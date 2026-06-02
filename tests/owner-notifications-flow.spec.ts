import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

test.describe('Owner Dashboard Live Cancellation Notifications E2E', () => {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goodrest88';
  const BASE_URL = 'http://localhost:3005';
  let orderId: string;
  let friendlyId: string;

  test.beforeEach(async () => {
    // 1. Seed a temporary active order
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: 'Playwright Owner Tester',
        customer_phone: '9999999999',
        delivery_address: '101 Playwright Admin Row, suite A',
        items: [{ id: 'menu-1', name: 'Admin Salad', price: 120, quantity: 1 }],
        total_amount: 120,
        payment_method: 'cod',
        order_status: 'confirmed',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (error || !order) {
      throw new Error(`Failed to seed test order: ${error?.message}`);
    }
    orderId = order.id;
    friendlyId = order.friendly_id || '';
  });

  test.afterEach(async () => {
    // 2. Clean up test order
    if (orderId) {
      await supabaseAdmin.from('orders').delete().eq('id', orderId);
    }
  });

  test('Owner dashboard displays live badge count and cancelled order details in dropdown', async ({ page }) => {
    // Step 1: Login as Admin first (active order exists)
    await page.goto(`${BASE_URL}/admin/login`);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button:has-text("Unlock Dashboard")');
    await expect(page).toHaveURL(`${BASE_URL}/admin/orders`, { timeout: 30000 });

    // Step 2: Ensure the bell icon is present
    const bellBtn = page.locator('[data-testid="admin-bell"]');
    await expect(bellBtn).toBeVisible();

    // Wait for Supabase Realtime WebSocket connection to establish
    await page.waitForTimeout(2000);

    // Step 3: Trigger real-time order cancellation in the database AFTER mounting admin page
    const cancelReason = 'Customer requested fast cancel';
    const { error: cancelError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: 'cancelled',
        cancelled_by: 'customer',
        cancel_reason: cancelReason
      })
      .eq('id', orderId);

    expect(cancelError).toBeNull();

    // Step 4: Verify the bell badge count is visible and shows at least 1 cancellation
    const badge = bellBtn.locator('span');
    await expect(badge).toBeVisible({ timeout: 15000 });
    const countText = await badge.innerText();
    expect(parseInt(countText)).toBeGreaterThanOrEqual(1);

    // Ensure the new order popup is dismissed or hidden to prevent it from blocking the bell dropdown click
    const newOrderPopup = page.locator('[data-testid="new-order-popup"]');
    if (await newOrderPopup.isVisible()) {
      const closeBtn = page.locator('[data-testid="close-new-order-popup"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
      await expect(newOrderPopup).toBeHidden({ timeout: 5000 });
    }

    // Step 5: Click the bell icon (safe from overlaps using force: true)
    await bellBtn.click({ force: true });

    // Step 6: Verify the dropdown renders with our cancelled order details
    await expect(page.getByText('Cancelled Orders Today', { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(friendlyId, { exact: false })).toBeVisible();
    await expect(page.getByText('Playwright Owner Tester', { exact: false })).toBeVisible();
    await expect(page.getByText(`Call (9999999999)`, { exact: false })).toBeVisible();
    await expect(page.getByText(`"${cancelReason}"`, { exact: false })).toBeVisible();

    // Step 7: Trigger a post-cancellation help request submission in the database
    const helpMessage = 'Rider forgot my drinks, help!';
    const { error: helpError } = await supabaseAdmin
      .from('orders')
      .update({
        customer_help_message: helpMessage
      })
      .eq('id', orderId);

    expect(helpError).toBeNull();

    // Step 8: Verify the dropdown dynamically updates in real-time to show the help request message
    await expect(page.getByText('Help Request Message:', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(`“${helpMessage}”`, { exact: false })).toBeVisible();
  });
});
