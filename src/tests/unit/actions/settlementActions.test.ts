import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockVerifyAdminSession: vi.fn(),
  mockVerifyRiderSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: mocks.mockVerifyAdminSession,
  verifyRiderSession: mocks.mockVerifyRiderSession,
}));

const supabaseMocks = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: supabaseMocks.mockFrom,
    rpc: supabaseMocks.mockRpc,
  },
}));

import { settleWeeklyPayout } from '@/app/actions/settlementActions';

const VALID_RIDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('settleWeeklyPayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });
    supabaseMocks.mockRpc.mockResolvedValue({ error: null });
  });

  it('should reject when no orders exist for the rider in the week', async () => {
    const ordersChain = {
      select: () => ordersChain,
      is: () => ordersChain,
      eq: () => ordersChain,
      not: () => Promise.resolve({ data: [], error: null }),
      gte: () => ordersChain,
      lte: () => ordersChain,
      order: () => Promise.resolve({ data: [], error: null }),
    };

    supabaseMocks.mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') return ordersChain;
      return {};
    });

    const result = await settleWeeklyPayout({
      riderId: VALID_RIDER_ID,
      weekStart: '2026-06-15',
      weekEnd: '2026-06-21',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No deliveries');
  });

  it('should calculate amounts from actual orders and insert settlement', async () => {
    const mockOrders = [
      { rider_id: VALID_RIDER_ID, rider_earning: 41, distance_km: 2.0, delivered_at: '2026-06-15T10:00:00.000Z' },
      { rider_id: VALID_RIDER_ID, rider_earning: 41, distance_km: 2.0, delivered_at: '2026-06-15T11:00:00.000Z' },
      { rider_id: VALID_RIDER_ID, rider_earning: 41, distance_km: 2.0, delivered_at: '2026-06-15T12:00:00.000Z' },
      { rider_id: VALID_RIDER_ID, rider_earning: 41, distance_km: 2.0, delivered_at: '2026-06-15T13:00:00.000Z' },
      { rider_id: VALID_RIDER_ID, rider_earning: 41, distance_km: 2.0, delivered_at: '2026-06-15T14:00:00.000Z' },
      { rider_id: VALID_RIDER_ID, rider_earning: 41, distance_km: 2.0, delivered_at: '2026-06-15T15:00:00.000Z' },
    ];

    const ordersChain = {
      select: () => ordersChain,
      is: () => ordersChain,
      eq: () => ordersChain,
      not: () => Promise.resolve({ data: [], error: null }),
      gte: () => ordersChain,
      lte: () => ordersChain,
      order: () => Promise.resolve({ data: mockOrders, error: null }),
    };

    let insertedValues: Record<string, unknown> | null = null;
    const settlementChain = {
      insert: (values: Record<string, unknown>) => {
        insertedValues = values;
        return settlementChain;
      },
      select: () => settlementChain,
      single: () => Promise.resolve({ data: { id: 'settlement-1', ...insertedValues }, error: null }),
    };

    let updatedAmount: number | null = null;
    const ridersChain = {
      select: () => ridersChain,
      update: (values: Record<string, unknown>) => {
        updatedAmount = values.total_settled as number;
        return ridersChain;
      },
      eq: () => ridersChain,
      single: () => Promise.resolve({ data: { total_settled: 0 }, error: null }),
    };

    supabaseMocks.mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') return ordersChain;
      if (table === 'rider_settlements') return settlementChain;
      if (table === 'riders') return ridersChain;
      return {};
    });

    supabaseMocks.mockRpc.mockResolvedValueOnce({ error: { message: 'RPC failed' } });

    const result = await settleWeeklyPayout({
      riderId: VALID_RIDER_ID,
      weekStart: '2026-06-15',
      weekEnd: '2026-06-21',
    });

    expect(result.success).toBe(true);

    // Verify calculated amounts (not client-provided)
    // 6 deliveries, each distance=2km → deliveryFee=30, pickupPay=4, total=rider_earning=41
    // totalEarnings = 6 * 41 = 246
    // bonus for 6 orders on one day = ₹100
    expect(insertedValues).toBeTruthy();
    expect(insertedValues!.rider_id).toBe(VALID_RIDER_ID);
    expect(insertedValues!.total_deliveries).toBe(6);
    expect(insertedValues!.total_earnings).toBe(246);
    expect(insertedValues!.total_bonus).toBe(100);
    expect(insertedValues!.total_amount).toBe(346);

    // Verify atomic RPC was called
    expect(supabaseMocks.mockRpc).toHaveBeenCalledWith('increment_rider_settlement', {
      p_rider_id: VALID_RIDER_ID,
      p_amount: 346,
    });

    // Verify fallback balance tracking was triggered and succeeded
    expect(updatedAmount).toBe(346);
  });

  it('should reject when admin session is invalid', async () => {
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: false, error: 'Unauthorized' });

    const result = await settleWeeklyPayout({
      riderId: VALID_RIDER_ID,
      weekStart: '2026-06-15',
      weekEnd: '2026-06-21',
    });

    expect(result.success).toBe(false);
  });

  it('should reject with missing riderId', async () => {
    const result = await settleWeeklyPayout({
      riderId: '',
      weekStart: '2026-06-15',
      weekEnd: '2026-06-21',
    });

    expect(result.success).toBe(false);
  });
});
