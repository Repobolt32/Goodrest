import { renderHook, waitFor } from '@testing-library/react';
import { useMenu } from './useMenu';

// Mock Supabase
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  async then(resolve: (value: unknown) => void) {
    resolve({ data: [{ id: '1', name: 'Test Food', category: 'Main Course' }], error: null });
  },
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => mockSupabaseQuery),
  },
}));

describe('useMenu', () => {
  it('should fetch menu items for a specific category', async () => {
    const { result } = renderHook(() => useMenu('Main Course'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.menuItems).toHaveLength(1);
    expect(result.current.menuItems[0].name).toBe('Test Food');
  });
});
