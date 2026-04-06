import { test, expect } from '@playwright/test';
import type { RazorpayPaymentCallback } from '@/types/payment';

interface MockRazorpayArgs {
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface MockRazorpayOptions {
  order_id: string;
  handler: (response: RazorpayPaymentCallback) => void | Promise<void>;
}

interface MockRazorpayInstance {
  on: (event: string) => void;
  open: () => void;
}

test.describe('Customer Ordering Flow', () => {
  test('should allow a customer to browse, add items, and checkout successfully', async ({ page }) => {
    // 1. Visit the home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify logo is present
    await expect(page.getByText('Goodrest', { exact: false })).toBeVisible();

    // 2. Add an item to the cart
    const addButton = page.getByRole('button', { name: 'Add' }).first();
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
    
    // Wait for cart animation/state update
    await page.waitForTimeout(1000);

    // 3. Go to checkout (direct navigation to avoid SPA timing issues)
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/checkout/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    // 5. Fill out the checkout form
    await page.getByPlaceholder('John Doe').fill('E2E Test User');
    await page.getByPlaceholder('9876543210').fill('1234567890');
    await page.getByPlaceholder(/Complete Address/i).fill('123 Test Street, Playwright City, 99999');

    // 6. Mock Razorpay and Submit (Hardened against script overwrite)
    const mockData = {
      razorpay_payment_id: 'pay_test_flow',
      razorpay_signature: 'sig_test_flow'
    };

    await page.evaluate((args: MockRazorpayArgs) => {
      Object.defineProperty(window, 'Razorpay', {
        value: function(this: MockRazorpayInstance, options: MockRazorpayOptions) {
          this.on = (event: string) => {
            console.log(`[E2E] Razorpay.on(${event}) called`);
          };
          this.open = () => {
            console.log('[E2E] Hardened Razorpay Mock: intercepting open()');
            options.handler({
              razorpay_payment_id: args.razorpay_payment_id,
              razorpay_order_id: options.order_id,
              razorpay_signature: args.razorpay_signature
            });
          };
        },
        configurable: true,
        writable: false
      });
    }, mockData);

    const payOrderButton = page.getByRole('button', { name: /Pay & Order/ });
    await expect(payOrderButton).toBeEnabled();
    await payOrderButton.click();

    // 7. Verify success page
    await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible();
    await expect(page.getByText(/Thank you/i)).toBeVisible();
  });
});
