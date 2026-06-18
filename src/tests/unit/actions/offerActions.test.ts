import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockNeq: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockOrder: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockFrom: vi.fn(),
  mockVerifyAdminSession: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: mocks.mockVerifyAdminSession,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.mockRevalidatePath,
}));

import {
  getActiveOffers,
  getAllOffers,
  createOffer,
  updateOffer,
  toggleOffer,
  deleteOffer,
} from '@/app/actions/offerActions';

describe('offerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

    const chain = {
      select: mocks.mockSelect,
      eq: mocks.mockEq,
      neq: mocks.mockNeq,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      order: mocks.mockOrder,
      single: mocks.mockSingle,
      maybeSingle: mocks.mockMaybeSingle,
    };

    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockEq.mockReturnValue(chain);
    mocks.mockNeq.mockReturnValue(chain);
    mocks.mockInsert.mockReturnValue(chain);
    mocks.mockUpdate.mockReturnValue(chain);
    mocks.mockDelete.mockReturnValue(chain);
    mocks.mockOrder.mockReturnValue(chain);
  });

  describe('getActiveOffers', () => {
    it('should return active offers within time window', async () => {
      const mockOffers = [
        { id: 'offer-1', type: 'discount_percent', config: { percent: 10 }, active: true, start_time: null, end_time: null },
      ];
      mocks.mockEq.mockResolvedValueOnce({ data: mockOffers, error: null });

      const result = await getActiveOffers();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOffers);
    });

    it('should return empty array when no active offers', async () => {
      mocks.mockEq.mockResolvedValueOnce({ data: [], error: null });

      const result = await getActiveOffers();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database error', async () => {
      mocks.mockEq.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

      const result = await getActiveOffers();
      expect(result.success).toBe(false);
      expect(result.error).toBe('db error');
    });
  });

  describe('getAllOffers', () => {
    it('should return all offers for admin', async () => {
      const mockOffers = [
        { id: 'offer-1', type: 'discount_percent', active: true },
        { id: 'offer-2', type: 'free_delivery', active: false },
      ];
      mocks.mockOrder.mockResolvedValueOnce({ data: mockOffers, error: null });

      const result = await getAllOffers();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOffers);
    });

    it('should reject unauthorized user', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await getAllOffers();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('createOffer', () => {
    it('should create a new offer', async () => {
      const input = {
        type: 'discount_percent' as const,
        config: { percent: 10, max_amount: 100 },
        active: true,
      };
      const mockCreated = { id: 'new-offer', ...input, label: '10% off', created_at: '2026-06-08T00:00:00Z' };
      mocks.mockSingle.mockResolvedValueOnce({ data: mockCreated, error: null });

      const result = await createOffer(input);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreated);
      expect(mocks.mockRevalidatePath).toHaveBeenCalledWith('/admin/offers');
    });

    it('should reject unauthorized user', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await createOffer({ type: 'discount_percent', config: { percent: 10 }, active: true });
      expect(result.success).toBe(false);
    });

    it('should handle database error on insert', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

      const result = await createOffer({ type: 'discount_percent', config: { percent: 10 }, active: true });
      expect(result.success).toBe(false);
      expect(result.error).toBe('insert failed');
    });
  });

  describe('updateOffer', () => {
    it('should update an offer', async () => {
      const validId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const mockUpdated = { id: validId, type: 'discount_percent', config: { percent: 20 }, active: true };
      mocks.mockSingle
        .mockResolvedValueOnce({ data: { type: 'discount_percent', config: { percent: 10 }, active: true }, error: null }) // SELECT existing lookup
        .mockResolvedValueOnce({ data: mockUpdated, error: null }); // UPDATE result

      const result = await updateOffer(validId, { config: { percent: 20 } });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdated);
    });

    it('should reject invalid UUID', async () => {
      const result = await updateOffer('not-a-uuid', { active: false });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should reject unauthorized user', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });
      const validId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const result = await updateOffer(validId, { active: false });
      expect(result.success).toBe(false);
    });
  });

  describe('toggleOffer', () => {
    it('should toggle offer active status', async () => {
      const validId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const mockToggled = { id: validId, active: true };
      mocks.mockSingle.mockResolvedValueOnce({ data: mockToggled, error: null });

      const result = await toggleOffer(validId, true);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockToggled);
    });

    it('should reject unauthorized user', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });
      const validId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const result = await toggleOffer(validId, true);
      expect(result.success).toBe(false);
    });
  });

  describe('deleteOffer', () => {
    it('should delete an offer', async () => {
      const validId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await deleteOffer(validId);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', async () => {
      const result = await deleteOffer('bad-id');
      expect(result.success).toBe(false);
    });

    it('should reject unauthorized user', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });
      const validId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const result = await deleteOffer(validId);
      expect(result.success).toBe(false);
    });
  });
});
