import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockIs: vi.fn(),
  mockIn: vi.fn(),
  mockNot: vi.fn(),
  mockGte: vi.fn(),
  mockLte: vi.fn(),
  mockOrder: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockVerifyAdminSession: vi.fn(),
  mockVerifyCustomerSession: vi.fn(),
}));

const distanceMocks = vi.hoisted(() => ({
  getGoogleMapsRouteData: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: mocks.mockVerifyAdminSession,
  verifyCustomerSession: mocks.mockVerifyCustomerSession,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
    rpc: mocks.mockRpc,
  },
}));

vi.mock('@/app/actions/distanceActions', () => ({
  getGoogleMapsRouteData: distanceMocks.getGoogleMapsRouteData,
}));

vi.mock('next/cache', () => ({
  revalidatePath: cacheMocks.revalidatePath,
}));

import { cancelOrder } from '@/app/actions/orderActions';
import { acceptOrder as ownerAcceptOrder, markFoodReady, dispatchOrder } from '@/app/actions/ownerActions';
import { acceptOrder as riderAcceptOrder, startRiding, markOrderAsDeliveredRider } from '@/app/actions/riderActions';

describe('Order Lifecycle State Machine Tests', () => {
  const VALID_RIDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const VALID_ORDER_ID = '11111111-2222-3333-4444-555555555555';
  const CUSTOMER_PHONE = '1234567890';

  const chain = {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    eq: mocks.mockEq,
    is: mocks.mockIs,
    in: mocks.mockIn,
    not: mocks.mockNot,
    gte: mocks.mockGte,
    lte: mocks.mockLte,
    order: mocks.mockOrder,
    single: mocks.mockSingle,
    maybeSingle: mocks.mockMaybeSingle,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default admin session is valid
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });
    mocks.mockVerifyCustomerSession.mockResolvedValue({ success: true, session: { phone: CUSTOMER_PHONE } });

    // Setup default chain return values
    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockInsert.mockReturnValue(chain);
    mocks.mockUpdate.mockReturnValue(chain);
    mocks.mockEq.mockReturnValue(chain);
    mocks.mockIs.mockReturnValue(chain);
    mocks.mockIn.mockReturnValue(chain);
    mocks.mockNot.mockReturnValue(chain);
    mocks.mockGte.mockReturnValue(chain);
    mocks.mockLte.mockReturnValue(chain);
    mocks.mockOrder.mockReturnValue(chain);

    // Default single resolves
    mocks.mockSingle.mockResolvedValue({ data: { id: VALID_ORDER_ID, customer_phone: CUSTOMER_PHONE, order_status: 'placed' }, error: null });
    mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  // ─── 1. cancelOrder transitions ────────────────────────────────────
  describe('cancelOrder', () => {
    it('should allow cancel from placed', async () => {
      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'placed', customer_phone: CUSTOMER_PHONE }, error: null }) // SELECT lookup
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'cancelled', cancelled_by: 'customer' }, error: null }); // UPDATE result

      const result = await cancelOrder(VALID_ORDER_ID, 'Not hungry');
      expect(result.success).toBe(true);
      expect(result.data?.order_status).toBe('cancelled');
    });

    it('should allow cancel from confirmed', async () => {
      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'confirmed', customer_phone: CUSTOMER_PHONE }, error: null })
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'cancelled', cancelled_by: 'customer' }, error: null });

      const result = await cancelOrder(VALID_ORDER_ID, 'Change of mind');
      expect(result.success).toBe(true);
      expect(result.data?.order_status).toBe('cancelled');
    });

    it('should allow cancel from preparing', async () => {
      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'preparing', customer_phone: CUSTOMER_PHONE }, error: null })
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'cancelled', cancelled_by: 'customer' }, error: null });

      const result = await cancelOrder(VALID_ORDER_ID, 'Taking too long');
      expect(result.success).toBe(true);
      expect(result.data?.order_status).toBe('cancelled');
    });

    it('should reject cancel from out_for_delivery', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: VALID_ORDER_ID, order_status: 'out_for_delivery', customer_phone: CUSTOMER_PHONE },
        error: null,
      });

      const result = await cancelOrder(VALID_ORDER_ID, 'Too late');
      expect(result.success).toBe(false);
      expect(result.error).toContain('out for delivery'); // Space assertion fix
    });

    it('should reject cancel from delivered', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: VALID_ORDER_ID, order_status: 'delivered', customer_phone: CUSTOMER_PHONE },
        error: null,
      });

      const result = await cancelOrder(VALID_ORDER_ID, 'Too late');
      expect(result.success).toBe(false);
      expect(result.error).toContain('delivered');
    });

    it('should reject cancel from cancelled (idempotent)', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: VALID_ORDER_ID, order_status: 'cancelled', customer_phone: CUSTOMER_PHONE },
        error: null,
      });

      const result = await cancelOrder(VALID_ORDER_ID, 'Already cancelled');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Order is already cancelled');
    });

    it('should reject cancel if customer phone does not match', async () => {
      mocks.mockVerifyCustomerSession.mockResolvedValueOnce({ success: true, session: { phone: '9999999999' } });
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: VALID_ORDER_ID, order_status: 'placed', customer_phone: CUSTOMER_PHONE },
        error: null,
      });

      const result = await cancelOrder(VALID_ORDER_ID, 'Not authorized');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authorized to cancel this order');
    });

    it('should allow cancel with reason and phone verification', async () => {
      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'placed', customer_phone: CUSTOMER_PHONE }, error: null })
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'cancelled', cancelled_by: 'customer', cancel_reason: 'Mistake' }, error: null });

      const result = await cancelOrder(VALID_ORDER_ID, 'Mistake');
      expect(result.success).toBe(true);
      expect(result.data?.order_status).toBe('cancelled');
    });
  });

  // ─── 2. ownerAcceptOrder transitions ──────────────────────────────
  describe('ownerAcceptOrder', () => {
    it('should transition confirmed → preparing', async () => {
      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'confirmed', lat: 24.79, lng: 85.01, total_amount: 400 }, error: null }) // SELECT lookup
        .mockResolvedValueOnce({ data: { prep_time_minutes: 20 }, error: null }) // settings lookup
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'preparing' }, error: null }); // UPDATE result

      distanceMocks.getGoogleMapsRouteData.mockResolvedValueOnce({ distanceKm: 5.0, durationSeconds: 900 });

      const result = await ownerAcceptOrder(VALID_ORDER_ID);
      expect(result.success).toBe(true);
      expect(result.data?.order_status).toBe('preparing');
    });

    it('should reject if not confirmed', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: VALID_ORDER_ID, order_status: 'placed', lat: null, lng: null, total_amount: 400 },
        error: null,
      });

      const result = await ownerAcceptOrder(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Can only accept confirmed orders');
    });

    it('should reject if order not found', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const result = await ownerAcceptOrder(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should reject if unauthorized', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await ownerAcceptOrder(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  // ─── 3. markFoodReady transitions ──────────────────────────────────
  describe('markFoodReady', () => {
    it('should transition preparing → ready', async () => {
      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'preparing' }, error: null })
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'ready' }, error: null });

      const result = await markFoodReady(VALID_ORDER_ID);
      expect(result.success).toBe(true);
      expect(result.data?.order_status).toBe('ready');
    });

    it('should reject if not preparing', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: VALID_ORDER_ID, order_status: 'confirmed' },
        error: null,
      });

      const result = await markFoodReady(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Can only mark preparing orders as ready');
    });

    it('should reject if order not found', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const result = await markFoodReady(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should reject if unauthorized', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await markFoodReady(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  // ─── 4. dispatchOrder transitions ──────────────────────────────────
  describe('dispatchOrder', () => {
    it('should set manual_dispatch to true when ready', async () => {
      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'ready', rider_id: VALID_RIDER_ID, duration_seconds: 900 }, error: null })
        .mockResolvedValueOnce({ data: { id: VALID_ORDER_ID, order_status: 'ready', manual_dispatch: true }, error: null });

      const result = await dispatchOrder(VALID_ORDER_ID);
      expect(result.success).toBe(true);
      expect(result.data?.manual_dispatch).toBe(true);
    });

    it('should reject if not ready', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: VALID_ORDER_ID, order_status: 'preparing', rider_id: VALID_RIDER_ID },
        error: null,
      });

      const result = await dispatchOrder(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Can only dispatch ready orders');
    });

    it('should reject if no rider assigned', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: VALID_ORDER_ID, order_status: 'ready', rider_id: null },
        error: null,
      });

      const result = await dispatchOrder(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot dispatch without a rider. Assign a rider first.');
    });

    it('should reject if order not found', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const result = await dispatchOrder(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should reject if unauthorized', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await dispatchOrder(VALID_ORDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  // ─── 5. riderAcceptOrder transitions ──────────────────────────────
  describe('riderAcceptOrder', () => {
    it('should assign rider to order when order is preparing or ready', async () => {
      const mockOrder = { distance_km: 5.2, duration_seconds: 600, lat: 24.79, lng: 85.01 };
      const mockRider = { phone: '8888888888' };
      const mockUpdatedRows = [{ id: VALID_ORDER_ID }];

      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: null }, error: null }) }) }) }) // early rider_id check
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockOrder, error: null }) }) }) }) // order details
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockRider, error: null }) }) }) }) // rider phone
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ not: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }) // active orders check
        .mockReturnValueOnce({ // FCFS update
          update: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({
                  select: () => Promise.resolve({ data: mockUpdatedRows, error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await riderAcceptOrder(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(true);
      expect((result as { earning: number }).earning).toBe(34);
    });

    it('should reject if order already taken (no rows updated)', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: 'other-rider' }, error: null }) }) }) }); // early check: taken

      const result = await riderAcceptOrder(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order already taken or no longer available');
    });

    it('should reject if rider does not exist', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }) }) }) }); // verifyRiderExists fails

      const result = await riderAcceptOrder(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rider not found');
    });
  });

  // ─── 6. startRiding transitions ───────────────────────────────────
  describe('startRiding', () => {
    it('should transition ready/preparing → out_for_delivery if manual_dispatch is true', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: VALID_RIDER_ID, order_status: 'ready', manual_dispatch: true }, error: null }) }) }) }) // order select
        .mockReturnValueOnce({ // update order
          update: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  eq: () => Promise.resolve({ error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await startRiding(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(true);
    });

    it('should reject if manual_dispatch is false/null', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: VALID_RIDER_ID, order_status: 'ready', manual_dispatch: false }, error: null }) }) }) });

      const result = await startRiding(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Waiting for restaurant handover');
    });

    it('should reject if order status is not ready or preparing', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: VALID_RIDER_ID, order_status: 'placed' }, error: null }) }) }) });

      const result = await startRiding(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot start riding order with status');
    });

    it('should reject if order belongs to a different rider', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: 'other-rider', order_status: 'ready' }, error: null }) }) }) });

      const result = await startRiding(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not your order');
    });

    it('should reject if rider does not exist', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }) }) }) }); // verifyRiderExists fails

      const result = await startRiding(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rider not found');
    });
  });

  // ─── 7. markOrderAsDeliveredRider transitions ───────────────────────
  describe('markOrderAsDeliveredRider', () => {
    it('should transition out_for_delivery → delivered', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: VALID_RIDER_ID, order_status: 'out_for_delivery', rider_earning: 150 }, error: null }) }) }) }); // order select

      mocks.mockRpc.mockResolvedValueOnce({ error: null });

      const result = await markOrderAsDeliveredRider(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(true);
      expect(mocks.mockRpc).toHaveBeenCalledWith('deliver_order', {
        p_order_id: VALID_ORDER_ID,
        p_rider_id: VALID_RIDER_ID,
        p_rider_earning: 150,
      });
    });

    it('should reject if not out_for_delivery', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: VALID_RIDER_ID, order_status: 'ready', rider_earning: 150 }, error: null }) }) }) });

      const result = await markOrderAsDeliveredRider(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order must be out for delivery');
    });

    it('should reject if order belongs to a different rider', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: 'other-rider', order_status: 'out_for_delivery', rider_earning: 150 }, error: null }) }) }) });

      const result = await markOrderAsDeliveredRider(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not your order');
    });

    it('should preserve rider_earning on transition', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null }) }) }) }) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: VALID_RIDER_ID, order_status: 'out_for_delivery', rider_earning: 450 }, error: null }) }) }) }); // order select

      mocks.mockRpc.mockResolvedValueOnce({ error: null });

      const result = await markOrderAsDeliveredRider(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(true);
      expect(mocks.mockRpc).toHaveBeenCalledWith('deliver_order', {
        p_order_id: VALID_ORDER_ID,
        p_rider_id: VALID_RIDER_ID,
        p_rider_earning: 450, // earning preserved perfectly
      });
    });

    it('should reject if rider does not exist', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }) }) }) }); // verifyRiderExists fails

      const result = await markOrderAsDeliveredRider(VALID_ORDER_ID, VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rider not found');
    });
  });
});
