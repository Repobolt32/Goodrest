import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockLimit: vi.fn(),
  mockOrder: vi.fn(),
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
  },
}));

import { getOrdersByPhone, getOrderById } from '@/app/actions/trackActions';

describe('trackActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {
      select: mocks.mockSelect,
      eq: mocks.mockEq,
      order: mocks.mockOrder,
      limit: mocks.mockLimit,
      single: mocks.mockSingle,
      update: mocks.mockUpdate,
    };
    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockUpdate.mockReturnValue(chain);
  });

  describe('getOrdersByPhone', () => {
    it('should return orders sorted with active first', async () => {
      const mockData = [
        { id: '1', friendly_id: 'F001', order_status: 'delivered', total_amount: 200, created_at: '2025-01-01', items: [] },
        { id: '2', friendly_id: 'F002', order_status: 'placed', total_amount: 300, created_at: '2025-01-02', items: [] },
      ];
      mocks.mockSelect.mockReturnValue({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: mockData, error: null }) }) }) });

      const result = await getOrdersByPhone('1234567890');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2'); // Active first
    });

    it('should return empty array on error', async () => {
      mocks.mockSelect.mockReturnValue({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'DB error' } }) }) }) });

      const result = await getOrdersByPhone('1234567890');
      expect(result).toEqual([]);
    });
  });

  describe('getOrderById', () => {
    it('should return order for valid id', async () => {
      const mockData = { id: 'order-1', friendly_id: 'F001', order_status: 'placed', total_amount: 200, items: '[{"name":"Pizza","quantity":1}]' };
      mocks.mockSelect.mockReturnValue({ eq: () => ({ single: () => Promise.resolve({ data: mockData, error: null }) }) });

      const result = await getOrderById('order-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('order-1');
    });

    it('should return null on DB error', async () => {
      mocks.mockSelect.mockReturnValue({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }) }) });

      const result = await getOrderById('nonexistent');
      expect(result).toBeNull();
    });
  });
});
