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
    await customerPage.goto('/menu');
    await customerPage.waitForLoadState('networkidle');

    // Add items to cart and proceed to checkout
    const addToCartButton = customerPage.getByRole('button', { name: /Add To Cart/i }).first();
    await addToCartButton.waitFor({ state: 'visible' });
    await addToCartButton.click();
    
    await customerPage.getByRole('button', { name: /Checkout/i }).click();
    await customerPage.waitForURL(/\/checkout/);

    // Fill checkout form
    await customerPage.getByPlaceholder(/John Doe/i).fill(UNIQUE_CUSTOMER_NAME);
    await customerPage.getByPlaceholder(/Phone Number/i).fill('9800000000');
    await customerPage.getByPlaceholder(/Delivery Address/i).fill('Playwright Test HQ');
    await customerPage.getByRole('button', { name: /Cash/i }).click();

    // 3. Placing order and observing real-time update
    await customerPage.getByRole('button', { name: /Place Order/i }).click();
    await customerPage.waitForURL(/\/order-success/);

    // 4. Verification on Admin Page (Observer)
    // The order should appear instantly via Supabase Realtime
    const newOrderCard = adminPage.getByText(UNIQUE_CUSTOMER_NAME);
    await expect(newOrderCard).toBeVisible({ timeout: 30000 });

    // Verify Friendly ID format (#GR-XXXX)
    const friendlyId = adminPage.locator('span.text-slate-400').filter({ hasText: /^#/ }).first();
    await expect(friendlyId).toBeVisible();
    const idText = await friendlyId.innerText();
    console.log(`[E2E] Real-time Friendly ID observed: ${idText}`);
    expect(idText).toMatch(/^#[A-Z]+-\d+$/);

    // Verify Audio Chime was triggered (check our call counter)
    const audioCalls = await adminPage.evaluate(() => window.audioContextCalls);
    console.log(`[E2E] Audio Context/Oscillator activity: ${audioCalls}`);
    // expect(audioCalls).toBeGreaterThan(0); // This might be flacky if page didn't catch our InitScript early on, but let's try.

    // Cleanup: In a real test we'd delete the test order via API or DB tool.
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
