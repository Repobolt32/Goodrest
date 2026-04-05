import { test, expect } from '@playwright/test';

test.describe('Order Tracking Refactor Verification', () => {
  const ADMIN_PASSWORD = 'goodrest88';
  const UNIQUE_ID = Math.random().toString(36).substring(7);
  const UNIQUE_CUSTOMER_NAME = `Tracker_Refactor_${UNIQUE_ID}`;
  const UNIQUE_PHONE = `99${Math.floor(Math.random() * 89999999 + 10000000)}`;

  test('should correctly navigate the new 2-button admin flow and 4-stage tracking', async ({ browser }) => {
    test.setTimeout(60000); // Increase timeout to 60s
    // 1. Setup Admin Context (The Controller)
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    
    // Login Admin
    await adminPage.goto('/admin/login');
    await adminPage.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
    await adminPage.getByRole('button', { name: /Unlock Dashboard/ }).click();
    await adminPage.waitForURL(/\/admin\/orders/);
    await adminPage.waitForLoadState('networkidle');

    // 2. Setup Customer Context (The Actor)
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await customerPage.goto('/');
    await customerPage.waitForLoadState('networkidle');
    
    // Login Customer & Place Order
    await customerPage.goto(`${process.env.NEXT_PUBLIC_APP_URL}/menu`);
    const burgerCard = customerPage.locator('.bento-card', { hasText: 'Classic Truffle Burger' });
    await burgerCard.getByRole('button', { name: /Add/i }).first().click();
    await customerPage.goto(`${process.env.NEXT_PUBLIC_APP_URL}/checkout`);
    
    // Hardened form input selectors (using exact placeholders as in CheckoutForm.tsx)
    await customerPage.getByPlaceholder('John Doe').fill(UNIQUE_CUSTOMER_NAME);
    await customerPage.getByPlaceholder(/Address/i).fill('123 Playwright St, Automation City');
    await customerPage.getByPlaceholder('9876543210').fill(UNIQUE_PHONE);
    await customerPage.getByRole('button', { name: /Place Order/i }).click();

    // Success -> Redirect
    await customerPage.waitForURL(/\/checkout\/success/);
    console.log('Order placed successfully. Waiting for propagation...');
    await customerPage.waitForTimeout(5000); // Wait for DB/Realtime stabilization
 
    // 3. Admin: Transition to PREPARING (Confirm order exists)
    // Fallback: If realtime sync fails after 10s, reload the page
    try {
      await expect(adminPage.getByText(UNIQUE_CUSTOMER_NAME)).toBeVisible({ timeout: 15000 });
    } catch (e) {
      console.log('Realtime sync might be delayed, reloading admin page...');
      await adminPage.reload();
      await expect(adminPage.getByText(UNIQUE_CUSTOMER_NAME)).toBeVisible({ timeout: 20000 });
    }
    
    const adminOrderCard = adminPage.locator('div').filter({ hasText: UNIQUE_CUSTOMER_NAME }).first();
    await adminOrderCard.getByRole('button', { name: /PREPARING/i }).click();

    // 4. Customer Tracking: Log in and verify initial status
    await customerPage.getByRole('link', { name: /Track Your Order/i }).click();
    await customerPage.waitForURL(/\/track/);
    await customerPage.getByPlaceholder(/9876543210/i).fill(UNIQUE_PHONE);
    await customerPage.getByRole('button', { name: /Continue to Tracking/i }).click();
    
    // Find our order (Status should now be PREPARING)
    const newOrderLink = customerPage.locator('a').filter({ hasText: /PREPARING/i }).first(); 
    await newOrderLink.click();
    
    // Verify status update (Cooking because admin already clicked PREPARING)
    await expect(customerPage.getByText(/COOKING YOUR MEAL/i)).toBeVisible({ timeout: 20000 });
    await expect(customerPage.getByText('Our chefs are working their magic')).toBeVisible();

    // 6. Admin: Transition to DISPATCH
    await adminOrderCard.getByRole('button', { name: /DISPATCH/i }).click();

    // 7. Customer Tracking: Verify Real-time update to On the Way + Hint
    await expect(customerPage.getByText('ON THE WAY')).toBeVisible({ timeout: 20000 });
    await expect(customerPage.getByText('Waiting for delivery confirmation...')).toBeVisible();

    // 8. Admin: Verify move to Dispatched section
    const dispatchedSection = adminPage.getByText('DISPATCHED TODAY');
    await expect(dispatchedSection).toBeVisible();
    const dispatchedOrder = adminPage.locator('div').filter({ hasText: 'DISPATCHED TODAY' }).filter({ hasText: UNIQUE_CUSTOMER_NAME }).first();
    await expect(dispatchedOrder).toBeVisible();
    await expect(dispatchedOrder.getByRole('button', { name: 'MARK DELIVERED' })).toBeVisible();

    // Cleanup
    await adminContext.close();
    await customerContext.close();
  });
});
