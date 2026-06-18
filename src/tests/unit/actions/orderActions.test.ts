import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrderInput } from '@/app/actions/orderActions';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
  mockNeq: vi.fn(),
  mockIn: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  verifyCustomerSession: vi.fn(),
  signCustomerSession: vi.fn(),
  verifyAdminSession: vi.fn(),
}));

const rzpMocks = vi.hoisted(() => ({
  razorpayOrdersCreate: vi.fn(() => Promise.resolve({ id: 'rzp_test_order_123' })),
  validatePaymentVerification: vi.fn(() => true),
}));

const distanceMocks = vi.hoisted(() => ({
  getGoogleMapsRouteData: vi.fn().mockResolvedValue({ distanceKm: 2.5, durationSeconds: 300 }),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
    rpc: mocks.mockRpc,
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyCustomerSession: authMocks.verifyCustomerSession,
  signCustomerSession: authMocks.signCustomerSession,
  verifyAdminSession: authMocks.verifyAdminSession,
}));

vi.mock('jose', () => ({
  jwtVerify: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/razorpay', () => ({
  razorpay: {
    orders: {
      create: rzpMocks.razorpayOrdersCreate,
    },
  },
}));

vi.mock('razorpay/dist/utils/razorpay-utils', () => ({
  validatePaymentVerification: rzpMocks.validatePaymentVerification,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
}));

vi.mock('@/app/actions/distanceActions', () => ({
  getGoogleMapsRouteData: distanceMocks.getGoogleMapsRouteData,
}));

import {
  createOrder,
  generateRazorpayOrder,
  verifyPaymentSignature,
  cancelOrder,
  updateRefundStatus,
} from '@/app/actions/orderActions';
import { redactPhone } from '@/lib/redaction';

describe('orderActions', () => {
  let currentTable = '';
  const validInput = {
    customer_name: 'Test User',
    customer_phone: '1234567890',
    delivery_address: '123 Test St',
    items: [{ id: 'item1', name: 'Pizza', price: 200, quantity: 2 }],
    total_amount: 400,
    payment_method: 'online' as const,
    lat: 24.79,
    lng: 85.01,
  } as unknown as OrderInput;

  const chain = {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    eq: mocks.mockEq,
    neq: mocks.mockNeq,
    in: mocks.mockIn,
    single: mocks.mockSingle,
  };

  beforeEach(() => {
    currentTable = '';
    // Reset all mocks to prevent leak pollution across tests
    mocks.mockFrom.mockReset();
    mocks.mockSelect.mockReset();
    mocks.mockInsert.mockReset();
    mocks.mockUpdate.mockReset();
    mocks.mockEq.mockReset();
    mocks.mockNeq.mockReset();
    mocks.mockIn.mockReset();
    mocks.mockSingle.mockReset();
    mocks.mockRpc.mockReset();
    rzpMocks.razorpayOrdersCreate.mockReset();
    rzpMocks.validatePaymentVerification.mockReset();
    distanceMocks.getGoogleMapsRouteData.mockReset();
    distanceMocks.getGoogleMapsRouteData.mockResolvedValue({ distanceKm: 2.5, durationSeconds: 300 });
    authMocks.verifyCustomerSession.mockReset();
    authMocks.verifyCustomerSession.mockResolvedValue({ success: true, session: { phone: '1234567890' } });
    authMocks.signCustomerSession.mockReset();
    authMocks.signCustomerSession.mockResolvedValue('mock-jwt-token-customer');

    mocks.mockFrom.mockImplementation((table) => {
      currentTable = table;
      return chain;
    });
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockInsert.mockReturnValue(chain);
    mocks.mockUpdate.mockReturnValue(chain);
    mocks.mockNeq.mockReturnValue(chain);

    mocks.mockEq.mockImplementation(() => {
      if (currentTable === 'offers') {
        return Promise.resolve({
          data: [],
          error: null,
        });
      }
      return chain;
    });

    mocks.mockIn.mockImplementation(() => {
      if (currentTable === 'menu_items') {
        return Promise.resolve({ data: [{ id: 'item1', price: 200 }], error: null });
      }
      return chain;
    });

    // Default stable leaf-node return values
    mocks.mockSingle.mockResolvedValue({
      data: {
        id: 'order-1',
        online_status: true,
        payment_status: 'pending',
        total_amount: 400,
        razorpay_order_id: null,
        customer_phone: '1234567890',
        order_status: 'confirmed',
      },
      error: null,
    });
    mocks.mockRpc.mockResolvedValue({ data: 'order-1', error: null });
    rzpMocks.razorpayOrdersCreate.mockResolvedValue({ id: 'rzp_test_order_123' });
    rzpMocks.validatePaymentVerification.mockReturnValue(true);
  });

  describe('createOrder', () => {
    it('should create order successfully for online payment', async () => {
      const result = await createOrder(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.id).toBe('order-1');
      }
    });

    it('should reject order with missing fields', async () => {
      const result = await createOrder({ ...validInput, customer_name: '' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Name must be at least 2 characters.');
    });

    it('should reject order with empty items', async () => {
      const result = await createOrder({ ...validInput, items: [] });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid menu items');
    });

    it('should always validate prices from DB even with test item IDs', async () => {
      // CRITICAL: E2E_MODE must not bypass DB price validation
      process.env.E2E_MODE = 'true';
      mocks.mockIn.mockResolvedValueOnce({
        data: [], // DB returns empty — test item ID '1' not found in real menu
        error: null,
      });

      const result = await createOrder({
        ...validInput,
        items: [{ id: '1', name: 'Test Burger', price: 1, quantity: 2 }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid menu items');
    });

    it('should return error on DB failure', async () => {
      mocks.mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const result = await createOrder(validInput);
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });

    it.skip('should set COD orders as placed immediately', async () => {
      await createOrder({ ...validInput, payment_method: 'cod' });
      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.order_status).toBe('confirmed');
    });

    it('should set customer_session cookie on successful order creation', async () => {
      mocks.mockRpc.mockResolvedValue({ data: 'test-order-id-123', error: null });
      const mockSet = vi.fn();
      const { cookies } = await import('next/headers');
      vi.mocked(cookies).mockResolvedValue({
        set: mockSet,
        get: vi.fn(),
        delete: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const result = await createOrder(validInput);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-order-id-123');
      expect(authMocks.signCustomerSession).toHaveBeenCalledWith('1234567890');
      expect(authMocks.signCustomerSession).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        'customer_session',
        'mock-jwt-token-customer',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        }
      );
    });

    it('should set online payment orders as created (pending payment)', async () => {
      await createOrder({ ...validInput, payment_method: 'online' });
      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.order_status).toBe('created');
    });

    it('should apply discount_percent offer to order total', async () => {
      mocks.mockEq.mockImplementation(() => {
        if (currentTable === 'offers') {
          // offers.eq('active', true) → resolve with offer data
          return Promise.resolve({
            data: [{ id: 'offer-d1', type: 'discount_percent', config: { percent: 10, max_amount: 50 }, active: true, start_time: null, end_time: null }],
            error: null,
          });
        }
        // restaurant_settings.eq('id', 1) → return chain for .single()
        return chain;
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.discount_amount).toBe(40);
      expect(rpcCall.p_order.applied_offers).toEqual([
        { id: 'offer-d1', type: 'discount_percent', config: { percent: 10, max_amount: 50 } },
      ]);
    });

    it('should cap discount at max_amount', async () => {
      mocks.mockEq.mockImplementation(() => {
        if (currentTable === 'offers') {
          return Promise.resolve({
            data: [{ id: 'offer-d2', type: 'discount_percent', config: { percent: 20, max_amount: 50 }, active: true, start_time: null, end_time: null }],
            error: null,
          });
        }
        return chain;
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.discount_amount).toBe(50);
    });

    it('should cap discount at subtotal (cannot exceed order total)', async () => {
      mocks.mockEq.mockImplementation(() => {
        if (currentTable === 'offers') {
          return Promise.resolve({
            data: [{ id: 'offer-d3', type: 'discount_percent', config: { percent: 50, max_amount: 999 }, active: true, start_time: null, end_time: null }],
            error: null,
          });
        }
        return chain;
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.discount_amount).toBe(200);
    });

    it('should apply free_delivery offer when order meets threshold', async () => {
      mocks.mockEq.mockImplementation(() => {
        if (currentTable === 'offers') {
          return Promise.resolve({
            data: [{ id: 'offer-f1', type: 'free_delivery', config: { threshold: 200 }, active: true, start_time: null, end_time: null }],
            error: null,
          });
        }
        return chain;
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.delivery_fee).toBe(0);
    });

    it('should not apply free_delivery when order below threshold', async () => {
      mocks.mockEq.mockImplementation(() => {
        if (currentTable === 'offers') {
          return Promise.resolve({
            data: [{ id: 'offer-f2', type: 'free_delivery', config: { threshold: 500 }, active: true, start_time: null, end_time: null }],
            error: null,
          });
        }
        return chain;
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      // 2.5km → delivery fee = 35 (UPTO_3KM slab)
      expect(rpcCall.p_order.delivery_fee).toBe(35);
    });

    it('should not apply expired offers', async () => {
      mocks.mockEq.mockImplementation(() => {
        if (currentTable === 'offers') {
          return Promise.resolve({
            data: [{ id: 'offer-exp', type: 'discount_percent', config: { percent: 50 }, active: true, start_time: '2020-01-01T00:00:00Z', end_time: '2020-12-31T23:59:59Z' }],
            error: null,
          });
        }
        return chain;
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.discount_amount).toBe(0);
      expect(rpcCall.p_order.applied_offers).toBeNull();
    });

    it('should handle no active offers gracefully', async () => {
      mocks.mockEq.mockImplementation(() => {
        if (currentTable === 'offers') {
          return Promise.resolve({ data: [], error: null });
        }
        return chain;
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.discount_amount).toBe(0);
      expect(rpcCall.p_order.delivery_fee).toBe(35);
      expect(rpcCall.p_order.applied_offers).toBeNull();
    });

    it('should apply both discount and free_delivery simultaneously', async () => {
      mocks.mockEq.mockImplementation(() => {
        if (currentTable === 'offers') {
          return Promise.resolve({
            data: [
              { id: 'offer-d', type: 'discount_percent', config: { percent: 10 }, active: true, start_time: null, end_time: null },
              { id: 'offer-f', type: 'free_delivery', config: { threshold: 200 }, active: true, start_time: null, end_time: null },
            ],
            error: null,
          });
        }
        return chain;
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.discount_amount).toBe(40);
      expect(rpcCall.p_order.delivery_fee).toBe(0);
      expect(rpcCall.p_order.applied_offers).toHaveLength(2);
    });
  });

  describe('generateRazorpayOrder', () => {
    it('should return error if order not found', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const result = await generateRazorpayOrder('nonexistent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should return error if order already paid', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', payment_status: 'paid', total_amount: 400 },
        error: null,
      });

      const result = await generateRazorpayOrder('order-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order already paid');
    });

    it('should reuse existing razorpay_order_id (idempotency)', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', payment_status: 'pending', total_amount: 400, razorpay_order_id: 'rzp_existing' },
        error: null,
      });

      const result = await generateRazorpayOrder('order-1');
      expect(result.success).toBe(true);
      expect(result.razorpayOrderId).toBe('rzp_existing');
    });

    it('should return error when Razorpay API call fails', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', payment_status: 'pending', total_amount: 400, razorpay_order_id: null },
        error: null,
      });
      rzpMocks.razorpayOrdersCreate.mockRejectedValueOnce(new Error('Razorpay API down'));

      const result = await generateRazorpayOrder('order-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate payment link');
    });

    it('should still succeed when DB trace update fails (RP order created)', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', payment_status: 'pending', total_amount: 400, razorpay_order_id: null },
        error: null,
      });
      rzpMocks.razorpayOrdersCreate.mockResolvedValueOnce({ id: 'rzp_new_order_123' });
      
      // First eq call is select query (returns chain), second eq is update query (returns DB failure)
      mocks.mockEq
        .mockReturnValueOnce(chain)
        .mockResolvedValueOnce({ error: { message: 'DB trace failed' } });

      const result = await generateRazorpayOrder('order-1');
      expect(result.success).toBe(true);
      expect(result.razorpayOrderId).toBe('rzp_new_order_123');
    });

    it('should compute correct amount in paise', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', payment_status: 'pending', total_amount: 250.50, razorpay_order_id: null },
        error: null,
      });
      rzpMocks.razorpayOrdersCreate.mockResolvedValueOnce({ id: 'rzp_new_order' });
      
      mocks.mockEq
        .mockReturnValueOnce(chain)
        .mockResolvedValueOnce({ error: null });

      const result = await generateRazorpayOrder('order-1');
      expect(result.success).toBe(true);
      expect(result.amount).toBe(25050);
      expect(rzpMocks.razorpayOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 25050, currency: 'INR' })
      );
    });
  });

  describe('verifyPaymentSignature', () => {
    const mockCallback = {
      razorpay_order_id: 'rzp_order_123',
      razorpay_payment_id: 'pay_test_abc',
      razorpay_signature: 'sig_123',
    };

    it('should verify payment and update DB', async () => {
      const ORIGINAL_E2E = process.env.E2E_MODE;
      process.env.E2E_MODE = 'true';

      try {
        mocks.mockSingle
          .mockResolvedValueOnce({ data: { id: 'order-1', payment_status: 'pending' }, error: null })
          .mockResolvedValueOnce({ data: { id: 'order-1' }, error: null });

        const result = await verifyPaymentSignature(mockCallback);
        expect(result.success).toBe(true);
      } finally {
        process.env.E2E_MODE = ORIGINAL_E2E;
      }
    });

    it('should reject invalid signature', async () => {
      rzpMocks.validatePaymentVerification.mockReturnValue(false);

      process.env.E2E_MODE = 'false';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';

      const result = await verifyPaymentSignature(mockCallback);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Signature verification failed.');
    });

    it('should never bypass signature verification for pay_test_ IDs', async () => {
      // CRITICAL: E2E_MODE must not bypass real signature verification
      process.env.E2E_MODE = 'true';
      process.env.NODE_ENV = 'development'; // not production
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';
      rzpMocks.validatePaymentVerification.mockReturnValue(false);

      const testCallback = {
        razorpay_order_id: 'rzp_order_123',
        razorpay_payment_id: 'pay_test_abc',
        razorpay_signature: 'invalid_sig',
      };

      const result = await verifyPaymentSignature(testCallback);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Signature verification failed.');
    });

    it('should be idempotent for already paid orders', async () => {
      const ORIGINAL_E2E = process.env.E2E_MODE;
      process.env.E2E_MODE = 'true';

      try {
        mocks.mockSingle.mockResolvedValueOnce({
          data: { id: 'order-1', payment_status: 'paid' },
          error: null,
        });

        const result = await verifyPaymentSignature(mockCallback);
        expect(result.success).toBe(true);
        expect(result.message).toBe('Already processed');
      } finally {
        process.env.E2E_MODE = ORIGINAL_E2E;
      }
    });

    it('should verify payment with valid HMAC in normal (non-E2E) mode', async () => {
      const ORIGINAL_E2E = process.env.E2E_MODE;
      process.env.E2E_MODE = 'false';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret';
      rzpMocks.validatePaymentVerification.mockReturnValue(true);

      try {
        mocks.mockSingle
          .mockResolvedValueOnce({ data: { id: 'order-normal', payment_status: 'pending' }, error: null })
          .mockResolvedValueOnce({ data: { id: 'order-normal' }, error: null });

        const result = await verifyPaymentSignature(mockCallback);
        expect(result.success).toBe(true);
        expect(rzpMocks.validatePaymentVerification).toHaveBeenCalledWith(
          { order_id: 'rzp_order_123', payment_id: 'pay_test_abc' },
          'sig_123',
          'test_secret'
        );
      } finally {
        process.env.E2E_MODE = ORIGINAL_E2E;
      }
    });

    it('should return success if DB update finds no pending row (race condition)', async () => {
      const ORIGINAL_E2E = process.env.E2E_MODE;
      process.env.E2E_MODE = 'true';

      try {
        mocks.mockSingle
          .mockResolvedValueOnce({ data: { id: 'order-race', payment_status: 'pending' }, error: null })
          .mockResolvedValueOnce({ data: null, error: null });

        const result = await verifyPaymentSignature(mockCallback);
        expect(result.success).toBe(true);
        expect(result.message).toBe('Already processed');
      } finally {
        process.env.E2E_MODE = ORIGINAL_E2E;
      }
    });

    it('should return error when order not found by razorpay_order_id', async () => {
      const ORIGINAL_E2E = process.env.E2E_MODE;
      process.env.E2E_MODE = 'true';

      try {
        mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

        const result = await verifyPaymentSignature(mockCallback);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Order trace failed');
      } finally {
        process.env.E2E_MODE = ORIGINAL_E2E;
      }
    });

    it('should return error when RAZORPAY_KEY_SECRET is not configured', async () => {
      const ORIGINAL_E2E = process.env.E2E_MODE;
      const ORIGINAL_SECRET = process.env.RAZORPAY_KEY_SECRET;
      process.env.E2E_MODE = 'false';
      delete process.env.RAZORPAY_KEY_SECRET;

      try {
        const result = await verifyPaymentSignature(mockCallback);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Server configuration error');
      } finally {
        process.env.E2E_MODE = ORIGINAL_E2E;
        if (ORIGINAL_SECRET) process.env.RAZORPAY_KEY_SECRET = ORIGINAL_SECRET;
      }
    });
  });

  describe('Price Tampering Prevention', () => {
    it('should ignore client total_amount and recalculate from DB prices', async () => {
      mocks.mockIn.mockResolvedValueOnce({
        data: [{ id: 'item1', price: 200 }],
        error: null,
      });

      const result = await createOrder({
        ...validInput,
        total_amount: 1,
        items: [{ id: 'item1', name: 'Pizza', price: 1, quantity: 2 }],
      } as OrderInput);

      expect(result.success).toBe(true);
      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.total_amount).toBe(435); // 400 items + 35 delivery fee (2.5km mock)
    });

    it('should reject order with zero quantity item', async () => {
      const result = await createOrder({
        ...validInput,
        items: [{ id: 'item1', name: 'Pizza', price: 200, quantity: 0 }],
      } as OrderInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid quantity');
    });

    it('should reject order with negative quantity item', async () => {
      const result = await createOrder({
        ...validInput,
        items: [{ id: 'item1', name: 'Pizza', price: 200, quantity: -1 }],
      } as OrderInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid quantity');
    });

    it('should reject order with non-existent item IDs', async () => {
      mocks.mockIn.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await createOrder({
        ...validInput,
        items: [{ id: 'nonexistent-id', name: 'Ghost', price: 100, quantity: 1 }],
      } as OrderInput);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid menu items');
    });
  });

  describe('Payment Flow (Online Only)', () => {
    it('should set online orders with order_status=created (pending payment)', async () => {
      const result = await createOrder({ ...validInput, payment_method: 'online' });
      expect(result.success).toBe(true);

      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.order_status).toBe('created');
      expect(rpcCall.p_order.payment_method).toBe('online');
    });
  });

  describe('Double-Payment / Double-Verification Idempotency', () => {
    it('generateRazorpayOrder returns same RP ID on duplicate calls', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: { id: 'order-1', payment_status: 'pending', total_amount: 400, razorpay_order_id: 'rzp_existing' },
        error: null,
      });

      const result1 = await generateRazorpayOrder('order-1');
      const result2 = await generateRazorpayOrder('order-1');
      expect(result1.razorpayOrderId).toBe('rzp_existing');
      expect(result2.razorpayOrderId).toBe('rzp_existing');
      expect(rzpMocks.razorpayOrdersCreate).not.toHaveBeenCalled();
    });

    it('verifyPaymentSignature skips already-paid orders (no double-confirm)', async () => {
      const ORIGINAL_E2E = process.env.E2E_MODE;
      process.env.E2E_MODE = 'true';
      try {
        mocks.mockSingle.mockResolvedValue({
          data: { id: 'order-1', payment_status: 'paid' },
          error: null,
        });

        const result = await verifyPaymentSignature({
          razorpay_order_id: 'rzp_order_123',
          razorpay_payment_id: 'pay_test_abc',
          razorpay_signature: 'sig_123',
        });
        expect(result.success).toBe(true);
        expect(result.message).toBe('Already processed');
        expect(mocks.mockUpdate).not.toHaveBeenCalled();
      } finally {
        process.env.E2E_MODE = ORIGINAL_E2E;
      }
    });

    it('cancelOrder is idempotent — second call returns success', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', order_status: 'cancelled', customer_phone: '1234567890' },
        error: null,
      });

      const result = await cancelOrder('order-1', 'Already cancelled');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Order is already cancelled');
    });

    it('cancelOrder rejects double-cancel of delivered order', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', order_status: 'delivered', customer_phone: '1234567890' },
        error: null,
      });

      const result = await cancelOrder('order-1', 'Too late');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot cancel');
    });

    it('cancelOrder rejects when session phone does not match order customer_phone', async () => {
      authMocks.verifyCustomerSession.mockResolvedValueOnce({ success: true, session: { phone: '9999999999' } });
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', order_status: 'confirmed', customer_phone: '1234567890' },
        error: null,
      });

      const result = await cancelOrder('order-1', 'Wrong user');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not authorized');
    });

    it('cancelOrder rejects when no customer session exists', async () => {
      authMocks.verifyCustomerSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await cancelOrder('order-1', 'No session');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not authorized');
    });
  });

  describe('updateRefundStatus', () => {
    it('should update refund_status for cancelled order', async () => {
      authMocks.verifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: 'order-1', order_status: 'cancelled' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'order-1', refund_status: 'refunded' }, error: null });

      const result = await updateRefundStatus('order-1', 'refunded');
      expect(result.success).toBe(true);
      expect(result.data?.refund_status).toBe('refunded');
    });

    it('should reject update for non-cancelled order', async () => {
      authMocks.verifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: 'order-1', order_status: 'confirmed' },
        error: null,
      });

      const result = await updateRefundStatus('order-1', 'refunded');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only cancelled orders');
    });

    it('should reject without admin session', async () => {
      authMocks.verifyAdminSession.mockResolvedValue({ success: false, error: 'Unauthorized' });

      const result = await updateRefundStatus('order-1', 'refunded');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should use verifyAdminSession instead of manual cookie reading', async () => {
      authMocks.verifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

      mocks.mockSingle
        .mockResolvedValueOnce({ data: { id: 'order-1', order_status: 'cancelled' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'order-1', refund_status: 'refunded' }, error: null });

      const result = await updateRefundStatus('order-1', 'refunded');
      expect(authMocks.verifyAdminSession).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Server-side delivery fee & input sanitization', () => {
    // Tracer bullet: input names/address with HTML are sanitized before DB insert
    it('should sanitize script tags in customer_name and delivery_address', async () => {
      mocks.mockIn.mockResolvedValueOnce({
        data: [{ id: 'item1', price: 200 }],
        error: null,
      });

      const result = await createOrder({
        ...validInput,
        customer_name: '<script>alert("xss")</script>Test',
        delivery_address: '123 <img src=x onerror=alert(1)> Street',
      });
      expect(result.success).toBe(true);
      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.customer_name).not.toContain('<');
      expect(rpcCall.p_order.delivery_address).not.toContain('<');
    });

    it('should save distance_km and duration_seconds on order creation', async () => {
      mocks.mockIn.mockResolvedValueOnce({
        data: [{ id: 'item1', price: 200 }],
        error: null,
      });

      const result = await createOrder({ ...validInput, lat: 24.79, lng: 85.01 });
      expect(result.success).toBe(true);
      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      expect(rpcCall.p_order.distance_km).toBeDefined();
      expect(rpcCall.p_order.duration_seconds).toBeDefined();
    });

    it('should add delivery fee to total_amount on order creation', async () => {
      // Mock menu_items price fetch (terminal: .in())
      mocks.mockIn.mockResolvedValueOnce({
        data: [{ id: 'item1', price: 200 }],
        error: null,
      });
      // Mock restaurant_settings online_status check (terminal: .single())
      mocks.mockSingle.mockResolvedValueOnce({
        data: { online_status: true },
        error: null,
      });

      const result = await createOrder(validInput);
      expect(result.success).toBe(true);
      const rpcCall = mocks.mockRpc.mock.calls[0][1];
      const serverTotal = rpcCall.p_order.total_amount;
      expect(serverTotal).toBeGreaterThanOrEqual(400); // includes delivery fee
    });
  });
});

describe('redactPhone', () => {
  it('should redact phone in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(redactPhone('9876543210')).toBe('****3210');
      expect(redactPhone('1234')).toBe('****');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should return full phone in non-production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(redactPhone('9876543210')).toBe('9876543210');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
