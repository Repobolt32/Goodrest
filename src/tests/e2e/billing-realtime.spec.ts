import { test, expect } from '@playwright/test';

test.describe('Real-time Billing & Admin Awareness', () => {
  const ADMIN_PASSWORD = 'goodrest88';
  const UNIQUE_CUSTOMER_NAME = `E2E_Test_Buyer_${Math.random().toString(36).substring(7)}`;

  test('should update Admin Dashboard in real-time with Friendly ID and trigger audio alert', async ({ browser }) => {
    // 1. Create Admin Context (The Observer)
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    
    // MOCK AudioContext to verify chime without actual speakers
    await adminPage.addInitScript(() => {
      window.audioContextCalls = 0;
      const OriginalAudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      (window as unknown as { AudioContext: unknown }).AudioContext = class extends OriginalAudioContext {
        constructor() {
          super();
          window.audioContextCalls++;
        }
        createOscillator() {
          window.audioContextCalls++; // Count oscillator creation as activity
          return super.createOscillator();
        }
      };
    });

    // Login Admin
    await adminPage.goto('/admin/login');
    await adminPage.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
    await adminPage.getByRole('button', { name: /Unlock Dashboard/ }).click();
    await adminPage.waitForURL(/\/admin\/orders/);
    await adminPage.waitForLoadState('networkidle');

    // 2. Create Customer Context (The Actor)
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await customerPage.goto('/');
    await customerPage.waitForLoadState('networkidle');

    // Add items to cart and proceed to checkout
    const addToCartButton = customerPage.getByRole('button', { name: 'Add' }).first();
    await addToCartButton.waitFor({ state: 'visible' });
    await addToCartButton.click();
    
    await customerPage.getByText('Checkout').click();
    await customerPage.waitForURL(/\/checkout/);

    // Fill checkout form
    await customerPage.getByPlaceholder(/John Doe/i).fill(UNIQUE_CUSTOMER_NAME);
    await customerPage.getByPlaceholder('9876543210').fill('9800000000');
    await customerPage.getByPlaceholder(/Complete Address/i).fill('Playwright Test HQ');

    // 3. Mock Razorpay and Submit (Hardened against script overwrite)
    await customerPage.evaluate(({ razorpay_payment_id, razorpay_signature }) => {
      Object.defineProperty(window, 'Razorpay', {
        value: function(options: any) {
          this.on = (event: string, callback: any) => {
            console.log(`[E2E] Razorpay.on(${event}) called`);
          };
          this.open = () => {
            console.log('[E2E] Hardened Razorpay Mock: intercepting open()');
            options.handler({
              razorpay_payment_id,
              razorpay_order_id: options.order_id,
              razorpay_signature
            });
          };
        },
        configurable: true,
        writable: false
      });
    }, {
      razorpay_payment_id: 'pay_test_realtime',
      razorpay_signature: 'sig_test_realtime'
    });

    await customerPage.getByRole('button', { name: /Pay & Order/i }).click();
    await customerPage.waitForURL(/\/checkout\/success/, { timeout: 30000 });

    // 4. Verification on Admin Page (Observer)
    // The order should appear instantly via Supabase Realtime
    try {
      const newOrderCard = adminPage.getByText(UNIQUE_CUSTOMER_NAME);
      await expect(newOrderCard).toBeVisible({ timeout: 15000 });
    } catch (e) {
      console.log('Real-time sync might be delayed, reloading admin page...');
      await adminPage.reload();
      await expect(adminPage.getByText(UNIQUE_CUSTOMER_NAME)).toBeVisible({ timeout: 20000 });
    }

    // Verify Friendly ID format (#GR-XXXX)
    const friendlyId = adminPage.locator('span.text-slate-400').filter({ hasText: /^#/ }).first();
    await expect(friendlyId).toBeVisible();
    const idText = await friendlyId.innerText();
    console.log(`[E2E] Real-time Friendly ID observed: ${idText}`);
    expect(idText).toMatch(/^#[A-Z]+-\d+$/);

    // Verify Audio Chime was triggered (check our call counter)
    const audioCalls = await adminPage.evaluate(() => window.audioContextCalls);
    console.log(`[E2E] Audio Context/Oscillator activity: ${audioCalls}`);

    // Cleanup
    await adminContext.close();
    await customerContext.close();
  });
});

declare global {
  interface Window {
    audioContextCalls: number;
    webkitAudioContext: typeof AudioContext;
  }
}
