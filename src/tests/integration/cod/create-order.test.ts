import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createOrder } from '@/app/actions/orderActions';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/menu';

const authMocks = vi.hoisted(() => ({
  verifyCustomerSession: vi.fn(),
  signCustomerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyCustomerSession: authMocks.verifyCustomerSession,
  signCustomerSession: authMocks.signCustomerSession,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

const isDBConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-anon-key');

describe('COD Integration: Create Order', () => {
  let testOrderId: string | null = null;
  const TEST_PHONE = '9800000001';
  let originalE2E: string | undefined;

  beforeAll(() => {
    originalE2E = process.env.E2E_MODE;
    process.env.E2E_MODE = 'true';
    authMocks.verifyCustomerSession.mockResolvedValue({ success: true, session: { phone: TEST_PHONE } });
    authMocks.signCustomerSession.mockResolvedValue('mock-token');
  });

  afterAll(async () => {
    process.env.E2E_MODE = originalE2E;
    if (testOrderId) {
      await supabase.from('order_items').delete().eq('order_id', testOrderId);
      await supabase.from('orders').delete().eq('id', testOrderId);
    }
  });

  it('should create a real COD order with status confirmed and persist items', async () => {
    const input = {
      customer_name: 'COD Create Test',
      customer_phone: TEST_PHONE,
      delivery_address: '123 Integration Lane',
      payment_method: 'cod' as const,
      items: [
        {
          id: 'garlic-naan',
          name: 'Garlic Naan',
          price: 60,
          category: 'Main Course' as Category,
          tags: [],
          is_available: true,
          quantity: 2,
        },
      ],
      total_amount: 120,
      lat: 24.79,
      lng: 85.01,
    };

    const result = await createOrder(input);
    expect(result.success).toBe(true);
    testOrderId = result.data?.id || null;
    expect(testOrderId).toBeTruthy();

    // Verify order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', testOrderId as string)
      .single();

    expect(orderError).toBeNull();
    expect(order).not.toBeNull();
    expect(order!.order_status).toBe('confirmed');
    expect(order!.payment_method).toBe('cod');
    expect(order!.payment_status).toBe('pending');
    expect(order!.customer_name).toBe('COD Create Test');
    expect(order!.customer_phone).toBe(TEST_PHONE);

    // Verify order_items persisted
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', testOrderId as string);

    expect(itemsError).toBeNull();
    expect(items).not.toBeNull();
    expect(items!).toHaveLength(1);
    expect(items![0].quantity).toBe(2);
    expect(Number(items![0].price_at_order)).toBe(60);
  }, 15000);
});
