import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

let testOfferId: string;

test.beforeAll(async () => {
  await supabase.from('offers').delete().like('label', 'E2E_%');

  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      type: 'discount_percent',
      label: 'E2E_10pct_off',
      config: { percent: 10 },
      active: true,
    })
    .select()
    .single();

  if (error || !offer) throw new Error(`Failed to create test offer: ${error?.message}`);
  testOfferId = offer.id;
});

test.afterAll(async () => {
  if (testOfferId) {
    await supabase.from('offers').delete().eq('id', testOfferId);
  }
});

test.describe('Discount Offer E2E', () => {
  test('checkout shows discounted total when 10% offer is active', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/');
    await page.waitForSelector('button[aria-label^="Add"]', { timeout: 15000 });

    // Add first menu item to cart
    await page.locator('button[aria-label^="Add"]').first().click();

    // Go to checkout
    await page.waitForSelector('a[href="/checkout"]', { timeout: 10000 });
    await page.click('a[href="/checkout"]');
    await page.waitForURL('/checkout', { timeout: 10000 });

    // Wait for offers to load — the offers badge should appear
    await expect.poll(async () => {
      const badge = page.locator('text=/offer.*applied/i');
      return await badge.isVisible().catch(() => false);
    }, { timeout: 10000, intervals: [500] }).toBe(true);

    // Verify the discount line is visible
    const discountLine = page.locator('text=/Discount/i').first();
    await expect(discountLine).toBeVisible({ timeout: 5000 });

    // Verify the grand total is less than the items total
    const itemsTotalText = await page.locator('text=/Items Total/i').locator('..').locator('span:last-child').textContent();
    const grandTotalText = await page.locator('text=/Grand Total/i').locator('..').locator('span:last-child').textContent();

    const itemsTotal = parseInt(itemsTotalText?.replace(/[^0-9]/g, '') || '0');
    const grandTotal = parseInt(grandTotalText?.replace(/[^0-9]/g, '') || '0');

    expect(grandTotal).toBeLessThan(itemsTotal);
    expect(grandTotal).toBeGreaterThan(0);

    // Verify the discount amount is approximately 10% of items total
    const discountText = await page.locator('text=/-₹/i').first().textContent();
    const discount = parseInt(discountText?.replace(/[^0-9]/g, '') || '0');
    const expectedDiscount = Math.floor(itemsTotal * 0.10);
    expect(discount).toBe(expectedDiscount);

    // Verify CheckoutSummary also shows the discounted total (not raw cart total)
    const summaryTotal = page.locator('[class*="font-black"][class*="text-primary"]').last();
    const summaryTotalText = await summaryTotal.textContent();
    const summaryValue = parseInt(summaryTotalText?.replace(/[^0-9]/g, '') || '0');
    expect(summaryValue).toBe(grandTotal);
  });
});
