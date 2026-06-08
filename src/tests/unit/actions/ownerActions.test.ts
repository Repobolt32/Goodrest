import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockNot: vi.fn(),
  mockIs: vi.fn(),
  mockGte: vi.fn(),
  mockOrder: vi.fn(),
  mockIn: vi.fn(),
  mockUpdate: vi.fn(),
  mockSingle: vi.fn(),
  mockFrom: vi.fn(),
  mockVerifyAdminSession: vi.fn(),
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
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/validation', () => ({
  getRestoCoordinates: vi.fn().mockReturnValue({ lat: 24.79, lng: 85.01 }),
}));

import { getWeeklyRiderPayouts, toggleOnlineStatus, updatePrepTime } from '@/app/actions/ownerActions';

describe('ownerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

    const chain = {
      select: mocks.mockSelect,
      eq: mocks.mockEq,
      not: mocks.mockNot,
      is: mocks.mockIs,
      gte: mocks.mockGte,
      order: mocks.mockOrder,
      in: mocks.mockIn,
      update: mocks.mockUpdate,
      single: mocks.mockSingle,
    };

    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockEq.mockReturnValue(chain);
    mocks.mockNot.mockReturnValue(chain);
    mocks.mockIs.mockReturnValue(chain);
    mocks.mockGte.mockReturnValue(chain);
    mocks.mockIn.mockReturnValue(chain);
    mocks.mockUpdate.mockReturnValue(chain);
  });

  describe('getWeeklyRiderPayouts', () => {
    it('should return empty array when no orders exist', async () => {
      mocks.mockOrder.mockResolvedValueOnce({ data: [], error: null });

      const result = await getWeeklyRiderPayouts();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return empty array when orders is null', async () => {
      mocks.mockOrder.mockResolvedValueOnce({ data: null, error: null });

      const result = await getWeeklyRiderPayouts();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return rider payouts grouped by rider', async () => {
      const mockOrders = [
        { rider_id: 'rider-1', rider_earning: 500, distance_km: 3.0, delivered_at: '2026-05-31T10:00:00.000Z' },
        { rider_id: 'rider-1', rider_earning: 600, distance_km: 8.0, delivered_at: '2026-05-31T14:00:00.000Z' },
        { rider_id: 'rider-2', rider_earning: 400, distance_km: 2.0, delivered_at: '2026-05-31T12:00:00.000Z' },
      ];
      const mockRiders = [
        { id: 'rider-1', name: 'Rider A', phone: '1111111111' },
        { id: 'rider-2', name: 'Rider B', phone: '2222222222' },
      ];

      mocks.mockOrder.mockResolvedValueOnce({ data: mockOrders, error: null });
      mocks.mockIn.mockResolvedValueOnce({ data: mockRiders, error: null });

      const result = await getWeeklyRiderPayouts();
      const payouts = result.data!;
      expect(payouts.length).toBe(2);
      expect(payouts[0].riderName).toBe('Rider A');
      expect(payouts[0].weekDeliveries).toBe(2);
      expect(payouts[0].weekTotalDue).toBe(1100);
      expect(payouts[1].riderName).toBe('Rider B');
      expect(payouts[1].weekDeliveries).toBe(1);
      expect(payouts[1].weekTotalDue).toBe(400);
    });

    it('should handle orders without distance_km', async () => {
      const mockOrders = [
        { rider_id: 'rider-1', rider_earning: 500, distance_km: null, delivered_at: '2026-05-31T10:00:00.000Z' },
      ];
      const mockRiders = [{ id: 'rider-1', name: 'Rider A', phone: '1111111111' }];

      mocks.mockOrder.mockResolvedValueOnce({ data: mockOrders, error: null });
      mocks.mockIn.mockResolvedValueOnce({ data: mockRiders, error: null });

      const result = await getWeeklyRiderPayouts();
      expect(result.data![0].weekDeliveryFees).toBe(500);
      expect(result.data![0].weekPickupPay).toBe(0);
    });

    it('should handle rider with no name/phone gracefully', async () => {
      const mockOrders = [
        { rider_id: 'rider-unknown', rider_earning: 300, distance_km: 1.5, delivered_at: '2026-05-31T10:00:00.000Z' },
      ];

      mocks.mockOrder.mockResolvedValueOnce({ data: mockOrders, error: null });
      mocks.mockIn.mockResolvedValueOnce({ data: [], error: null });

      const result = await getWeeklyRiderPayouts();
      expect(result.data![0].riderName).toBe('Unknown');
      expect(result.data![0].riderPhone).toBe('');
    });

    it('should calculate nightly bonus across multiple days', async () => {
      const mockOrders = Array.from({ length: 6 }, () => ({
        rider_id: 'rider-1', rider_earning: 50, distance_km: 2.0, delivered_at: '2026-05-31T10:00:00.000Z',
      })).concat(
        Array.from({ length: 4 }, () => ({
          rider_id: 'rider-1', rider_earning: 50, distance_km: 2.0, delivered_at: '2026-05-30T10:00:00.000Z',
        }))
      );
      const mockRiders = [{ id: 'rider-1', name: 'Bonus Rider', phone: '9999999999' }];

      mocks.mockOrder.mockResolvedValueOnce({ data: mockOrders, error: null });
      mocks.mockIn.mockResolvedValueOnce({ data: mockRiders, error: null });

      const result = await getWeeklyRiderPayouts();
      const payout = result.data![0];
      expect(payout.weekBonus).toBe(100);
      expect(payout.weekDeliveries).toBe(10);
      expect(payout.weekTotalDue).toBe(600);
    });

    it('should deduplicate batch orders to avoid double-counting dead miles', async () => {
      const mockOrders = [
        { rider_id: 'rider-1', rider_earning: 53, distance_km: 3.5, delivered_at: '2026-05-31T10:00:00.000Z', batch_id: 'batch-abc' },
        { rider_id: 'rider-1', rider_earning: 41, distance_km: 2.0, delivered_at: '2026-05-31T10:30:00.000Z', batch_id: 'batch-abc' },
      ];
      const mockRiders = [{ id: 'rider-1', name: 'Batch Rider', phone: '7777777777' }];

      mocks.mockOrder.mockResolvedValueOnce({ data: mockOrders, error: null });
      mocks.mockIn.mockResolvedValueOnce({ data: mockRiders, error: null });

      const result = await getWeeklyRiderPayouts();
      const payout = result.data![0];
      // First order: full breakdown (deliveryFee + pickupPay)
      // Second order (same batch): pickupPay=0, deliveryFee=rider_earning
      // Total earnings = 53 + 41 = 94
      expect(payout.weekDeliveries).toBe(2);
      expect(payout.weekTotalDue).toBe(94);
    });
  });

  describe('toggleOnlineStatus', () => {
    it('should update online status to true', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: { online_status: true }, error: null });

      const result = await toggleOnlineStatus(true);
      expect(result.success).toBe(true);
      expect(mocks.mockFrom).toHaveBeenCalledWith('restaurant_settings');
      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ online_status: true })
      );
    });

    it('should update online status to false', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: { online_status: false }, error: null });

      const result = await toggleOnlineStatus(false);
      expect(result.success).toBe(true);
      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ online_status: false })
      );
    });

    it('should return error on DB failure', async () => {
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const result = await toggleOnlineStatus(true);
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('updatePrepTime', () => {
    it('should update prep time with valid value', async () => {
      mocks.mockEq.mockResolvedValueOnce({ error: null });

      const result = await updatePrepTime(25);
      expect(result.success).toBe(true);
      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ prep_time_minutes: 25 })
      );
    });

    it('should reject without admin session', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

      const result = await updatePrepTime(25);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject negative prep time', async () => {
      const result = await updatePrepTime(-5);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Prep time must be between 5 and 120 minutes.');
    });

    it('should reject prep time of zero', async () => {
      const result = await updatePrepTime(0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Prep time must be between 5 and 120 minutes.');
    });

    it('should reject prep time exceeding 120 minutes', async () => {
      const result = await updatePrepTime(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Prep time must be between 5 and 120 minutes.');
    });

    it('should accept boundary values (5 and 120)', async () => {
      mocks.mockEq.mockResolvedValueOnce({ error: null });
      const result5 = await updatePrepTime(5);
      expect(result5.success).toBe(true);

      mocks.mockEq.mockResolvedValueOnce({ error: null });
      const result120 = await updatePrepTime(120);
      expect(result120.success).toBe(true);
    });

    it('should return error on DB failure', async () => {
      mocks.mockEq.mockResolvedValueOnce({ error: { message: 'Update failed' } });

      const result = await updatePrepTime(25);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });
});
