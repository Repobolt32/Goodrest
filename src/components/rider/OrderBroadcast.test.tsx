import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrderBroadcast from './OrderBroadcast';
import { acceptOrder, getUnassignedOrders } from '@/app/actions/riderActions';

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

let insertCallback: ((payload: unknown) => void) | undefined;
let updateCallback: ((payload: unknown) => void) | undefined;

vi.stubGlobal(
  'Audio',
  class {
    loop = false;
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();
  },
);

vi.mock('@/lib/supabase', () => {
  const chain = {
    on: vi.fn(
      (_: string, filter: { event: string }, callback: (payload: unknown) => void) => {
        if (filter.event === 'INSERT') insertCallback = callback;
        if (filter.event === 'UPDATE') updateCallback = callback;
        return chain;
      },
    ),
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  };
  return {
    supabase: {
      channel: vi.fn(() => chain),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/app/actions/riderActions', () => ({
  acceptOrder: vi.fn(() => Promise.resolve({ success: true })),
  getUnassignedOrders: vi.fn(() => Promise.resolve([])),
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Bell: () => null,
    Check: () => null,
    X: () => null,
  };
});

const mockOrder = {
  id: 'order-1',
  rider_id: null,
  order_status: 'ready',
  distance_km: 5.2,
  rider_earning: 552,
  customer_name: 'Alice',
  delivery_address: '123 Main St',
};

describe('OrderBroadcast', () => {
  beforeEach(() => {
    insertCallback = undefined;
    updateCallback = undefined;
  });

  it('should render nothing when there is no new order', () => {
    render(<OrderBroadcast hasActiveOrder={false} />);
    expect(screen.queryByText(/New Order/i)).toBeNull();
  });

  it('should render broadcast when INSERT event fires with unassigned ready order', async () => {
    render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);

    await act(async () => {
      insertCallback!({ new: mockOrder });
    });

    expect(screen.getByText(/New Delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.2.*km/i)).toBeInTheDocument();
    expect(screen.getByText(/₹552/i)).toBeInTheDocument();
  });

  it('should auto-dismiss when UPDATE event shows another rider took the order', async () => {
    render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);

    await act(async () => {
      insertCallback!({ new: mockOrder });
    });
    expect(screen.getByText(/New Delivery/i)).toBeInTheDocument();

    await act(async () => {
      updateCallback!({
        new: { ...mockOrder, rider_id: 'other-rider', order_status: 'accepted' },
      });
    });
    expect(screen.queryByText(/New Delivery/i)).toBeNull();
  });

  it('should call acceptOrder and dismiss modal when Accept is clicked', async () => {
    const onAccept = vi.fn();
    render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} onAccept={onAccept} />);

    await act(async () => {
      insertCallback!({ new: mockOrder });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Accept/i));
    });

    expect(acceptOrder).toHaveBeenCalledWith('order-1', 'rider-1');
    expect(onAccept).toHaveBeenCalled();
    expect(screen.queryByText(/New Delivery/i)).toBeNull();
  });

  it('should dismiss broadcast when Reject is clicked', async () => {
    render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);

    await act(async () => {
      insertCallback!({ new: mockOrder });
    });
    expect(screen.getByText(/New Delivery/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText(/Reject/i));
    });

    expect(screen.queryByText(/New Delivery/i)).toBeNull();
  });

  it('fetches unassigned orders on mount and shows the first one', async () => {
    vi.mocked(getUnassignedOrders).mockResolvedValue([
      { id: 'order-1', order_status: 'ready', rider_id: null, distance_km: 3.2, rider_earning: 532, customer_name: 'Test User', delivery_address: '123 St' } as unknown as never,
    ]);

    await act(async () => {
      render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);
    });

    expect(getUnassignedOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/New Delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/3.*km/i)).toBeInTheDocument();
    expect(screen.getByText(/532/i)).toBeInTheDocument();
  });

  it('does not fetch unassigned orders when rider has active order', async () => {
    await act(async () => {
      render(<OrderBroadcast riderId="rider-1" hasActiveOrder={true} />);
    });

    expect(getUnassignedOrders).not.toHaveBeenCalled();
    expect(screen.queryByText(/New Delivery/i)).not.toBeInTheDocument();
  });

  it('fetches unassigned orders when hasActiveOrder changes from true to false', async () => {
    vi.mocked(getUnassignedOrders).mockResolvedValue([]);

    const { rerender } = await act(async () => {
      return render(<OrderBroadcast riderId="rider-1" hasActiveOrder={true} />);
    });

    expect(getUnassignedOrders).not.toHaveBeenCalled();

    vi.mocked(getUnassignedOrders).mockResolvedValue([
      { id: 'order-queued', order_status: 'preparing', rider_id: null, distance_km: 1.5, rider_earning: 515, customer_name: 'Queued Customer', delivery_address: '456 Ave' } as unknown as never,
    ]);

    await act(async () => {
      rerender(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);
    });

    expect(getUnassignedOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/New Delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/Queued Customer/i)).toBeInTheDocument();
  });

  it('does not show duplicate if realtime delivers same order already fetched', async () => {
    vi.mocked(getUnassignedOrders).mockResolvedValue([
      { id: 'order-1', order_status: 'ready', rider_id: null, distance_km: 2, rider_earning: 520, customer_name: 'User A', delivery_address: '100 St' } as unknown as never,
    ]);

    await act(async () => {
      render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);
    });

    expect(screen.getByText(/User A/i)).toBeInTheDocument();

    await act(async () => {
      insertCallback?.({ new: { id: 'order-1', order_status: 'ready', rider_id: null, distance_km: 2, rider_earning: 520, customer_name: 'User A', delivery_address: '100 St' } });
    });

    expect(screen.getAllByText(/New Delivery/i)).toHaveLength(1);
  });

  it('handles fetch error gracefully without crashing', async () => {
    vi.mocked(getUnassignedOrders).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);
    });

    expect(getUnassignedOrders).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/New Delivery/i)).not.toBeInTheDocument();
  });

  // ─── Earning Breakdown (Task 11) ──────────────────────────────────
  it('should show itemized earning breakdown when distance_km is set', async () => {
    render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);

    await act(async () => {
      insertCallback!({ new: { ...mockOrder, distance_km: 2.5, rider_earning: 41 } });
    });

    expect(screen.getByText(/Delivery ₹35 \+ Pickup Pay ₹6/)).toBeInTheDocument();
  });

  it('should not show breakdown when distance_km is null', async () => {
    render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);

    await act(async () => {
      insertCallback!({ new: { ...mockOrder, distance_km: null } });
    });

    expect(screen.queryByText(/Delivery ₹/)).not.toBeInTheDocument();
  });

  it('should show earning with breakdown when fetched unassigned order has distance_km', async () => {
    vi.mocked(getUnassignedOrders).mockResolvedValue([
      { id: 'order-bd', order_status: 'ready', rider_id: null, distance_km: 2.5, rider_earning: 41, customer_name: 'BD User', delivery_address: '500 St' } as unknown as never,
    ]);

    await act(async () => {
      render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);
    });

    expect(screen.getByText('BD User')).toBeInTheDocument();
    expect(screen.getByText(/Delivery ₹35 \+ Pickup Pay ₹6/)).toBeInTheDocument();
  });

  it('should fallback to total when breakdown cannot compute (distance null)', async () => {
    vi.mocked(getUnassignedOrders).mockResolvedValue([
      { id: 'order-nod', order_status: 'preparing', rider_id: null, distance_km: null, rider_earning: 500, customer_name: 'NoDist', delivery_address: '999 St' } as unknown as never,
    ]);

    await act(async () => {
      render(<OrderBroadcast riderId="rider-1" hasActiveOrder={false} />);
    });

    expect(screen.getByText('NoDist')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.queryByText(/Delivery ₹/)).not.toBeInTheDocument();
  });
});
