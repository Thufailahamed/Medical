import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { StripeAdapter } from '../src/lib/payments/stripe';

const env = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' };

describe('StripeAdapter', () => {
  it('createCheckout returns Stripe URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' }), { status: 200 })
    );
    const adapter = new StripeAdapter({ fetchImpl: fetchMock as any });
    const result = await adapter.createCheckout(
      { invoiceId: 'inv_1', method: 'stripe', returnUrl: 'https://x' },
      env as any
    );
    expect(result.redirectUrl).toContain('checkout.stripe.com');
    expect(result.merchantOrderId).toBe('cs_1');
    expect(result.provider).toBe('stripe');
  });

  it('verifyWebhook accepts valid signature', () => {
    const adapter = new StripeAdapter();
    const ts = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', amount_total: 5000, currency: 'usd' } },
    });
    const sig = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${ts}.${payload}`).digest('hex');
    const event = adapter.verifyWebhook(payload, `t=${ts},v1=${sig}`, env as any);
    expect(event.provider).toBe('stripe');
    expect(event.amountMinor).toBe(5000);
    expect(event.statusCode).toBe(2);
  });

  it('verifyWebhook rejects bad signature', () => {
    const adapter = new StripeAdapter();
    expect(() => adapter.verifyWebhook('{}', 't=1,v1=bad', env as any)).toThrow(/webhook_signature_invalid/);
  });
});
