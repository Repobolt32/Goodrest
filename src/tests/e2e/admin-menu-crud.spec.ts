import { test, expect } from '@playwright/test';

test.describe('Admin Menu CRUD Flow', () => {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goodrest88';
  const timestamp = Date.now();
  const dishName = `Test Dish ${timestamp}`;
  const updatedDishName = `Updated Dish ${timestamp}`;
  const dishPrice = '99.99';
  const updatedPrice = '149.99';
  const dishCategory = 'Desserts';
  const imageUrl = 'https://picsum.photos/200';

  test.beforeEach(async ({ page }) => {
    // Reach Menu page, login only if needed
    await page.goto('/admin/menu');
    if (page.url().includes('/admin/login')) {
      await page.waitForLoadState('networkidle');
      await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
      await page.getByRole('button', { name: /Unlock Dashboard/ }).click();
      // Middleware may redirect via orders first, then menu
      await expect(page).toHaveURL(/\/admin\/orders/, { timeout: 20000 });
      await page.getByRole('link', { name: /Menu Editor/ }).click();
      await expect(page).toHaveURL(/\/admin\/menu/, { timeout: 20000 });
    }
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Menu Management/i)).toBeVisible({ timeout: 10000 });
  });

  test('should perform full CRUD operations on a dish', async ({ page }) => {
    // 1. ADD DISH
    await page.getByRole('button', { name: /Add New Dish/i }).click();
    
    // Wait for modal and use labels (now that we've added htmlFor)
    await page.getByLabel(/Dish Name/i).fill(dishName);
    await page.getByLabel(/Price/i).fill(dishPrice);
    await page.getByLabel(/Category/i).selectOption(dishCategory);
    await page.getByLabel(/Image URL/i).fill(imageUrl);
    
    await page.getByRole('button', { name: /Create Dish/i }).click();
    
    // Verify Add
    const dishCard = page.getByTestId('menu-item-card').filter({ hasText: dishName });
    await expect(dishCard).toBeVisible({ timeout: 15000 });
    await expect(dishCard.getByText(new RegExp(`Rs\\s*${dishPrice.replace('.', '\\.')}`, 'i'))).toBeVisible();

    // 2. EDIT DISH
    // Use aria-label for robust selection
    await page.getByRole('button', { name: new RegExp(`Edit ${dishName}`, 'i') }).click();
    
    // Update name and price using labels
    await page.getByLabel(/Dish Name/i).fill(updatedDishName);
    await page.getByLabel(/Price/i).fill(updatedPrice);
    
    await page.getByRole('button', { name: /Save Changes/i }).click();
    
    // Verify Edit
    const updatedDishCard = page.getByTestId('menu-item-card').filter({ hasText: updatedDishName });
    await expect(updatedDishCard).toBeVisible({ timeout: 15000 });
    await expect(updatedDishCard.getByText(new RegExp(`Rs\\s*${updatedPrice.replace('.', '\\.')}`, 'i'))).toBeVisible();

    // 3. SOFT DELETE DISH
    // Use aria-label for Delete button
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: new RegExp(`Delete ${updatedDishName}`, 'i') }).click();
    
    // Verify Soft Delete (Available checkbox becomes unchecked, or status becomes Hidden)
    // In our UI, soft delete sets is_available to false.
    await expect(updatedDishCard.getByText('Hidden')).toBeVisible({ timeout: 10000 });
  });
});
