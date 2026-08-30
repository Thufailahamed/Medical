import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, PaymentErrorCode } from './errors';
import type { CheckoutInput, CheckoutResult, RefundInput, RefundResult, WebhookEvent } from './types';

type StripeEnv = { STRIPE_SECRET_KEY: string; STRIPE_WEBHOOK_SECRET: string };
type Fetch = typeof fetch;

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeFetch(env: StripeEnv, path: string, init: RequestInit, fetchImpl: Fetch): Promise<any> {
  const res = await fetchImpl(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new PaymentError(PaymentErrorCode.ProviderError, 'stripe', path, `stripe ${res.status}`);
  return res.json();
}

export class StripeAdapter {
  constructor(private opts: { fetchImpl?: Fetch } = {}) {}

  async createCheckout(input: CheckoutInput, env: StripeEnv): Promise<CheckoutResult> {
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', input.returnUrl);
    if (input.cancelUrl) params.set('cancel_url', input.cancelUrl);
    params.set('client_reference_id', input.invoiceId);
    const session = await stripeFetch(env, '/checkout/sessions', { method: 'POST', body: params.toString() }, this.opts.fetchImpl ?? fetch);
    return { redirectUrl: session.url, merchantOrderId: session.id, provider: 'stripe' };
  }

  verifyWebhook(rawBody: string, sigHeader: string, env: StripeEnv): WebhookEvent {
    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
    const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${parts.t}.${rawBody}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(parts.v1 ?? '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new PaymentError(PaymentErrorCode.WebhookSignatureInvalid, 'stripe');
    }
    const evt = JSON.parse(rawBody);
    const obj = evt.data?.object ?? {};
    return {
      provider: 'stripe',
      eventId: evt.id,
      merchantOrderId: obj.id,
      statusCode: evt.type === 'checkout.session.completed' ? 2 : -1,
      amountMinor: obj.amount_total ?? 0,
      currency: obj.currency?.toUpperCase() ?? 'USD',
      raw: evt,
    };
  }

  async refund(input: RefundInput, env: StripeEnv): Promise<RefundResult> {
    const body = new URLSearchParams();
    body.set('payment_intent', input.paymentId);
    if (input.amountMinor) body.set('amount', String(input.amountMinor));
    const refund = await stripeFetch(env, '/refunds', { method: 'POST', body: body.toString() }, this.opts.fetchImpl ?? fetch);
    return { refundId: refund.id, status: refund.status, provider: 'stripe' };
  }
}
