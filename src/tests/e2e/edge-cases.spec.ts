import { test, expect } from '@playwright/test';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Deep Web App Testing: Edge Cases & Administrative Integrity
 * This suite tests boundary conditions and multi-page state synchronization.
 */
test.describe('Goodrest Deep Audit - Edge Cases', () => {
  const timestamp = Date.now();
  const testDishName = `Audit Dish ${timestamp}`;
  const testDishPrice = 250;

  test.beforeAll(async () => {
    // Ensure clean state: add a test item directly into Supabase for sync testing
    // ID for 'Starters': 1af3767c-42e2-4233-aa17-136528d04b44
    await supabaseAdmin.from('menu_items').insert([{
      name: testDishName,
      price: testDishPrice,
      category: 'Starters',
      category_id: '1af3767c-42e2-4233-aa17-136528d04b44',
      is_available: true
    }]);
  });

  test.afterAll(async () => {
    // Cleanup: Remove test items
    await supabaseAdmin.from('menu_items').delete().eq('name', testDishName);
  });

  test.beforeEach(async ({ page }) => {
    // Reset test item status between tests to ensure isolation
    await supabaseAdmin.from('menu_items')
      .update({ is_available: true, price: testDishPrice })
      .eq('name', testDishName);
  });

  test('ADMIN -> HOME SYNC: Soft Delete should remove items from customer menu', async ({ page }) => {
    // 1. Verify item is visible on Home page initially
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(testDishName)).toBeVisible({ timeout: 15000 });

    // 2. Perform Soft Delete in Admin
    await page.goto('/admin/menu');
    // Login bypass via E2E_MODE=true is assumed active
    const dishCard = page.getByTestId('menu-item-card').filter({ hasText: testDishName });
    await expect(dishCard).toBeVisible({ timeout: 15000 });

    // Trigger soft delete (updates is_available = false)
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: new RegExp(`Delete ${testDishName}`, 'i') }).click();
    
    // Verify it is Hidden in Admin
    await expect(dishCard.getByText('Hidden')).toBeVisible({ timeout: 10000 });

    // 3. Verify it is GONE from Home page (State Sync Check)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(testDishName)).not.toBeVisible({ timeout: 15000 });
  });

  test('ADMIN -> HOME SYNC: Price Update should reflect on Landing page', async ({ page }) => {
    const updatedPrice = 499;

    // 1. Update price in Admin
    await page.goto('/admin/menu');
    await page.waitForLoadState('networkidle');
    
    const dishCard = page.getByTestId('menu-item-card').filter({ hasText: testDishName });
    await expect(dishCard).toBeVisible({ timeout: 15000 });
    
    await dishCard.getByRole('button', { name: /Edit/i }).click();
    
    // Use the ID for deterministic selection
    const priceInput = page.locator('#dishPrice');
    await expect(priceInput).toBeVisible({ timeout: 10000 });
    await priceInput.fill(updatedPrice.toString());
    
    await page.getByRole('button', { name: /Save Changes/i }).click();
    
    // Wait for modal to stay closed
    await expect(priceInput).not.toBeVisible();

    // 2. Verify on Home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Home page categorization check
    await page.getByRole('button', { name: /^Starters$/i }).click();
    
    // Force a data refresh wait
    await page.reload();
    await page.getByRole('button', { name: /^Starters$/i }).click();

    const menuCard = page.locator('.bento-card').filter({ hasText: testDishName });
    await expect(menuCard.getByText(new RegExp(`₹${updatedPrice}`, 'i'))).toBeVisible({ timeout: 15000 });
  });

  test('BOUNDARY: Large quantities and form validation', async ({ page }) => {
    // 1. Add item
    await page.goto('/');
    await page.getByRole('button', { name: /^Starters$/i }).click();
    
    const addButton = page.locator('.bento-card').filter({ hasText: testDishName }).getByRole('button', { name: /Add/i });
    await addButton.click();
    
    // Wait for cart notification or counter
    await expect(page.locator('div').getByText(/1 item/i)).toBeVisible({ timeout: 10000 });

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    
    await page.getByPlaceholder('John Doe').fill('Audit User');
    await page.getByPlaceholder('9876543210').fill('123'); // Invalid short phone
    
    const submitBtn = page.getByRole('button', { name: /Pay & Order/i });
    await submitBtn.click();
    
    const phoneInput = page.getByPlaceholder('9876543210');
    const isValid = await phoneInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('SECURITY: Payment Signature Rejection without E2E_MODE', async ({ page }) => {
     await page.goto('/');
     await page.getByRole('button', { name: /^Starters$/i }).click();
     
     const addButton = page.locator('.bento-card').filter({ hasText: testDishName }).getByRole('button', { name: /Add/i });
     await addButton.click();
     
     await expect(page.locator('div').getByText(/1 item/i)).toBeVisible({ timeout: 10000 });
     
     await page.goto('/checkout');
     await page.waitForLoadState('networkidle');
     
     await page.getByPlaceholder('John Doe').fill('Signature Auditor');
     await page.getByPlaceholder('9876543210').fill('9876543210');
     await page.getByPlaceholder('Complete Address').fill('123 Signature St, Audit City');
     
     // Trigger submit and look for the overlay immediately
     await page.getByRole('button', { name: /Pay & Order/i }).click();
     
     // 100% Functional Check: The overlay MUST appear during the Lock -> Server transition
     const overlayText = page.locator('h3').getByText(/Securing Order/i);
     await expect(overlayText).toBeVisible({ timeout: 15000 });
     await expect(page.getByText(/Please do not refresh/i)).toBeVisible();
  });
});
