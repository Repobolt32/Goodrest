import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

test.describe('Admin Cancelled Orders Dashboard E2E', () => {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goodrest88';
  const BASE_URL = 'http://localhost:3005';
  let orderId: string;
  let friendlyId: string;

  test.beforeEach(async () => {
    // Seed a temporary cancelled order in the database
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: 'Playwright Refund Tester',
        customer_phone: '8888888888',
        delivery_address: '202 Playwright Cancellation Ave, Suite B',
        items: [
          { id: 'menu-1', name: 'Premium Burger', price: 200, quantity: 2 },
          { id: 'menu-2', name: 'Fries Large', price: 80, quantity: 1 }
        ],
        total_amount: 480,
        payment_method: 'online',
        order_status: 'cancelled',
        payment_status: 'paid',
        cancelled_by: 'customer',
        cancel_reason: 'Double ordered by mistake',
        customer_help_message: 'Please process my refund quickly!',
        refund_status: 'pending'
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
    // Clean up test order
    if (orderId) {
      await supabaseAdmin.from('orders').delete().eq('id', orderId);
    }
  });

  test('Owner can view cancelled orders, toggle refund status, and navigate via sidebar and bell dropdown', async ({ page }) => {
    // 1. Login as Admin
    await page.goto(`${BASE_URL}/admin/login`);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button:has-text("Unlock Dashboard")');
    await expect(page).toHaveURL(`${BASE_URL}/admin/orders`, { timeout: 30000 });

    // 2. Navigate via sidebar
    const sidebarLink = page.locator('a:has-text("Cancelled Orders")').first();
    await expect(sidebarLink).toBeVisible();
    await sidebarLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/admin/cancelled-orders`, { timeout: 15000 });

    // 3. Verify the main dashboard elements and header
    await expect(page.locator('h1', { hasText: 'Cancelled Orders' }).first()).toBeVisible();
    await expect(page.locator('button:has-text("Pending Refunds")').first()).toBeVisible();
    
    // 4. Verify seeded cancelled order details card
    const card = page.locator(`[data-order-id="${orderId}"]`).first();
    await expect(card).toBeVisible();
    await expect(card.locator('[data-testid="order-friendly-id"]')).toContainText(friendlyId);
    await expect(card.getByText('Playwright Refund Tester', { exact: false })).toBeVisible();
    await expect(card.getByText('Premium Burger', { exact: false })).toBeVisible();
    await expect(card.getByText('Fries Large', { exact: false })).toBeVisible();
    await expect(card.getByText('Double ordered by mistake', { exact: false })).toBeVisible();
    await expect(card.getByText('Please process my refund quickly!', { exact: false })).toBeVisible();
    await expect(card.locator('[data-testid="refund-status-label"]')).toContainText('Pending');

    // 5. Toggle refund status to "Refunded"
    const toggleBtn = card.locator('[data-testid="toggle-refund-btn"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // The order should disappear from the "Pending" tab because its state is updated
    await expect(card).not.toBeVisible({ timeout: 10000 });

    // 6. Switch to "Completed Refunds" tab
    const completedTab = page.locator('button:has-text("Completed Refunds")').first();
    await completedTab.click();

    // Verify order is visible in Completed Refunds tab and has correct labels
    const completedCard = page.locator(`[data-order-id="${orderId}"]`).first();
    await expect(completedCard).toBeVisible();
    await expect(completedCard.locator('[data-testid="refund-status-label"]')).toContainText('Refunded');
    await expect(completedCard.locator('[data-testid="toggle-refund-btn"]')).toContainText('Undo');

    // 7. Click Undo to return to Pending
    const undoBtn = completedCard.locator('[data-testid="toggle-refund-btn"]');
    await undoBtn.click();

    // Verify order disappears from Completed tab
    await expect(page.locator(`[data-order-id="${orderId}"]`).first()).not.toBeVisible();

    // 8. Go back to Pending tab and verify order is back
    const pendingTab = page.locator('button:has-text("Pending Refunds")').first();
    await pendingTab.click();
    await expect(page.locator(`[data-order-id="${orderId}"]`).first()).toBeVisible();
    await expect(page.locator(`[data-order-id="${orderId}"]`).first().locator('[data-testid="refund-status-label"]')).toContainText('Pending');

    // 9. Go back to main dashboard, open notifications bell, and click "View All" link
    await page.goto(`${BASE_URL}/admin/orders`);
    const bellBtn = page.locator('[data-testid="admin-bell"]');
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();

    const viewAllBtn = page.locator('[data-testid="view-all-cancelled-btn"]');
    await expect(viewAllBtn).toBeVisible();
    await viewAllBtn.click();
    await expect(page).toHaveURL(`${BASE_URL}/admin/cancelled-orders`, { timeout: 15000 });
  });
});
