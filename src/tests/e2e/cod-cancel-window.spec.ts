import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'placeholder-jwt-secret-key-at-least-32-chars-long';

async function signAdminJWT(): Promise<string> {
  const encoder = new globalThis.TextEncoder();
  const secret = encoder.encode(JWT_SECRET);
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

let testOrderId: string | null = null;

async function cleanupTestData() {
  if (testOrderId) {
    await supabase.from('order_items').delete().eq('order_id', testOrderId);
    await supabase.from('orders').delete().eq('id', testOrderId);
    testOrderId = null;
  }
}

test.afterEach(async () => {
  await cleanupTestData();
});

async function mockGeolocation(page: Page) {
  await page.evaluate(() => {
    const mockPosition = {
      coords: {
        latitude: 24.7975,
        longitude: 85.01,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
    navigator.geolocation.getCurrentPosition = (success) => {
      success(mockPosition as GeolocationPosition);
    };
    navigator.geolocation.watchPosition = (success) => {
      success(mockPosition as GeolocationPosition);
      return 1;
    };
    navigator.geolocation.clearWatch = () => {};
  });
}

async function placeCODOrder(page: Page, context: { grantPermissions: (permissions: string[]) => Promise<void> }): Promise<string> {
  const customerPhone = `98${Date.now().toString().slice(-8)}`;

  await page.goto('/');
  await page.waitForSelector('button[aria-label^="Add"]', { timeout: 15000 });
  await page.locator('button[aria-label^="Add"]').first().click();

  await page.waitForSelector('a[href="/checkout"]', { timeout: 10000 });
  await page.click('a[href="/checkout"]');
  await page.waitForURL('/checkout', { timeout: 10000 });

  await page.fill('#customer-name', 'E2E Cancel Window');
  await page.fill('#customer-phone', customerPhone);
  await page.fill('#delivery-address', '456 Cancel Road, Test City');

  await context.grantPermissions(['geolocation']);
  await mockGeolocation(page);
  await page.click('button:has-text("Detect Location")');

  await expect.poll(async () => {
    const status = page.locator('p.text-xs.font-bold.mt-2');
    const text = (await status.textContent().catch(() => '')) || '';
    return text.includes('✅') || text.includes('📍') || text.includes('Verified');
  }, { timeout: 15000, intervals: [500] }).toBe(true);

  await page.click('button:has-text("Cash on Delivery")');
  await page.waitForURL(/\/checkout\/success/, { timeout: 20000 });

  const url = new URL(page.url());
  const orderId = url.searchParams.get('order_id') || '';
  expect(orderId.length).toBeGreaterThan(0);
  return orderId;
}

test.describe('COD Cancel Window', () => {
  test('customer can cancel order within the grace window', async ({ page, context }) => {
    test.setTimeout(60000);
    testOrderId = await placeCODOrder(page, context);

    // Navigate to tracking page
    await page.goto(`/track/order/${testOrderId}`);
    await page.waitForSelector('[data-testid="order-status-heading"]', { timeout: 15000 });

    // Verify cancel button is visible
    await expect(page.locator('button:has-text("Cancel Order")')).toBeVisible({ timeout: 10000 });

    // Click cancel and confirm
    await page.click('button:has-text("Cancel Order")');
    await page.waitForSelector('button:has-text("Yes, Cancel Order")', { timeout: 5000 });
    await page.click('button:has-text("Yes, Cancel Order")');

    // Verify cancelled state appears
    await page.waitForSelector('text=ORDER CANCELLED', { timeout: 15000 });
    await expect(page.locator('[data-testid="order-status-heading"]')).toContainText('cancelled');

    // Verify help form is shown for cancelled orders
    await expect(page.locator('text=Need Help? Tell us what happened:')).toBeVisible();
  });

  test('after grace window expires customer sees call-restaurant fallback', async ({ page, context }) => {
    test.setTimeout(60000);
    testOrderId = await placeCODOrder(page, context);

    // Manually expire the grace window by backdating created_at in DB
    const expiredCreatedAt = new Date(Date.now() - 35000).toISOString();
    await supabase
      .from('orders')
      .update({ created_at: expiredCreatedAt })
      .eq('id', testOrderId);

    // Navigate to tracking page
    await page.goto(`/track/order/${testOrderId}`);
    await page.waitForSelector('[data-testid="order-status-heading"]', { timeout: 15000 });

    // Cancel Order button should NOT be visible
    await expect(page.locator('button:has-text("Cancel Order")')).not.toBeVisible();

    // Call Restaurant fallback should be visible
    await expect(page.locator('a:has-text("Call Restaurant")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=The kitchen is actively preparing your order')).toBeVisible();
  });

  test('owner bell notification is delayed by the 30-second grace window', async ({ page, context }) => {
    test.setTimeout(90000);
    testOrderId = await placeCODOrder(page, context);

    // Login as Admin
    const adminToken = await signAdminJWT();
    await context.addCookies([
      { name: 'admin_session', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    ]);

    // Go to admin dashboard
    await page.goto('/admin/orders');
    await page.waitForSelector('text=Owner Dashboard', { timeout: 15000 });

    // Assert that the popup does NOT appear during the first 10s
    await page.waitForTimeout(10000);
    const popup = page.locator('[data-testid="new-order-popup"]');
    await expect(popup).not.toBeVisible();

    // Now wait up to 25s more (making total time >35s from order creation) and check it appears
    await expect(popup).toBeVisible({ timeout: 25000 });
  });
});
