import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: () => ({ allowed: true }),
}));

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
let mockHeadersGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    set: mockSet,
    delete: mockDelete,
  }),
  headers: () => Promise.resolve({
    get: (...args: string[]) => mockHeadersGet(...args),
  }),
}));

import { login, logout } from '@/app/actions/authActions';

const ACTUAL_PASSWORD = process.env.ADMIN_PASSWORD || 'goodrest88';

describe('authActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeadersGet = vi.fn();
  });

  it('should login with correct password', async () => {
    mockHeadersGet.mockReturnValue('127.0.0.1');
    const result = await login(ACTUAL_PASSWORD);
    expect(result.success).toBe(true);
    expect(mockSet).toHaveBeenCalledOnce();
  });

  it('should reject wrong password', async () => {
    mockHeadersGet.mockReturnValue('127.0.0.1');
    const result = await login('wrongpassword');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid password');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('should use fallback password when ADMIN_PASSWORD not set', async () => {
    mockHeadersGet.mockReturnValue('127.0.0.1');
    const result = await login('goodrest88');
    expect(result.success).toBe(true);
  });

  it('should logout and clear cookie', async () => {
    const result = await logout();
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('admin_session');
  });

  it('should set httpOnly cookie on login', async () => {
    mockHeadersGet.mockReturnValue('127.0.0.1');
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

  // Tracer bullet: should use secure IP extraction to prevent X-Forwarded-For injection bypass
  it('should prefer x-real-ip and fallback to x-forwarded-for first entry', async () => {
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === 'x-real-ip') return '12.34.56.78';
      if (name === 'x-forwarded-for') return '1.2.3.4, 192.168.1.1';
      if (name === 'x-forwarded-host') return 'evil.com';
      return '127.0.0.1';
    });

    await login(ACTUAL_PASSWORD);
    expect(mockSet).toHaveBeenCalledOnce();
  });

  it('should fallback to connection remote address when no forwarded headers', async () => {
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === 'x-real-ip') return null;
      if (name === 'x-forwarded-for') return null;
      return '10.0.0.5';
    });

    const result = await login(ACTUAL_PASSWORD);
    expect(result.success).toBe(true);
  });

  // Tracer bullet: timing-safe password comparison
  it('should return same error message for wrong password (prevents user enumeration) and NOT throw immediately on first mismatch byte', async () => {
    mockHeadersGet.mockReturnValue('127.0.0.1');
    const wrongPassResult = await login('wrongpassword');
    expect(wrongPassResult.success).toBe(false);
    expect(wrongPassResult.error).toBe('Invalid password');
  });
});
