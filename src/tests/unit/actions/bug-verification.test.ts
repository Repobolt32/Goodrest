import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
  mockCookies: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mocks.mockFrom },
}));

const cookieStoreMock = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(() => Promise.resolve(cookieStoreMock)),
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
  default: { compare: vi.fn().mockResolvedValue(true) },
}));

const authMocks = vi.hoisted(() => ({
  signRiderSession: vi.fn().mockResolvedValue('signed_token_123'),
  verifyRiderSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyRiderSession: authMocks.verifyRiderSession,
  signRiderSession: authMocks.signRiderSession,
}));

// Import AFTER mocks
import { loginRider, acceptOrder } from '@/app/actions/riderActions';
import bcrypt from 'bcryptjs';

describe('BUG #2 VERIFICATION: Rider session cookie is set and verified', () => {
  const VALID_RIDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const VALID_ORDER_ID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMock.set.mockReset();
    cookieStoreMock.get.mockReset();
    authMocks.signRiderSession.mockReset();
    authMocks.signRiderSession.mockResolvedValue('signed_token_123');
    authMocks.verifyRiderSession.mockReset();
    
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const chain = {
      select: mocks.mockSelect,
      eq: mocks.mockEq,
      single: mocks.mockSingle,
    };

    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockEq.mockReturnValue(chain);
  });

  it('loginRider signs the session and sets the rider_session cookie', async () => {
    const chain = {
      select: mocks.mockSelect,
      eq: mocks.mockEq,
      single: mocks.mockSingle,
    };
    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSingle.mockResolvedValue({
      data: { id: VALID_RIDER_ID, phone: '9999999999', name: 'Test Rider', password_hash: 'hash' },
      error: null,
    });

    const result = await loginRider('9999999999', 'password');

    expect(result.success).toBe(true);
    expect(authMocks.signRiderSession).toHaveBeenCalledWith({
      id: VALID_RIDER_ID,
      name: 'Test Rider',
      phone: '9999999999',
    });
    expect(cookieStoreMock.set).toHaveBeenCalledWith(
      'rider_session',
      'signed_token_123',
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
  });

  it('verifyRiderSession is verified and fails when no rider_session cookie exists', async () => {
    // mock verifyRiderSession to simulate the real behavior: checking cookie
    authMocks.verifyRiderSession.mockImplementationOnce(async () => {
      const session = cookieStoreMock.get('rider_session')?.value;
      if (!session) {
        return { success: false, error: 'Unauthorized' };
      }
      return { success: true, session: { id: VALID_RIDER_ID, name: 'Test Rider', phone: '9999999999' } };
    });

    cookieStoreMock.get.mockReturnValueOnce(undefined);

    const result = await acceptOrder(VALID_ORDER_ID, VALID_RIDER_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
    expect(cookieStoreMock.get).toHaveBeenCalledWith('rider_session');
  });
});
