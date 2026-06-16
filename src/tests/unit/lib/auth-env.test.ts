import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const originalEnv = process.env.JWT_SECRET;

beforeAll(() => {
  delete process.env.JWT_SECRET;
});

afterAll(() => {
  if (originalEnv !== undefined) {
    process.env.JWT_SECRET = originalEnv;
  } else {
    delete process.env.JWT_SECRET;
  }
});

describe('auth.ts - JWT_SECRET validation', () => {
  it('should throw at startup if JWT_SECRET is not set', async () => {
    await expect(import('@/lib/auth')).rejects.toThrow('JWT_SECRET');
  });
});
