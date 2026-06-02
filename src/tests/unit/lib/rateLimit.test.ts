import { describe, it, expect, vi, beforeEach } from 'vitest';

// Dynamic import so we get a fresh Map store each time
async function importFresh() {
  return import('@/lib/rateLimit');
}

describe('rateLimit', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should allow first request', async () => {
    const { rateLimit } = await importFresh();
    const result = rateLimit('user:test1', 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should count down remaining for same key', async () => {
    const { rateLimit } = await importFresh();
    for (let i = 0; i < 3; i++) {
      const result = rateLimit('user:test2', 5);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - i - 1);
    }
  });

  it('should block request after max is exceeded', async () => {
    const { rateLimit } = await importFresh();
    const key = 'user:test3';
    const max = 3;
    for (let i = 0; i < max; i++) {
      expect(rateLimit(key, max).allowed).toBe(true);
    }
    const blocked = rateLimit(key, max);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('should keep blocking after threshold is crossed', async () => {
    const { rateLimit } = await importFresh();
    const key = 'user:test4';
    const max = 2;
    rateLimit(key, max);
    rateLimit(key, max);
    expect(rateLimit(key, max).allowed).toBe(false);
    expect(rateLimit(key, max).allowed).toBe(false);
  });

  it('should use separate counters for different keys', async () => {
    const { rateLimit } = await importFresh();
    expect(rateLimit('key:a', 2).allowed).toBe(true);
    expect(rateLimit('key:b', 2).allowed).toBe(true);
    expect(rateLimit('key:a', 2).allowed).toBe(true);
    expect(rateLimit('key:b', 2).allowed).toBe(true);
    expect(rateLimit('key:a', 2).allowed).toBe(false);
    expect(rateLimit('key:b', 2).allowed).toBe(false);
  });

  it('should reset after window expires', async () => {
    const { rateLimit } = await importFresh();
    vi.useFakeTimers();
    const now = new Date('2026-05-28T10:00:00Z');
    vi.setSystemTime(now);

    const key = 'user:test5';
    const max = 2;

    rateLimit(key, max);
    expect(rateLimit(key, max).allowed).toBe(true);
    expect(rateLimit(key, max).allowed).toBe(false);

    vi.advanceTimersByTime(61_000);

    const afterReset = rateLimit(key, max);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(max - 1);

    vi.useRealTimers();
  });

  it('should handle maxRequest of 1', async () => {
    const { rateLimit } = await importFresh();
    const key = 'user:test6';
    const result = rateLimit(key, 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
    expect(rateLimit(key, 1).allowed).toBe(false);
  });

  it('should handle maxRequest of 0', async () => {
    const { rateLimit } = await importFresh();
    const result = rateLimit('user:test7', 0);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(-1);
    expect(rateLimit('user:test7', 0).allowed).toBe(false);
  });
});
