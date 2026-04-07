import { test, expect } from '@playwright/test';
import type { RazorpayPaymentCallback } from '@/types/payment';

interface MockRazorpayOptions {
  order_id: string;
  handler: (response: RazorpayPaymentCallback) => void | Promise<void>;
}

interface MockRazorpayInstance {
  open: () => void;
  on: () => void;
}

test.describe('Order Tracking Refactor Verification', () => {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goodrest88';
  const UNIQUE_ID = Math.random().toString(36).substring(7);
  const UNIQUE_CUSTOMER_NAME = `Tracker_Refactor_${UNIQUE_ID}`;
  const UNIQUE_PHONE = `99${Math.floor(Math.random() * 89999999 + 10000000)}`;

  test('should correctly navigate the new 2-button admin flow and 4-stage tracking', async ({ browser }) => {
    test.setTimeout(90000); // Increase timeout to 90s for local Turbopack stress
    // 1. Setup Admin Context (The Controller)
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    
    // Login Admin
    await adminPage.goto('/admin/login', { waitUntil: 'networkidle' });
    const passwordInput = adminPage.getByPlaceholder('••••••••');
    await passwordInput.waitFor({ state: 'visible' });
    await passwordInput.fill(ADMIN_PASSWORD);
    
    const loginButton = adminPage.getByRole('button', { name: /Unlock Dashboard/ });
    await loginButton.click();
    
    // Harden: Retry login transition once when dev server/HMR delays redirect.
    try {
      await expect(adminPage).toHaveURL(/\/admin\/orders/, { timeout: 15000 });
    } catch {
      await passwordInput.fill(ADMIN_PASSWORD);
      await loginButton.click();
      await expect(adminPage).toHaveURL(/\/admin\/orders/, { timeout: 60000 });
    }
    await expect(adminPage.getByRole('heading', { name: /Live Orders/i })).toBeVisible({ timeout: 20000 });
    await adminPage.waitForLoadState('networkidle');

    // 2. Setup Customer Context (The Actor)
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await customerPage.goto('/');
    await customerPage.waitForLoadState('networkidle');
    
    // Login Customer & Place Order
    await customerPage.goto('/');
    
    // Ensure 'All' is selected to find the dish
    await customerPage.getByRole('button', { name: 'All' }).click();
    
    const paneerCard = customerPage.locator('div').filter({ hasText: 'Shahi Paneer' }).first();
    await paneerCard.getByRole('button', { name: /Add/i }).first().click();
    
    await customerPage.waitForTimeout(1000);
    await customerPage.getByText('Checkout').click();
    
    // Hardened form input selectors (using exact placeholders as in CheckoutForm.tsx)
    await customerPage.getByPlaceholder('John Doe').fill(UNIQUE_CUSTOMER_NAME);
    await customerPage.getByPlaceholder(/Address/i).fill('123 Playwright St, Automation City');
    await customerPage.getByPlaceholder('9876543210').fill(UNIQUE_PHONE);

    // 2.5 Mock Razorpay and Submit
    await customerPage.evaluate(() => {
      const mockHandler = (options: MockRazorpayOptions): MockRazorpayInstance => {
        return {
          open: () => {
            options.handler({
              razorpay_payment_id: 'pay_test_tracker',
              razorpay_order_id: options.order_id,
              razorpay_signature: 'sig_test_tracker'
            });
          },
          on: () => {}
        };
      };

      Object.defineProperty(window, 'Razorpay', {
        value: function(this: MockRazorpayInstance, options: MockRazorpayOptions) {
          return mockHandler(options);
        },
        writable: false,
        configurable: true
      });
    });

    const payOrderButton = customerPage.getByRole('button', { name: /Pay & Order/i });
    await payOrderButton.click();

    // Success -> Redirect
    await expect(customerPage).toHaveURL(/\/checkout\/success/, { timeout: 30000 });
    await customerPage.waitForLoadState('networkidle');
    console.log('Order placed successfully. Waiting for propagation...');
    await customerPage.waitForTimeout(5000); // Wait for DB/Realtime stabilization
 
    // 3. Admin: Transition to PREPARING (Confirm order exists)
    // Fallback: If realtime sync fails after 10s, reload the page
    try {
      await expect(adminPage.getByText(UNIQUE_CUSTOMER_NAME)).toBeVisible({ timeout: 15000 });
    } catch {
      console.log('Realtime sync might be delayed, reloading admin page...');
      await adminPage.reload();
      await expect(adminPage.getByText(UNIQUE_CUSTOMER_NAME)).toBeVisible({ timeout: 20000 });
    }
    
    const adminOrderCard = adminPage.locator('div.glass-card').filter({ hasText: UNIQUE_CUSTOMER_NAME }).first();
    await adminOrderCard.getByRole('button', { name: /Start Cooking/i }).click();

    // 4. Customer Tracking: Log in and verify initial status
    await customerPage.getByRole('link', { name: /Track Your Order/i }).click();
    await expect(customerPage).toHaveURL(/\/track/);
    await customerPage.getByPlaceholder(/Phone Number/i).fill(UNIQUE_PHONE);
    await customerPage.getByRole('button', { name: /Continue to Tracking/i }).click();
    await customerPage.waitForLoadState('networkidle');
    
    // Find our order (Status should now be PREPARING)
    // Harden: If the list page is stale, poll for the PREPARING link
    await expect(customerPage.locator('a').filter({ hasText: /PREPARING/i }).first()).toBeVisible({ timeout: 15000 });
    const newOrderLink = customerPage.locator('a').filter({ hasText: /PREPARING/i }).first(); 
    await newOrderLink.click();
    
    // Verify status update (Cooking because admin already clicked Start Cooking)
    // Harden: If we hit a 404 page ("Order Not Found"), reload once
    try {
      await expect(customerPage.getByTestId('order-status-heading')).toBeVisible({ timeout: 10000 });
    } catch {
      console.log('Order Details page 404 or slow load, reloading...');
      await customerPage.reload();
      await expect(customerPage.getByTestId('order-status-heading')).toBeVisible({ timeout: 15000 });
    }
    await expect(customerPage.getByTestId('tracker-step-preparing')).toHaveAttribute('data-step-status', 'current');
    await expect(customerPage.getByText('Our chefs are working their magic')).toBeVisible();

    // 6. Admin: Transition to DISPATCH
    console.log('TRANSITIONING_TO_DISPATCH...');
    await adminPage.waitForTimeout(2000); // Wait for optimistic UI to settle
    await adminOrderCard.getByRole('button', { name: /Dispatch Order/i }).click();
    console.log('ADMIN_CLICKED_DISPATCH');

    // 7. Customer Tracking: Verify Real-time update to On the Way + Hint
    console.log('WAITING_FOR_DELIVERY_STATUS');
    try {
      await expect(customerPage.getByTestId('order-status-heading')).toHaveText(/out for delivery/i, { timeout: 25000 });
    } catch {
      console.log('Delivery update slow, reloading customer page...');
      await customerPage.reload();
      await expect(customerPage.getByTestId('order-status-heading')).toHaveText(/out for delivery/i, { timeout: 15000 });
    }
    await expect(customerPage.getByTestId('tracker-step-out_for_delivery')).toHaveAttribute('data-step-status', 'current');
    
    // Durable check for the 'Rider is arriving shortly...' hint in the next step
    // status is 'out_for_delivery', so the 'delivered' step should show the hint
    await expect(customerPage.getByTestId('tracker-step-delivered')).toContainText(/Rider is arriving shortly/i);

    // 8. Admin: Transition to DELIVERED
    console.log('TRANSITIONING_TO_DELIVERED...');
    await adminPage.waitForTimeout(2000); // Settle
    await adminOrderCard.getByRole('button', { name: /Mark Delivered/i }).click();
    console.log('ADMIN_CLICKED_DELIVERED');

    // 9. Customer: Final verification
    console.log('WAITING_FOR_FINAL_DELIVERY');
    try {
      await expect(customerPage.getByTestId('order-status-heading')).toHaveText(/delivered/i, { timeout: 25000 });
    } catch {
      console.log('Final delivery update slow, reloading customer page...');
      await customerPage.reload();
      await expect(customerPage.getByTestId('order-status-heading')).toHaveText(/delivered/i, { timeout: 15000 });
    }
    await expect(customerPage.getByTestId('tracker-step-delivered')).toHaveAttribute('data-step-status', 'current');
    
    console.log('STABILIZATION_FLOW_COMPLETE');

    // Cleanup
    await adminContext.close();
    await customerContext.close();
  });
});
