import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { PaymentsLkAdapter, mintOrderId, type PaymentsLkEnv } from '../src/lib/payments/paymentslk';

const env: PaymentsLkEnv = { PAYMENTS_LK_SECRET_KEY: 'sk_test_abc', PAYMENTS_LK_WEBHOOK_SECRET: 'whsec_abc' };

function signedHeader(payload: string, secret = env.PAYMENTS_LK_WEBHOOK_SECRET!, ts = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  return { header: `t=${ts},v1=${sig}`, ts };
}

function webhookEvent(overrides: Record<string, any> = {}) {
  return JSON.stringify({
    id: 'evt_1',
    object: 'event',
    type: 'payment.succeeded',
    mode: 'test',
    created: new Date().toISOString(),
    data: {
      object: 'payment',
      id: 'pay_x1n31wnp8nkbjkkhymtqd6zs',
      mode: 'test',
      status: 'succeeded',
      amountCents: 350000,
      currency: 'LKR',
      description: 'Consultation',
      reference: 'HH123',
      succeededAt: new Date().toISOString(),
      ...overrides,
    },
  });
}

describe('mintOrderId', () => {
  it('returns HH-prefixed unique id', () => {
    const a = mintOrderId();
    const b = mintOrderId();
    expect(a).toMatch(/^HH[0-9a-f]{20}$/);
    expect(a).not.toBe(b);
  });
});

describe('PaymentsLkAdapter.createCheckout', () => {
  it('POSTs amountCents + reference with bearer + idempotency headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'chk_1', url: 'https://payments.lk/checkout/chk_1', payment: { id: 'pay_1' } }),
        { status: 201 }
      )
    );
    const adapter = new PaymentsLkAdapter({ fetchImpl: fetchMock as any });
    const result = await adapter.createCheckout(
      { amountCents: 350000, description: 'Consultation', reference: 'HH123', successUrl: 'https://x/return', cancelUrl: 'https://x/cancel' },
      env
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.payments.lk/v1/checkouts');
    expect(init.headers['Authorization']).toBe('Bearer sk_test_abc');
    expect(init.headers['Idempotency-Key']).toBe('HH123');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ amountCents: 350000, description: 'Consultation', reference: 'HH123', successUrl: 'https://x/return', cancelUrl: 'https://x/cancel' });
    expect(result).toEqual({ redirectUrl: 'https://payments.lk/checkout/chk_1', merchantOrderId: 'chk_1', paymentId: 'pay_1', provider: 'paymentslk' });
  });

  it('throws ProviderError on gateway failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"code":"CONFLICT"}', { status: 409 }));
    const adapter = new PaymentsLkAdapter({ fetchImpl: fetchMock as any });
    await expect(
      adapter.createCheckout({ amountCents: 350000, description: 'x', reference: 'HH123', successUrl: 'https://x' }, env)
    ).rejects.toThrow(/paymentslk 409/);
  });
});

describe('PaymentsLkAdapter.verifyWebhook', () => {
  it('accepts valid signature and normalizes payment.succeeded', () => {
    const adapter = new PaymentsLkAdapter();
    const payload = webhookEvent();
    const { header } = signedHeader(payload);
    const event = adapter.verifyWebhook(payload, header, env);
    expect(event.provider).toBe('paymentslk');
    expect(event.eventId).toBe('evt_1');
    expect(event.merchantOrderId).toBe('HH123');
    expect(event.paymentId).toBe('pay_x1n31wnp8nkbjkkhymtqd6zs');
    expect(event.statusCode).toBe(2);
    expect(event.amountMinor).toBe(350000);
  });

  it('maps payment.failed → -1 and checkout.expired → -2', () => {
    const adapter = new PaymentsLkAdapter();
    const failedPayload = JSON.stringify({
      id: 'evt_f1',
      object: 'event',
      type: 'payment.failed',
      mode: 'test',
      created: new Date().toISOString(),
      data: { id: 'pay_f1', status: 'failed', amountCents: 350000, reference: 'HH123', failureMessage: 'card declined' },
    });
    const failed = adapter.verifyWebhook(failedPayload, signedHeader(failedPayload).header, env);
    expect(failed.statusCode).toBe(-1);
    const expired = JSON.stringify({ id: 'evt_2', object: 'event', type: 'checkout.expired', mode: 'test', created: new Date().toISOString(), data: { id: 'chk_2', reference: 'HH9' } });
    expect(adapter.verifyWebhook(expired, signedHeader(expired).header, env).statusCode).toBe(-2);
  });

  it('accepts a rotated second v1', () => {
    const adapter = new PaymentsLkAdapter();
    const payload = webhookEvent();
    const ts = Math.floor(Date.now() / 1000);
    const old = createHmac('sha256', 'whsec_old').update(`${ts}.${payload}`).digest('hex');
    const neu = createHmac('sha256', env.PAYMENTS_LK_WEBHOOK_SECRET!).update(`${ts}.${payload}`).digest('hex');
    const event = adapter.verifyWebhook(payload, `t=${ts},v1=${old},v1=${neu}`, env);
    expect(event.statusCode).toBe(2);
  });

  it('rejects signature older than 300s', () => {
    const adapter = new PaymentsLkAdapter();
    const payload = webhookEvent();
    const { header } = signedHeader(payload, env.PAYMENTS_LK_WEBHOOK_SECRET!, Math.floor(Date.now() / 1000) - 400);
    expect(() => adapter.verifyWebhook(payload, header, env)).toThrow(/webhook_signature_invalid/);
  });

  it('rejects bad signature', () => {
    const adapter = new PaymentsLkAdapter();
    const payload = webhookEvent();
    const { header } = signedHeader(payload);
    expect(() => adapter.verifyWebhook(payload, header.replace(/v1=.*/, 'v1=deadbeef'), env)).toThrow(/webhook_signature_invalid/);
  });
});

describe('PaymentsLkAdapter.refund', () => {
  it('POSTs paymentId + amountCents with idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 're_1', status: 'pending', amountCents: 50000 }), { status: 201 })
    );
    const adapter = new PaymentsLkAdapter({ fetchImpl: fetchMock as any });
    const result = await adapter.refund({ paymentId: 'pay_1', amountCents: 50000, reason: 'duplicate' }, env);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.payments.lk/v1/refunds');
    expect(init.headers['Idempotency-Key']).toBe('refund-pay_1-50000');
    expect(JSON.parse(init.body)).toEqual({ paymentId: 'pay_1', amountCents: 50000, reason: 'duplicate' });
    expect(result).toEqual({ refundId: 're_1', status: 'pending', provider: 'paymentslk' });
  });

  it('refunds in full when amountCents omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 're_2', status: 'succeeded' }), { status: 201 })
    );
    const adapter = new PaymentsLkAdapter({ fetchImpl: fetchMock as any });
    const result = await adapter.refund({ paymentId: 'pay_1' }, env);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ paymentId: 'pay_1' });
    expect(result.status).toBe('succeeded');
  });
});
