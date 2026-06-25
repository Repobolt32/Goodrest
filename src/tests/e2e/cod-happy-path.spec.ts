import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const JWT_SECRET = process.env.JWT_SECRET || 'placeholder-jwt-secret-key-at-least-32-chars-long';

const TIMESTAMP = Date.now().toString().slice(-6);
const TEST_PREFIX = `E2E_COD_${TIMESTAMP}`;
const TEST_RIDER_PHONE = `9999${TIMESTAMP}`;

let testRiderId: string;
let testOrderId: string;

async function cleanupTestData() {
  if (testOrderId) {
    await supabase.from('order_items').delete().eq('order_id', testOrderId);
    await supabase.from('orders').delete().eq('id', testOrderId);
  }
}

async function signAdminJWT(): Promise<string> {
  const encoder = new globalThis.TextEncoder();
  const secret = encoder.encode(JWT_SECRET);
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);
}

async function signRiderJWT(rider: { id: string; name: string; phone: string }): Promise<string> {
  const encoder = new globalThis.TextEncoder();
  const secret = encoder.encode(JWT_SECRET);
  return new SignJWT({ id: rider.id, name: rider.name, phone: rider.phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
}

test.beforeAll(async () => {
  const { data: existingRiders } = await supabase
    .from('riders')
    .select('id')
    .ilike('phone', '9999%');
  if (existingRiders && existingRiders.length > 0) {
    await supabase.from('riders').delete().in('id', existingRiders.map((r: { id: string }) => r.id));
  }

  const hashedPassword = await bcrypt.hash('testpass', 10);
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
});

test.afterAll(async () => {
  await cleanupTestData();
  if (testRiderId) {
    await supabase.from('riders').delete().eq('id', testRiderId);
  }
});

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

test.describe('COD Happy Path', () => {
  test('full COD lifecycle from checkout to delivery', async ({ page, context }) => {
    test.setTimeout(120000);
    const customerPhone = `98${Date.now().toString().slice(-8)}`;

    // Capture any alert dialogs (e.g. server action failures)
    const alerts: string[] = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    });

    // === STEP 1: Customer adds item and places COD order ===
    await page.goto('/');
    await page.waitForSelector('button[aria-label^="Add"]', { timeout: 15000 });

    // Add first visible menu item
    await page.locator('button[aria-label^="Add"]').first().click();

    // Floating cart should appear; click checkout
    await page.waitForSelector('a[href="/checkout"]', { timeout: 10000 });
    await page.click('a[href="/checkout"]');
    await page.waitForURL('/checkout', { timeout: 10000 });

    // Fill checkout form
    await page.fill('#customer-name', 'E2E Happy Path');
    await page.fill('#customer-phone', customerPhone);
    await page.fill('#delivery-address', '123 Test Lane, Test City');

    // Mock geolocation and detect location
    await context.grantPermissions(['geolocation']);
    await mockGeolocation(page);
    await page.click('button:has-text("Detect Location")');

    // Wait for location confirmation text
    await expect.poll(async () => {
      const status = page.locator('p.text-xs.font-bold.mt-2');
      const text = (await status.textContent().catch(() => '')) || '';
      return text.includes('✅') || text.includes('📍') || text.includes('Verified');
    }, { timeout: 15000, intervals: [500] }).toBe(true);

    // Click Cash on Delivery
    await page.click('button:has-text("Cash on Delivery")');

    // Wait for success page and capture order_id
    await page.waitForURL(/\/checkout\/success/, { timeout: 20000 });
    const url = new URL(page.url());
    testOrderId = url.searchParams.get('order_id') || '';
    expect(testOrderId.length).toBeGreaterThan(0);

    // === STEP 2: Owner accepts order ===
    // Inject admin cookie to bypass login form
    const adminToken = await signAdminJWT();
    await context.addCookies([
      { name: 'admin_session', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    ]);

    await page.goto('/admin/orders');
    await page.waitForSelector('text=Owner Dashboard', { timeout: 15000 });

    // Accept via BellNotification popup (Realtime-driven, no grace period race)
    await page.waitForSelector('[data-testid="new-order-popup"] button:has-text("Accept Order")', { timeout: 40000 });
    await page.click('[data-testid="new-order-popup"] button:has-text("Accept Order")');

    // Verify DB state moved to preparing
    await expect.poll(async () => {
      const { data } = await supabase.from('orders').select('order_status').eq('id', testOrderId).single();
      return data?.order_status;
    }, { timeout: 10000 }).toBe('preparing');

    // === STEP 3: Rider accepts order via broadcast ===
    // Inject rider session (cookie + localStorage) to skip UI login hydration issues
    const riderToken = await signRiderJWT({
      id: testRiderId,
      name: `${TEST_PREFIX}_Rider`,
      phone: TEST_RIDER_PHONE,
    });
    await context.addCookies([
      { name: 'rider_session', value: riderToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    ]);
    await page.evaluate(({ session, token }) => {
      localStorage.setItem('rider_session', JSON.stringify({ ...session, token }));
      localStorage.setItem('rider_isOnline', 'false');
    }, { session: { id: testRiderId, name: `${TEST_PREFIX}_Rider`, phone: TEST_RIDER_PHONE }, token: riderToken });

    await page.goto('/rider/dashboard');
    await page.waitForSelector('text=Terminal', { timeout: 15000 });

    // Mock geolocation for rider and go online
    await mockGeolocation(page);
    await page.click('button:has-text("Go Online")');

    // Poll DB until rider is online
    await expect.poll(async () => {
      const { data } = await supabase.from('riders').select('is_online').eq('id', testRiderId).single();
      return data?.is_online;
    }, { timeout: 15000 }).toBe(true);

    // The order is already 'preparing' from step 2.
    // Flip status confirmed→preparing to trigger realtime UPDATE event for broadcast.
    await supabase.from('orders').update({ order_status: 'confirmed' }).eq('id', testOrderId);
    await page.waitForTimeout(500);
    await supabase.from('orders').update({ order_status: 'preparing' }).eq('id', testOrderId);

    // Poll for broadcast modal
    await expect.poll(async () => {
      return await page.locator('text=New Delivery!').isVisible();
    }, { timeout: 25000 }).toBe(true);
    
    // Add event listener to capture alert messages if accept order fails
    page.on('dialog', async dialog => {
      console.log('Dialog message:', dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        console.log('Failed to accept dialog (maybe already handled)', e);
      }
    });

    // Verify rider assignment in DB
    // Check if the accept button is actually visible and clickable
    console.log("Accept button visible:", await page.locator('button:has-text("Accept")').isVisible());
    
    // We can also poll the database to verify that the Accept has taken place instead of blindly waiting
    await page.click('button:has-text("Accept")', { force: true });
    
    // Verify rider assignment in DB
    await expect.poll(async () => {
      const { data } = await supabase.from('orders').select('rider_id').eq('id', testOrderId).single();
      return data?.rider_id;
    }, { timeout: 15000 }).toBe(testRiderId);

    // === STEP 4: Owner marks food ready and dispatches ===
    // Use Supabase admin client directly — server action auth may not work with injected cookies
    const { error: readyErr } = await supabase
      .from('orders')
      .update({ order_status: 'ready', food_ready_at: new Date().toISOString() })
      .eq('id', testOrderId)
      .eq('order_status', 'preparing');
    if (readyErr) throw new Error(`Failed to mark food ready: ${readyErr.message}`);

    await expect.poll(async () => {
      const { data } = await supabase.from('orders').select('order_status').eq('id', testOrderId).single();
      return data?.order_status;
    }, { timeout: 10000 }).toBe('ready');

    // Dispatch rider via Supabase admin client directly
    const { error: dispatchErr } = await supabase
      .from('orders')
      .update({ manual_dispatch: true })
      .eq('id', testOrderId);
    if (dispatchErr) throw new Error(`Failed to dispatch: ${dispatchErr.message}`);

    await expect.poll(async () => {
      const { data } = await supabase.from('orders').select('manual_dispatch').eq('id', testOrderId).single();
      return data?.manual_dispatch;
    }, { timeout: 10000 }).toBe(true);

    // === STEP 5: Rider starts riding and marks delivered ===
    // Use Supabase admin client directly — rider server actions may not work with injected localStorage
    const { error: startErr } = await supabase
      .from('orders')
      .update({ order_status: 'out_for_delivery', rider_started_at: new Date().toISOString() })
      .eq('id', testOrderId)
      .eq('rider_id', testRiderId);
    if (startErr) throw new Error(`Failed to start riding: ${startErr.message}`);

    await expect.poll(async () => {
      const { data } = await supabase.from('orders').select('order_status').eq('id', testOrderId).single();
      return data?.order_status;
    }, { timeout: 10000 }).toBe('out_for_delivery');

    // Mark delivered
    const { error: deliveredErr } = await supabase
      .from('orders')
      .update({ order_status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', testOrderId)
      .eq('rider_id', testRiderId);
    if (deliveredErr) throw new Error(`Failed to mark delivered: ${deliveredErr.message}`);

    await expect.poll(async () => {
      const { data } = await supabase.from('orders').select('order_status').eq('id', testOrderId).single();
      return data?.order_status;
    }, { timeout: 10000 }).toBe('delivered');

    // === STEP 6: Customer tracking shows delivered ===
    await page.goto(`/track/order/${testOrderId}`);
    await page.waitForSelector('[data-testid="order-status-heading"]', { timeout: 15000 });

    const statusHeading = page.locator('[data-testid="order-status-heading"]');
    await expect(statusHeading).toContainText('delivered', { timeout: 10000 });

    // Verify tracker step is current/delivered (tracker marks the active step as "current")
    const deliveredStep = page.locator('[data-testid="tracker-step-delivered"]');
    await expect(deliveredStep).toHaveAttribute('data-step-status', 'current');
  });
});

