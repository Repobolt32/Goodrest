import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import AdminLayout from '@/app/admin/layout';

// Mock useRouter, usePathname
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin/orders',
}));

// Mock action functions
vi.mock('@/app/actions/authActions', () => ({
  logout: vi.fn(),
}));
vi.mock('@/app/actions/settingsActions', () => ({
  getAppSettings: vi.fn().mockResolvedValue({ success: true, data: { delivery_enabled: true } }),
  updateAppSettings: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('@/app/actions/ownerActions', () => ({
  acceptOrder: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ShoppingBag: () => null,
  LogOut: () => null,
  Bell: () => null,
  ChefHat: () => null,
  ChevronRight: () => null,
  Menu: () => null,
  X: () => null,
  BarChart3: () => null,
  Phone: () => null,
  MessageSquare: () => null,
  AlertTriangle: () => null,
  Clock: () => null,
  ExternalLink: () => null,
  History: () => null,
  Tag: () => null,
  Bike: () => null,
}));

// Mock components
vi.mock('@/components/admin/AdminSearchBar', () => ({
  default: () => <div data-testid="search-bar" />,
}));

const mocks = vi.hoisted(() => ({
  mockChannel: vi.fn(),
  mockOn: vi.fn(),
  mockSubscribe: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockGte: vi.fn(),
  mockOrder: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => {
  const chain = {
    select: mocks.mockSelect,
    eq: mocks.mockEq,
    single: mocks.mockSingle,
    gte: mocks.mockGte,
    order: mocks.mockOrder,
  };
  mocks.mockFrom.mockReturnValue(chain);
  mocks.mockSelect.mockReturnValue(chain);
  mocks.mockEq.mockReturnValue(chain);
  mocks.mockSingle.mockReturnValue(chain);
  mocks.mockGte.mockReturnValue(chain);
  mocks.mockOrder.mockReturnValue(chain);

  return {
    supabase: {
      from: mocks.mockFrom,
      channel: mocks.mockChannel,
      removeChannel: mocks.mockRemoveChannel,
    },
  };
});

// Electron API mock
const mockElectronAPI = {
  showBellWindow: vi.fn(),
  hideBellWindow: vi.fn(),
  updateTrayBadge: vi.fn(),
  playNotificationSound: vi.fn(),
  onAcceptOrderFromBell: vi.fn(() => vi.fn()),
  onDismissOrderFromBell: vi.fn(() => vi.fn()),
};

const mockOrderData = {
  id: '00000000-0000-0000-0000-000000000001',
  friendly_id: '#1001',
  customer_name: 'Test Customer',
  customer_phone: '9876543210',
  delivery_address: '123 Test St',
  order_status: 'confirmed',
  payment_status: 'paid',
  payment_method: 'online',
  total_amount: 500,
  items: [{ name: 'Test Item', quantity: 2, price: 250 }],
  created_at: '2026-05-19T10:00:00Z',
};

describe('AdminLayout Electron Bell Triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockChannel.mockReturnValue({
      on: mocks.mockOn.mockImplementation((_event: string, _filter: unknown, _callback: (...args: unknown[]) => void) => {
        return mocks.mockChannel();
      }),
      subscribe: mocks.mockSubscribe,
    });

    // Default Supabase query mock: empty tables
    mocks.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  it('should render children and not trigger bell when no confirmed orders exist', async () => {
    // Set up Electron API on window
    const win = window as unknown as { electronAPI: typeof mockElectronAPI };
    win.electronAPI = mockElectronAPI;
    mockElectronAPI.showBellWindow.mockClear();
    mockElectronAPI.updateTrayBadge.mockClear();

    render(
      <AdminLayout>
        <div data-testid="admin-child">Dashboard Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('admin-child')).toBeInTheDocument();
    expect(mockElectronAPI.showBellWindow).not.toHaveBeenCalled();

    delete (window as unknown as Record<string, unknown>).electronAPI;
  });

  it('should call showBellWindow and updateTrayBadge when confirmed orders are loaded', async () => {
    const win = window as unknown as { electronAPI: typeof mockElectronAPI };
    win.electronAPI = mockElectronAPI;
    mockElectronAPI.showBellWindow.mockClear();
    mockElectronAPI.updateTrayBadge.mockClear();

    // Mock initial confirmed orders fetch to return 1 order
    mocks.mockFrom.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: unknown) => {
          if (table === 'orders' && col === 'order_status' && val === 'confirmed') {
            return {
              order: vi.fn().mockResolvedValue({ data: [mockOrderData], error: null }),
            };
          }
          return chain;
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      return chain;
    });

    await act(async () => {
      render(
        <AdminLayout>
          <div>Content</div>
        </AdminLayout>
      );
    });

    expect(mockElectronAPI.showBellWindow).toHaveBeenCalledWith({
      id: mockOrderData.id,
      customer_name: mockOrderData.customer_name,
      items_summary: '2x Test Item',
      total_amount: mockOrderData.total_amount,
    });
    expect(mockElectronAPI.updateTrayBadge).toHaveBeenCalledWith(1);

    delete (window as unknown as Record<string, unknown>).electronAPI;
  });
});
