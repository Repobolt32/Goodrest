import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSign = vi.hoisted(() => vi.fn().mockResolvedValue('mock-jwt-token'));

vi.mock('jose', () => ({
  SignJWT: class SignJWT {
    setProtectedHeader() { return this; }
    setExpirationTime() { return this; }
    sign = mockSign;
  },
}));

const mockSet = vi.fn();
const mockDelete = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    set: mockSet,
    delete: mockDelete,
  }),
  headers: () => Promise.resolve({
    get: () => '127.0.0.1',
  }),
}));

import { login, logout } from '@/app/actions/authActions';

// ADMIN_PASSWORD is captured at module load time from process.env
const ACTUAL_PASSWORD = process.env.ADMIN_PASSWORD || 'goodrest88';

describe('authActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should login with correct password', async () => {
    const result = await login(ACTUAL_PASSWORD);
    expect(result.success).toBe(true);
    expect(mockSet).toHaveBeenCalledOnce();
  });

  it('should reject wrong password', async () => {
    const result = await login('wrongpassword');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid password');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('should use fallback password when ADMIN_PASSWORD not set', async () => {
    // If ADMIN_PASSWORD was set in env, the constant captured it.
    // This test verifies the fallback value 'goodrest88' works.
    const result = await login('goodrest88');
    expect(result.success).toBe(true);
  });

  it('should logout and clear cookie', async () => {
    const result = await logout();
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('admin_session');
  });

  it('should set httpOnly cookie on login', async () => {
    await login(ACTUAL_PASSWORD);
    expect(mockSet).toHaveBeenCalledWith(
      'admin_session',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      })
    );
  });
});
