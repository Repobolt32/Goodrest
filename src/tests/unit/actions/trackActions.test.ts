import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockLimit: vi.fn(),
  mockOrder: vi.fn(),
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
  mockCookies: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  verifyCustomerSession: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyCustomerSession: authMocks.verifyCustomerSession,
}));

vi.mock('next/headers', () => ({
  cookies: () => mocks.mockCookies(),
}));

import { getOrdersByPhone, getOrderById } from '@/app/actions/trackActions';

describe('trackActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.verifyCustomerSession.mockResolvedValue({ success: true, session: { phone: '1234567890' } });
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
    it('should return order for valid id with matching session phone', async () => {
      const mockData = { id: 'order-1', friendly_id: 'F001', order_status: 'placed', total_amount: 200, customer_phone: '1234567890', items: '[{"name":"Pizza","quantity":1}]' };
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

    it('should reject access when session phone does not match order customer_phone', async () => {
      authMocks.verifyCustomerSession.mockResolvedValue({ success: true, session: { phone: '9999999999' } });
      const mockData = { id: 'order-1', customer_phone: '1234567890', order_status: 'placed', total_amount: 200, items: '[]' };
      mocks.mockSelect.mockReturnValue({ eq: () => ({ single: () => Promise.resolve({ data: mockData, error: null }) }) });

      const result = await getOrderById('order-1');
      expect(result).toBeNull();
    });

    it('should reject access when no customer session exists', async () => {
      authMocks.verifyCustomerSession.mockResolvedValue({ success: false, error: 'Unauthorized' });

      const result = await getOrderById('order-1');
      expect(result).toBeNull();
    });

    it('should not expose internal columns (batch_id, deleted_at, razorpay_payment_id)', async () => {
      const mockData = { id: 'order-1', customer_phone: '1234567890', order_status: 'placed', total_amount: 200, items: '[]' };
      mocks.mockSelect.mockReturnValue({ eq: () => ({ single: () => Promise.resolve({ data: mockData, error: null }) }) });

      await getOrderById('order-1');

      // Verify select was called with explicit columns, not '*'
      const selectCall = mocks.mockSelect.mock.calls[0]?.[0];
      expect(selectCall).not.toBe('*');
      expect(selectCall).toContain('id');
      expect(selectCall).not.toContain('batch_id');
      expect(selectCall).not.toContain('deleted_at');
      expect(selectCall).not.toContain('razorpay_payment_id');
    });
  });
});
