import { test, expect } from '@playwright/test';

test.describe('Customer Ordering Flow', () => {
  test('should allow a customer to browse, add items, and checkout successfully', async ({ page }) => {
    // 1. Visit the home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify logo is present
    await expect(page.getByText('Goodrest', { exact: false })).toBeVisible();

    // 2. Add an item to the cart
    // We'll click the first "Add" button we find
    const addButton = page.getByRole('button', { name: 'Add' }).first();
    await addButton.click();
    
    // Wait for cart animation/state update
    await page.waitForTimeout(1000);

    // 3. Verify floating cart appears
    const checkoutButton = page.getByText('Checkout');
    await expect(checkoutButton).toBeVisible({ timeout: 10000 });

    // 4. Go to checkout
    await checkoutButton.click();
    await page.waitForURL(/\/checkout/);
    await page.waitForLoadState('networkidle');

    // 5. Fill out the checkout form
    await page.getByPlaceholder('John Doe').fill('E2E Test User');
    await page.getByPlaceholder('9876543210').fill('1234567890');
    await page.getByPlaceholder('Complete Address').fill('123 Test Street, Playwright City, 99999');

    // Select Cash on Delivery (it's default, but let's be explicit)
    await page.getByRole('button', { name: 'Cash' }).click();

    // 6. Submit the order
    const placeOrderButton = page.getByRole('button', { name: /Place Order/ });
    await placeOrderButton.click();

    // 7. Verify success page
    // Increased timeout for database insertion and redirect
    await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 15000 });
    await expect(page.getByText(/Order Placed/i)).toBeVisible();
    await expect(page.getByText(/Thank you/i)).toBeVisible();
  });
});
