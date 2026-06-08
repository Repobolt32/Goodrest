import { createOrder } from '@/app/actions/orderActions';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/menu';
import { vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  verifyCustomerSession: vi.fn().mockResolvedValue({ success: true, session: { phone: '9999999999' } }),
  signCustomerSession: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Test Data Constants
const TEST_PREFIX = 'TEST_USER_';
const TEST_PHONE_PREFIX = '999999';

const isDBConfigured = 
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-anon-key');

describe.skipIf(!isDBConfigured)('Database Integration: Order & Customer Flow', () => {
  const testOrderIds: string[] = [];
  const testCustomerPhones: string[] = [];
  let originalE2E: string | undefined;
  let testMenuItems: { id: string; name: string; price: number; category: string | null; tags: string[] | null; is_available: boolean | null }[] = [];

  beforeAll(async () => {
    originalE2E = process.env.E2E_MODE;
    process.env.E2E_MODE = 'true';

    // Fetch real menu items from DB for testing
    const { data: menuItems, error } = await supabase
      .from('menu_items')
      .select('*')
      .limit(2);

    if (error || !menuItems || menuItems.length < 2) {
      throw new Error(`Failed to fetch menu items for integration test: ${error?.message || 'Not enough items'}`);
    }
    testMenuItems = menuItems;
  });

  it('successfully populates 8 diverse orders and ensures customer records are upserted', async () => {
    const item1 = testMenuItems[0];
    const item2 = testMenuItems[1];

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
             id: item1.id,
             name: item1.name,
             price: Number(item1.price),
             quantity: i,
             category: (item1.category || 'Other') as Category,
             tags: Array.isArray(item1.tags) ? item1.tags : [],
             is_available: !!item1.is_available
           },
           {
             id: item2.id,
             name: item2.name,
             price: Number(item2.price),
             quantity: 1,
             category: (item2.category || 'Other') as Category,
             tags: Array.isArray(item2.tags) ? item2.tags : [],
             is_available: !!item2.is_available
           }
         ],
         total_amount: (Number(item1.price) * i + Number(item2.price))
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
      // Tolerate stale data from prior interrupted runs
      expect(customer.total_orders).toBeGreaterThanOrEqual(1);
    }
  }, 60000); // Higher timeout for real DB network calls

  it('persists audit-safe order_items rows with real menu item IDs', async () => {
    const item1 = testMenuItems[0];
    const item2 = testMenuItems[1];
    const phone = `${TEST_PHONE_PREFIX}9999`;
    const input = {
      customer_name: `${TEST_PREFIX}AUDIT`,
      customer_phone: phone,
      delivery_address: '999 Reliability Street, Test City',
      payment_method: 'online' as const,
      items: [
        {
          id: item1.id,
          name: item1.name,
          price: Number(item1.price),
          quantity: 2,
          category: (item1.category || 'Other') as Category,
          tags: Array.isArray(item1.tags) ? item1.tags : [],
          is_available: !!item1.is_available,
        },
        {
          id: item2.id,
          name: item2.name,
          price: Number(item2.price),
          quantity: 1,
          category: (item2.category || 'Other') as Category,
          tags: Array.isArray(item2.tags) ? item2.tags : [],
          is_available: !!item2.is_available,
        },
      ],
      total_amount: Number(item1.price) * 2 + Number(item2.price),
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
    // Non-UUID item IDs result in menu_item_id = null; UUID IDs would be stored
    const expectedMenuIds = [item1.id, item2.id].map(id =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null
    );
    expect(items?.map((item) => item.menu_item_id)).toEqual(expectedMenuIds);
    expect(items?.map((item) => Number(item.price_at_order))).toEqual([Number(item1.price), Number(item2.price)]);
  }, 15000);

  afterAll(async () => {
    process.env.E2E_MODE = originalE2E;
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
