import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockOrder: vi.fn(),
  mockFrom: vi.fn(),
  mockVerifyAdminSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: mocks.mockVerifyAdminSession,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
    storage: {
      from: () => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/dish.jpg' } }),
      }),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  updateOrderStatus,
  updatePaymentStatus,
  deleteOrder,
  toggleItemAvailability,
  updateItemPrice,
  addMenuItem,
  updateMenuItem,
  getCategories,
  deleteMenuItem,
  uploadDishImage,
} from '@/app/actions/adminActions';

const VALID_ORDER = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
const VALID_ITEM = 'b1c2d3e4-f5a6-7890-1234-567890abcdef';

describe('adminActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });
    const chain = {
      select: mocks.mockSelect,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      eq: mocks.mockEq,
      order: mocks.mockOrder,
      single: mocks.mockSingle,
    };
    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockInsert.mockReturnValue(chain);
    mocks.mockUpdate.mockReturnValue(chain);
    mocks.mockDelete.mockReturnValue(chain);
  });

  describe('auth guards', () => {
    it('should reject updateOrderStatus without session', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValue({ success: false, error: 'Unauthorized' });
      const result = await updateOrderStatus(VALID_ORDER, 'preparing');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject deleteOrder without session', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValue({ success: false, error: 'Unauthorized' });
      const result = await deleteOrder(VALID_ORDER);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject addMenuItem without session', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValue({ success: false, error: 'Unauthorized' });
      const result = await addMenuItem({ name: 'Pizza', price: 200, category: 'Main', is_available: true });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject uploadDishImage without session', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValue({ success: false, error: 'Unauthorized' });
      const formData = new FormData();
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      formData.append('file', file);
      const result = await uploadDishImage(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status on valid transition', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { order_status: 'created' }, error: null }) }) }) })
        .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
      const result = await updateOrderStatus(VALID_ORDER, 'confirmed');
      expect(result.success).toBe(true);
    });

    it('should return error on DB failure during update', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { order_status: 'created' }, error: null }) }) }) })
        .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: { message: 'DB error' } }) }) });
      const result = await updateOrderStatus(VALID_ORDER, 'confirmed');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });

    it('should reject non-UUID orderId', async () => {
      const result = await updateOrderStatus('not-a-uuid', 'confirmed');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid order ID');
    });

    it('should reject invalid status values', async () => {
      const result = await updateOrderStatus(VALID_ORDER, 'hacked');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status');
    });

    it('should skip update when status is unchanged', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { order_status: 'confirmed' }, error: null }) }) }),
      });
      const result = await updateOrderStatus(VALID_ORDER, 'confirmed');
      expect(result.success).toBe(true);
    });

    it('should reject delivered -> confirmed (backwards transition)', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { order_status: 'delivered' }, error: null }) }) }),
      });
      const result = await updateOrderStatus(VALID_ORDER, 'confirmed');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should reject created -> delivered (skipping steps)', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { order_status: 'created' }, error: null }) }) }),
      });
      const result = await updateOrderStatus(VALID_ORDER, 'delivered');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should allow created -> cancelled', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { order_status: 'created' }, error: null }) }) }) })
        .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
      const result = await updateOrderStatus(VALID_ORDER, 'cancelled');
      expect(result.success).toBe(true);
    });

    it('should reject delivered -> preparing (backwards from terminal)', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { order_status: 'delivered' }, error: null }) }) }),
      });
      const result = await updateOrderStatus(VALID_ORDER, 'preparing');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should return error when order not found during status fetch', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'not found' } }) }) }),
      });
      const result = await updateOrderStatus(VALID_ORDER, 'confirmed');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status on valid transition', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { payment_status: 'pending' }, error: null }) }) }) })
        .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
      const result = await updatePaymentStatus(VALID_ORDER, 'paid');
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID orderId', async () => {
      const result = await updatePaymentStatus('not-a-uuid', 'paid');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid order ID');
    });

    it('should reject invalid payment status values', async () => {
      const result = await updatePaymentStatus(VALID_ORDER, 'hacked');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid payment status');
    });

    it('should reject pending -> refunded (skipping steps)', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { payment_status: 'pending' }, error: null }) }) }),
      });
      const result = await updatePaymentStatus(VALID_ORDER, 'refunded');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should reject refunded -> paid (backwards from terminal)', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { payment_status: 'refunded' }, error: null }) }) }),
      });
      const result = await updatePaymentStatus(VALID_ORDER, 'paid');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should allow paid -> refund_processing', async () => {
      mocks.mockFrom
        .mockReturnValueOnce({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { payment_status: 'paid' }, error: null }) }) }) })
        .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
      const result = await updatePaymentStatus(VALID_ORDER, 'refund_processing');
      expect(result.success).toBe(true);
    });

    it('should skip update when payment status is unchanged', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { payment_status: 'paid' }, error: null }) }) }),
      });
      const result = await updatePaymentStatus(VALID_ORDER, 'paid');
      expect(result.success).toBe(true);
    });

    it('should return error when order not found', async () => {
      mocks.mockFrom.mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'not found' } }) }) }),
      });
      const result = await updatePaymentStatus(VALID_ORDER, 'paid');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });
  });

  describe('deleteOrder', () => {
    it('should soft delete order by setting deleted_at', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: { order_status: 'delivered' }, error: null });
      const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });

      const mockIs = vi.fn().mockResolvedValue({ error: null });
      const mockEqUpdate = vi.fn().mockReturnValue({ is: mockIs });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });

      mocks.mockFrom
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ update: mockUpdate });

      const result = await deleteOrder(VALID_ORDER);
      expect(result.success).toBe(true);
      expect(mockIs).toHaveBeenCalled();
    });
  });

  describe('toggleItemAvailability', () => {
    it('should toggle menu item availability', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await toggleItemAvailability(VALID_ITEM, false);
      expect(result.success).toBe(true);
    });

    it('should return error on DB failure', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: { message: 'DB error' } }));
      const result = await toggleItemAvailability(VALID_ITEM, false);
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('updateItemPrice', () => {
    it('should update item price', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await updateItemPrice(VALID_ITEM, 250);
      expect(result.success).toBe(true);
    });
  });

  describe('addMenuItem', () => {
    it('should add menu item successfully', async () => {
      const newItem = { name: 'Pizza', price: 200, category: 'Main Course', is_available: true };
      mocks.mockInsert.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: VALID_ITEM, ...newItem }, error: null }) }) });
      const result = await addMenuItem(newItem);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(VALID_ITEM);
    });
  });

  describe('updateMenuItem', () => {
    it('should update existing menu item', async () => {
      mocks.mockEq.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: VALID_ITEM, name: 'Updated Pizza' }, error: null }) }) });
      const result = await updateMenuItem(VALID_ITEM, { name: 'Updated Pizza' });
      expect(result.success).toBe(true);
    });
  });

  describe('getCategories', () => {
    it('should fetch categories ordered by display_order', async () => {
      const mockData = [{ id: 'cat-1', name: 'Starters', display_order: 1 }];
      mocks.mockSelect.mockReturnValue({ order: () => Promise.resolve({ data: mockData, error: null }) });
      const result = await getCategories();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });
  });

  describe('deleteMenuItem', () => {
    it('should soft delete (set is_available=false)', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await deleteMenuItem(VALID_ITEM);
      expect(result.success).toBe(true);
    });
  });

  describe('uploadDishImage', () => {
    it('should reject missing file', async () => {
      const formData = new FormData();
      const result = await uploadDishImage(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('should reject invalid file type', async () => {
      const formData = new FormData();
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      formData.append('file', file);
      const result = await uploadDishImage(formData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject oversized file (>2MB)', async () => {
      const formData = new FormData();
      const bigFile = new File([new ArrayBuffer(3 * 1024 * 1024)], 'test.jpg', { type: 'image/jpeg' });
      formData.append('file', bigFile);
      const result = await uploadDishImage(formData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Max size');
    });

    it('should accept valid image file', async () => {
      const formData = new FormData();
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      formData.append('file', file);
      const result = await uploadDishImage(formData);
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
    });
  });
});
