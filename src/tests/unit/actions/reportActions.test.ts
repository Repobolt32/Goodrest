import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockGte: vi.fn(),
  mockOrder: vi.fn(),
  mockFrom: vi.fn(),
  mockVerifyAdminSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: mocks.mockVerifyAdminSession,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
  },
}));

vi.mock('@/lib/pricing', () => ({
  calculateNightlyBonus: (count: number) => (count >= 5 ? 100 : 0),
}));

import { getDailyReport } from '@/app/actions/reportActions';

describe('reportActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

    const chain = {
      select: mocks.mockSelect,
      gte: mocks.mockGte,
      order: mocks.mockOrder,
    };

    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockGte.mockReturnValue(chain);
  });

  it('should reject unauthorized user', async () => {
    mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

    const result = await getDailyReport();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('should return reports and subtract delivery fees from revenue', async () => {
    // Today's orders
    const mockTodayOrders = [
      { id: 'o-1', order_status: 'confirmed', total_amount: 500, delivery_fee: 50, created_at: new Date().toISOString() },
      { id: 'o-2', order_status: 'delivered', total_amount: 300, delivery_fee: 30, created_at: new Date().toISOString() },
      { id: 'o-3', order_status: 'cancelled', total_amount: 400, delivery_fee: 40, created_at: new Date().toISOString() },
    ];

    // Weekly orders
    const mockWeeklyOrders = [
      {
        id: 'o-1',
        order_status: 'confirmed',
        total_amount: 500,
        delivery_fee: 50,
        created_at: new Date().toISOString(),
        rider_id: null,
        rider_earning: null,
      },
      {
        id: 'o-2',
        order_status: 'delivered',
        total_amount: 300,
        delivery_fee: 30,
        created_at: new Date().toISOString(),
        rider_id: 'rider-1',
        rider_earning: 100,
      },
      {
        id: 'o-4',
        order_status: 'delivered',
        total_amount: 250,
        delivery_fee: 20,
        created_at: new Date().toISOString(),
        rider_id: 'rider-1',
        rider_earning: 100,
      },
    ];

    mocks.mockOrder
      .mockResolvedValueOnce({ data: mockTodayOrders, error: null }) // todayOrders fetch
      .mockResolvedValueOnce({ data: mockWeeklyOrders, error: null }); // weekOrders fetch

    const result = await getDailyReport();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Today's revenue calculation:
    // (500 - 50) + (300 - 30) = 450 + 270 = 720 (excluding cancelled order)
    expect(result.data?.today.totalRevenue).toBe(720);
    expect(result.data?.today.totalOrders).toBe(3);

    // Weekly calculations:
    // Non-cancelled weekly orders are: o-1 (450 net), o-2 (270 net), o-4 (230 net) -> total net revenue = 950
    // Rider payouts: o-2 (100 earning), o-4 (100 earning) -> total 200 (no bonus because rider-1 has 2 deliveries, < 5)
    // Net margin = 950 - 200 = 750
    const todayStr = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weeklyToday = result.data?.weekly.find(w => w.date === todayStr);

    expect(weeklyToday).toBeDefined();
    expect(weeklyToday?.orderCount).toBe(3);
    expect(weeklyToday?.revenue).toBe(950);
    expect(weeklyToday?.riderPayout).toBe(200);
    expect(weeklyToday?.netMargin).toBe(750);
  });
});
