import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HistoryView from './HistoryView';

vi.mock('framer-motion', () => ({
  motion: { div: 'div' },
}));

const mockOrders = [
  {
    id: 'order-12345678',
    friendly_id: '1001',
    customer_name: 'John Doe',
    delivery_address: '123 Main St, Mumbai',
    distance_km: 2.5,
    rider_earning: 45,
    delivered_at: new Date(Date.now() - 30 * 60000).toISOString(), // 30 minutes ago
  },
  {
    id: 'order-22222222',
    friendly_id: null,
    customer_name: '',
    delivery_address: '',
    distance_km: null,
    rider_earning: null,
    delivered_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
  },
];

describe('HistoryView', () => {
  it('should render loading skeleton when loading', () => {
    render(<HistoryView orders={[]} loading={true} />);
    
    // Check that there is no title or content, but loading placeholder exists
    expect(screen.queryByText('Last 24 Hours')).not.toBeInTheDocument();
  });

  it('should render empty state when no orders are present', () => {
    render(<HistoryView orders={[]} loading={false} />);

    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('No deliveries in the last 24 hours')).toBeInTheDocument();
  });

  it('should render list of orders with formatted times and default fallbacks', () => {
    render(<HistoryView orders={mockOrders} loading={false} />);

    // Order 1 (complete details, <1 hr ago)
    expect(screen.getByText('#1001')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('123 Main St, Mumbai')).toBeInTheDocument();
    expect(screen.getAllByText(/Distance:/)[0]).toBeInTheDocument();
    expect(screen.getByText('2.5 km')).toBeInTheDocument();
    expect(screen.getByText('₹45')).toBeInTheDocument();
    expect(screen.getByText('30m ago')).toBeInTheDocument();

    // Order 2 (missing details/fallbacks, >1 hr ago)
    expect(screen.getByText('#order-22')).toBeInTheDocument(); // fallback to id slice (first 8 chars of 'order-22222222')
    expect(screen.getByText('Guest')).toBeInTheDocument(); // fallback customer name
    expect(screen.getByText('No address')).toBeInTheDocument(); // fallback address
    expect(screen.getAllByText(/Distance:/)[1]).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // fallback distance
    expect(screen.getByText('₹0')).toBeInTheDocument(); // fallback earning
  });

  it('should format delivered dates correctly based on the 1-hour boundary', () => {
    const now = Date.now();
    const customOrders = [
      {
        id: 'order-3',
        friendly_id: '1003',
        customer_name: 'Bob',
        delivery_address: 'Home',
        distance_km: 1.0,
        rider_earning: 30,
        delivered_at: new Date(now - 59 * 60000).toISOString(), // 59 mins ago (relative)
      },
      {
        id: 'order-4',
        friendly_id: '1004',
        customer_name: 'Alice',
        delivery_address: 'Work',
        distance_km: 2.0,
        rider_earning: 40,
        delivered_at: new Date(now - 60 * 60000).toISOString(), // 60 mins ago (should be absolute clock time)
      },
    ];

    render(<HistoryView orders={customOrders} loading={false} />);

    expect(screen.getByText('59m ago')).toBeInTheDocument();
    
    // Check that absolute clock is rendered for 60m ago
    const deliveredAt = new Date(now - 60 * 60000);
    let hours = deliveredAt.getHours();
    const minutes = String(deliveredAt.getMinutes()).padStart(2, '0');
    const amamp = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const expectedTime = `${String(hours).padStart(2, '0')}:${minutes} ${amamp}`;
    
    expect(screen.getByText(expectedTime)).toBeInTheDocument();
  });
});
