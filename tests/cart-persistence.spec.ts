import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Bug #3: Cart Persistence Across Multiple Orders', () => {
  
  test('cart should persist after 5 order cycles (add → checkout → back → repeat)', async ({ page }) => {
    // Clear cart state before starting
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.removeItem('goodrest_cart'));
    
    const itemsToAdd = [
      { name: 'Butter Chicken', ariaLabel: 'Add Butter Chicken to cart' },
      { name: 'Garlic Naan', ariaLabel: 'Add Garlic Naan to cart' },
      { name: 'Gulab Jamun', ariaLabel: 'Add Gulab Jamun to cart' },
      { name: 'Paneer Tikka', ariaLabel: 'Add Paneer Tikka to cart' },
      { name: 'Shahi Paneer', ariaLabel: 'Add Shahi Paneer to cart' },
    ];

    // Simulate 5 order cycles
    for (let cycle = 0; cycle < 5; cycle++) {
      console.log(`=== Order Cycle ${cycle + 1} ===`);
      
      // Go to menu
      await page.goto(BASE_URL);
      await page.waitForSelector('main', { timeout: 10000 });
      
      // Add item to cart
      const item = itemsToAdd[cycle];
      const addBtn = page.getByRole('button', { name: item.ariaLabel });
      
      // Wait for button to be visible and click
      await addBtn.scrollIntoViewIfNeeded();
      await addBtn.click();
      
      // Verify item was added (button should change to quantity controls)
      await page.waitForTimeout(500);
      
      // Check localStorage
      const cartAfterAdd = await page.evaluate(() => {
        const cart = localStorage.getItem('goodrest_cart');
        return cart ? JSON.parse(cart) : [];
      });
      console.log(`Cart after adding ${item.name}:`, cartAfterAdd.length, 'items');
      expect(cartAfterAdd.length).toBeGreaterThanOrEqual(1);
      
      // Navigate to checkout
      await page.goto(`${BASE_URL}/checkout`);
      await page.waitForTimeout(1000);
      
      // Check if cart is empty at checkout (THE BUG)
      const cartAtCheckout = await page.evaluate(() => {
        const cart = localStorage.getItem('goodrest_cart');
        return cart ? JSON.parse(cart) : [];
      });
      
      console.log(`Cart at checkout (cycle ${cycle + 1}):`, cartAtCheckout.length, 'items');
      
      // THE BUG: Cart shows empty at checkout after multiple cycles
      if (cartAtCheckout.length === 0) {
        console.error(`❌ BUG REPRODUCED at cycle ${cycle + 1}: Cart is empty at checkout!`);
      }
      
      // Verify checkout shows items (not "Your cart is empty")
      const emptyCartMessage = page.getByText('Your cart is empty.');
      const isCartEmpty = await emptyCartMessage.isVisible().catch(() => false);
      
      if (isCartEmpty) {
        console.error(`❌ BUG CONFIRMED: "Your cart is empty" shown at checkout`);
        
        // Take screenshot for evidence
        await page.screenshot({ path: `tests/bug-evidence-cycle-${cycle + 1}.png` });
      }
      
      expect(cartAtCheckout.length).toBeGreaterThanOrEqual(1);
      expect(isCartEmpty).toBe(false);
      
      // Go back to menu for next cycle
      await page.goto(BASE_URL);
      await page.waitForTimeout(500);
    }
  });

  test('rapid add/remove operations should not corrupt cart', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.removeItem('goodrest_cart'));
    
    // Rapidly add and remove items
    for (let i = 0; i < 10; i++) {
      const addBtn = page.getByRole('button', { name: 'Add Butter Chicken to cart' });
      await addBtn.scrollIntoViewIfNeeded();
      await addBtn.click();
      await page.waitForTimeout(100);
      
      const removeBtn = page.getByRole('button', { name: 'Remove one Butter Chicken' });
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(100);
      }
    }
    
    // Check final state
    const cart = await page.evaluate(() => {
      const data = localStorage.getItem('goodrest_cart');
      return data ? JSON.parse(data) : [];
    });
    
    console.log('Cart after rapid operations:', cart.length, 'items');
    // Should be 0 items (all removed) but not corrupted
    expect(Array.isArray(cart)).toBe(true);
  });

  test('navigation race condition: add item then immediately navigate', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.removeItem('goodrest_cart'));
    
    // Add item and immediately navigate (potential race condition)
    const addBtn = page.getByRole('button', { name: 'Add Butter Chicken to cart' });
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    
    // Navigate immediately without waiting
    await Promise.all([
      page.waitForNavigation(),
      page.goto(`${BASE_URL}/checkout`)
    ]);
    
    await page.waitForTimeout(1000);
    
    // Check if cart persisted
    const cart = await page.evaluate(() => {
      const data = localStorage.getItem('goodrest_cart');
      return data ? JSON.parse(data) : [];
    });
    
    console.log('Cart after race condition:', cart.length, 'items');
    
    const emptyCart = page.getByText('Your cart is empty.');
    const isCartEmpty = await emptyCart.isVisible().catch(() => false);
    
    if (isCartEmpty) {
      console.error('❌ RACE CONDITION BUG: Cart empty after rapid navigation');
      await page.screenshot({ path: 'tests/bug-evidence-race-condition.png' });
    }
    
    expect(cart.length).toBeGreaterThanOrEqual(1);
  });
});
