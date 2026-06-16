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

const cookieStore = vi.hoisted(() => ({
  store: new Map<string, string>(),
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

cookieStore.set.mockImplementation((name: string, value: string) => {
  cookieStore.store.set(name, value);
});
cookieStore.get.mockImplementation((name: string) => {
  const val = cookieStore.store.get(name);
  return val ? { name, value: val } : undefined;
});
cookieStore.delete.mockImplementation((name: string) => {
  cookieStore.store.delete(name);
});

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(cookieStore),
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

// Mock auth: signRiderSession uses real jose, verifyRiderSession uses real jose + our mocked cookies
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
    // Override verifyRiderSession to use our known secret + mocked cookies
    verifyRiderSession: async () => {
      const session = cookieStore.get('rider_session')?.value;
      if (!session) {
        return { success: false, error: 'Unauthorized' };
      }
      try {
        const { jwtVerify } = await import('jose');
        const { payload } = await jwtVerify(session, REAL_JWT_SECRET);
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

describe('BUG-14 FIX: Real cookie round-trip — loginRider → acceptOrder', () => {
  const RIDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const ORDER_ID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.store.clear();

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

  it('loginRider sets real JWT cookie, acceptOrder reads and verifies it', async () => {
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

    // Cookie was set with a real JWT
    const cookieVal = cookieStore.store.get('rider_session');
    expect(cookieVal).toBeDefined();
    expect(cookieVal!.split('.')).toHaveLength(3); // JWT format

    // acceptOrder: verifyRiderSession reads cookie (real flow via our mock)
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

    const acceptResult = await acceptOrder(ORDER_ID, RIDER_ID);
    expect(acceptResult.success).toBe(true);
  });

  it('acceptOrder rejects when cookie is missing (real verifyRiderSession)', async () => {
    const result = await acceptOrder(ORDER_ID, RIDER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('acceptOrder rejects when cookie has invalid JWT (real verifyRiderSession)', async () => {
    cookieStore.store.set('rider_session', 'not-a-real-jwt');

    const result = await acceptOrder(ORDER_ID, RIDER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('acceptOrder rejects when rider session ID does not match riderId', async () => {
    // Create a valid JWT for a DIFFERENT rider
    const otherToken = await new SignJWT({ id: 'ffffffff-aaaa-bbbb-cccc-dddddddddddd', name: 'Other', phone: '1111111111' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(REAL_JWT_SECRET);

    cookieStore.store.set('rider_session', otherToken);

    const result = await acceptOrder(ORDER_ID, RIDER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized: rider session does not match');
  });
});
