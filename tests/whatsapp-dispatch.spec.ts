import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

test.describe('FCFS Rider Assignment Flow', () => {
  const BASE_URL = 'http://localhost:3005';
  const RIDER_PHONE = '9999999998';
  const RIDER_PASSWORD = 'test123';

  test.beforeEach(async () => {
    // Clean up any existing test rider rows, then seed fresh
    await supabaseAdmin.from('riders').delete().eq('phone', RIDER_PHONE);
    const passwordHash = await bcrypt.hash(RIDER_PASSWORD, 10);
    await supabaseAdmin.from('riders').insert({
      username: RIDER_PHONE,
      phone: RIDER_PHONE,
      password_hash: passwordHash,
      name: 'FCFS Test Rider',
    });
  });

  test('Ready order has no manual dispatch UI; rider self-assigns via Accept', async ({ page, context }) => {
    // 1. Navigate to admin orders
    await page.goto(`${BASE_URL}/admin/orders`);

    // 2. Find a READY order and verify no DISPATCH button (Phase 4 removed manual dispatch)
    const orderCard = page.locator('.glass-card').filter({ hasText: 'READY' }).first();
    if (await orderCard.isVisible()) {
      await expect(orderCard.getByRole('button', { name: 'DISPATCH' })).not.toBeVisible();
      // Phase 4 removed Rider Phone and Tracking Link inputs
      await expect(orderCard.getByPlaceholder('Rider Phone')).not.toBeVisible();
      await expect(orderCard.getByPlaceholder('Tracking Link')).not.toBeVisible();
    }

    // 3. Rider logs in — grant geolocation BEFORE creating rider page
    //    Without this, rider dashboard watchPosition() fails → setIsOnline(false)
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 24.7974, longitude: 85.0100 });
    const riderPage = await context.newPage();
    await riderPage.goto(`${BASE_URL}/rider/login`);
    await riderPage.fill('input[placeholder="Phone Number"]', RIDER_PHONE);
    await riderPage.fill('input[placeholder="Password"]', RIDER_PASSWORD);
    await riderPage.click('button:has-text("Login")');

    // 4. Rider should reach dashboard
    await expect(riderPage).toHaveURL(/.*rider\/dashboard/, { timeout: 15000 });

    // 5. Go Online — geolocation watchPosition now succeeds, "Online & Ready" renders
    await riderPage.click('button:has-text("Go Online")');
    await expect(riderPage.getByText('Online & Ready')).toBeVisible({ timeout: 10000 });
  });
});
