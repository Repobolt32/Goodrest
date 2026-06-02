import { test, expect } from '@playwright/test';

test.describe('Application Route Audit', () => {
  const routes = [
    { path: '/', name: 'Home' },
    { path: '/admin/login', name: 'Admin Login' },
    { path: '/track', name: 'Track Order' },
  ];

  for (const route of routes) {
    test(`should visit ${route.name} (${route.path})`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      
      // Basic accessibility check: ensure page title or a key heading is present
      if (route.path === '/') {
        await expect(page).toHaveTitle(/Goodrest/i);
      } else {
        await expect(page.locator('h1, h2')).toHaveCount(Math.max(1, 0), { timeout: 5000 });
      }
    });
  }

  test('should verify API Webhook endpoint exists', async ({ request }) => {
    // Webhook should return 400 or 401/403 if missing signature, but 404 would mean it's missing
    const response = await request.post('/api/webhook/razorpay');
    expect(response.status()).not.toBe(404);
  });
});
