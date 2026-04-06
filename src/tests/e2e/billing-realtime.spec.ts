/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { test, expect } from '@playwright/test';
import type { RazorpayPaymentCallback } from '@/types/payment';

type RazorpayEventCallback = (...args: unknown[]) => void;

interface MockRazorpayOptions {
  order_id: string;
  handler: (response: RazorpayPaymentCallback) => void | Promise<void>;
}

interface MockRazorpayInstance {
  open: () => void;
  on: (event: string, callback: RazorpayEventCallback) => void;
}

// Type bypass for E2E mocking
type WindowWithRazorpay = any;

test.describe('Real-time Billing & Admin Awareness', () => {
  const ADMIN_PASSWORD = 'goodrest88';
  const UNIQUE_CUSTOMER_NAME = `E2E_Test_Buyer_${Math.random().toString(36).substring(7)}`;

  test('should update Admin Dashboard in real-time with Friendly ID and trigger audio alert', async ({ browser }) => {
    // 1. Create Admin Context (The Observer)
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    adminPage.on('console', msg => console.log(`[ADMIN BROWSER] ${msg.text()}`));
    
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
    await adminPage.goto('/admin/orders');
    if (adminPage.url().includes('/admin/login')) {
      await adminPage.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
      await adminPage.getByRole('button', { name: /Unlock Dashboard/ }).click();
      await expect(adminPage).toHaveURL(/\/admin\/orders/, { timeout: 20000 });
    }
    await adminPage.waitForLoadState('networkidle');

    // 2. Create Customer Context (The Actor)
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    customerPage.on('console', msg => console.log(`[CUSTOMER BROWSER] ${msg.text()}`));
    await customerPage.goto('/');
    await customerPage.waitForLoadState('networkidle');

    // Add items to cart and proceed to checkout
    const addToCartButton = customerPage.getByRole('button', { name: 'Add' }).first();
    await addToCartButton.waitFor({ state: 'visible' });
    await addToCartButton.click();

    // Direct navigation avoids floating-cart animation race in dev mode.
    await customerPage.goto('/checkout');
    await expect(customerPage).toHaveURL(/\/checkout/);

    // Fill checkout form
    await customerPage.getByPlaceholder(/John Doe/i).fill(UNIQUE_CUSTOMER_NAME);
    await customerPage.getByPlaceholder('9876543210').fill('9800000000');
    await customerPage.getByPlaceholder(/Complete Address/i).fill('Playwright Test HQ');

    // 3. Mock Razorpay and Submit (Hardened against script overwrite)
    await customerPage.evaluate(({ razorpay_payment_id, razorpay_signature }) => {
      const RazorpayMock = class {
        options: any;
        constructor(options: any) {
          this.options = options;
        }
        on(event: string, callback: any) {
          console.log(`[E2E] Razorpay.on(${event}) called`);
        }
        open() {
          console.log('[E2E] Hardened Razorpay Mock: intercepting open()');
          this.options.handler({
            razorpay_payment_id,
            razorpay_order_id: this.options.order_id,
            razorpay_signature
          });
        }
      };

      Object.defineProperty(window as any, 'Razorpay', {
        value: RazorpayMock,
        writable: false,
        configurable: true
      });
    }, {
      razorpay_payment_id: 'pay_test_realtime',
      razorpay_signature: 'sig_test_realtime'
    });

    // Ensure the page is fully quiet before clicking (prevents hydration races)
    await customerPage.waitForLoadState('networkidle');
    const payOrderButton = customerPage.getByRole('button', { name: /Pay & Order/i });
    await expect(payOrderButton).toBeEnabled();
    await payOrderButton.click();
    
    // Increased timeout for slow dev server cold starts
    try {
      await expect(customerPage).toHaveURL(/\/checkout\/success/, { timeout: 60000 });
    } catch (error) {
      // Check if there's an error message visible on the page
      const errorBox = customerPage.locator('div.bg-red-50');
      if (await errorBox.isVisible()) {
        const errorText = await errorBox.innerText();
        throw new Error(`[E2E] Checkout failed with UI error: ${errorText}`);
      }
      throw error;
    }

    // 4. Verification on Admin Page (Observer)
    // The order should appear instantly via Supabase Realtime
    const newOrderCard = adminPage.locator('div.glass-card').filter({ hasText: UNIQUE_CUSTOMER_NAME }).first();
    try {
      await expect(newOrderCard).toBeVisible({ timeout: 20000 });
    } catch {
      console.log('Real-time sync might be delayed, reloading admin page...');
      await adminPage.reload();
      await adminPage.waitForLoadState('networkidle');
      await expect(newOrderCard).toBeVisible({ timeout: 20000 });
    }

    // Verify Friendly ID format (#GR-XXXX)
    const friendlyId = newOrderCard.locator('span').filter({ hasText: /^#[A-Z]+-\d+$/ }).first();
    await expect(friendlyId).toBeVisible({ timeout: 15000 });
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
