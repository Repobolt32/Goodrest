import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RiderDashboardPage from './page';

const mocks = vi.hoisted(() => ({
  getRiderActiveOrder: vi.fn(),
  getRiderStats: vi.fn(),
  setRiderOnline: vi.fn(),
}));

const mockPush = vi.fn();
const mockRouter = { push: mockPush, replace: vi.fn(), refresh: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/rider/dashboard',
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    a: 'a',
    form: 'form',
    input: 'input',
    label: 'label',
    p: 'p',
    h1: 'h1',
    h2: 'h2',
    span: 'span',
    section: 'section',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    Bike: () => null,
    BarChart3: () => null,
    LogOut: () => null,
    RefreshCw: () => null,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({
        unsubscribe: vi.fn(),
      })),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/app/actions/riderActions', () => ({
  getRiderStats: mocks.getRiderStats,
  getRiderActiveOrder: mocks.getRiderActiveOrder,
  updateLocation: vi.fn(),
  startRiding: vi.fn(),
  markOrderAsDeliveredRider: vi.fn(),
  setRiderOnline: mocks.setRiderOnline,
}));

vi.mock('@/components/rider/TerminalView', () => ({
  default: () => <div data-testid="terminal-view">TerminalView Mock</div>,
}));

vi.mock('@/components/rider/EarningsView', () => ({
  default: () => <div data-testid="earnings-view">EarningsView Mock</div>,
}));

const riderSession = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Rider',
  phone: '9876543210',
};

describe('RiderDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('rider_session', JSON.stringify(riderSession));
    mocks.getRiderStats.mockResolvedValue({
      totalDeliveries: 50,
      totalEarnings: 30000,
      todayDeliveries: 5,
      todayEarnings: 500,
      todayDistanceKm: 12.5,
      todayNightlyBonus: 0,
      todayDeliveryFees: 400,
      todayPickupPay: 100,
      nextBonusMilestone: 6,
      deliveriesUntilBonus: 1,
      bonusProgress: 5 / 6,
      bonusLabel: '₹100 bonus in 1 more deliveries',
    });
    mocks.getRiderActiveOrder.mockResolvedValue(null);
    mocks.setRiderOnline.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ─── Tab Navigation ──────────────────────────────────────────────
  it('should render TerminalView by default (activeTab = terminal)', async () => {
    render(<RiderDashboardPage />);

    const terminalView = await screen.findByTestId('terminal-view');
    expect(terminalView).toBeInTheDocument();
    expect(screen.queryByTestId('earnings-view')).not.toBeInTheDocument();
  });

  it('should switch to EarningsView when Earnings tab is clicked', async () => {
    render(<RiderDashboardPage />);

    // Wait for terminal view to render first
    await screen.findByTestId('terminal-view');

    const earningsTab = screen.getByText('Earnings');
    fireEvent.click(earningsTab);

    expect(screen.getByTestId('earnings-view')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-view')).not.toBeInTheDocument();
  });

  it('should switch back to TerminalView when Terminal tab is clicked from Earnings', async () => {
    render(<RiderDashboardPage />);

    await screen.findByTestId('terminal-view');

    // Go to Earnings
    fireEvent.click(screen.getByText('Earnings'));
    expect(screen.getByTestId('earnings-view')).toBeInTheDocument();

    // Go back to Terminal
    fireEvent.click(screen.getByText('Terminal'));
    expect(screen.getByTestId('terminal-view')).toBeInTheDocument();
    expect(screen.queryByTestId('earnings-view')).not.toBeInTheDocument();
  });

  // ─── Header ──────────────────────────────────────────────────────
  it('should show rider name in header', async () => {
    render(<RiderDashboardPage />);

    await screen.findByTestId('terminal-view');
    expect(screen.getByText(/Hi, Test Rider/)).toBeInTheDocument();
  });

  it('should show online status in header', async () => {
    // Default is offline
    render(<RiderDashboardPage />);

    await screen.findByTestId('terminal-view');
    expect(screen.getByText(/Currently Offline/)).toBeInTheDocument();
  });

  it('should show logout button', async () => {
    render(<RiderDashboardPage />);

    await screen.findByTestId('terminal-view');
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  // ─── Logout ──────────────────────────────────────────────────────
  it('should clear localStorage on logout', async () => {
    render(<RiderDashboardPage />);

    expect(localStorage.getItem('rider_session')).not.toBeNull();

    await screen.findByTestId('terminal-view');
    const logoutBtn = screen.getByRole('button', { name: 'Logout' });
    fireEvent.click(logoutBtn);

    expect(mockPush).toHaveBeenCalledWith('/rider/login');
    expect(localStorage.getItem('rider_session')).toBeNull();
  });

  // ─── No Session → Redirect ───────────────────────────────────────
  it('should redirect to login when no session', async () => {
    localStorage.removeItem('rider_session');
    render(<RiderDashboardPage />);

    // Should render null initially
    expect(mockPush).toHaveBeenCalledWith('/rider/login');
  });

  // ─── Tab Bar Styling ────────────────────────────────────────────
  it('should highlight active tab with Zomato red color', async () => {
    render(<RiderDashboardPage />);

    await screen.findByTestId('terminal-view');

    const terminalBtn = screen.getByText('Terminal').closest('button');
    const earningsBtn = screen.getByText('Earnings').closest('button');

    // Terminal should be active (red)
    expect(terminalBtn!.className).toContain('text-[#E23744]');
    expect(earningsBtn!.className).toContain('text-[#696969]');

    // Click Earnings
    fireEvent.click(screen.getByText('Earnings'));

    // Now Earnings should be active
    const newEarningsBtn = screen.getByText('Earnings').closest('button');
    const newTerminalBtn = screen.getByText('Terminal').closest('button');

    expect(newEarningsBtn!.className).toContain('text-[#E23744]');
    expect(newTerminalBtn!.className).toContain('text-[#696969]');
  });
});
