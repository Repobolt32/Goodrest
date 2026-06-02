import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { getAppSettings, updateAppSettings } from '@/app/actions/settingsActions';

describe('settingsActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {
      select: mocks.mockSelect,
      eq: mocks.mockEq,
      single: mocks.mockSingle,
      update: mocks.mockUpdate,
    };
    mocks.mockFrom.mockReturnValue(chain);
    mocks.mockSelect.mockReturnValue(chain);
    mocks.mockUpdate.mockReturnValue(chain);
  });

  describe('getAppSettings', () => {
    it('should return settings from DB', async () => {
      const mockData = { id: 'global', max_delivery_radius: 15, delivery_enabled: true };
      mocks.mockSelect.mockReturnValue({ eq: () => ({ single: () => Promise.resolve({ data: mockData, error: null }) }) });

      const result = await getAppSettings();
      expect(result.success).toBe(true);
      expect(result.data.max_delivery_radius).toBe(15);
    });

    it('should return defaults if table does not exist', async () => {
      mocks.mockSelect.mockReturnValue({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'relation does not exist' } }) }) });

      const result = await getAppSettings();
      expect(result.success).toBe(true);
      expect(result.data.max_delivery_radius).toBe(10);
      expect(result.data.delivery_enabled).toBe(true);
    });
  });

  describe('updateAppSettings', () => {
    it('should update delivery radius', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await updateAppSettings({ max_delivery_radius: 20 });
      expect(result.success).toBe(true);
    });

    it('should toggle delivery enabled', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      const result = await updateAppSettings({ delivery_enabled: false });
      expect(result.success).toBe(true);
    });

    it('should return error on DB failure', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: { message: 'DB error' } }));
      const result = await updateAppSettings({ max_delivery_radius: 20 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });

    it('should set updated_at timestamp', async () => {
      mocks.mockEq.mockReturnValue(Promise.resolve({ error: null }));
      await updateAppSettings({ max_delivery_radius: 15 });
      const updateData = mocks.mockUpdate.mock.calls[0][0];
      expect(updateData.updated_at).toBeDefined();
    });
  });
});
