import { describe, it, expect, vi } from 'vitest';

describe('razorpay', () => {
  const ORIGINAL_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const ORIGINAL_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  afterEach(() => {
    process.env.RAZORPAY_KEY_ID = ORIGINAL_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = ORIGINAL_KEY_SECRET;
    vi.resetModules();
  });

  it('should export razorpay instance when env vars are set', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_xxx';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';

    const { razorpay } = await import('@/lib/razorpay');
    expect(razorpay).toBeDefined();
    expect(razorpay.orders).toBeDefined();
  });

  it('should throw if RAZORPAY_KEY_ID is missing', async () => {
    delete process.env.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';

    await expect(import('@/lib/razorpay')).rejects.toThrow(
      'RAZORPAY_KEY_ID is not defined'
    );
  });

  it('should throw if RAZORPAY_KEY_SECRET is missing', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_xxx';
    delete process.env.RAZORPAY_KEY_SECRET;

    await expect(import('@/lib/razorpay')).rejects.toThrow(
      'RAZORPAY_KEY_SECRET is not defined'
    );
  });
});
