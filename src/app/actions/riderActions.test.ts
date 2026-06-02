import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockVerifyAdminSession: vi.fn(),
  mockVerifyRiderSession: vi.fn(),
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
  mockIs: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({
  verifyAdminSession: mocks.mockVerifyAdminSession,
  verifyRiderSession: mocks.mockVerifyRiderSession,
}));


vi.mock('../../lib/supabaseAdmin', () => {
  return {
    supabaseAdmin: {
      from: mocks.mockFrom,
      rpc: vi.fn(() => Promise.resolve({ error: null })),
    },
  };
});

vi.mock('./distanceActions', () => ({
  getGoogleMapsRouteData: vi.fn(() => Promise.resolve(null)),
}));

import { getRiderByPhone, updateLocation, getUnassignedOrders } from './riderActions';

describe('riderActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerifyRiderSession.mockResolvedValue({
      success: true,
      session: { id: '00000000-0000-0000-0000-000000000001', name: 'Test Rider', phone: '9999999999' }
    });
    // Default: rider exists check returns valid rider
    mocks.mockSingle.mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null });
    mocks.mockEq.mockReturnValue({ single: mocks.mockSingle });
    mocks.mockIs.mockReturnValue({ in: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })) });

    mocks.mockSelect.mockReturnValue({
      is: mocks.mockIs,
      eq: mocks.mockEq,
    });

    mocks.mockFrom.mockReturnValue({
      select: mocks.mockSelect,
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    });
  });

  it('should attempt to fetch a rider by phone', async () => {
    // Override for this test: rider not found
    mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
    const rider = await getRiderByPhone('1234567890');
    expect(rider).toBeNull();
  });

  it('should attempt to update rider location', async () => {
    const result = await updateLocation(
      '00000000-0000-0000-0000-000000000001',
      24.79,
      85.01
    );
    expect(result.success).toBe(true);
  });

  it('should fetch unassigned orders successfully', async () => {
    const result = await getUnassignedOrders();
    expect(Array.isArray(result)).toBe(true);
  });
});
