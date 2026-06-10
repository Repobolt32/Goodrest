import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DeliveryConfirmationModal from './DeliveryConfirmationModal';

vi.mock('framer-motion', () => ({
  motion: { div: 'div', button: 'button', h3: 'h3' },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const mockOrder = {
  id: 'order-123456',
  friendly_id: '9999',
  customer_name: 'Jane Doe',
  delivery_address: 'Flat 101, Sky Heights, Gachibowli',
  distance_km: 4.8,
  rider_earning: 60,
};

describe('DeliveryConfirmationModal', () => {
  it('should render all details when open', () => {
    render(
      <DeliveryConfirmationModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Confirm Delivery')).toBeInTheDocument();
    expect(screen.getByText('#9999')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Flat 101, Sky Heights, Gachibowli')).toBeInTheDocument();
    expect(screen.getByText('4.8 km')).toBeInTheDocument();
    expect(screen.getByText('₹60')).toBeInTheDocument();
  });

  it('should call onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <DeliveryConfirmationModal
        order={mockOrder}
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call onClose when close X button is clicked', () => {
    const onClose = vi.fn();
    render(
      <DeliveryConfirmationModal
        order={mockOrder}
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should trigger onConfirm and close on success', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(
      <DeliveryConfirmationModal
        order={mockOrder}
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delivered' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it('should render error message and keep modal open on confirm failure', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ success: false, error: 'Database Timeout' });
    const onClose = vi.fn();
    render(
      <DeliveryConfirmationModal
        order={mockOrder}
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delivered' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    // Verify error banner appears
    const errorBanner = await screen.findByText('Database Timeout');
    expect(errorBanner).toBeInTheDocument();
    // Verify modal is not closed
    expect(onClose).not.toHaveBeenCalled();

    // Verify confirm button is re-enabled to allow retry
    const confirmBtn = screen.getByRole('button', { name: 'Yes, Delivered' });
    expect(confirmBtn).not.toHaveAttribute('disabled');
  });

  it('should prevent double-confirmations while loading', async () => {
    let resolveConfirm: (value: { success: boolean }) => void = () => {};
    const confirmPromise = new Promise<{ success: boolean }>((resolve) => {
      resolveConfirm = resolve;
    });
    const onConfirm = vi.fn().mockReturnValue(confirmPromise);

    render(
      <DeliveryConfirmationModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: 'Yes, Delivered' });
    
    // Tap confirm first time
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledOnce();

    // Tap confirm second time immediately
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledOnce(); // Still 1 because it's loading/disabled

    // Resolve the loading state
    resolveConfirm({ success: true });
  });

  it('should handle exception/rejection in onConfirm gracefully', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Network offline'));
    render(
      <DeliveryConfirmationModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delivered' }));
    const errorBanner = await screen.findByText(/network or server error/i);
    expect(errorBanner).toBeInTheDocument();
  });
});
