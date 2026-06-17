import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MenuManagementClient from './MenuManagementClient';

// Mock the server actions
vi.mock('@/app/actions/adminActions', () => ({
  addMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  deleteMenuItem: vi.fn(),
  toggleItemAvailability: vi.fn(),
  updateItemPrice: vi.fn(),
  uploadDishImage: vi.fn(),
}));

vi.mock('@/app/actions/settingsActions', () => ({
  getAppSettings: vi.fn().mockResolvedValue({ success: true, data: { max_delivery_radius: 10 } }),
  updateAppSettings: vi.fn(),
}));

// Mock framer-motion to avoid animation timing/opacity issues in jsdom tests
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

const mockCategories = [
  { id: '1', name: 'Starters', display_order: 1, is_active: true },
  { id: '2', name: 'Main Course', display_order: 2, is_active: true },
];

const mockItems = [
  {
    id: '1',
    name: 'Paneer Tikka',
    price: 250,
    category: 'Starters',
    category_id: '1',
    image_url: 'https://example.com/image.jpg',
    is_available: true,
    tags: [],
  },
];

describe('MenuManagementClient - Modal Action Buttons Visibility', () => {
  it('should render the Add New Dish button', async () => {
    await act(async () => {
      render(
        <MenuManagementClient
          initialItems={mockItems}
          categories={mockCategories}
        />
      );
    });

    const addButton = screen.getByRole('button', { name: /add new dish/i });
    expect(addButton).toBeInTheDocument();
  });

  it('should show Cancel and Create Dish buttons when modal opens', async () => {
    await act(async () => {
      render(
        <MenuManagementClient
          initialItems={mockItems}
          categories={mockCategories}
        />
      );
    });

    // Click the Add New Dish button to open modal
    const addButton = screen.getByRole('button', { name: /add new dish/i });
    await act(async () => {
      fireEvent.click(addButton);
    });

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    // Check that both action buttons are visible
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const createButton = screen.getByRole('button', { name: /create dish/i });

    expect(cancelButton).toBeInTheDocument();
    expect(createButton).toBeInTheDocument();

    // Verify buttons are visible (not hidden or cut off)
    expect(cancelButton).toBeVisible();
    expect(createButton).toBeVisible();
  });

  it('should have action buttons with proper touch target size', async () => {
    await act(async () => {
      render(
        <MenuManagementClient
          initialItems={mockItems}
          categories={mockCategories}
        />
      );
    });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add new dish/i });
    await act(async () => {
      fireEvent.click(addButton);
    });

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    // Check button classes for proper sizing
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const createButton = screen.getByRole('button', { name: /create dish/i });

    // Buttons should have py-4 (16px padding) for proper touch targets
    expect(cancelButton.className).toContain('py-4');
    expect(createButton.className).toContain('py-4');
  });
});

