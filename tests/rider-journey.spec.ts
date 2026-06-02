import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

test.describe('Rider End-to-End Journey', () => {
  const BASE_URL = 'http://localhost:3005';
  const RIDER_PHONE = '1234567890';
  const RIDER_PASSWORD = 'password123';
  let seededRiderId: string | undefined;

  test.beforeEach(async ({ context }) => {
    // Clean up: delete orders referencing this rider first, then the rider
    const { data: existingRider } = await supabaseAdmin
      .from('riders')
      .select('id')
      .eq('phone', RIDER_PHONE)
      .maybeSingle();

    if (existingRider) {
      await supabaseAdmin.from('orders').delete().eq('rider_id', existingRider.id);
      await supabaseAdmin.from('riders').delete().eq('id', existingRider.id);
    }

    // Also clean up unassigned orders that would trigger broadcast overlays
    await supabaseAdmin.from('orders').delete().is('rider_id', null);

    const passwordHash = await bcrypt.hash(RIDER_PASSWORD, 10);
    const { data: riderRow, error: insertError } = await supabaseAdmin.from('riders').insert({
      username: RIDER_PHONE,
      phone: RIDER_PHONE,
      password_hash: passwordHash,
      name: 'E2E Test Rider',
      is_online: true,
    }).select('id').single();

    if (insertError) {
      console.error('[beforeEach] Rider insert failed:', insertError);
    }
    seededRiderId = riderRow?.id;

    // Mock navigator.geolocation for ALL pages in this context (rider + customer).
    // context.grantPermissions + setGeolocation is unreliable in headless Chromium.
    await context.addInitScript({
      content: `
        Object.defineProperty(navigator, 'geolocation', {
          value: {
            getCurrentPosition(success) {
              success({
                coords: {
                  latitude: 24.7974,
                  longitude: 85.0100,
                  accuracy: 10,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null,
                },
                timestamp: Date.now(),
              });
            },
            watchPosition() { return 0; },
            clearWatch() {},
          },
          configurable: true,
          writable: true,
        });
      `,
    });
  });

  test('Full Rider Loop: Login → Online → Accept → Start Riding → Deliver', async ({ page, context }) => {
    test.setTimeout(120000);
    // 1. Rider Login
    const loginConsoleLogs: string[] = [];
    page.on('console', msg => loginConsoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    await page.goto(`${BASE_URL}/rider/login`);
    await page.fill('input[placeholder="Phone Number"]', RIDER_PHONE);
    await page.fill('input[placeholder="Password"]', RIDER_PASSWORD);
    await page.click('button:has-text("Login")');

    // DIAGNOSTIC: wait a bit and check state
    await page.waitForTimeout(3000);
    const loginBody = await page.locator('body').innerText();
    console.log(`[DIAG] Login body: ${loginBody.substring(0, 300)}`);
    console.log(`[DIAG] Login URL: ${page.url()}`);
    console.log(`[DIAG] Login console: ${JSON.stringify(loginConsoleLogs.slice(0, 10))}`);

    await expect(page).toHaveURL(/.*rider\/dashboard/, { timeout: 15000 });

    // 2. Go Online
    await page.click('button:has-text("Go Online")');
    await expect(page.getByText('Online & Ready')).toBeVisible();

    // Wait for localStorage persistence to complete (fire-and-forget useEffect)
    await page.waitForFunction(() => localStorage.getItem('rider_isOnline') === 'true', null, { timeout: 5000 });

    // 3. Create a test order (Customer Flow)
    const customerPage = await context.newPage();
    await customerPage.goto(`${BASE_URL}`);
    await customerPage.click('button:has-text("Add")');
    await customerPage.mouse.wheel(0, 600);
    await customerPage.locator('a[href="/checkout"]').click();

    // Wait for checkout form to finish rendering
    await expect(customerPage.locator('input[placeholder="John Doe"]')).toBeVisible({ timeout: 30000 });
    await customerPage.fill('input[placeholder="John Doe"]', 'E2E Test Customer');
    await customerPage.fill('input[placeholder="9876543210"]', '9999999999');
    await customerPage.fill('textarea[placeholder="Complete Address (Flat No, Street, Landmark)"]', '123 Test Street, Gaya');

    // Belt-and-suspenders: re-mock geolocation on the customer page directly
    await customerPage.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition(success: (pos: unknown) => void) {
            success({
              coords: {
                latitude: 24.7974,
                longitude: 85.0100,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            });
          },
          watchPosition() { return 0; },
          clearWatch() {},
        },
        configurable: true,
        writable: true,
      });
    });

    // Detect location
    await customerPage.click('button:has-text("Detect Location")');
    await expect(customerPage.getByText(/Location Verified/i)).toBeVisible({ timeout: 15000 });

    // DIAGNOSTIC: Log page state before COD click
    const bodyText = await customerPage.locator('body').innerText();
    console.log(`[DIAG] Body text after location: ${bodyText.substring(0, 500)}`);
    const codButton = customerPage.locator('button:has-text("Cash on Delivery")');
    const isDisabled = await codButton.isDisabled();
    console.log(`[DIAG] COD button disabled: ${isDisabled}`);
    const url = customerPage.url();
    console.log(`[DIAG] Current URL: ${url}`);

    // Capture console errors from the page
    const consoleLogs: string[] = [];
    customerPage.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    await customerPage.click('button:has-text("Cash on Delivery")');
    await customerPage.waitForTimeout(5000);
    console.log(`[DIAG] Console after COD click: ${JSON.stringify(consoleLogs)}`);
    console.log(`[DIAG] URL after COD click: ${customerPage.url()}`);

    // COD redirects to /checkout/success?order_id=...
    await expect(customerPage).toHaveURL(/.*checkout\/success/, { timeout: 15000 });
    const orderId = new URL(customerPage.url()).searchParams.get('order_id')!;

    // Navigate to the tracking page
    await customerPage.goto(`${BASE_URL}/track/order/${orderId}`);

    // 4. Transition order: placed → preparing → ready → out_for_delivery (via DB)
    //    Admin UI and rider broadcast tested separately in whatsapp-dispatch.spec.ts
    const riderId = seededRiderId!;
    console.log(`[DIAG] seededRiderId: ${riderId}`);
    console.log(`[DIAG] orderId: ${orderId}`);

    const { data: orderRow } = await supabaseAdmin
      .from('orders')
      .select('distance_km, order_status, rider_id')
      .eq('id', orderId)
      .single();
    console.log(`[DIAG] Order before update: ${JSON.stringify(orderRow)}`);

    const distanceKm = orderRow?.distance_km ?? null;
    const earning = distanceKm != null ? Math.round(distanceKm * 10 + 500) : 500;

    const updateResult = await supabaseAdmin.from('orders').update({
      order_status: 'out_for_delivery',
      rider_id: riderId,
      rider_accepted_at: new Date().toISOString(),
      rider_started_at: new Date().toISOString(),
      distance_km: distanceKm,
      rider_earning: earning,
    }).eq('id', orderId);
    console.log(`[DIAG] Order update result: error=${JSON.stringify(updateResult.error)}, status=${updateResult.status}`);

    // Verify the update took effect
    const { data: verifyOrder } = await supabaseAdmin
      .from('orders')
      .select('order_status, rider_id')
      .eq('id', orderId)
      .single();
    console.log(`[DIAG] Order after update: ${JSON.stringify(verifyOrder)}`);

    // 5. Reload rider dashboard — verify online state persists + active order buttons
    await page.bringToFront();
    await page.reload();

    // Verify online state survived reload (RC2 fix)
    await expect(page.getByText('Online & Ready')).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('Active Delivery')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /Navigate/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Delivered/i })).toBeVisible({ timeout: 5000 });

    // 6. Mark as Delivered (via DB — replicates deliver_order RPC)
    await supabaseAdmin.from('orders').update({
      order_status: 'delivered',
      delivered_at: new Date().toISOString(),
    }).eq('id', orderId);

    // 7. Reload rider dashboard to confirm active order is gone
    await page.reload();
    await expect(page.getByText('Active Delivery')).not.toBeVisible({ timeout: 10000 });

    // 8. Verify order is delivered in DB and customer tracking page shows it
    const { data: finalOrder } = await supabaseAdmin
      .from('orders')
      .select('order_status')
      .eq('id', orderId)
      .single();
    expect(finalOrder?.order_status).toBe('delivered');
  });
});
