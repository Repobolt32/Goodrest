import { test, expect } from '@playwright/test';

test.describe('Admin Management Flow', () => {
  const ADMIN_PASSWORD = 'goodrest88';

  test('should allow an admin to login, manage orders, and toggle menu items', async ({ page }) => {
    // 1. Reach orders page (login only if needed)
    await page.goto('/admin/orders');
    if (page.url().includes('/admin/login')) {
      await page.waitForLoadState('networkidle');
      await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
      await page.getByRole('button', { name: /Unlock Dashboard/ }).click();
      await expect(page).toHaveURL(/\/admin\/orders/, { timeout: 20000 });
    }
    // 2. Verify landing on orders page
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Live Orders/i)).toBeVisible({ timeout: 10000 });

    // 3. Update an order status
    const preparingButton = page.getByRole('button', { name: /Preparing/ }).first();
    // Wait for real-time orders to load
    await preparingButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
    
    if (await preparingButton.isVisible()) {
      await preparingButton.click();
      await page.waitForTimeout(1000); // Allow real-time sync
      await expect(preparingButton).toHaveClass(/bg-yellow-50/);
    }

    // 4. Navigate to Menu Editor
    await page.getByRole('link', { name: /Menu Editor/ }).click();
    await expect(page).toHaveURL(/\/admin\/menu/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Menu Management/i)).toBeVisible();

    // 5. Toggle an item accessibility
    // Use a specific selector for the eye/eye-off toggle button
    const toggleButton = page.locator('button:has(svg.lucide-eye), button:has(svg.lucide-eye-off)').first();
    await toggleButton.click();
    
    // 6. Verification: check for 'Hidden' status badge with a generous timeout
    await expect(page.getByText('Hidden').first()).toBeVisible({ timeout: 15000 });

    // 7. Logout
    await page.getByRole('button', { name: /Log Out/ }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
