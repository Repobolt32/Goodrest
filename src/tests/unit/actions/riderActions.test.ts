import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockEq: vi.fn(),
  mockIs: vi.fn(),
  mockIn: vi.fn(),
  mockNot: vi.fn(),
  mockGte: vi.fn(),
  mockLte: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockVerifyAdminSession: vi.fn(),
  mockVerifyRiderToken: vi.fn(),
}));

const distanceMocks = vi.hoisted(() => ({
  getGoogleMapsRouteData: vi.fn(),
}));

const revalidateMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

const validationMocks = vi.hoisted(() => ({
  getRestoCoordinates: vi.fn().mockReturnValue({ lat: 24.79, lng: 85.01 }),
  isValidUUID: (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
}));

const cookiesMocks = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => cookiesMocks,
}));

const authMocks = vi.hoisted(() => ({
  signRiderSession: vi.fn().mockResolvedValue('signed_token_123'),
}));

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: mocks.mockVerifyAdminSession,
  verifyRiderToken: mocks.mockVerifyRiderToken,
  signRiderSession: authMocks.signRiderSession,
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

vi.mock('@/lib/validation', () => ({
  getRestoCoordinates: validationMocks.getRestoCoordinates,
  isValidUUID: validationMocks.isValidUUID,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidateMocks.revalidatePath,
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

import {
  loginRider,
  acceptOrder,
  startRiding,
  markOrderAsDeliveredRider,
  setRiderOnline,
  updateLocation,
  getRiderStats,
  getRiderActiveOrder,
  getUnassignedOrders,
  getRider24HHistory,
} from '@/app/actions/riderActions';

import bcrypt from 'bcryptjs';

interface AcceptOrderSuccess {
  success: boolean;
  distanceKm?: number | null;
  durationSeconds?: number | null;
  earning?: number;
  error?: string;
}

describe('riderActions', () => {
  const VALID_RIDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const VALID_ORDER_ID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    // Reset all mock functions to clear queued return values and call history
    mocks.mockSelect.mockReset();
    mocks.mockSingle.mockReset();
    mocks.mockMaybeSingle.mockReset();
    mocks.mockEq.mockReset();
    mocks.mockIs.mockReset();
    mocks.mockIn.mockReset();
    mocks.mockNot.mockReset();
    mocks.mockGte.mockReset();
    mocks.mockLte.mockReset();
    mocks.mockOrder.mockReset();
    mocks.mockLimit.mockReset();
    mocks.mockInsert.mockReset();
    mocks.mockUpdate.mockReset();
    mocks.mockFrom.mockReset();
    mocks.mockRpc.mockReset();
    mocks.mockVerifyAdminSession.mockReset();
    mocks.mockVerifyRiderToken.mockReset();
    distanceMocks.getGoogleMapsRouteData.mockReset();
    revalidateMocks.revalidatePath.mockReset();
    cookiesMocks.set.mockReset();
    cookiesMocks.get.mockReset();
    authMocks.signRiderSession.mockReset();
    authMocks.signRiderSession.mockResolvedValue('signed_token_123');

    // Default: admin session valid
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

    // Default: rider token valid
    mocks.mockVerifyRiderToken.mockResolvedValue({
      success: true,
      session: { id: VALID_RIDER_ID, name: 'Test Rider', phone: '9999999999' },
    });

    // Mock bcrypt compare by default
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    // Default chain that resolves most queries
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
      limit: mocks.mockLimit,
      single: mocks.mockSingle,
      maybeSingle: mocks.mockMaybeSingle,
    };

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
    mocks.mockLimit.mockReturnValue(chain);
    // Default single: resolve with a valid rider for verifyRiderExists
    mocks.mockSingle.mockResolvedValue({ data: { id: VALID_RIDER_ID }, error: null });
    mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  const mockRiderQuery = {
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: VALID_RIDER_ID }, error: null })
        })
      })
    })
  };



  // Helper: prepend verifyRiderExists mock to a mockFrom chain
  function mockRiderExists() {
    return mocks.mockFrom.mockReturnValueOnce(mockRiderQuery);
  }

  // ─── loginRider ───────────────────────────────────────────────────
  describe('loginRider', () => {
    it('should return rider data on valid credentials', async () => {
      const mockRider = { id: VALID_RIDER_ID, phone: '9999999999', name: 'Test Rider', password_hash: 'hashed_pw_123' };
      mocks.mockSingle.mockResolvedValueOnce({ data: mockRider, error: null });

      const result = await loginRider('9999999999', 'hashed_pw_123');
      
      expect(result.success).toBe(true);
      expect(result.rider).toEqual(mockRider);
      expect(result.token).toBe('signed_token_123');
      expect(mocks.mockFrom).toHaveBeenCalledWith('riders');
      expect(authMocks.signRiderSession).toHaveBeenCalledWith({
        id: VALID_RIDER_ID,
        name: 'Test Rider',
        phone: '9999999999',
      });
    });

    it('should return error on invalid credentials', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const result = await loginRider('9999999999', 'wrong_pw');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone or password');
    });

    it('should return error when rider is deactivated', async () => {
      const mockRider = { id: VALID_RIDER_ID, phone: '9999999999', name: 'Test Rider', password_hash: 'some_hash', is_active: false };
      mocks.mockSingle.mockResolvedValueOnce({ data: mockRider, error: null });

      const result = await loginRider('9999999999', 'test123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rider account is deactivated');
    });

    it('should handle unexpected bcrypt errors gracefully', async () => {
      const mockRider = { id: VALID_RIDER_ID, phone: '9999999999', name: 'Test Rider', password_hash: 'some_hash' };
      mocks.mockSingle.mockResolvedValueOnce({ data: mockRider, error: null });
      vi.spyOn(bcrypt, 'compare').mockRejectedValueOnce(new Error('bcrypt internal error') as never);

      const result = await loginRider('9999999999', 'test123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone or password');
    });

    it('should handle unexpected supabase query rejection gracefully', async () => {
      mocks.mockSingle.mockRejectedValueOnce(new Error('connection failed'));

      const result = await loginRider('9999999999', 'test123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error when rider has no password_hash field', async () => {
      const mockRider = { id: VALID_RIDER_ID, phone: '9999999999', name: 'Test Rider' };
      mocks.mockSingle.mockResolvedValueOnce({ data: mockRider, error: null });

      const result = await loginRider('9999999999', 'test123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone or password');
    });

    it('should accept plaintext password and compare against stored hash via bcrypt', async () => {
      const mockRider = { id: VALID_RIDER_ID, phone: '9999999999', name: 'Test Rider', password_hash: '$2b$10$hashed' };
      mocks.mockSingle.mockResolvedValueOnce({ data: mockRider, error: null });
      vi.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);

      const result = await loginRider('9999999999', 'plaintext_password');

      expect(result.success).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('plaintext_password', '$2b$10$hashed');
    });
  });

  // ─── acceptOrder ──────────────────────────────────────────────────
  describe('acceptOrder', () => {
    it('should reject when rider session is invalid', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject when the session token is empty', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await acceptOrder('', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject when rider session ID does not match riderId param', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({
        success: true,
        session: { id: 'different-rider-id', name: 'Other', phone: '1111111111' },
      });

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: rider session does not match');
    });

    it('should reject invalid UUID for orderId', async () => {
      const result = await acceptOrder('valid_token', 'not-a-uuid', VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid order or rider ID');
    });

    it('should reject invalid UUID for riderId', async () => {
      const result = await acceptOrder('valid_token', VALID_ORDER_ID, 'bad-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid order or rider ID');
    });

    it('should accept order with existing distance_km and compute earning', async () => {
      const mockOrder = { distance_km: 5.2, duration_seconds: 600, lat: 24.79, lng: 85.01 };
      const mockRider = { phone: '8888888888' };
      const mockUpdatedRows = [{ id: VALID_ORDER_ID }];

      mocks.mockFrom
        .mockReturnValueOnce(mockRiderQuery) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: null }, error: null }) }) }) }) // early rider_id check
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockOrder, error: null }) }) }) }) // order details
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockRider, error: null }) }) }) }) // rider phone
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ not: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }) }) }) }) // active orders check
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

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(true);
      expect((result as unknown as AcceptOrderSuccess).distanceKm).toBe(5.2);
      expect((result as unknown as AcceptOrderSuccess).earning).toBe(34); // new pricing: 15 + Math.ceil(5.2 - 5)*7 + Math.ceil(5.2)*2 = 15 + 7 + 12 = 34
    });

    it('should call getGoogleMapsRouteData when distance_km is missing', async () => {
      const mockOrder = { distance_km: null, duration_seconds: null, lat: 24.79, lng: 85.01 };
      const mockRider = { phone: '8888888888' };
      const mockUpdatedRows = [{ id: VALID_ORDER_ID }];

      distanceMocks.getGoogleMapsRouteData.mockResolvedValueOnce({ distanceKm: 3.5, durationSeconds: 600 });

      mocks.mockFrom
        .mockReturnValueOnce(mockRiderQuery) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: null }, error: null }) }) }) }) // early rider_id check
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockOrder, error: null }) }) }) }) // order details
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockRider, error: null }) }) }) }) // rider phone
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ not: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }) }) }) }) // active orders check
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

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(true);
      expect(distanceMocks.getGoogleMapsRouteData).toHaveBeenCalled();
      expect((result as unknown as AcceptOrderSuccess).distanceKm).toBe(3.5);
      expect((result as unknown as AcceptOrderSuccess).durationSeconds).toBe(600);
      expect((result as unknown as AcceptOrderSuccess).earning).toBe(53); // new pricing: 45 (upto 5km slab) + Math.ceil(3.5)*2 = 45 + 8 = 53
    });

    it('should return error when order is already taken (zero rows updated)', async () => {
      const mockOrder = { distance_km: 2, lat: null, lng: null };
      const mockRider = { phone: '8888888888' };

      mocks.mockFrom
        .mockReturnValueOnce(mockRiderQuery) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: null }, error: null }) }) }) }) // early rider_id check
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockOrder, error: null }) }) }) }) // order details
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockRider, error: null }) }) }) }) // rider phone
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ not: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }) }) }) }) // active orders check
        .mockReturnValueOnce({ // FCFS update returns empty
          update: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({
                  select: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order already taken or no longer available');
    });

    it('should reject immediately if order already has a rider_id (early race check)', async () => {
      mocks.mockFrom
        .mockReturnValueOnce(mockRiderQuery) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: 'some-other-rider' }, error: null }) }) }) }); // early rider_id check shows taken

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order already taken or no longer available');
    });

    it('should return error when FCFS update has DB error', async () => {
      const mockOrder = { distance_km: 2, lat: null, lng: null };
      const mockRider = { phone: '8888888888' };

      mocks.mockFrom
        .mockReturnValueOnce(mockRiderQuery) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: null }, error: null }) }) }) }) // early rider_id check
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockOrder, error: null }) }) }) }) // order details
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockRider, error: null }) }) }) }) // rider phone
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ not: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }) }) }) }) // active orders check
        .mockReturnValueOnce({ // FCFS update with DB error
          update: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({
                  select: () => Promise.resolve({ data: null, error: { message: 'DB failure' } }),
                }),
              }),
            }),
          }),
        });

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB failure');
    });

    it('should default earning to 41 when distance cannot be computed', async () => {
      const mockOrder = { distance_km: null, lat: null, lng: null };
      const mockRider = { phone: '8888888888' };
      const mockUpdatedRows = [{ id: VALID_ORDER_ID }];

      mocks.mockFrom
        .mockReturnValueOnce(mockRiderQuery) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: null }, error: null }) }) }) }) // early rider_id check
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockOrder, error: null }) }) }) }) // order details
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockRider, error: null }) }) }) }) // rider phone
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ not: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }) }) }) }) // active orders check
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

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(true);
      expect((result as unknown as AcceptOrderSuccess).earning).toBe(41); // default fallback earning
    });

    it('should reject via FCFS guard when early check passes but order taken before update', async () => {
      const mockOrder = { distance_km: 2, lat: null, lng: null };
      const mockRider = { phone: '8888888888' };

      mocks.mockFrom
        .mockReturnValueOnce(mockRiderQuery) // verifyRiderExists
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { rider_id: null }, error: null }) }) }) }) // early check: rider_id is null
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockOrder, error: null }) }) }) }) // order details
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockRider, error: null }) }) }) }) // rider phone
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ not: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }) }) }) }) // active orders check
        .mockReturnValueOnce({ // FCFS update: returns empty (another rider claimed it first)
          update: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({
                  select: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await acceptOrder('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order already taken or no longer available');
    });
  });

  // ─── startRiding ──────────────────────────────────────────────────
  describe('startRiding', () => {
    it('should reject when rider session is invalid', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await startRiding('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject when rider session ID does not match riderId param', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({
        success: true,
        session: { id: 'different-rider-id', name: 'Other', phone: '1111111111' },
      });

      const result = await startRiding('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: rider session does not match');
    });

    it('should reject invalid UUID', async () => {
      const result = await startRiding('valid_token', 'bad-id', VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid order or rider ID');
    });

    it('should return error when order belongs to a different rider', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { rider_id: 'other-rider-id', order_status: 'ready' },
              error: null,
            }),
          }),
        }),
      });

      const result = await startRiding('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not your order');
    });

    it('should succeed when order is already out_for_delivery', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { rider_id: VALID_RIDER_ID, order_status: 'out_for_delivery' },
              error: null,
            }),
          }),
        }),
      });

      const result = await startRiding('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(true);
    });

    it('should update status to out_for_delivery on valid request', async () => {
      mockRiderExists();
      // 1st call: fetch order
      mocks.mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { rider_id: VALID_RIDER_ID, order_status: 'ready', manual_dispatch: true },
                error: null,
              }),
            }),
          }),
        })
        // 2nd call: update order
        .mockReturnValueOnce({
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

      const result = await startRiding('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(true);
      expect(revalidateMocks.revalidatePath).toHaveBeenCalledWith('/admin/orders');
    });

    it('should update rider location when lat/lng provided', async () => {
      mockRiderExists();
      mocks.mockFrom
        // 1st call: fetch order
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { rider_id: VALID_RIDER_ID, order_status: 'ready', manual_dispatch: true },
                error: null,
              }),
            }),
          }),
        })
        // 2nd call: update order status
        .mockReturnValueOnce({
          update: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  eq: () => Promise.resolve({ error: null }),
                }),
              }),
            }),
          }),
        })
        // 3rd call: update rider location
        .mockReturnValueOnce({
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        });

      const result = await startRiding('valid_token', VALID_ORDER_ID, VALID_RIDER_ID, 28.6139, 77.209);

      expect(result.success).toBe(true);
      // Verify the 4th mock call was for updating the rider's location (1st is verifyRiderExists)
      expect(mocks.mockFrom).toHaveBeenNthCalledWith(4, 'riders');
    });

    it('should return error on DB update failure', async () => {
      mockRiderExists();
      mocks.mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { rider_id: VALID_RIDER_ID, order_status: 'ready', manual_dispatch: true },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  eq: () => Promise.resolve({ error: { message: 'Update failed' } }),
                }),
              }),
            }),
          }),
        });

      const result = await startRiding('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ─── markOrderAsDeliveredRider ─────────────────────────────────────
  describe('markOrderAsDeliveredRider', () => {
    it('should reject when rider session is invalid', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await markOrderAsDeliveredRider('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject when rider session ID does not match riderId param', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({
        success: true,
        session: { id: 'different-rider-id', name: 'Other', phone: '1111111111' },
      });

      const result = await markOrderAsDeliveredRider('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: rider session does not match');
    });

    it('should reject invalid UUID', async () => {
      const result = await markOrderAsDeliveredRider('valid_token', 'bad-id', VALID_RIDER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid order or rider ID');
    });

    it('should return error when order belongs to a different rider', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { rider_id: 'other-rider', order_status: 'out_for_delivery', rider_earning: 500 },
              error: null,
            }),
          }),
        }),
      });

      const result = await markOrderAsDeliveredRider('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not your order');
    });

    it('should return error when order status is not out_for_delivery', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { rider_id: VALID_RIDER_ID, order_status: 'ready', rider_earning: 500 },
              error: null,
            }),
          }),
        }),
      });

      const result = await markOrderAsDeliveredRider('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order must be out for delivery');
    });

    it('should call deliver_order RPC on valid request', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { rider_id: VALID_RIDER_ID, order_status: 'out_for_delivery', rider_earning: 650 },
              error: null,
            }),
          }),
        }),
      });

      mocks.mockRpc.mockResolvedValueOnce({ error: null });

      const result = await markOrderAsDeliveredRider('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(true);
      expect(mocks.mockRpc).toHaveBeenCalledWith('deliver_order', {
        p_order_id: VALID_ORDER_ID,
        p_rider_id: VALID_RIDER_ID,
        p_rider_earning: 650,
      });
    });

    it('should default rider_earning to 41 when not set', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { rider_id: VALID_RIDER_ID, order_status: 'out_for_delivery', rider_earning: null },
              error: null,
            }),
          }),
        }),
      });

      mocks.mockRpc.mockResolvedValueOnce({ error: null });

      await markOrderAsDeliveredRider('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(mocks.mockRpc).toHaveBeenCalledWith('deliver_order', {
        p_order_id: VALID_ORDER_ID,
        p_rider_id: VALID_RIDER_ID,
        p_rider_earning: 41,
      });
    });

    it('should return error on RPC failure', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { rider_id: VALID_RIDER_ID, order_status: 'out_for_delivery', rider_earning: 600 },
              error: null,
            }),
          }),
        }),
      });

      mocks.mockRpc.mockResolvedValueOnce({ error: { message: 'RPC failed' } });

      const result = await markOrderAsDeliveredRider('valid_token', VALID_ORDER_ID, VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC failed');
    });
  });

  // ─── updateLocation ──────────────────────────────────────────────
  describe('updateLocation', () => {
    it('should reject invalid UUID', async () => {
      const result = await updateLocation('valid_token', 'bad-id', 28.61, 77.20);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid rider ID');
    });

    it('should reject when rider session is invalid', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await updateLocation('valid_token', VALID_RIDER_ID, 28.61, 77.20);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject when rider session ID does not match riderId', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({
        success: true,
        session: { id: 'different-rider-id', name: 'Other', phone: '1111111111' },
      });

      const result = await updateLocation('valid_token', VALID_RIDER_ID, 28.61, 77.20);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: rider session does not match');
    });

    it('should update location with valid session', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      });
      mocks.mockInsert.mockReturnValueOnce(Promise.resolve({ error: null }));

      const result = await updateLocation('valid_token', VALID_RIDER_ID, 28.6139, 77.209);

      expect(result.success).toBe(true);
    });
  });

  // ─── setRiderOnline ──────────────────────────────────────────────
  describe('setRiderOnline', () => {
    it('should reject invalid UUID', async () => {
      const result = await setRiderOnline('valid_token', 'bad-id', true);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid rider ID');
    });

    it('should reject when rider session is invalid', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await setRiderOnline('valid_token', VALID_RIDER_ID, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject when rider session ID does not match riderId', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({
        success: true,
        session: { id: 'different-rider-id', name: 'Other', phone: '1111111111' },
      });

      const result = await setRiderOnline('valid_token', VALID_RIDER_ID, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: rider session does not match');
    });

    it('should update is_online to true with valid session', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      });

      const result = await setRiderOnline('valid_token', VALID_RIDER_ID, true);

      expect(result.success).toBe(true);
      expect(mocks.mockFrom).toHaveBeenCalledWith('riders');
    });

    it('should update is_online to false with valid session', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      });

      const result = await setRiderOnline('valid_token', VALID_RIDER_ID, false);

      expect(result.success).toBe(true);
    });

    it('should return error on DB failure', async () => {
      mockRiderExists();
      mocks.mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => Promise.resolve({ error: { message: 'Update failed' } }),
        }),
      });

      const result = await setRiderOnline('valid_token', VALID_RIDER_ID, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ─── getRiderStats ────────────────────────────────────────────────
  describe('getRiderStats', () => {
    it('should return zero stats for invalid UUID', async () => {
      const result = await getRiderStats('bad-id');

      expect(result.totalDeliveries).toBe(0);
      expect(result.totalEarnings).toBe(0);
      expect(result.todayDeliveries).toBe(0);
      expect(result.todayEarnings).toBe(0);
      expect(result.todayDistanceKm).toBe(0);
    });

    it('should return total stats from riders table and today stats from orders', async () => {
      mockRiderExists();
      mocks.mockSingle.mockResolvedValueOnce({
        data: { total_deliveries: 42, total_earnings: 25000 },
        error: null,
      });
      mocks.mockGte.mockResolvedValueOnce({ count: 3, error: null });
      mocks.mockGte.mockResolvedValueOnce({
        data: [
          { rider_earning: 550, distance_km: 5.0 },
          { rider_earning: 600, distance_km: 10.0 },
        ],
        error: null,
      });

      const result = await getRiderStats(VALID_RIDER_ID);

      expect(result.totalDeliveries).toBe(42);
      expect(result.totalEarnings).toBe(25000);
      expect(result.todayDeliveries).toBe(3);
      expect(result.todayEarnings).toBe(1150);
      expect(result.todayDistanceKm).toBe(15);
      expect(result.todayNightlyBonus).toBe(0);
    });

    it('should calculate nightly bonus for riders with >=6 and >=10 deliveries', async () => {
      // Test 6 deliveries (₹100 bonus)
      mockRiderExists();
      mocks.mockSingle.mockResolvedValueOnce({
        data: { total_deliveries: 10, total_earnings: 5000 },
        error: null,
      });
      mocks.mockGte.mockResolvedValueOnce({ count: 6, error: null });
      mocks.mockGte.mockResolvedValueOnce({
        data: Array(6).fill({ rider_earning: 50, distance_km: 2.0 }),
        error: null,
      });

      const result6 = await getRiderStats(VALID_RIDER_ID);
      expect(result6.todayDeliveries).toBe(6);
      expect(result6.todayNightlyBonus).toBe(100);
      expect(result6.todayEarnings).toBe(300 + 100); // 6 * 50 + 100
      expect(result6.totalEarnings).toBe(5000 + 100);

      // Test 10 deliveries (₹200 bonus)
      mockRiderExists();
      mocks.mockSingle.mockResolvedValueOnce({
        data: { total_deliveries: 20, total_earnings: 10000 },
        error: null,
      });
      mocks.mockGte.mockResolvedValueOnce({ count: 10, error: null });
      mocks.mockGte.mockResolvedValueOnce({
        data: Array(10).fill({ rider_earning: 50, distance_km: 2.0 }),
        error: null,
      });

      const result10 = await getRiderStats(VALID_RIDER_ID);
      expect(result10.todayDeliveries).toBe(10);
      expect(result10.todayNightlyBonus).toBe(200);
      expect(result10.todayEarnings).toBe(500 + 200); // 10 * 50 + 200
      expect(result10.totalEarnings).toBe(10000 + 200);
    });

    it('should handle null rider data gracefully', async () => {
      mockRiderExists();
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: null });
      mocks.mockGte.mockResolvedValueOnce({ count: 0, error: null });
      mocks.mockGte.mockResolvedValueOnce({ data: [], error: null });
      mocks.mockGte.mockResolvedValueOnce({ count: 0, error: null });
      mocks.mockGte.mockResolvedValueOnce({ data: [], error: null });

      const result = await getRiderStats(VALID_RIDER_ID);

      expect(result.totalDeliveries).toBe(0);
      expect(result.totalEarnings).toBe(0);
      expect(result.todayDeliveries).toBe(0);
      expect(result.todayEarnings).toBe(0);
    });
  });

  // ─── getRiderActiveOrder ──────────────────────────────────────────
  describe('getRiderActiveOrder', () => {
    it('should return null for invalid UUID', async () => {
      const result = await getRiderActiveOrder('bad-id');
      expect(result).toBeNull();
    });

    it('should return active order when one exists', async () => {
      const mockOrder = { id: VALID_ORDER_ID, order_status: 'out_for_delivery', rider_id: VALID_RIDER_ID };
      mockRiderExists();
      mocks.mockLimit.mockResolvedValueOnce({ data: [mockOrder], error: null });

      const result = await getRiderActiveOrder(VALID_RIDER_ID);

      expect(result).toEqual(mockOrder);
    });

    it('should return null when no active order exists', async () => {
      mockRiderExists();
      mocks.mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const result = await getRiderActiveOrder(VALID_RIDER_ID);

      expect(result).toBeNull();
    });
  });

  // ─── getUnassignedOrders ──────────────────────────────────────────
  describe('getUnassignedOrders', () => {
    it('should return unassigned orders ordered by created_at', async () => {
      const mockOrders = [
        { id: 'order-1', order_status: 'preparing', rider_id: null },
        { id: 'order-2', order_status: 'ready', rider_id: null },
      ];
      mocks.mockOrder.mockResolvedValueOnce({ data: mockOrders, error: null });

      const result = await getUnassignedOrders('valid_token');

      expect(result).toEqual(mockOrders);
      expect(mocks.mockFrom).toHaveBeenCalledWith('orders');
    });

    it('should return empty array when no unassigned orders', async () => {
      mocks.mockOrder.mockResolvedValueOnce({ data: null, error: null });

      const result = await getUnassignedOrders('valid_token');

      expect(result).toEqual([]);
    });
  });

  // ─── getRider24HHistory ───────────────────────────────────────────
  describe('getRider24HHistory', () => {
    it('should reject when rider session is invalid', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await getRider24HHistory('valid_token', VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject when rider session ID does not match riderId param', async () => {
      mocks.mockVerifyRiderToken.mockResolvedValueOnce({
        success: true,
        session: { id: 'different-rider-id', name: 'Other', phone: '1111111111' },
      });

      const result = await getRider24HHistory('valid_token', VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: rider session does not match');
    });

    it('should reject invalid UUID', async () => {
      const result = await getRider24HHistory('valid_token', 'bad-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid rider ID');
    });

    it('should fetch delivered orders from last 24 hours', async () => {
      mockRiderExists();
      const mockOrders = [
        { id: 'order-1', friendly_id: 'F1', customer_name: 'John', delivery_address: 'Addr 1', distance_km: 1.5, rider_earning: 41, delivered_at: new Date().toISOString() }
      ];
      mocks.mockLimit.mockResolvedValueOnce({ data: mockOrders, error: null });

      const result = await getRider24HHistory('valid_token', VALID_RIDER_ID);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrders);
    });

    it('should return error on query failure', async () => {
      mockRiderExists();
      mocks.mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

      const result = await getRider24HHistory('valid_token', VALID_RIDER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
