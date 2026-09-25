/**
 * payments.lk (Payable) gateway adapter.
 *
 * API facts (payments.lk/developers/api):
 *   - POST /v1/checkouts  → { id: chk_..., url, payment: { id: pay_... } }
 *   - POST /v1/refunds    → { id: re_..., status: pending|succeeded|failed }
 *   - Amounts are integer LKR cents (Rs. 1,450.00 = 145000).
 *   - Bearer secret key (sk_test_ / sk_live_ — the key picks the mode).
 *   - Idempotency-Key required on every write.
 *   - Webhooks: Payments-Signature header `t=<unix>,v1=<hex>`; HMAC-SHA256
 *     over `${t}.${rawBody}` under the whsec_ secret; reject |clock - t|
 *     > 300s; accept any v1 while a rotated secret is still valid.
 *   - Events: { id, type, data: payment } — data.reference is our order id.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, PaymentErrorCode } from './errors';
import type { CheckoutInput, CheckoutResult, RefundInput, RefundResult, WebhookEvent } from './types';

export type PaymentsLkEnv = {
  PAYMENTS_LK_SECRET_KEY?: string;
  PAYMENTS_LK_WEBHOOK_SECRET?: string;
};

type Fetch = typeof fetch;

const API_BASE = 'https://api.payments.lk/v1';
const MAX_CLOCK_SKEW_SECONDS = 300;

/** Mint a unique order id. Format: HH<20hex> — collision-resistant. */
export function mintOrderId(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `HH${uuid.slice(0, 20)}`;
}

function parseSignatureHeader(header: string): { t: number; v1s: string[] } {
  let t = NaN;
  const v1s: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 't') t = parseInt(v, 10);
    if (k === 'v1' && v) v1s.push(v);
  }
  return { t, v1s };
}

export class PaymentsLkAdapter {
  constructor(private opts: { fetchImpl?: Fetch } = {}) {}

  private async request(
    env: PaymentsLkEnv,
    path: string,
    init: { method: string; body?: string; idempotencyKey?: string }
  ): Promise<any> {
    if (!env.PAYMENTS_LK_SECRET_KEY) {
      throw new PaymentError(PaymentErrorCode.ProviderError, 'paymentslk', path, 'paymentslk not configured');
    }
    const res = await (this.opts.fetchImpl ?? fetch)(`${API_BASE}${path}`, {
      method: init.method,
      body: init.body,
      headers: {
        Authorization: `Bearer ${env.PAYMENTS_LK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new PaymentError(
        PaymentErrorCode.ProviderError,
        'paymentslk',
        path,
        `paymentslk ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`
      );
    }
    return res.json();
  }

  async createCheckout(input: CheckoutInput, env: PaymentsLkEnv): Promise<CheckoutResult> {
    const body: Record<string, unknown> = {
      amountCents: input.amountCents,
      description: input.description,
      reference: input.reference,
      successUrl: input.successUrl,
    };
    if (input.cancelUrl) body.cancelUrl = input.cancelUrl;
    if (input.customer) body.customer = input.customer;
    const checkout = await this.request(env, '/checkouts', {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey: input.reference,
    });
    return {
      redirectUrl: checkout.url,
      merchantOrderId: checkout.id,
      paymentId: checkout.payment?.id ?? null,
      provider: 'paymentslk',
    };
  }

  verifyWebhook(rawBody: string, sigHeader: string, env: PaymentsLkEnv): WebhookEvent {
    const secret = env.PAYMENTS_LK_WEBHOOK_SECRET;
    if (!secret) throw new PaymentError(PaymentErrorCode.WebhookSignatureInvalid, 'paymentslk');
    const { t, v1s } = parseSignatureHeader(sigHeader);
    const skew = Math.abs(Math.floor(Date.now() / 1000) - t);
    if (!Number.isFinite(t) || skew > MAX_CLOCK_SKEW_SECONDS || v1s.length === 0) {
      throw new PaymentError(PaymentErrorCode.WebhookSignatureInvalid, 'paymentslk');
    }
    const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    const matched = v1s.some((v1) => {
      const a = Buffer.from(expected);
      const b = Buffer.from(v1);
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (!matched) throw new PaymentError(PaymentErrorCode.WebhookSignatureInvalid, 'paymentslk');
    const evt = JSON.parse(rawBody);
    const data = evt.data ?? {};
    const statusCode = evt.type === 'payment.succeeded' ? 2 : evt.type === 'checkout.expired' ? -2 : -1;
    return {
      provider: 'paymentslk',
      eventId: String(evt.id ?? ''),
      merchantOrderId: String(data.reference ?? ''),
      paymentId: data.id ? String(data.id) : null,
      statusCode,
      amountMinor: Number(data.amountCents ?? 0),
      raw: evt,
    };
  }

  async refund(input: RefundInput, env: PaymentsLkEnv): Promise<RefundResult> {
    const body: Record<string, unknown> = { paymentId: input.paymentId };
    if (input.amountCents) body.amountCents = input.amountCents;
    if (input.reason) body.reason = input.reason;
    const refund = await this.request(env, '/refunds', {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey: `refund-${input.paymentId}-${input.amountCents ?? 'full'}`,
    });
    const status =
      refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : 'pending';
    return { refundId: refund.id, status, provider: 'paymentslk' };
  }
}
