import { createOrder } from '@/app/actions/orderActions';
import { supabase } from '@/lib/supabase';
import { Category, MenuItem, CartItem } from '@/types/menu';

describe('Billing Infrastructure Integration', () => {
  let createdOrderId: string | null = null;
  const TEST_PHONE = '9800000001';

  it('should generate a sequential friendly_id and capture correct item prices', async () => {
    // 1. Arrange: Get a real menu item to ensure trigger has something to look up
    const { data: menuItem, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .limit(1)
      .single();
    
    expect(menuError).toBeNull();
    if (!menuItem) throw new Error('No menu items found for test');

    const input = {
      customer_name: 'Test Billing User',
      customer_phone: TEST_PHONE,
      delivery_address: '123 Integration Lane',
      payment_method: 'online' as const,
      items: [
        { 
          id: menuItem.id,
          name: menuItem.name,
          price: Number(menuItem.price),
          category: (menuItem.category || 'Other') as Category,
          category_id: menuItem.category_id || undefined,
          tags: Array.isArray(menuItem.tags) ? (menuItem.tags as string[]) : [],
          is_available: !!menuItem.is_available,
          quantity: 2
        } as CartItem
      ],
      total_amount: (Number(menuItem.price) || 0) * 2
    };

    // 2. Act: Create the order
    const result = await createOrder(input);
    expect(result.success).toBe(true);
    createdOrderId = result.data?.id || null;
    if (!createdOrderId) throw new Error('Order creation failed to return ID');

    // 3. Assert: Verify the audit-proof records in the database
    // A. Verify the Order record
    const { data: order, error: fetchOrderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', createdOrderId as string)
      .single();
    
    expect(fetchOrderError).toBeNull();
    if (!order) throw new Error('Order not found after creation');
    expect(order.friendly_id).toMatch(/^#GR-\d+$/);
    console.log(`[Test] Generated Friendly ID: ${order.friendly_id}`);

    // B. Verify the Order Items (Relational)
    const { data: items, error: fetchItemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', createdOrderId as string);
    
    expect(fetchItemsError).toBeNull();
    expect(items).not.toBeNull();
    expect(items!).toHaveLength(1);
    
    const capturedItem = items![0];
    expect(capturedItem.menu_item_id).toBe(menuItem.id);
    expect(capturedItem.quantity).toBe(2);
    
    // THE MOST IMPORTANT ASSERTION: Price must match menu price at insertion
    // (Handled by the tr_capture_price_at_order trigger)
    expect(Number(capturedItem.price_at_order)).toBe(Number(menuItem.price));
    console.log(`[Test] Captured Price at Order: ${capturedItem.price_at_order} (Menu Price: ${menuItem.price})`);

  }, 15000); // Allow for network/DB latency

  afterAll(async () => {
    if (createdOrderId) {
      console.log(`Cleaning up test order ${createdOrderId}...`);
      await supabase.from('order_items').delete().eq('order_id', createdOrderId);
      await supabase.from('orders').delete().eq('id', createdOrderId);
    }
  });
});
