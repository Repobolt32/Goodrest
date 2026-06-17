import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const JWT_SECRET = process.env.JWT_SECRET || 'placeholder-jwt-secret-key-at-least-32-chars-long';

const TEST_PREFIX = 'E2E_SETTLE';
const TEST_RIDER_PHONE = `9998${Date.now().toString().slice(-6)}`;

let testRiderId: string;

async function signAdminJWT(): Promise<string> {
  const encoder = new globalThis.TextEncoder();
  const secret = encoder.encode(JWT_SECRET);
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);
}

test.beforeAll(async () => {
  const hashedPassword = await (await import('bcryptjs')).default.hash('testpass', 10);
  const { data: rider, error } = await supabase
    .from('riders')
    .insert({
      name: `${TEST_PREFIX}_Rider`,
      phone: TEST_RIDER_PHONE,
      username: `${TEST_PREFIX}_user`,
      password_hash: hashedPassword,
      is_active: true,
      is_online: false,
    })
    .select()
    .single();

  if (error || !rider) throw new Error(`Failed to create test rider: ${error?.message}`);
  testRiderId = rider.id;

  // Seed test orders for the current week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(10, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const deliveredAt = new Date(weekStart);
    deliveredAt.setDate(weekStart.getDate() + Math.floor(i / 4));
    deliveredAt.setHours(10 + i, 0, 0, 0);

    await supabase.from('orders').insert({
      customer_name: `${TEST_PREFIX}_Customer_${i}`,
      customer_phone: '9000000000',
      delivery_address: 'Test Address',
      payment_method: 'cod',
      total_amount: 200,
      order_status: 'delivered',
      rider_id: testRiderId,
      rider_earning: 41,
      distance_km: 2.0,
      delivered_at: deliveredAt.toISOString(),
    });
  }
});

test.afterAll(async () => {
  // Cleanup test orders
  if (testRiderId) {
    await supabase
      .from('orders')
      .delete()
      .eq('rider_id', testRiderId);
  }
  // Cleanup test rider
  if (testRiderId) {
    await supabase.from('riders').delete().eq('id', testRiderId);
  }
});

test.describe('Settlement Feature', () => {
  test('should render admin orders page with RiderPayoutsPanel', async ({ page }) => {
    const adminToken = await signAdminJWT();
    await page.context().addCookies([
      { name: 'admin_session', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    ]);

    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto('/admin/orders');
    expect(response?.status()).toBe(200);

    // Wait for the page to hydrate
    await page.waitForTimeout(2000);

    // Check that RiderPayoutsPanel renders (shows heading or empty state)
    const hasPayoutsSection = await page.locator('text=Rider Payouts').or(page.locator('text=No rider payouts')).count();
    expect(hasPayoutsSection).toBeGreaterThan(0);

    // No critical JS errors (filter pre-existing CSP/Razorpay noise)
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('hydrat') &&
      !e.includes('ResizeObserver') &&
      !e.includes('favicon') &&
      !e.includes('supabase') &&
      !e.includes('razorpay') &&
      !e.includes('Content Security Policy') &&
      !e.includes('checkout.js')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('should render settlements page', async ({ page }) => {
    const adminToken = await signAdminJWT();
    await page.context().addCookies([
      { name: 'admin_session', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    ]);

    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto('/admin/settlements');
    expect(response?.status()).toBe(200);

    await page.waitForTimeout(2000);

    // Check heading renders
    await expect(page.locator('h1')).toContainText('Rider Settlements');

    // No critical JS errors (filter pre-existing CSP/Razorpay noise)
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('hydrat') &&
      !e.includes('ResizeObserver') &&
      !e.includes('favicon') &&
      !e.includes('supabase') &&
      !e.includes('razorpay') &&
      !e.includes('Content Security Policy') &&
      !e.includes('checkout.js')
    );
    expect(criticalErrors).toEqual([]);
  });
});
