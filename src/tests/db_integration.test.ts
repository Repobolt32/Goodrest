import { createOrder } from '@/app/actions/orderActions';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/menu';

// Test Data Constants
const TEST_PREFIX = 'TEST_USER_';
const TEST_PHONE_PREFIX = '999999';

describe('Database Integration: Order & Customer Flow', () => {
  const testOrderIds: string[] = [];
  const testCustomerPhones: string[] = [];

  it('successfully populates 8 diverse orders and ensures customer records are upserted', async () => {
    for (let i = 1; i <= 8; i++) {
       const phone = `${TEST_PHONE_PREFIX}${i.toString().padStart(4, '0')}`;
       const name = `${TEST_PREFIX}${i}`;
       const address = `${i*100}, Integration Street, Test City`;
       
       const input = {
         customer_name: name,
         customer_phone: phone,
         delivery_address: address,
         payment_method: (i % 2 === 0 ? 'cod' : 'online') as 'cod' | 'online',
         items: [
           { 
             id: '1', 
             name: 'Test Burger', 
             price: 100, 
             quantity: i, 
             category: 'Main Course' as Category, 
             tags: ['Test'], 
             is_available: true 
           },
           { 
             id: '2', 
             name: 'Test Drink', 
             price: 50, 
             quantity: 1, 
             category: 'Beverages' as Category, 
             tags: ['Test'], 
             is_available: true 
           }
         ],
         total_amount: (100 * i + 50)
       };

       const result = await createOrder(input);
       
       if (!result.success) {
         console.error(`Order ${i} failure:`, result.error);
       }
       
       expect(result.success).toBe(true);
       if (result.data?.id) testOrderIds.push(result.data.id);
       testCustomerPhones.push(phone);
    }

    expect(testOrderIds).toHaveLength(8);
    
    // Verify one of the records in the DB to ensure trigger fired
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', testOrderIds[0])
      .single();
      
    expect(orderError).toBeNull();
    expect(order).not.toBeNull();
    if (order) {
      expect(order.customer_name).toBe(`${TEST_PREFIX}1`);
      expect(order.order_status).toBe('created');
      expect(order.payment_method).toBe('online');
    }

    const { data: codOrder, error: codOrderError } = await supabase
      .from('orders')
      .select('payment_method')
      .eq('id', testOrderIds[1])
      .single();

    expect(codOrderError).toBeNull();
    expect(codOrder?.payment_method).toBe('cod');
    
    // Verify customer record was created/updated and count incremented via trigger
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', testCustomerPhones[0])
      .single();
      
    expect(customerError).toBeNull();
    expect(customer).not.toBeNull();
    if (customer) {
      expect(customer.name).toBe(`${TEST_PREFIX}1`);
      // Since we ran 8 iterations with unique phones, each phone should have 1 order
      expect(customer.total_orders).toBe(1);
    }
  }, 20000); // Higher timeout for real DB network calls

  it('persists audit-safe order_items rows even when cart item ids are not UUIDs', async () => {
    const phone = `${TEST_PHONE_PREFIX}9999`;
    const input = {
      customer_name: `${TEST_PREFIX}AUDIT`,
      customer_phone: phone,
      delivery_address: '999 Reliability Street, Test City',
      payment_method: 'online' as const,
      items: [
        {
          id: '1',
          name: 'Test Burger',
          price: 100,
          quantity: 2,
          category: 'Main Course' as Category,
          tags: ['Test'],
          is_available: true,
        },
        {
          id: '2',
          name: 'Test Drink',
          price: 50,
          quantity: 1,
          category: 'Beverages' as Category,
          tags: ['Test'],
          is_available: true,
        },
      ],
      total_amount: 250,
    };

    const result = await createOrder(input);

    expect(result.success).toBe(true);
    expect(result.data?.id).toBeTruthy();
    if (!result.data?.id) {
      return;
    }

    testOrderIds.push(result.data.id);
    testCustomerPhones.push(phone);

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', result.data.id);

    expect(itemsError).toBeNull();
    expect(items).not.toBeNull();
    expect(items).toHaveLength(2);
    expect(items?.map((item) => item.menu_item_id)).toEqual([null, null]);
    expect(items?.map((item) => Number(item.price_at_order))).toEqual([100, 50]);
  }, 15000);

  afterAll(async () => {
    console.log('Cleaning up integration test data...');
    
    if (testOrderIds.length > 0) {
      await supabase
        .from('order_items')
        .delete()
        .in('order_id', testOrderIds);
    }

    // Delete test orders
    if (testOrderIds.length > 0) {
      await supabase
        .from('orders')
        .delete()
        .in('id', testOrderIds);
    }
    
    // Delete test customers
    if (testCustomerPhones.length > 0) {
      await supabase
        .from('customers')
        .delete()
        .in('phone', testCustomerPhones);
    }
    
    console.log('Cleanup complete.');
  });
});
