import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockJwtVerify = vi.hoisted(() => vi.fn());

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

const mockGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    get: mockGet,
  }),
}));

import { verifyAdminSession, getAdminSession } from '@/lib/auth';

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyAdminSession', () => {
    it('should return unauthorized when no session cookie', async () => {
      mockGet.mockReturnValue(undefined);
      const result = await verifyAdminSession();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should return unauthorized when JWT verification fails', async () => {
      mockGet.mockReturnValue({ value: 'invalid-token' });
      mockJwtVerify.mockRejectedValue(new Error('Invalid token'));
      const result = await verifyAdminSession();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should return success with session when JWT is valid', async () => {
      mockGet.mockReturnValue({ value: 'valid-token' });
      mockJwtVerify.mockResolvedValue({ payload: { role: 'admin' } });
      const result = await verifyAdminSession();
      expect(result.success).toBe(true);
      expect(result.session).toEqual({ role: 'admin' });
      expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', expect.anything());
    });
  });

  describe('getAdminSession', () => {
    it('should return session when valid', async () => {
      mockGet.mockReturnValue({ value: 'valid-token' });
      mockJwtVerify.mockResolvedValue({ payload: { role: 'admin' } });
      const session = await getAdminSession();
      expect(session).toEqual({ role: 'admin' });
    });

    it('should return null when unauthorized', async () => {
      mockGet.mockReturnValue(undefined);
      const session = await getAdminSession();
      expect(session).toBeNull();
    });
  });
});
