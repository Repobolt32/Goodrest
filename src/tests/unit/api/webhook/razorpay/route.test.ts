import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockValidateWebhookSignature: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('razorpay', () => ({
  default: {
    validateWebhookSignature: mocks.mockValidateWebhookSignature,
  },
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
  },
}));

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 29 })),
}));

import { POST } from '@/app/api/webhook/razorpay/route';
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

describe('razorpay webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  });

  const createRequest = (body: object, signature?: string) => {
    const headers = new Map<string, string>();
    if (signature) headers.set('x-razorpay-signature', signature);
    return {
      text: () => Promise.resolve(JSON.stringify(body)),
      headers,
    } as unknown as NextRequest;
  };

  /** Set up from() to return select chain then update chain */
  const setupSelectAndUpdateMocks = (
    orderData: { id: string; payment_status: string } | null,
    updateResult: { error: { message: string } | null } = { error: null }
  ) => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: orderData,
      error: orderData ? null : { message: 'Not found' },
    });
    const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });

    const mockNeq = vi.fn().mockResolvedValue(updateResult);
    const mockIn = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    mocks.mockFrom
      .mockReturnValueOnce({ select: mockSelect })  // first call: select
      .mockReturnValueOnce({ update: mockUpdate });  // second call: update

    return { mockSingle, mockSelect, mockEqSelect, mockUpdate, mockEq, mockIn, mockNeq };
  };

  it('should return 500 if webhook secret not configured', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const res = await POST(createRequest({}));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Webhook secret not configured');
  });

  it('should return 400 if signature header missing', async () => {
    const res = await POST(createRequest({}, undefined));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Missing x-razorpay-signature header');
  });

  it('should return 400 on invalid signature', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(false);

    const res = await POST(createRequest({ event: 'payment.captured' }, 'bad-sig'));
    expect(res.status).toBe(400);
  });

  it('should return 429 when rate limit exceeded', async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce({ allowed: false, remaining: 0 });

    const res = await POST(createRequest({ event: 'payment.captured' }, 'valid-sig'));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('Too many requests');
  });

  it('should handle payment.captured event', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    setupSelectAndUpdateMocks({ id: 'order-1', payment_status: 'pending' });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_test_123', order_id: 'rzp_order_123' },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
  });

  it('should update payment_status and order_status on capture', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    const { mockUpdate } = setupSelectAndUpdateMocks({ id: 'order-1', payment_status: 'pending' });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_test_123', order_id: 'rzp_order_123' },
        },
      },
    };

    await POST(createRequest(payload, 'valid-sig'));

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.payment_status).toBe('paid');
    expect(updateCall.order_status).toBe('confirmed');
  });

  it('should guard update with payment_status=pending to prevent race conditions', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);

    const mockNeq = vi.fn().mockResolvedValue({ error: null });
    const mockIn = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'order-1', payment_status: 'pending' },
      error: null,
    });
    const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });

    mocks.mockFrom
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ update: mockUpdate });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_test_123', order_id: 'rzp_order_123' },
        },
      },
    };

    await POST(createRequest(payload, 'valid-sig'));

    // Must chain .eq('id', ...).in('payment_status', ['pending', 'failed']).neq('order_status', 'cancelled')
    expect(mockEq).toHaveBeenCalledWith('id', 'order-1');
    expect(mockIn).toHaveBeenCalledWith('payment_status', ['pending', 'failed']);
    expect(mockNeq).toHaveBeenCalledWith('order_status', 'cancelled');
  });

  it('should handle payment.failed event', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    setupSelectAndUpdateMocks({ id: 'order-1', payment_status: 'pending' });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_123',
            order_id: 'rzp_order_123',
            error_description: 'Insufficient funds',
          },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
  });

  it('should set payment_status=failed on payment.failed', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    const { mockUpdate } = setupSelectAndUpdateMocks({ id: 'order-1', payment_status: 'pending' });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_123',
            order_id: 'rzp_order_123',
          },
        },
      },
    };

    await POST(createRequest(payload, 'valid-sig'));

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.payment_status).toBe('failed');
    expect(updateCall.order_status).toBe('created');
  });

  it('should ack unhandled event types', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);

    const res = await POST(createRequest({ event: 'order.paid', payload: {} }, 'valid-sig'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
  });

  it('should be idempotent for already paid orders on capture', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    // Only set up select chain (no update expected)
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'order-1', payment_status: 'paid' },
      error: null,
    });
    const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });
    mocks.mockFrom.mockReturnValue({ select: mockSelect });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_test_123', order_id: 'rzp_order_123' },
        },
      },
    };

    await POST(createRequest(payload, 'valid-sig'));
    // Should NOT call update since order is already paid
    expect(mocks.mockFrom).toHaveBeenCalledTimes(1); // only select, no update
  });

  it('should not overwrite paid status with failed event', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    // Only set up select chain (no update expected)
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'order-1', payment_status: 'paid' },
      error: null,
    });
    const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });
    mocks.mockFrom.mockReturnValue({ select: mockSelect });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_test_123', order_id: 'rzp_order_123' },
        },
      },
    };

    await POST(createRequest(payload, 'valid-sig'));
    // Should NOT update since already paid
    expect(mocks.mockFrom).toHaveBeenCalledTimes(1);
  });

  it('should return 400 on missing order_id in payment.captured', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_test_123', order_id: undefined },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    expect(res.status).toBe(400);
  });

  it('should handle malformed JSON body gracefully', async () => {
    const badReq = {
      text: () => Promise.resolve('{invalid json'),
      headers: new Map([['x-razorpay-signature', 'some-sig']]),
    } as unknown as NextRequest;

    const res = await POST(badReq);
    expect(res.status).toBe(500);
  });

  it('should be idempotent on replayed webhook (same payload + signature)', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    // First call: order is pending → should update
    const mockSingle = vi.fn()
      .mockResolvedValueOnce({ data: { id: 'order-1', payment_status: 'pending' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'order-1', payment_status: 'paid' }, error: null });
    const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });
    
    const mockNeq = vi.fn().mockResolvedValue({ error: null });
    const mockIn = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    mocks.mockFrom
      .mockReturnValueOnce({ select: mockSelect })  // first call: select
      .mockReturnValueOnce({ update: mockUpdate })  // first call: update
      .mockReturnValueOnce({ select: mockSelect }); // second call: select only

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_replay_123', order_id: 'rzp_replay_123' },
        },
      },
    };

    // First webhook
    const res1 = await POST(createRequest(payload, 'valid-sig'));
    expect(res1.status).toBe(200);

    // Second webhook (replay) — should be idempotent, no double-update
    const res2 = await POST(createRequest(payload, 'valid-sig'));
    expect(res2.status).toBe(200);
    // Only 1 update call total (from first webhook)
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('should return 400 on missing order_id in payment.failed', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_test_123', order_id: undefined },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    expect(res.status).toBe(400);
  });

  it('should handle payment.captured for non-existent order gracefully', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    // Select returns null (order not found)
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });
    mocks.mockFrom.mockReturnValue({ select: mockSelect });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_orphan', order_id: 'rzp_orphan' },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    expect(res.status).toBe(200); // Acknowledges but doesn't crash
  });

  it('should handle payment.failed for non-existent order gracefully', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });
    mocks.mockFrom.mockReturnValue({ select: mockSelect });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_orphan', order_id: 'rzp_orphan', error_description: 'Timeout' },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    expect(res.status).toBe(200);
  });

  it('should handle payment.captured with DB update failure', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    setupSelectAndUpdateMocks({ id: 'order-1', payment_status: 'pending' }, { error: { message: 'DB connection lost' } });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_dbfail', order_id: 'rzp_dbfail' },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    expect(res.status).toBe(200); // Still acknowledges to avoid Razorpay retry loop
  });

  it('should handle payment.failed with DB update failure', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    setupSelectAndUpdateMocks({ id: 'order-1', payment_status: 'pending' }, { error: { message: 'DB connection lost' } });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_dbfail', order_id: 'rzp_dbfail', error_description: 'Timeout' },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    expect(res.status).toBe(200);
  });

  it('should handle payment.captured with missing payment entity', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);

    const payload = {
      event: 'payment.captured',
      payload: {
        // payment entity is undefined
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    expect(res.status).toBe(400);
  });

  it('should handle payment.failed with missing payment_id gracefully', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    setupSelectAndUpdateMocks({ id: 'order-1', payment_status: 'pending' });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: undefined, order_id: 'rzp_order_123', error_description: 'Bank error' },
        },
      },
    };

    const res = await POST(createRequest(payload, 'valid-sig'));
    expect(res.status).toBe(200);
  });

  it('should set razorpay_payment_id on payment.failed when provided', async () => {
    mocks.mockValidateWebhookSignature.mockReturnValue(true);
    const { mockUpdate } = setupSelectAndUpdateMocks({ id: 'order-1', payment_status: 'pending' });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_with_id', order_id: 'rzp_order_123', error_description: 'Card declined' },
        },
      },
    };

    await POST(createRequest(payload, 'valid-sig'));
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.razorpay_payment_id).toBe('pay_with_id');
  });
});
