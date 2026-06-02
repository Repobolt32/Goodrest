import { render, screen, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RiderPayoutsPanel from './RiderPayoutsPanel';

const mocks = vi.hoisted(() => ({
  getWeeklyRiderPayouts: vi.fn(),
}));

vi.mock('@/app/actions/ownerActions', () => ({
  getWeeklyRiderPayouts: mocks.getWeeklyRiderPayouts,
}));

vi.mock('lucide-react', () => ({
  Bike: () => null,
}));

describe('RiderPayoutsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton while fetching', () => {
    mocks.getWeeklyRiderPayouts.mockReturnValue(new Promise(() => {}));

    render(<RiderPayoutsPanel />);

    const loadingEls = document.querySelectorAll('.animate-pulse');
    expect(loadingEls.length).toBeGreaterThan(0);
  });

  it('should return null when payouts array is empty', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue({ success: true, data: [] });

    const { container } = await act(async () => {
      return render(<RiderPayoutsPanel />);
    });

    expect(container.innerHTML).toBe('');
  });

  it('should return null when response has no success/data', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue({ success: false, error: 'error' });

    const { container } = await act(async () => {
      return render(<RiderPayoutsPanel />);
    });

    expect(container.innerHTML).toBe('');
  });

  it('should return null when success but no data', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue({ success: true });

    const { container } = await act(async () => {
      return render(<RiderPayoutsPanel />);
    });

    expect(container.innerHTML).toBe('');
  });

  it('should render payout rows for each rider', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue({
      success: true,
      data: [
        {
          riderId: 'rider-1',
          riderName: 'Test Rider',
          riderPhone: '9876543210',
          weekDeliveries: 20,
          weekDeliveryFees: 1500,
          weekPickupPay: 200,
          weekBonus: 200,
          weekTotalDue: 1900,
        },
        {
          riderId: 'rider-2',
          riderName: 'Second Rider',
          riderPhone: '9876543211',
          weekDeliveries: 15,
          weekDeliveryFees: 1200,
          weekPickupPay: 150,
          weekBonus: 100,
          weekTotalDue: 1450,
        },
      ],
    });

    await act(async () => {
      render(<RiderPayoutsPanel />);
    });

    expect(screen.getByText('Rider Payouts (This Week)')).toBeInTheDocument();
    expect(screen.getByText('Test Rider')).toBeInTheDocument();
    expect(screen.getByText('Second Rider')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('9876543211')).toBeInTheDocument();
  });

  it('should render all table headers', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue({
      success: true,
      data: [
        {
          riderId: 'rider-1',
          riderName: 'Header Rider',
          riderPhone: '9999999999',
          weekDeliveries: 1,
          weekDeliveryFees: 100,
          weekPickupPay: 10,
          weekBonus: 0,
          weekTotalDue: 110,
        },
      ],
    });

    await act(async () => {
      render(<RiderPayoutsPanel />);
    });

    const thead = document.querySelector('thead');
    expect(thead).toBeTruthy();
    expect(within(thead!).getByText('Rider')).toBeInTheDocument();
    expect(within(thead!).getByText('Orders')).toBeInTheDocument();
    expect(within(thead!).getByText('Delivery')).toBeInTheDocument();
    expect(within(thead!).getByText('Pickup')).toBeInTheDocument();
    expect(within(thead!).getByText('Bonus')).toBeInTheDocument();
    expect(within(thead!).getByText('Total Due')).toBeInTheDocument();
  });

  it('should calculate correct totals row', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue({
      success: true,
      data: [
        {
          riderId: 'rider-1',
          riderName: 'A',
          riderPhone: '1',
          weekDeliveries: 10,
          weekDeliveryFees: 500,
          weekPickupPay: 100,
          weekBonus: 50,
          weekTotalDue: 650,
        },
        {
          riderId: 'rider-2',
          riderName: 'B',
          riderPhone: '2',
          weekDeliveries: 20,
          weekDeliveryFees: 1000,
          weekPickupPay: 200,
          weekBonus: 150,
          weekTotalDue: 1350,
        },
      ],
    });

    await act(async () => {
      render(<RiderPayoutsPanel />);
    });

    const tfoot = document.querySelector('tfoot');
    expect(tfoot).toBeTruthy();
    expect(within(tfoot!).getByText('Total')).toBeInTheDocument();
    expect(within(tfoot!).getByText('30')).toBeInTheDocument();
    expect(within(tfoot!).getByText('₹1,500')).toBeInTheDocument();
    expect(within(tfoot!).getByText('₹300')).toBeInTheDocument();
    expect(within(tfoot!).getByText('₹200')).toBeInTheDocument();
    expect(within(tfoot!).getByText('₹2,000')).toBeInTheDocument();
  });

  it('should handle zero bonus riders correctly', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue({
      success: true,
      data: [
        {
          riderId: 'rider-1',
          riderName: 'NoBonus Rider',
          riderPhone: '9999999999',
          weekDeliveries: 3,
          weekDeliveryFees: 200,
          weekPickupPay: 20,
          weekBonus: 0,
          weekTotalDue: 220,
        },
      ],
    });

    await act(async () => {
      render(<RiderPayoutsPanel />);
    });

    expect(screen.getByText('NoBonus Rider')).toBeInTheDocument();
    const bonusCells = screen.getAllByText('₹0');
    expect(bonusCells.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle single rider with all values', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue({
      success: true,
      data: [
        {
          riderId: 'sol-rider',
          riderName: 'Solo Rider',
          riderPhone: '1111111111',
          weekDeliveries: 42,
          weekDeliveryFees: 3500,
          weekPickupPay: 400,
          weekBonus: 200,
          weekTotalDue: 4100,
        },
      ],
    });

    await act(async () => {
      render(<RiderPayoutsPanel />);
    });

    expect(screen.getByText('Solo Rider')).toBeInTheDocument();
    expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₹3,500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₹400').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₹200').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₹4,100').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle response that is not in wrapper format (direct array)', async () => {
    mocks.getWeeklyRiderPayouts.mockResolvedValue([
      {
        riderId: 'rider-1',
        riderName: 'Direct Array Rider',
        riderPhone: '9999999998',
        weekDeliveries: 5,
        weekDeliveryFees: 400,
        weekPickupPay: 50,
        weekBonus: 50,
        weekTotalDue: 500,
      },
    ]);

    await act(async () => {
      render(<RiderPayoutsPanel />);
    });

    expect(screen.queryByText('Rider Payouts')).toBeNull();
  });
});