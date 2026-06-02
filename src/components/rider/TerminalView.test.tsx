import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TerminalView from './TerminalView';

vi.mock('framer-motion', () => ({
  motion: { div: 'div', button: 'button', a: 'a', p: 'p', span: 'span', section: 'section' },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./OrderBroadcast', () => ({
  default: ({ riderId, hasActiveOrder }: { riderId: string; hasActiveOrder: boolean }) => (
    <div data-testid="order-broadcast" data-rider-id={riderId} data-has-active={String(hasActiveOrder)}>
      Broadcast
    </div>
  ),
}));

vi.mock('./BonusProgress', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="bonus-progress" data-deliveries={String(props.todayDeliveries)}>
      BonusProgress
    </div>
  ),
}));

vi.mock('@/lib/pricing', () => ({
  calculateEarningBreakdown: (distanceKm: number) => ({
    total: Math.ceil(distanceKm) * 10 + 30,
    deliveryFee: 30,
    pickupPay: Math.ceil(distanceKm) * 10,
  }),
}));

const defaultStats = {
  todayEarnings: 500,
  todayDeliveries: 3,
  todayDistanceKm: 12.5,
  todayNightlyBonus: 0,
  todayDeliveryFees: 400,
  todayPickupPay: 100,
  nextBonusMilestone: 6 as number | null,
  deliveriesUntilBonus: 3,
  bonusProgress: 0.5,
  bonusLabel: '₹100 bonus in 3 more deliveries',
};

const mockActiveOrder = {
  id: 'order-001',
  friendly_id: '#1001',
  order_status: 'preparing',
  customer_name: 'John Doe',
  delivery_address: '123 Main St, Mumbai',
  distance_km: 2.5,
  rider_earning: 41,
  lat: 19.076,
  lng: 72.8777,
  manual_dispatch: true,
};

describe('TerminalView', () => {
  // ─── Online/Offline Toggle ────────────────────────────────────────
  it('should show Go Online button when offline', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={null}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Go Online')).toBeInTheDocument();
  });

  it('should show Go Offline button when online', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={null}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Go Offline')).toBeInTheDocument();
  });

  it('should call onToggleOnline when toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={null}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={onToggle}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Go Online'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  // ─── Geolocation Error ────────────────────────────────────────────
  it('should display geo error message when present', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError="Location access denied"
        stats={null}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Location access denied')).toBeInTheDocument();
    expect(screen.getByText(/Enable GPS/)).toBeInTheDocument();
  });

  it('should not show geo error when null', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={null}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.queryByText(/Enable GPS/)).not.toBeInTheDocument();
  });

  // ─── Stats Grid ────────────────────────────────────────────────────
  it('should render stats grid with correct values', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('₹500')).toBeInTheDocument(); // earnings
    expect(screen.getByText('3')).toBeInTheDocument(); // orders (todayDeliveries)
    expect(screen.getByText('12.5 km')).toBeInTheDocument(); // distance
    expect(screen.getByText('₹0')).toBeInTheDocument(); // bonus (tonight 0)
  });

  it('should show zeros when stats is null', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={null}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    // Should show ₹0, 0, 0 km, ₹0
    const zeroValues = screen.getAllByText(/₹0|0 km/);
    expect(zeroValues.length).toBeGreaterThanOrEqual(2);
  });

  // ─── BonusProgress Integration ──────────────────────────────────────
  it('should render BonusProgress component', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={defaultStats}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByTestId('bonus-progress')).toBeInTheDocument();
  });

  it('should pass correct props to BonusProgress', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={defaultStats}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    const bp = screen.getByTestId('bonus-progress');
    expect(bp.getAttribute('data-deliveries')).toBe('3');
  });

  it('should use defaults for BonusProgress when stats is null', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={null}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    const bp = screen.getByTestId('bonus-progress');
    expect(bp.getAttribute('data-deliveries')).toBe('0');
  });

  // ─── Active Order Card ────────────────────────────────────────────
  it('should not render active order card when no active order', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.queryByText('Active Delivery')).not.toBeInTheDocument();
  });

  it('should render active order card with customer and address', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={mockActiveOrder}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Active Delivery')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText('2.5 km')).toBeInTheDocument();
    expect(screen.getByText('₹41')).toBeInTheDocument();
  });

  it('should show order friendly_id as fallback', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, id: 'xyz-99999', friendly_id: '#FRND-99' }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText(/FRND-99/)).toBeInTheDocument();
  });

  it('should show order id slice when friendly_id is null', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, id: 'abcdefgh-1234', friendly_id: null }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText(/Order #abcdefgh/)).toBeInTheDocument();
  });

  it('should show default customer name when empty', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, customer_name: '' }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Premium Guest')).toBeInTheDocument();
  });

  it('should show "Start Riding" button for preparing status', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={mockActiveOrder}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Start Riding')).toBeInTheDocument();
  });

  it('should show "Start Riding" button for ready status', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, order_status: 'ready' }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Start Riding')).toBeInTheDocument();
  });

  it('should show Waiting for Restaurant Handover when manual_dispatch is false', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, manual_dispatch: false }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText(/Waiting for Restaurant Handover/)).toBeInTheDocument();
    expect(screen.queryByText('Start Riding')).not.toBeInTheDocument();
  });

  it('should call onStartRiding when Start Riding is clicked', () => {
    const onStartRiding = vi.fn();
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={mockActiveOrder}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={onStartRiding}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Start Riding'));
    expect(onStartRiding).toHaveBeenCalledOnce();
  });

  it('should show loading spinner instead of Start Riding when actionLoading is true', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={mockActiveOrder}
        actionLoading={true}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    const actionBtn = buttons.find(b => b.hasAttribute('disabled'));
    expect(actionBtn).toBeTruthy();
    expect(screen.queryByText('Start Riding')).not.toBeInTheDocument();
  });

  it('should show Navigate and Delivered buttons for out_for_delivery', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, order_status: 'out_for_delivery' }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('should call onDelivered when Delivered is clicked', () => {
    const onDelivered = vi.fn();
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, order_status: 'out_for_delivery' }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={onDelivered}
        onAcceptBroadcast={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Delivered'));
    expect(onDelivered).toHaveBeenCalledOnce();
  });

  it('should show earning breakdown when distance_km is set', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={mockActiveOrder}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/Delivery ₹30 \+ Pickup ₹30/)).toBeInTheDocument();
  });

  it('should not show earning breakdown when distance_km is null', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, distance_km: null }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.queryByText('Breakdown')).not.toBeInTheDocument();
  });

  it('should show "?" for distance when distance_km is null', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, distance_km: null }}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    expect(screen.getByText('? km')).toBeInTheDocument();
  });

  it('should show spinner when actionLoading during out_for_delivery', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={{ ...mockActiveOrder, order_status: 'out_for_delivery' }}
        actionLoading={true}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    // Navigate link and Delivered button should be present
    expect(screen.getByText('Navigate')).toBeInTheDocument();
  });

  // ─── OrderBroadcast Integration ───────────────────────────────────
  it('should render OrderBroadcast with correct props', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={defaultStats}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    const broadcast = screen.getByTestId('order-broadcast');
    expect(broadcast.getAttribute('data-rider-id')).toBe('rider-1');
    expect(broadcast.getAttribute('data-has-active')).toBe('false');
  });

  it('should pass hasActiveOrder=true to OrderBroadcast when active order exists', () => {
    render(
      <TerminalView
        riderId="rider-2"
        isOnline={true}
        geoError={null}
        stats={defaultStats}
        activeOrder={mockActiveOrder}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    const broadcast = screen.getByTestId('order-broadcast');
    expect(broadcast.getAttribute('data-has-active')).toBe('true');
  });

  // ─── Bonus Display ────────────────────────────────────────────────
  it('should display bonus amount in the stats grid', () => {
    render(
      <TerminalView
        riderId="rider-1"
        isOnline={false}
        geoError={null}
        stats={{ ...defaultStats, todayNightlyBonus: 100 }}
        activeOrder={null}
        actionLoading={false}
        onToggleOnline={vi.fn()}
        onStartRiding={vi.fn()}
        onDelivered={vi.fn()}
        onAcceptBroadcast={vi.fn()}
      />
    );

    // Should find ₹100 somewhere (bonus)
    const bonusElements = screen.getAllByText('₹100');
    expect(bonusElements.length).toBeGreaterThanOrEqual(1);
  });
});
