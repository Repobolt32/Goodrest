import { render, screen } from '@testing-library/react';
import OrderTracker from '@/components/OrderTracker';
import { expect, it, describe, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    p: 'p',
    span: 'span',
    section: 'section',
    h2: 'h2',
    h3: 'h3',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
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

vi.mock('@/lib/distance', () => ({
  calculateETA: vi.fn(() => 15),
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  const Mock = (props: Record<string, unknown>) => <div {...props} />;
  return {
    ...actual,
    CheckCircle2: Mock,
    ChefHat: Mock,
    Truck: Mock,
    Package: Mock,
    AlertCircle: Mock,
    Wifi: Mock,
    Phone: Mock,
    Map: Mock,
    Clock: Mock,
    UtensilsCrossed: Mock,
  };
});

describe('OrderTracker', () => {
  it('shows confirmed step as current for initialStatus confirmed', () => {
    render(<OrderTracker orderId="123" initialStatus="confirmed" />);

    expect(screen.getByTestId('tracker-step-confirmed').getAttribute('data-step-status')).toBe('current');
    expect(screen.getByTestId('tracker-step-preparing').getAttribute('data-step-status')).toBe('pending');
  });

  it('updates step statuses when initialStatus prop changes', () => {
    const { rerender } = render(<OrderTracker orderId="123" initialStatus="confirmed" />);

    expect(screen.getByTestId('tracker-step-confirmed').getAttribute('data-step-status')).toBe('current');

    rerender(<OrderTracker orderId="123" initialStatus="preparing" />);

    expect(screen.getByTestId('tracker-step-confirmed').getAttribute('data-step-status')).toBe('completed');
    expect(screen.getByTestId('tracker-step-preparing').getAttribute('data-step-status')).toBe('current');
  });

  it('shows Call Rider button when riderPhone is provided during delivery', () => {
    const { rerender } = render(
      <OrderTracker orderId="123" initialStatus="out_for_delivery" />
    );

    expect(screen.queryByText(/Call Rider/i)).not.toBeInTheDocument();

    rerender(
      <OrderTracker orderId="123" initialStatus="out_for_delivery" initialRiderPhone="9876543210" />
    );

    expect(screen.getByText(/Call Rider/i)).toBeInTheDocument();
  });

  it('shows cancelled state when status is cancelled', () => {
    render(<OrderTracker orderId="123" initialStatus="cancelled" />);

    expect(screen.getByText(/ORDER CANCELLED/i)).toBeInTheDocument();
    // Verify support phone number and help box is rendered
    expect(screen.getByText(/Need Help\? Tell us what happened/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your issue here/i)).toBeInTheDocument();
  });

  it('renders the Cancel Order button when order is active and callback is provided', () => {
    const handleCancel = vi.fn();
    render(<OrderTracker orderId="123" initialStatus="confirmed" onCancel={handleCancel} />);

    expect(screen.getByText(/Cancel Order/i)).toBeInTheDocument();
  });

  it('renders the Cancel Order button with a fresh createdAt within the 30-second grace window', () => {
    const handleCancel = vi.fn();
    const freshCreatedAt = new Date(Date.now() - 1000).toISOString(); // 1 second ago (29s remaining)
    render(
      <OrderTracker
        orderId="123"
        initialStatus="confirmed"
        createdAt={freshCreatedAt}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByText(/Cancel Order/i)).toBeInTheDocument();
    expect(screen.getByText(/Need to cancel\? \(29s remaining\)/i)).toBeInTheDocument();
  });

  it('uses serverNow prop to correct clock skew for grace period', () => {
    const handleCancel = vi.fn();
    // Simulate: server clock is 10 seconds AHEAD of client clock
    // createdAt was 25 seconds before server time
    // Without correction: client sees 15s elapsed → 15s remaining
    // With correction: uses server time → 25s elapsed → 5s remaining
    const clockSkewMs = 10_000; // server is 10s ahead
    const serverNow = new Date(Date.now() + clockSkewMs);
    const createdAt = new Date(serverNow.getTime() - 25_000).toISOString(); // 25s before server now

    render(
      <OrderTracker
        orderId="123"
        initialStatus="confirmed"
        createdAt={createdAt}
        serverNow={serverNow.toISOString()}
        onCancel={handleCancel}
      />,
    );

    // With clock skew correction: 30 - 25 = 5s remaining
    expect(screen.getByText(/Need to cancel\? \(5s remaining\)/i)).toBeInTheDocument();
  });

  it('renders the Call Restaurant button when the 30-second grace window is expired', () => {
    const handleCancel = vi.fn();
    const expiredCreatedAt = new Date(Date.now() - 31000).toISOString(); // 31 seconds ago (expired)
    render(
      <OrderTracker
        orderId="123"
        initialStatus="confirmed"
        createdAt={expiredCreatedAt}
        onCancel={handleCancel}
      />
    );

    expect(screen.queryByText(/Cancel Order/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Call Restaurant/i)).toBeInTheDocument();
    expect(screen.getByText(/The kitchen is actively preparing your order/i)).toBeInTheDocument();
  });
});

