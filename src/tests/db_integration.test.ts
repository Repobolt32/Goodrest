import { describe, it, expect, afterAll } from 'vitest';
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
    }
    
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

  afterAll(async () => {
    console.log('Cleaning up integration test data...');
    
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
