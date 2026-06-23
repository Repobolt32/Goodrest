// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
  mockIs: vi.fn(),
  mockIn: vi.fn(),
  mockNot: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mocks.mockFrom },
}));

vi.mock('@/lib/validation', () => ({
  getRestoCoordinates: vi.fn().mockReturnValue({ lat: 24.79, lng: 85.01 }),
  isValidUUID: (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
}));

vi.mock('@/app/actions/distanceActions', () => ({
  getGoogleMapsRouteData: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}));

// Mock auth: signRiderSession uses real jose, verifyRiderToken uses real jose
const REAL_JWT_SECRET = new TextEncoder().encode('test-jwt-secret-for-auth-integration-at-least-32-chars');

vi.mock('@/lib/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...original,
    // Override signRiderSession to use our known secret
    signRiderSession: async (payload: { id: string; name: string; phone: string }) => {
      return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(REAL_JWT_SECRET);
    },
    // Override verifyRiderToken to use our known secret
    verifyRiderToken: async (token: string) => {
      if (!token) {
        return { success: false, error: 'Unauthorized' };
      }
      try {
        const { jwtVerify } = await import('jose');
        const { payload } = await jwtVerify(token, REAL_JWT_SECRET);
        return {
          success: true,
          session: {
            id: payload.id as string,
            name: payload.name as string,
            phone: payload.phone as string,
          },
        };
      } catch {
        return { success: false, error: 'Unauthorized' };
      }
    },
  };
});

import { loginRider, acceptOrder } from '@/app/actions/riderActions';
import bcrypt from 'bcryptjs';

describe('BUG-14 FIX: Real token round-trip — loginRider → acceptOrder', () => {
  const RIDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const ORDER_ID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const defaultChain = {
      select: mocks.mockSelect,
      eq: mocks.mockEq,
      single: mocks.mockSingle,
      is: mocks.mockIs,
      in: mocks.mockIn,
      not: mocks.mockNot,
      update: mocks.mockUpdate,
      insert: mocks.mockInsert,
      maybeSingle: mocks.mockMaybeSingle,
    };
    mocks.mockFrom.mockReturnValue(defaultChain);
    mocks.mockSelect.mockReturnValue(defaultChain);
    mocks.mockEq.mockReturnValue(defaultChain);
    mocks.mockIs.mockReturnValue(defaultChain);
    mocks.mockIn.mockReturnValue(defaultChain);
    mocks.mockNot.mockReturnValue(defaultChain);
    mocks.mockUpdate.mockReturnValue(defaultChain);
    mocks.mockInsert.mockReturnValue(defaultChain);
  });

  it('loginRider returns real JWT token, acceptOrder reads and verifies it', async () => {
    const rider = {
      id: RIDER_ID,
      phone: '9999999999',
      name: 'Test Rider',
      password_hash: 'hashed_pw',
    };

    // loginRider: rider lookup
    mocks.mockSingle.mockResolvedValueOnce({ data: rider, error: null });

    const loginResult = await loginRider('9999999999', 'password');
    expect(loginResult.success).toBe(true);

    const token = loginResult.token;
    expect(token).toBeDefined();
    expect(token!.split('.')).toHaveLength(3); // JWT format

    // acceptOrder: verifyRiderToken reads token
    mocks.mockSingle
      .mockResolvedValueOnce({ data: { id: RIDER_ID }, error: null })       // verifyRiderExists
      .mockResolvedValueOnce({ data: { rider_id: null }, error: null })     // early race check
      .mockResolvedValueOnce({ data: { distance_km: 3, duration_seconds: 300, lat: 24.80, lng: 85.02 }, error: null }) // order details
      .mockResolvedValueOnce({ data: { phone: '9999999999' }, error: null }); // rider phone

    mocks.mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    mocks.mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [{ id: ORDER_ID }], error: null }),
          }),
        }),
      }),
    });

    const acceptResult = await acceptOrder(token!, ORDER_ID, RIDER_ID);
    expect(acceptResult.success).toBe(true);
  });

  it('acceptOrder rejects when token is missing (real verifyRiderToken)', async () => {
    const result = await acceptOrder('', ORDER_ID, RIDER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('acceptOrder rejects when token has invalid JWT (real verifyRiderToken)', async () => {
    const result = await acceptOrder('not-a-real-jwt', ORDER_ID, RIDER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('acceptOrder rejects when rider session ID does not match riderId', async () => {
    // Create a valid JWT for a DIFFERENT rider
    const otherToken = await new SignJWT({ id: 'ffffffff-aaaa-bbbb-cccc-dddddddddddd', name: 'Other', phone: '1111111111' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(REAL_JWT_SECRET);

    const result = await acceptOrder(otherToken, ORDER_ID, RIDER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized: rider session does not match');
  });
});
