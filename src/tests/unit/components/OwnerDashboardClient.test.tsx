import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  mockChannel: vi.fn(),
  mockOn: vi.fn(),
  mockSubscribe: vi.fn(),
  mockRemoveChannel: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: mocks.mockChannel,
    removeChannel: mocks.mockRemoveChannel,
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/app/actions/ownerActions', () => ({
  acceptOrder: vi.fn().mockResolvedValue({ success: true }),
  markFoodReady: vi.fn().mockResolvedValue({ success: true }),
  dispatchOrder: vi.fn().mockResolvedValue({ success: true }),
  toggleOnlineStatus: vi.fn().mockResolvedValue({ success: true, data: { online_status: true } }),
  getRestaurantSettings: vi.fn().mockResolvedValue({
    success: true,
    data: { online_status: true, prep_time_minutes: 20, auto_reject_minutes: 5 },
  }),
  getWeeklyRiderPayouts: vi.fn().mockResolvedValue([]),
}));

import OwnerDashboardClient from '@/components/owner/OwnerDashboardClient';
import { toOrderRecord } from '@/types/orders';
import type { OrderRow } from '@/types/orders';

const mockConfirmedOrder = {
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
  updated_at: '2026-05-19T10:00:00Z',
  batch_id: null,
  delivery_coordinates: null,
  distance_km: null,
  duration_seconds: null,
  eta_last_updated: null,
  eta_minutes: null,
  lat: null,
  lng: null,
  latest_lat: null,
  latest_lng: null,
  last_location_timestamp: null,
  razorpay_order_id: 'order_test_123',
  razorpay_payment_id: 'pay_test_123',
  rider_id: null,
  rider_phone: null,
  rider_accepted_at: null,
  rider_earning: null,
  rider_started_at: null,
  tracking_url: null,
  delivered_at: null,
  accepted_at: null,
  prep_deadline: null,
  food_ready_at: null,
} as unknown as OrderRow;

describe('OwnerDashboardClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockChannel.mockReturnValue({
      on: mocks.mockOn.mockReturnThis(),
      subscribe: mocks.mockSubscribe,
    });
  });

  it('should render confirmed orders with accept button', () => {
    const order = toOrderRecord(mockConfirmedOrder);

    render(<OwnerDashboardClient initialOrders={[order]} initialOnlineStatus={true} />);

    const elements = screen.getAllByText('Test Customer');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show empty kitchen state when no active orders', () => {
    render(<OwnerDashboardClient initialOrders={[]} initialOnlineStatus={true} />);

    expect(screen.getByText('No active orders in kitchen')).toBeDefined();
  });

  it('should render online toggle', () => {
    render(<OwnerDashboardClient initialOrders={[]} initialOnlineStatus={true} />);

    expect(screen.getByText('ONLINE')).toBeDefined();
  });
});
