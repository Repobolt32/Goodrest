import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Bug #3: Capacitor-Specific Cart Issues', () => {
  
  test('FloatingCart overlap: tapping dish card should not trigger checkout navigation', async ({ page }) => {
    // Simulate mobile viewport (Capacitor)
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.removeItem('goodrest_cart'));
    await page.waitForSelector('main', { timeout: 10000 });
    
    // Scroll down to make FloatingCart appear
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(500);
    
    // Check if FloatingCart is visible
    const floatingCart = page.locator('a[href="/checkout"]').first();
    const isFloatingCartVisible = await floatingCart.isVisible().catch(() => false);
    console.log('FloatingCart visible:', isFloatingCartVisible);
    
    // Get FloatingCart position
    if (isFloatingCartVisible) {
      const box = await floatingCart.boundingBox();
      console.log('FloatingCart position:', box);
      
      // Check if any dish card overlaps with FloatingCart
      const dishCards = page.locator('.bento-card');
      const count = await dishCards.count();
      
      for (let i = 0; i < count; i++) {
        const cardBox = await dishCards.nth(i).boundingBox();
        if (cardBox && box) {
          const overlaps = !(
            cardBox.y + cardBox.height < box.y ||
            box.y + box.height < cardBox.y
          );
          if (overlaps) {
            console.error(`❌ OVERLAP DETECTED: Dish card ${i} overlaps with FloatingCart`);
          }
        }
      }
    }
    
    // Add item to cart
    const addBtn = page.getByRole('button', { name: 'Add Butter Chicken to cart' });
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    await page.waitForTimeout(300);
    
    // Verify item added
    const cart = await page.evaluate(() => {
      const data = localStorage.getItem('goodrest_cart');
      return data ? JSON.parse(data) : [];
    });
    expect(cart.length).toBe(1);
    
    // Now tap the dish card area (not the button) - should NOT navigate
    const dishCard = page.locator('.bento-card').first();
    const cardBox = await dishCard.boundingBox();
    
    if (cardBox) {
      // Tap center of card (not on any button)
      await page.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y + 50);
      await page.waitForTimeout(500);
      
      // Should still be on menu page
      const url = page.url();
      console.log('URL after tapping card:', url);
      expect(url).toBe(`${BASE_URL}/`);
      
      // Cart should still have items
      const cartAfterTap = await page.evaluate(() => {
        const data = localStorage.getItem('goodrest_cart');
        return data ? JSON.parse(data) : [];
      });
      expect(cartAfterTap.length).toBe(1);
    }
  });

  test('multiple rapid navigations should not lose cart state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.removeItem('goodrest_cart'));
    await page.waitForSelector('main', { timeout: 10000 });
    
    // Add item
    const addBtn = page.getByRole('button', { name: 'Add Butter Chicken to cart' });
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    await page.waitForTimeout(300);
    
    // Rapid navigation: menu → checkout → menu → checkout → menu
    for (let i = 0; i < 5; i++) {
      await page.goto(`${BASE_URL}/checkout`);
      await page.waitForTimeout(200);
      await page.goto(BASE_URL);
      await page.waitForTimeout(200);
    }
    
    // Final check at checkout
    await page.goto(`${BASE_URL}/checkout`);
    await page.waitForTimeout(1000);
    
    const cart = await page.evaluate(() => {
      const data = localStorage.getItem('goodrest_cart');
      return data ? JSON.parse(data) : [];
    });
    
    console.log('Cart after rapid navigation:', cart.length, 'items');
    
    const emptyCart = page.getByText('Your cart is empty.');
    const isCartEmpty = await emptyCart.isVisible().catch(() => false);
    
    if (isCartEmpty) {
      console.error('❌ BUG: Cart empty after rapid navigation');
      await page.screenshot({ path: 'tests/bug-evidence-rapid-nav.png' });
    }
    
    expect(cart.length).toBe(1);
    expect(isCartEmpty).toBe(false);
  });

  test('localStorage corruption check: verify cart data integrity', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.removeItem('goodrest_cart'));
    await page.waitForSelector('main', { timeout: 10000 });
    
    // Add multiple items
    const items = [
      'Add Butter Chicken to cart',
      'Add Garlic Naan to cart',
      'Add Gulab Jamun to cart',
    ];
    
    for (const itemLabel of items) {
      const btn = page.getByRole('button', { name: itemLabel });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(200);
    }
    
    // Check localStorage integrity
    const cartData = await page.evaluate(() => {
      const raw = localStorage.getItem('goodrest_cart');
      return {
        raw,
        parsed: raw ? JSON.parse(raw) : null,
        isValid: (() => {
          try {
            const data = JSON.parse(raw || '[]');
            return Array.isArray(data) && data.every(item => 
              item.id && item.name && item.price && typeof item.quantity === 'number'
            );
          } catch {
            return false;
          }
        })()
      };
    });
    
    console.log('Cart data integrity:', cartData.isValid);
    console.log('Cart items:', cartData.parsed?.length);
    
    if (!cartData.isValid) {
      console.error('❌ CORRUPTED CART DATA:', cartData.raw);
      await page.screenshot({ path: 'tests/bug-evidence-corruption.png' });
    }
    
    expect(cartData.isValid).toBe(true);
    expect(cartData.parsed?.length).toBe(3);
  });
});
