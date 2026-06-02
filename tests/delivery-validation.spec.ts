import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Delivery Validation Test Suite
 * Verifies:
 * 1. Admin Toggle (ONLINE/OFFLINE) blocks/allows delivery.
 * 2. Radius calculation blocks/allows delivery based on distance.
 */

test.describe('Delivery Radius & Toggle Verification', () => {
  test.describe.configure({ mode: 'serial' });
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goodrest88';
  const BASE_URL = 'http://localhost:3005';

  async function setDeliverySettings(settings: {
    delivery_enabled: boolean;
    max_delivery_radius: number;
  }) {
    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'global');

    expect(error).toBeNull();
  }

  test.beforeEach(async ({ page }) => {
    // Handle alerts automatically
    page.on('dialog', dialog => dialog.accept());

    // Reset delivery settings to online state to guarantee start state for toggle
    await setDeliverySettings({
      delivery_enabled: true,
      max_delivery_radius: 10,
    });

    // 1. Login as Admin
    await page.goto(`${BASE_URL}/admin/login`);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button:has-text("Unlock Dashboard")');
    // Increase timeout for slow dev server compilation
    await expect(page).toHaveURL(`${BASE_URL}/admin/orders`, { timeout: 30000 });
  });

  test('Scenario A: Blocks delivery when OFFLINE', async ({ page, context }) => {
    // 1. Toggle to OFFLINE
    const statusText = page.locator('[data-testid="delivery-status"]');
    const toggleButton = page.locator('[data-testid="delivery-toggle"]');

    await expect(toggleButton).toBeEnabled({ timeout: 15000 });
    const currentStatus = await statusText.innerText();
    if (currentStatus === 'ONLINE') {
      await toggleButton.click();
      await expect(statusText).toHaveText('OFFLINE', { timeout: 5000 });
      // Wait for server action DB write to complete before navigating
      await page.waitForTimeout(2000);
    }

    // 2. Go to Checkout with geolocation mock
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: (position: unknown) => void) => {
            success({ coords: { latitude: 24.7974, longitude: 85.0100, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
          },
          watchPosition: () => 0,
          clearWatch: () => {},
        },
        configurable: true,
      });
    });
    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("Add")');
    await page.mouse.wheel(0, 600);
    await page.locator('a[href="/checkout"]').click();

    // 3. Detect Location
    await page.click('button:has-text("Detect Location")');

    // 4. Verify Error
    await expect(page.locator('text=Currently online delivery is off.')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("Pay & Order")')).toBeDisabled();
  });

  test('Scenario B: Blocks delivery when OUT OF RADIUS', async ({ page, context }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

    // 1. Explicitly isolate shared settings for this scenario.
    await setDeliverySettings({
      delivery_enabled: true,
      max_delivery_radius: 0.1,
    });

    // 2. Go to Checkout with geolocation mock (~300m away from resto)
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: (position: unknown) => void) => {
            success({ coords: { latitude: 24.8000, longitude: 85.0100, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
          },
          watchPosition: () => 0,
          clearWatch: () => {},
        },
        configurable: true,
      });
    });
    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("Add")');
    await page.mouse.wheel(0, 600);
    await page.locator('a[href="/checkout"]').click();

    // 3. Detect Location
    await page.click('button:has-text("Detect Location")');
    await page.waitForTimeout(8000);

    const bodyText = await page.locator('body').innerText();
    const geoLogs = logs.filter(l => l.includes('Google') || l.includes('Maps') || l.includes('geolocation') || l.includes('Route') || l.includes('distance') || l.includes('GOOGLE'));
    console.log(`[TEST] Geo-related logs: ${JSON.stringify(geoLogs)}`);
    console.log(`[TEST] Page has "Sorry": ${bodyText.includes('Sorry')}`);
    console.log(`[TEST] Page has "Location Verified": ${bodyText.includes('Location Verified')}`);
    console.log(`[TEST] Page has "Test Mode": ${bodyText.includes('Test Mode')}`);
    console.log(`[TEST] Page has "Detecting": ${bodyText.includes('Detecting')}`);

    // 4. Verify Error
    await expect(page.getByText(/Sorry.*don't deliver/)).toBeVisible({ timeout: 20000 });
    await expect(page.locator('button:has-text("Pay & Order")')).toBeDisabled();
  });

  test('Scenario C: Allows delivery when IN RADIUS', async ({ page, context }) => {
    // 1. Explicitly isolate this scenario from Scenario B's shared settings.
    await setDeliverySettings({
      delivery_enabled: true,
      max_delivery_radius: 50,
    });

    // 2. Go to Checkout with geolocation mock (5km away, but radius is 50km)
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: (position: unknown) => void) => {
            success({ coords: { latitude: 24.8400, longitude: 85.0100, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
          },
          watchPosition: () => 0,
          clearWatch: () => {},
        },
        configurable: true,
      });
    });
    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("Add")');
    await page.mouse.wheel(0, 600);
    await page.locator('a[href="/checkout"]').click();

    // 3. Detect Location
    await page.click('button:has-text("Detect Location")');

    // 4. Verify Success
    await expect(page.locator('p:has-text("Location Verified")')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('button:has-text("Pay & Order")')).toBeEnabled();
  });

  test.afterAll(async ({}) => {
    // Cleanup settings would go here if we used a shared context, 
    // but playwright tests should ideally be isolated.
  });
});
