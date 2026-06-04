import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Helper: generate a customer_session JWT cookie
async function generateCustomerSessionToken(phone: string): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'placeholder-jwt-secret-key-at-least-32-chars-long'
  );
  return new SignJWT({ phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
}

test.describe('Customer Cancellation & Help Flow E2E', () => {
  const BASE_URL = 'http://localhost:3005';
  let orderId: string;

  test.beforeEach(async () => {
    // 1. Seed a temporary active order
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: 'Playwright E2E Tester',
        customer_phone: '9999999990',
        delivery_address: '456 Playwright Suite, test room',
        items: [{ id: 'menu-1', name: 'E2E Pizza', price: 250, quantity: 1 }],
        total_amount: 250,
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
  });

  test.afterEach(async () => {
    // 2. Clean up test order
    if (orderId) {
      await supabaseAdmin.from('orders').delete().eq('id', orderId);
    }
  });

  test('Customer cancels order successfully and sends post-cancellation help message', async ({ page, context }) => {
    // Inject customer_session cookie BEFORE navigating
    const token = await generateCustomerSessionToken('9999999990');
    await context.addCookies([{
      name: 'customer_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);

    // Step 1: Navigate to customer order tracking page
    await page.goto(`${BASE_URL}/track/order/${orderId}`);

    // Verify order tracker page has loaded successfully
    await expect(page.getByText('Order Summary', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="order-status-heading"]')).toHaveText(/confirmed/i);

    // Step 2: Customer clicks Cancel Order button
    const cancelBtn = page.getByRole('button', { name: 'Cancel Order' });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Verify confirmation interface is rendered
    await expect(page.getByText('Are you absolutely sure you want to cancel?')).toBeVisible();
    
    // Fill the optional cancellation reason
    const reasonTextarea = page.locator('textarea[placeholder*="ordered wrong items"]');
    await expect(reasonTextarea).toBeVisible();
    await reasonTextarea.fill('Decided to cook at home instead');

    // Click confirm cancel button
    const confirmCancelBtn = page.getByRole('button', { name: 'Yes, Cancel Order' });
    await confirmCancelBtn.click();

    // Step 3: Verify the tracker status updates to Cancelled
    await expect(page.getByText('ORDER CANCELLED', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Cancelled by you', { exact: true })).toBeVisible();
    await expect(page.getByText('Reason: “Decided to cook at home instead”')).toBeVisible();

    // Step 4: Submit post-cancellation Help Message
    const helpHeader = page.getByText('💬 Need Help? Tell us what happened:');
    await expect(helpHeader).toBeVisible();

    const helpTextarea = page.locator('textarea[placeholder*="Type your issue here"]');
    await expect(helpTextarea).toBeVisible();
    await helpTextarea.fill('Please cancel my payment authorization if any');

    const sendMsgBtn = page.getByRole('button', { name: 'Send Message' });
    await expect(sendMsgBtn).toBeVisible();
    await sendMsgBtn.click();

    // Verify that "✓ Help Request Sent" state is successfully displayed
    await expect(page.getByText('✓ Help Request Sent', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Please cancel my payment authorization if any')).toBeVisible();
  });
});
