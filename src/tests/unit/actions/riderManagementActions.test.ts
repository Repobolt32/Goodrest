import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
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

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_pw_123'),
  },
}));

import {
  getAllRiders,
  createRider,
  toggleRiderStatus,
  resetRiderPassword,
} from '@/app/actions/riderManagementActions';

describe('riderManagementActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerifyAdminSession.mockResolvedValue({ success: true, session: { role: 'admin' } });

    const chain = {
      select: mocks.mockSelect,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      eq: mocks.mockEq,
      order: mocks.mockOrder,
      single: mocks.mockSingle,
      maybeSingle: mocks.mockMaybeSingle,
    };

    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockInsert.mockReturnValue(chain);
    mocks.mockUpdate.mockReturnValue(chain);
    mocks.mockEq.mockReturnValue(chain);
    mocks.mockOrder.mockReturnValue(chain);
    mocks.mockSingle.mockReturnValue(chain);
    mocks.mockMaybeSingle.mockReturnValue(chain);
  });

  describe('getAllRiders', () => {
    it('should reject without admin session', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });
      const result = await getAllRiders();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should fetch riders successfully', async () => {
      const mockRiders = [{ id: '1', name: 'John Doe' }];
      mocks.mockOrder.mockResolvedValueOnce({ data: mockRiders, error: null });

      const result = await getAllRiders();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRiders);
    });

    it('should handle db error gracefully', async () => {
      mocks.mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'Database connection failed' } });

      const result = await getAllRiders();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('createRider', () => {
    it('should reject without admin session', async () => {
      mocks.mockVerifyAdminSession.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });
      const result = await createRider('John', 'john', '+911234567890', 'pass123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should validate short username', async () => {
      const result = await createRider('John', 'jo', '+911234567890', 'pass123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Username must be at least 3 characters');
    });

    it('should check duplicate username and phone', async () => {
      // First check for username: mock username already registered
      mocks.mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'existing' }, error: null });

      const result = await createRider('John', 'john', '+911234567890', 'pass123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Username already registered');
    });

    it('should create rider successfully', async () => {
      // username check: not found
      mocks.mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // phone check: not found
      mocks.mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      
      const newRider = { id: 'new-uuid', name: 'John', username: 'john', phone: '+911234567890' };
      mocks.mockSingle.mockResolvedValueOnce({ data: newRider, error: null });

      const result = await createRider('John', 'john', '+911234567890', 'pass123');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(newRider);
    });
  });

  describe('toggleRiderStatus', () => {
    it('should toggle rider status successfully', async () => {
      mocks.mockEq.mockResolvedValueOnce({ error: null });

      const result = await toggleRiderStatus('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', false);
      expect(result.success).toBe(true);
    });
  });

  describe('resetRiderPassword', () => {
    it('should reset rider password successfully', async () => {
      mocks.mockEq.mockResolvedValueOnce({ error: null });

      const result = await resetRiderPassword('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'newpassword');
      expect(result.success).toBe(true);
    });
  });
});
