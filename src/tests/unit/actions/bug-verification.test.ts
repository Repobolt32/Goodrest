import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
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
  default: { compare: vi.fn().mockResolvedValue(true) },
}));

const authMocks = vi.hoisted(() => ({
  signRiderSession: vi.fn().mockResolvedValue('signed_token_123'),
  verifyRiderToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyRiderToken: authMocks.verifyRiderToken,
  signRiderSession: authMocks.signRiderSession,
}));

// Import AFTER mocks
import { loginRider, acceptOrder } from '@/app/actions/riderActions';
import bcrypt from 'bcryptjs';

describe('BUG #2 VERIFICATION: Rider session token is returned and verified', () => {
  const VALID_RIDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const VALID_ORDER_ID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.signRiderSession.mockReset();
    authMocks.signRiderSession.mockResolvedValue('signed_token_123');
    authMocks.verifyRiderToken.mockReset();
    
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

  it('loginRider signs the session and returns the token directly', async () => {
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
    expect(result.token).toBe('signed_token_123');
  });

  it('verifyRiderToken is verified and fails when verifyRiderToken returns success: false', async () => {
    authMocks.verifyRiderToken.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

    const result = await acceptOrder('invalid_token', VALID_ORDER_ID, VALID_RIDER_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
    expect(authMocks.verifyRiderToken).toHaveBeenCalledWith('invalid_token');
  });
});
