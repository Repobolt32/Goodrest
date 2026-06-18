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

describe.skip('COD Integration: Offline Restaurant Rejection', () => {
  let testOrderId: string | null = null;
  let originalE2E: string | undefined;

  beforeAll(() => {
    originalE2E = process.env.E2E_MODE;
    process.env.E2E_MODE = 'true';
    authMocks.verifyCustomerSession.mockResolvedValue({ success: true, session: { phone: '9999999999' } });
    authMocks.signCustomerSession.mockResolvedValue('mock-token');
  });

  afterAll(async () => {
    process.env.E2E_MODE = originalE2E;
    if (testOrderId) {
      await supabase.from('order_items').delete().eq('order_id', testOrderId);
      await supabase.from('orders').delete().eq('id', testOrderId);
    }
    await supabase.from('restaurant_settings').update({ online_status: true }).eq('id', 1);
  });

  it('should reject COD order when restaurant is offline', async () => {
    const { error: settingsError } = await supabase
      .from('restaurant_settings')
      .update({ online_status: false })
      .eq('id', 1);

    expect(settingsError).toBeNull();

    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('online_status')
      .eq('id', 1)
      .single();

    expect(settings?.online_status).toBe(false);

    const input = {
      customer_name: 'Offline Test',
      customer_phone: '9800000002',
      delivery_address: 'Offline Street',
      payment_method: 'cod' as const,
      items: [
        {
          id: 'garlic-naan',
          name: 'Garlic Naan',
          price: 60,
          category: 'Main Course' as Category,
          tags: [],
          is_available: true,
          quantity: 1,
        },
      ],
      total_amount: 60,
    };

    const result = await createOrder(input);
    expect(result.success).toBe(false);
    expect(result.error).toContain('unavailable');
  }, 15000);

  it('should allow COD order after restaurant comes back online', async () => {
    const { error: settingsError } = await supabase
      .from('restaurant_settings')
      .update({ online_status: true })
      .eq('id', 1);

    expect(settingsError).toBeNull();

    const input = {
      customer_name: 'Online Test',
      customer_phone: '9800000003',
      delivery_address: 'Online Street',
      payment_method: 'cod' as const,
      items: [
        {
          id: 'jeera-rice',
          name: 'Jeera Rice',
          price: 120,
          category: 'Main Course' as Category,
          tags: [],
          is_available: true,
          quantity: 1,
        },
      ],
      total_amount: 120,
    };

    const result = await createOrder(input);
    expect(result.success).toBe(true);
    testOrderId = result.data?.id || null;
    expect(testOrderId).toBeTruthy();

    const { data: order } = await supabase
      .from('orders')
      .select('order_status')
      .eq('id', testOrderId as string)
      .single();

    expect(order?.order_status).toBe('confirmed');
  }, 15000);
});
