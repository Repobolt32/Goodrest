import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EarningsView from './EarningsView';

vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    p: 'p',
    span: 'span',
    section: 'section',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./WeeklyChart', () => ({
  default: ({ data }: { data: Array<{ date: string; deliveries: number; total: number; bonus: number }> }) => (
    <div data-testid="weekly-chart" data-days={String(data.length)}>
      WeeklyChart Mock
    </div>
  ),
}));

const mocks = vi.hoisted(() => ({
  getRiderEarningHistory: vi.fn(),
  getRiderWeekSettlementStatus: vi.fn(),
}));

vi.mock('@/app/actions/riderActions', () => ({
  getRiderEarningHistory: mocks.getRiderEarningHistory,
}));

vi.mock('@/app/actions/settlementActions', () => ({
  getRiderWeekSettlementStatus: mocks.getRiderWeekSettlementStatus,
}));

vi.mock('@/lib/weekRange', () => ({
  getCurrentWeekRange: () => ({ weekStart: '2026-05-25', weekEnd: '2026-05-31' }),
}));

const emptyResult = {
  weekly: [
    { date: '2026-05-25', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
    { date: '2026-05-26', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
    { date: '2026-05-27', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
    { date: '2026-05-28', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
    { date: '2026-05-29', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
    { date: '2026-05-30', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
    { date: '2026-05-31', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
  ],
  weekTotal: { deliveries: 0, earnings: 0, bonus: 0, total: 0 },
};

const populatedResult = {
  weekly: [
    { date: '2026-05-25', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
    { date: '2026-05-26', deliveries: 3, deliveryFees: 250, pickupPay: 30, bonus: 0, total: 280 },
    { date: '2026-05-27', deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 },
    { date: '2026-05-28', deliveries: 5, deliveryFees: 400, pickupPay: 50, bonus: 0, total: 450 },
    { date: '2026-05-29', deliveries: 6, deliveryFees: 500, pickupPay: 60, bonus: 100, total: 660 },
    { date: '2026-05-30', deliveries: 2, deliveryFees: 150, pickupPay: 20, bonus: 0, total: 170 },
    { date: '2026-05-31', deliveries: 4, deliveryFees: 300, pickupPay: 40, bonus: 0, total: 340 },
  ],
  weekTotal: { deliveries: 20, earnings: 1600, bonus: 100, total: 1700 },
};

const defaultProps = {
  riderId: '00000000-0000-0000-0000-000000000001',
  todayEarnings: 500,
  todayDeliveries: 3,
  todayDistanceKm: 12.5,
  todayBonus: 0,
  todayDeliveryFees: 400,
  todayPickupPay: 100,
};

describe('EarningsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRiderEarningHistory.mockResolvedValue(emptyResult);
    mocks.getRiderWeekSettlementStatus.mockResolvedValue({ success: true, data: null });
  });

  // ─── Loading State ────────────────────────────────────────────────
  it('should show loading skeleton initially', async () => {
    // Don't resolve the promise yet
    mocks.getRiderEarningHistory.mockReturnValue(new Promise(() => {}));

    render(<EarningsView {...defaultProps} />);

    // Loading skeleton has animate-pulse class
    expect(screen.getByText(/Today's Earnings/i)).toBeInTheDocument();
    const loadingBars = document.querySelectorAll('.animate-pulse');
    expect(loadingBars.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Today Summary Card ────────────────────────────────────────────
  it('should render today earnings summary card', async () => {
    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    expect(screen.getByText("Today's Earnings")).toBeInTheDocument();
    // formatCurrency(500) = ₹500
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText(/3 deliveries/)).toBeInTheDocument();
    expect(screen.getByText(/12.5 km/)).toBeInTheDocument();
  });

  it('should show today bonus in summary when present', async () => {
    await act(async () => {
      render(<EarningsView {...defaultProps} todayBonus={100} todayEarnings={600} />);
    });

    expect(screen.getByText('₹600')).toBeInTheDocument();
    expect(screen.getByText(/Bonus: ₹100/)).toBeInTheDocument();
  });

  it('should show breakdown in summary', async () => {
    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    expect(screen.getByText(/Delivery: ₹400 \+ Pickup Pay: ₹100/)).toBeInTheDocument();
  });

  // ─── Weekly Chart Integration ─────────────────────────────────────
  it('should render WeeklyChart when loaded', async () => {
    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    expect(screen.getByTestId('weekly-chart')).toBeInTheDocument();
  });

  it('should pass correct number of days to WeeklyChart', async () => {
    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    const chart = screen.getByTestId('weekly-chart');
    expect(chart.getAttribute('data-days')).toBe('7');
  });

  // ─── Daily Breakdown Accordion ─────────────────────────────────────
  it('should render daily breakdown accordion headers', async () => {
    mocks.getRiderEarningHistory.mockResolvedValue(populatedResult);

    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    expect(screen.getByText('Daily Breakdown')).toBeInTheDocument();

    // Only days with deliveries > 0 should appear, reversed order
    // populatedResult has deliveries on days: 26, 28, 29, 30, 31
    // Reversed => 31, 30, 29, 28, 26
    expect(screen.getByText(/4 orders/)).toBeInTheDocument();
    expect(screen.getByText(/2 orders/)).toBeInTheDocument();
    expect(screen.getByText(/6 orders/)).toBeInTheDocument();
    expect(screen.getByText(/5 orders/)).toBeInTheDocument();
    expect(screen.getByText(/3 orders/)).toBeInTheDocument();
  });

  it('should expand accordion on click', async () => {
    mocks.getRiderEarningHistory.mockResolvedValue(populatedResult);

    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    // Click on the first accordion header (latest day with deliveries = day 31, 4 orders)
    const headers = screen.getAllByRole('button');
    const firstDayBtn = headers[0]; // First accordion button

    await act(async () => {
      fireEvent.click(firstDayBtn);
    });

    // Should show expanded content
    expect(screen.getByText('Delivery Pay')).toBeInTheDocument();
    expect(screen.getByText('Pickup Pay')).toBeInTheDocument();
  });

  it('should collapse accordion on second click', async () => {
    mocks.getRiderEarningHistory.mockResolvedValue(populatedResult);

    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    const headers = screen.getAllByRole('button');
    const firstDayBtn = headers[0];

    await act(async () => {
      fireEvent.click(firstDayBtn);
    });
    expect(screen.getByText('Delivery Pay')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(firstDayBtn);
    });
    // After AnimatePresence exit, we need to wait; in mock, children are always rendered
    // The key check is that the expanded state toggles
    // Since we mock AnimatePresence to always render children, we check for presence
    expect(screen.queryByText('Delivery Pay')).not.toBeInTheDocument();
  });

  it('should show Nightly Bonus in expanded accordion only when bonus > 0', async () => {
    mocks.getRiderEarningHistory.mockResolvedValue(populatedResult);

    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    // Find the day with bonus (day 29, 6 deliveries, bonus 100)
    // In reversed order, it should be the 3rd button
    const headers = screen.getAllByRole('button');

    // Click the day with 6 orders (bonus day)
    const bonusDayBtn = headers[2]; // 3rd in reversed list = day 29
    await act(async () => {
      fireEvent.click(bonusDayBtn);
    });

    expect(screen.getByText('Nightly Bonus')).toBeInTheDocument();
    expect(screen.getByText('₹100')).toBeInTheDocument();
  });

  it('should not show Nightly Bonus when bonus is 0', async () => {
    mocks.getRiderEarningHistory.mockResolvedValue(populatedResult);

    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    const headers = screen.getAllByRole('button');

    // Click day with 4 orders (day 31, no bonus)
    const noBonusDayBtn = headers[0];
    await act(async () => {
      fireEvent.click(noBonusDayBtn);
    });

    expect(screen.queryByText('Nightly Bonus')).not.toBeInTheDocument();
  });

  // ─── Empty State ──────────────────────────────────────────────────
  it('should show "No deliveries this week yet" when all days are empty', async () => {
    mocks.getRiderEarningHistory.mockResolvedValue(emptyResult);

    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    expect(screen.getByText('No deliveries this week yet')).toBeInTheDocument();
  });

  // ─── Week Total Footer ────────────────────────────────────────────
  it('should show week total footer when total > 0', async () => {
    mocks.getRiderEarningHistory.mockResolvedValue(populatedResult);

    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('₹1,700')).toBeInTheDocument();
    expect(screen.getByText(/20 deliveries/)).toBeInTheDocument();
  });

  it('should not show week total footer when total is 0', async () => {
    mocks.getRiderEarningHistory.mockResolvedValue(emptyResult);

    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    expect(screen.queryByText(/This Week.*₹/)).toBeNull();
  });

  // ─── Edge Cases ──────────────────────────────────────────────────
  it('should handle zero today earnings', async () => {
    await act(async () => {
      render(<EarningsView {...defaultProps} todayEarnings={0} todayDeliveries={0} todayDistanceKm={0} />);
    });

    expect(screen.getByText('₹0')).toBeInTheDocument();
    expect(screen.getByText(/0 deliveries/)).toBeInTheDocument();
  });

  it('should fetch earning history on mount', async () => {
    await act(async () => {
      render(<EarningsView {...defaultProps} />);
    });

    expect(mocks.getRiderEarningHistory).toHaveBeenCalledWith(defaultProps.riderId);
    expect(mocks.getRiderEarningHistory).toHaveBeenCalledTimes(1);
  });

  it('should refresh when riderId changes', async () => {
    const { rerender } = await act(async () => {
      return render(<EarningsView {...defaultProps} />);
    });

    expect(mocks.getRiderEarningHistory).toHaveBeenCalledTimes(1);

    mocks.getRiderEarningHistory.mockResolvedValue(populatedResult);
    await act(async () => {
      rerender(<EarningsView {...defaultProps} riderId="different-rider-id" />);
    });

    expect(mocks.getRiderEarningHistory).toHaveBeenCalledTimes(2);
    expect(mocks.getRiderEarningHistory).toHaveBeenLastCalledWith('different-rider-id');
  });
});
