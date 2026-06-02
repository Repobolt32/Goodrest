import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDailyReport } from './reportActions';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockIs: vi.fn(),
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
    from: (table: string) => mocks.mockFrom(table),
  },
}));

describe('reportActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });
    mocks.mockFrom.mockReturnValue({
      select: mocks.mockSelect,
    });
    mocks.mockSelect.mockReturnValue({
      is: mocks.mockIs,
      gte: mocks.mockGte,
    });
    mocks.mockIs.mockReturnValue({
      gte: mocks.mockGte,
    });
    mocks.mockGte.mockReturnValue({
      order: mocks.mockOrder,
    });
  });

  it('should calculate today and weekly reports with correct IST timezone mapping', async () => {
    // Force current date to 2026-05-28T16:00:00.000Z (which is 9:30 PM IST on May 28)
    const fixedDate = new Date('2026-05-28T16:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    // Mock todayOrders: 1 active order, 1 cancelled order
    const mockTodayOrders = [
      {
        id: '1',
        order_status: 'delivered',
        total_amount: 500,
        created_at: '2026-05-28T15:00:00.000Z', // 8:30 PM IST today
      },
      {
        id: '2',
        order_status: 'cancelled',
        total_amount: 200,
        created_at: '2026-05-28T10:00:00.000Z', // 3:30 PM IST today
      },
    ];

    // Mock weekOrders
    const mockWeekOrders = [
      ...mockTodayOrders,
      {
        id: '3',
        order_status: 'delivered',
        total_amount: 300,
        created_at: '2026-05-27T10:00:00.000Z', // 3:30 PM IST yesterday (May 27)
      },
    ];

    mocks.mockOrder
      .mockResolvedValueOnce({ data: mockTodayOrders, error: null }) // first call for today
      .mockResolvedValueOnce({ data: mockWeekOrders, error: null }); // second call for week

    const result = await getDailyReport();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const report = result.data!;
    
    // Check today stats (cancelled is excluded from revenue)
    expect(report.today.totalOrders).toBe(2);
    expect(report.today.totalRevenue).toBe(500);
    expect(report.today.ordersByStatus).toEqual({
      delivered: 1,
      cancelled: 1,
    });

    // Check weekly stats keys exist and are formatted correctly as YYYY-MM-DD
    expect(report.weekly.length).toBe(7);
    
    // The last date in weekly should be today ("2026-05-28")
    const todayData = report.weekly.find((w) => w.date === '2026-05-28');
    expect(todayData).toBeDefined();
    expect(todayData!.orderCount).toBe(2);
    expect(todayData!.revenue).toBe(500);

    // The yesterday date in weekly should be "2026-05-27"
    const yesterdayData = report.weekly.find((w) => w.date === '2026-05-27');
    expect(yesterdayData).toBeDefined();
    expect(yesterdayData!.orderCount).toBe(1);
    expect(yesterdayData!.revenue).toBe(300);

    vi.useRealTimers();
  });

  it('should calculate riderPayout and netMargin correctly', async () => {
    const fixedDate = new Date('2026-05-28T16:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    // Orders with rider data
    const mockTodayOrders = [
      {
        id: '1',
        order_status: 'delivered',
        total_amount: 500,
        rider_id: 'rider-1',
        rider_earning: 100,
        distance_km: 2.0,
        created_at: '2026-05-28T15:00:00.000Z',
      },
    ];

    const mockWeekOrders = [
      ...mockTodayOrders,
      {
        id: '2',
        order_status: 'delivered',
        total_amount: 300,
        rider_id: 'rider-1',
        rider_earning: 60,
        distance_km: 1.5,
        created_at: '2026-05-27T10:00:00.000Z',
      },
      {
        id: '3',
        order_status: 'cancelled',
        total_amount: 200,
        created_at: '2026-05-27T09:00:00.000Z',
      },
    ];

    mocks.mockOrder
      .mockResolvedValueOnce({ data: mockTodayOrders, error: null })
      .mockResolvedValueOnce({ data: mockWeekOrders, error: null });

    const result = await getDailyReport();

    expect(result.success).toBe(true);
    const report = result.data!;

    // Check today
    const todayData = report.weekly.find((w) => w.date === '2026-05-28');
    expect(todayData).toBeDefined();
    // 1 delivery, rider_earning=100 + bonus=0 (1 delivery → bonus 0) = 100
    expect(todayData!.riderPayout).toBe(100);
    expect(todayData!.netMargin).toBe(500 - 100); // revenue - riderPayout

    // Check yesterday (2026-05-27)
    // Two orders: 1 delivered (rider_earning=60, revenue=300) + 1 cancelled
    // Rider payout: 60 + bonus 0 (1 delivery) = 60
    // Revenue: 300 (cancelled excluded)
    // netMargin: 300 - 60 = 240
    const yesterdayData = report.weekly.find((w) => w.date === '2026-05-27');
    expect(yesterdayData).toBeDefined();
    expect(yesterdayData!.riderPayout).toBe(60);
    expect(yesterdayData!.netMargin).toBe(240);

    vi.useRealTimers();
  });

  it('should include nightly bonus in riderPayout calculation', async () => {
    const fixedDate = new Date('2026-05-28T16:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    // 6 deliveries on same day → ₹100 bonus
    const sixOrders = Array.from({ length: 6 }, (_, i) => ({
      id: `${i}`,
      order_status: 'delivered' as const,
      total_amount: 100,
      rider_id: 'rider-1',
      rider_earning: 30,
      distance_km: 1.0,
      created_at: '2026-05-28T10:00:00.000Z',
    }));

    const mockTodayOrders = sixOrders;
    const mockWeekOrders = [...sixOrders];

    mocks.mockOrder
      .mockResolvedValueOnce({ data: mockTodayOrders, error: null })
      .mockResolvedValueOnce({ data: mockWeekOrders, error: null });

    const result = await getDailyReport();

    const todayData = result.data!.weekly.find((w) => w.date === '2026-05-28');
    // 6 × 30 = 180 earnings + 100 bonus = 280
    expect(todayData!.riderPayout).toBe(280);
    // Revenue = 6 × 100 = 600
    expect(todayData!.netMargin).toBe(600 - 280);

    vi.useRealTimers();
  });
});
