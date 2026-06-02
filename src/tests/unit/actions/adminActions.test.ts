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
      const result = await updateOrderStatus('order-1', 'preparing');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject deleteOrder without session', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValue({ success: false, error: 'Unauthorized' });
      const result = await deleteOrder('order-1');
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
    it('should update order status', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await updateOrderStatus('order-1', 'preparing');
      expect(result.success).toBe(true);
    });

    it('should return error on DB failure', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: { message: 'DB error' } }));
      const result = await updateOrderStatus('order-1', 'preparing');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await updatePaymentStatus('order-1', 'paid');
      expect(result.success).toBe(true);
    });
  });

  describe('deleteOrder', () => {
    it('should soft delete order by setting deleted_at', async () => {
      const mockIs = vi.fn().mockResolvedValue({ error: null });
      mocks.mockEq.mockReturnValue({ is: mockIs });
      const result = await deleteOrder('order-1');
      expect(result.success).toBe(true);
    });
  });

  describe('toggleItemAvailability', () => {
    it('should toggle menu item availability', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await toggleItemAvailability('item-1', false);
      expect(result.success).toBe(true);
    });

    it('should return error on DB failure', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: { message: 'DB error' } }));
      const result = await toggleItemAvailability('item-1', false);
      expect(result.success).toBe(false);
    });
  });

  describe('updateItemPrice', () => {
    it('should update item price', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await updateItemPrice('item-1', 250);
      expect(result.success).toBe(true);
    });
  });

  describe('addMenuItem', () => {
    it('should add menu item successfully', async () => {
      const newItem = { name: 'Pizza', price: 200, category: 'Main Course', is_available: true };
      mocks.mockInsert.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'item-1', ...newItem }, error: null }) }) });
      const result = await addMenuItem(newItem);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('item-1');
    });
  });

  describe('updateMenuItem', () => {
    it('should update existing menu item', async () => {
      mocks.mockEq.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'item-1', name: 'Updated Pizza' }, error: null }) }) });
      const result = await updateMenuItem('item-1', { name: 'Updated Pizza' });
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
      const result = await deleteMenuItem('item-1');
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
