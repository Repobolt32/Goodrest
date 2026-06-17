import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const createdOfferIds: string[] = [];

async function cleanupOffers() {
  if (createdOfferIds.length > 0) {
    await supabase.from('offers').delete().in('id', createdOfferIds);
  }
  await supabase.from('offers').delete().like('label', 'E2E_%');
}

async function createOffer(overrides: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('offers')
    .insert({ label: `E2E_${Date.now()}`, active: true, ...overrides })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create offer: ${error?.message}`);
  createdOfferIds.push(data.id);
  return data;
}

test.beforeEach(async () => {
  await cleanupOffers();
});

test.afterAll(async () => {
  await cleanupOffers();
});

test.describe('Free Delivery Offer', () => {
  test('waives delivery fee when subtotal meets threshold', async ({ page }) => {
    test.setTimeout(60000);

    await createOffer({
      type: 'free_delivery',
      config: { threshold: 100 },
    });

    await page.goto('/');
    await page.waitForSelector('button[aria-label^="Add"]', { timeout: 15000 });
    await page.locator('button[aria-label^="Add"]').first().click();

    await page.waitForSelector('a[href="/checkout"]', { timeout: 10000 });
    await page.click('a[href="/checkout"]');
    await page.waitForURL('/checkout', { timeout: 10000 });

    // Wait for offers to load
    await expect.poll(async () => {
      const badge = page.locator('text=/offer.*applied/i');
      return await badge.isVisible().catch(() => false);
    }, { timeout: 10000, intervals: [500] }).toBe(true);

    // Verify "Free Delivery" appears in the order summary
    const freeDelivery = page.locator('text=/Free/i').first();
    await expect(freeDelivery).toBeVisible({ timeout: 5000 });

    // Verify delivery fee line shows "Free" not a price
    const deliveryLine = page.locator('text=/Delivery/i').first();
    await expect(deliveryLine).toBeVisible();

    // Grand total should equal items total (no delivery fee)
    const itemsTotalText = await page.locator('text=/Items Total/i').locator('..').locator('span:last-child').textContent();
    const grandTotalText = await page.locator('text=/Grand Total/i').locator('..').locator('span:last-child').textContent();

    const itemsTotal = parseInt(itemsTotalText?.replace(/[^0-9]/g, '') || '0');
    const grandTotal = parseInt(grandTotalText?.replace(/[^0-9]/g, '') || '0');

    expect(grandTotal).toBe(itemsTotal);
  });

  test('does NOT waive delivery fee when subtotal is below threshold', async ({ page }) => {
    test.setTimeout(60000);

    await createOffer({
      type: 'free_delivery',
      config: { threshold: 99999 },
    });

    await page.goto('/');
    await page.waitForSelector('button[aria-label^="Add"]', { timeout: 15000 });
    await page.locator('button[aria-label^="Add"]').first().click();

    await page.waitForSelector('a[href="/checkout"]', { timeout: 10000 });
    await page.click('a[href="/checkout"]');
    await page.waitForURL('/checkout', { timeout: 10000 });

    // Wait for page to settle
    await page.waitForTimeout(2000);

    // "Free Delivery" should NOT appear
    const freeDelivery = page.locator('text=/Free Delivery/i');
    await expect(freeDelivery).not.toBeVisible();

    // Grand total should be > items total (delivery fee applied)
    const itemsTotalText = await page.locator('text=/Items Total/i').locator('..').locator('span:last-child').textContent();
    const grandTotalText = await page.locator('text=/Grand Total/i').locator('..').locator('span:last-child').textContent();

    const itemsTotal = parseInt(itemsTotalText?.replace(/[^0-9]/g, '') || '0');
    const grandTotal = parseInt(grandTotalText?.replace(/[^0-9]/g, '') || '0');

    expect(grandTotal).toBeGreaterThanOrEqual(itemsTotal);
  });
});

test.describe('Offer Expiry', () => {
  test('expired offer (end_time in past) is NOT applied', async ({ page }) => {
    test.setTimeout(60000);

    // Create an offer that ended 1 hour ago
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    await createOffer({
      type: 'discount_percent',
      config: { percent: 50 },
      end_time: oneHourAgo,
    });

    await page.goto('/');
    await page.waitForSelector('button[aria-label^="Add"]', { timeout: 15000 });
    await page.locator('button[aria-label^="Add"]').first().click();

    await page.waitForSelector('a[href="/checkout"]', { timeout: 10000 });
    await page.click('a[href="/checkout"]');
    await page.waitForURL('/checkout', { timeout: 10000 });

    // Wait for page to settle
    await page.waitForTimeout(2000);

    // No offers badge should appear
    const badge = page.locator('text=/offer.*applied/i');
    await expect(badge).not.toBeVisible();

    // No discount line
    const discountLine = page.locator('text=/Discount/i');
    await expect(discountLine).not.toBeVisible();

    // Grand total should equal items total (no discount)
    const itemsTotalText = await page.locator('text=/Items Total/i').locator('..').locator('span:last-child').textContent();
    const grandTotalText = await page.locator('text=/Grand Total/i').locator('..').locator('span:last-child').textContent();

    const itemsTotal = parseInt(itemsTotalText?.replace(/[^0-9]/g, '') || '0');
    const grandTotal = parseInt(grandTotalText?.replace(/[^0-9]/g, '') || '0');

    expect(grandTotal).toBeGreaterThanOrEqual(itemsTotal);
  });

  test('future offer (start_time in future) is NOT applied', async ({ page }) => {
    test.setTimeout(60000);

    // Create an offer that starts in 1 hour
    const oneHourLater = new Date(Date.now() + 3600000).toISOString();
    await createOffer({
      type: 'discount_percent',
      config: { percent: 50 },
      start_time: oneHourLater,
    });

    await page.goto('/');
    await page.waitForSelector('button[aria-label^="Add"]', { timeout: 15000 });
    await page.locator('button[aria-label^="Add"]').first().click();

    await page.waitForSelector('a[href="/checkout"]', { timeout: 10000 });
    await page.click('a[href="/checkout"]');
    await page.waitForURL('/checkout', { timeout: 10000 });

    await page.waitForTimeout(2000);

    const badge = page.locator('text=/offer.*applied/i');
    await expect(badge).not.toBeVisible();

    const discountLine = page.locator('text=/Discount/i');
    await expect(discountLine).not.toBeVisible();
  });

  test('active offer (within time window) IS applied', async ({ page }) => {
    test.setTimeout(60000);

    // Create an offer valid from 1 hour ago until 1 hour from now
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const oneHourLater = new Date(Date.now() + 3600000).toISOString();
    await createOffer({
      type: 'discount_percent',
      config: { percent: 20 },
      start_time: oneHourAgo,
      end_time: oneHourLater,
    });

    await page.goto('/');
    await page.waitForSelector('button[aria-label^="Add"]', { timeout: 15000 });
    await page.locator('button[aria-label^="Add"]').first().click();

    await page.waitForSelector('a[href="/checkout"]', { timeout: 10000 });
    await page.click('a[href="/checkout"]');
    await page.waitForURL('/checkout', { timeout: 10000 });

    // Offers badge should appear
    await expect.poll(async () => {
      const badge = page.locator('text=/offer.*applied/i');
      return await badge.isVisible().catch(() => false);
    }, { timeout: 10000, intervals: [500] }).toBe(true);

    // Discount line should show 20%
    const discountLine = page.locator('text=/20%/i').first();
    await expect(discountLine).toBeVisible({ timeout: 5000 });

    // Grand total should be less than items total
    const itemsTotalText = await page.locator('text=/Items Total/i').locator('..').locator('span:last-child').textContent();
    const grandTotalText = await page.locator('text=/Grand Total/i').locator('..').locator('span:last-child').textContent();

    const itemsTotal = parseInt(itemsTotalText?.replace(/[^0-9]/g, '') || '0');
    const grandTotal = parseInt(grandTotalText?.replace(/[^0-9]/g, '') || '0');

    expect(grandTotal).toBeLessThan(itemsTotal);
  });
});
