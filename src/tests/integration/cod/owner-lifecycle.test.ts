import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createOrder } from '@/app/actions/orderActions';
import { acceptOrder, markFoodReady, dispatchOrder } from '@/app/actions/ownerActions';
import { acceptOrder as riderAcceptOrder, startRiding, markOrderAsDeliveredRider } from '@/app/actions/riderActions';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/menu';
import bcrypt from 'bcryptjs';

const authMocks = vi.hoisted(() => ({
  verifyCustomerSession: vi.fn(),
  signCustomerSession: vi.fn(),
  verifyAdminSession: vi.fn(),
  verifyRiderSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyCustomerSession: authMocks.verifyCustomerSession,
  signCustomerSession: authMocks.signCustomerSession,
  verifyAdminSession: authMocks.verifyAdminSession,
  verifyRiderSession: authMocks.verifyRiderSession,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn().mockImplementation((name: string) => {
      if (name === 'admin_session') return { value: 'mock-admin-token' };
      return undefined;
    }),
    delete: vi.fn(),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const isDBConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-anon-key');

describe('COD Integration: Owner Lifecycle', () => {
  let testOrderId: string | null = null;
  let testRiderId: string | null = null;
  let originalE2E: string | undefined;
  const TEST_PREFIX = 'INT_OWNER_LC';

  beforeAll(async () => {
    originalE2E = process.env.E2E_MODE;
    process.env.E2E_MODE = 'true';
    authMocks.verifyCustomerSession.mockResolvedValue({ success: true, session: { phone: '9999999999' } });
    authMocks.signCustomerSession.mockResolvedValue('mock-token');
    authMocks.verifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

    // Create a test rider for assignment
    const hashedPassword = await bcrypt.hash('testpass', 10);
    const { data: rider, error } = await supabase
      .from('riders')
      .insert({
        name: `${TEST_PREFIX}_Rider`,
        phone: `${TEST_PREFIX}_PHONE`,
        username: `${TEST_PREFIX}_user`,
        password_hash: hashedPassword,
        is_active: true,
        is_online: false,
      })
      .select()
      .single();

    if (error || !rider) throw new Error(`Failed to create test rider: ${error?.message}`);
    testRiderId = rider.id;

    authMocks.verifyRiderSession.mockResolvedValue({ success: true, session: { id: testRiderId } });
  });

  afterAll(async () => {
    process.env.E2E_MODE = originalE2E;
    if (testOrderId) {
      await supabase.from('order_items').delete().eq('order_id', testOrderId);
      await supabase.from('orders').delete().eq('id', testOrderId);
    }
    if (testRiderId) {
      await supabase.from('riders').delete().eq('id', testRiderId);
    }
  });

  it('should flow confirmed -> preparing -> ready -> dispatch -> out_for_delivery -> delivered', async () => {
    // 1. Create COD order (confirmed)
    const input = {
      customer_name: `${TEST_PREFIX}_Customer`,
      customer_phone: '9800000004',
      delivery_address: 'Lifecycle Street, Test City',
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
      lat: 24.79,
      lng: 85.01,
    };

    const createResult = await createOrder(input);
    expect(createResult.success).toBe(true);
    if (!createResult.success) {
      console.error('[owner-lifecycle.test.ts] createOrder failed:', createResult.error);
    }
    testOrderId = createResult.data?.id || null;
    expect(testOrderId).toBeTruthy();

    // Verify initial state: confirmed
    const { data: initialOrder } = await supabase
      .from('orders')
      .select('order_status, payment_method, payment_status')
      .eq('id', testOrderId as string)
      .single();

    expect(initialOrder?.order_status).toBe('confirmed');
    expect(initialOrder?.payment_method).toBe('cod');
    expect(initialOrder?.payment_status).toBe('pending');

    // 2. Owner accepts -> preparing
    const acceptResult = await acceptOrder(testOrderId as string);
    expect(acceptResult.success).toBe(true);

    const { data: preparingOrder } = await supabase
      .from('orders')
      .select('order_status, accepted_at, prep_deadline')
      .eq('id', testOrderId as string)
      .single();

    expect(preparingOrder?.order_status).toBe('preparing');
    expect(preparingOrder?.accepted_at).toBeTruthy();
    expect(preparingOrder?.prep_deadline).toBeTruthy();

    // 3. Rider accepts order (assigns rider_id)
    const riderAcceptResult = await riderAcceptOrder(testOrderId as string, testRiderId as string);
    expect(riderAcceptResult.success).toBe(true);

    const { data: riderAssignedOrder } = await supabase
      .from('orders')
      .select('rider_id, rider_phone, rider_accepted_at')
      .eq('id', testOrderId as string)
      .single();

    expect(riderAssignedOrder?.rider_id).toBe(testRiderId);
    expect(riderAssignedOrder?.rider_accepted_at).toBeTruthy();

    // 4. Owner marks food ready -> ready
    const readyResult = await markFoodReady(testOrderId as string);
    expect(readyResult.success).toBe(true);

    const { data: readyOrder } = await supabase
      .from('orders')
      .select('order_status, food_ready_at')
      .eq('id', testOrderId as string)
      .single();

    expect(readyOrder?.order_status).toBe('ready');
    expect(readyOrder?.food_ready_at).toBeTruthy();

    // 5. Owner dispatches -> manual_dispatch = true
    const dispatchResult = await dispatchOrder(testOrderId as string);
    expect(dispatchResult.success).toBe(true);

    const { data: dispatchedOrder } = await supabase
      .from('orders')
      .select('manual_dispatch, order_status')
      .eq('id', testOrderId as string)
      .single();

    expect(dispatchedOrder?.manual_dispatch).toBe(true);
    expect(dispatchedOrder?.order_status).toBe('out_for_delivery'); // status updated by dispatch

    // 6. Rider starts riding -> out_for_delivery
    const startResult = await startRiding(testOrderId as string, testRiderId as string, 24.7975, 85.01);
    expect(startResult.success).toBe(true);

    const { data: outForDeliveryOrder } = await supabase
      .from('orders')
      .select('order_status, rider_started_at')
      .eq('id', testOrderId as string)
      .single();

    expect(outForDeliveryOrder?.order_status).toBe('out_for_delivery');
    expect(outForDeliveryOrder?.rider_started_at).toBeTruthy();

    // 7. Rider marks delivered -> delivered
    const deliverResult = await markOrderAsDeliveredRider(testOrderId as string, testRiderId as string);
    expect(deliverResult.success).toBe(true);

    const { data: deliveredOrder } = await supabase
      .from('orders')
      .select('order_status, delivered_at')
      .eq('id', testOrderId as string)
      .single();

    expect(deliveredOrder?.order_status).toBe('delivered');
    expect(deliveredOrder?.delivered_at).toBeTruthy();
  }, 30000);
});
