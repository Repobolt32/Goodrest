import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';
import { middleware } from '@/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

describe('middleware', () => {
  const createRequest = (pathname: string, cookie?: string) => ({
    nextUrl: { pathname, search: '' },
    cookies: {
      get: () => (cookie ? { value: cookie } : undefined),
    },
    url: `http://localhost:3005${pathname}`,
  }) as unknown as NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.E2E_MODE;
  });

  it('should allow non-admin routes through', async () => {
    const req = createRequest('/');
    const result = await middleware(req);
    expect(result).toBeDefined();
  });

  it('should allow /admin/login without auth', async () => {
    const req = createRequest('/admin/login');
    const result = await middleware(req);
    expect(result).toBeDefined();
  });

  it('should redirect /admin/* to login without session cookie', async () => {
    const req = createRequest('/admin/orders');
    const redirectSpy = vi.spyOn(NextResponse, 'redirect');

    await middleware(req);
    expect(redirectSpy).toHaveBeenCalled();
  });

  it('should allow /admin/* with valid JWT', async () => {
    (jwtVerify as ReturnType<typeof vi.fn>).mockResolvedValue({
      payload: { role: 'admin' },
    });

    const req = createRequest('/admin/orders', 'valid-jwt-token');
    const nextSpy = vi.spyOn(NextResponse, 'next');

    await middleware(req);
    expect(nextSpy).toHaveBeenCalled();
  });

  it('should redirect /admin/* with expired/invalid JWT', async () => {
    (jwtVerify as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Invalid token')
    );

    const req = createRequest('/admin/orders', 'expired-jwt-token');
    const redirectSpy = vi.spyOn(NextResponse, 'redirect');

    await middleware(req);
    expect(redirectSpy).toHaveBeenCalled();
  });

  it('should bypass auth when E2E_MODE=true', async () => {
    process.env.E2E_MODE = 'true';

    const req = createRequest('/admin/orders');
    const nextSpy = vi.spyOn(NextResponse, 'next');

    await middleware(req);
    expect(nextSpy).toHaveBeenCalled();
  });

  it('should throw at module load if JWT_SECRET is missing', async () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    vi.resetModules();

    await expect(import('@/middleware')).rejects.toThrow('JWT_SECRET is not configured');

    if (originalSecret) process.env.JWT_SECRET = originalSecret;
  });
});
