# Payments.lk Gateway Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PayHere + Stripe gateway integrations with payments.lk (Payable) across every payment surface: appointments (HH-), lab test bookings (TB-), insurance premiums (INS-), and hospital-billing invoices.

**Architecture:** Single gateway adapter (`PaymentsLkAdapter`) implementing the existing `lib/payments/` seam. Server creates hosted checkouts (`POST https://api.payments.lk/v1/checkouts`); payment confirmation arrives via signed webhooks at `POST /payments/webhook/paymentslk` with the existing `payment_webhook_events` idempotency table. Mobile keeps open-browser-and-poll.

**Tech Stack:** Hono on Cloudflare Workers, Drizzle/D1, Vitest (mock fetch + MockD1), Expo (react-native), Next.js 16.

**Spec:** `docs/superpowers/specs/2026-09-25-payments-lk-design.md`

## Global Constraints

- Amounts to payments.lk are integer LKR **cents** (`amountCents`); min Rs. 10 (1000), max Rs. 1,000,000 (100000000). No currency field is sent.
- `Idempotency-Key` header (8–255 chars of `[A-Za-z0-9-_.:]`) on every write (checkout create, refund). Use the existing order id.
- Webhook signature: `Payments-Signature: t=<unix seconds>,v1=<hex>` — HMAC-SHA256 of `${t}.${rawBody}` under the `whsec_` endpoint secret; accept any listed `v1` (secret rotation); reject if `t` is more than 300 s from local clock. Verify over raw bytes before parsing.
- Webhook events: `{ id: "evt_...", object: "event", type, mode, created, data: <payment object> }`. `data.reference` = our order id, `data.id` = `pay_...`, `data.amountCents`. Ack 200 always after recording; duplicates via `tryRecordWebhook`.
- Order-id prefixes stay: `HH` (appointments), `TB-` (lab bookings), `INS-` (insurance). `mintOrderId()` = `HH` + 20 hex chars (moved out of `lib/payhere.ts`).
- No new runtime dependencies (API or mobile). Node crypto (`node:crypto`) is used by the existing Stripe adapter and works on Workers.
- `reference` ≤ 64 chars — all our order ids are ≤ 26 chars. `description` ≤ 120 chars — slice descriptions.
- Customer fields: `name` (2–80, required), `email` (3–254, required), `phone` (optional).
- Env vars: `PAYMENTS_LK_SECRET_KEY`, `PAYMENTS_LK_WEBHOOK_SECRET` (optional strings; routes 503 when missing).
- Endpoints and response shapes for clients keep their paths: `POST /payments/initiate`, `GET /payments/:id`, `POST /payments/checkout`, `POST /payments/refund`, `GET /payments/me`; `POST /payments/notify` is **removed**; `POST /webhook/paymentslk` replaces `/webhook/stripe`.
- DB migration is plain SQL in `apps/api/migrations/0083_rename_payhere_columns.sql` (applied via `wrangler d1 execute`; no drizzle journal edit needed — journal stops at 0032).
- Verify with `bun run test` and `bun run typecheck` from repo root (mobile has pre-existing LucideIcon type errors — ignore those).

## File Map

**Create:**
- `apps/api/src/lib/payments/paymentslk.ts` — adapter
- `apps/api/migrations/0083_rename_payhere_columns.sql`
- `apps/api/tests/payments-paymentslk.test.ts`
- `apps/api/tests/payments-generic-routes.test.ts`
- `apps/mobile/src/lib/payments.ts`

**Modify:**
- `apps/api/src/lib/payments/types.ts`
- `apps/api/src/routes/payments.ts`
- `apps/api/src/routes/insurance-marketplace.ts`
- `apps/api/src/types/index.ts`
- `apps/api/tests/_testApp.ts` (adds `makeMockRawDb()`)
- `packages/db/src/schema.ts`
- `apps/api/tests/lab-payments.test.ts`, `payments-types.test.ts`, `payments-webhook-idempotency.test.ts`, `insurance-payout.test.ts`
- `apps/api/wrangler.toml`, `apps/api/src/index.ts`, `.env.example`, `apps/api/docs/CURL.md`, `README.md`
- Mobile: `apps/mobile/src/app/(app)/book-appointment.tsx`, `book-test.tsx`, `test-booking-detail/[id].tsx`, `insurance/policy/[id].tsx`, `insurance/payment/[enrollmentId].tsx`
- Web: `apps/marketing/src/patient/hooks/diagnostic.ts`, `apps/marketing/src/app/patient/(app)/diagnostic-tests/page.tsx`, `apps/marketing/src/app/hospital/(hospital)/billing/[id]/page.tsx`

**Delete:**
- `apps/api/src/lib/payments/stripe.ts`, `apps/api/src/lib/payhere.ts`, `apps/api/tests/payments-stripe.test.ts`, `apps/mobile/src/lib/payhere.ts`

---

### Task 1: Gateway types + PaymentsLkAdapter (TDD)

**Files:**
- Modify: `apps/api/src/lib/payments/types.ts`
- Modify: `apps/api/src/lib/payments/errors.ts` (no code change — verify untouched)
- Create: `apps/api/src/lib/payments/paymentslk.ts`
- Create: `apps/api/tests/payments-paymentslk.test.ts`

**Interfaces (produced — later tasks consume):**

```ts
// types.ts
export type PaymentProvider = 'paymentslk';
export type CheckoutCustomer = { name: string; email: string; phone?: string };
export type CheckoutInput = {
  amountCents: number;      // integer LKR cents
  description: string;      // ≤120 chars
  reference: string;        // our order id, ≤64 chars
  successUrl: string;
  cancelUrl?: string;
  customer?: CheckoutCustomer;
};
export type CheckoutResult = {
  redirectUrl: string;      // hosted checkout url
  merchantOrderId: string;  // chk_...
  paymentId: string | null; // pay_...
  provider: PaymentProvider;
};
export type WebhookEvent = {
  provider: PaymentProvider;
  eventId: string;
  merchantOrderId: string;  // event.data.reference
  paymentId: string | null; // event.data.id (pay_...)
  statusCode: number;       // 2 = succeeded, -1 = failed, -2 = expired
  amountMinor: number;      // event.data.amountCents
  raw: unknown;
};
export type RefundInput = { paymentId: string; amountCents?: number; reason?: string };
export type RefundResult = { refundId: string; status: 'pending' | 'succeeded' | 'failed'; provider: PaymentProvider };

// paymentslk.ts
export type PaymentsLkEnv = { PAYMENTS_LK_SECRET_KEY?: string; PAYMENTS_LK_WEBHOOK_SECRET?: string };
export function mintOrderId(): string; // HH + 20 hex chars
export class PaymentsLkAdapter {
  constructor(opts: { fetchImpl?: typeof fetch } = {});
  async createCheckout(input: CheckoutInput, env: PaymentsLkEnv): Promise<CheckoutResult>;
  verifyWebhook(rawBody: string, sigHeader: string, env: PaymentsLkEnv): WebhookEvent;
  async refund(input: RefundInput, env: PaymentsLkEnv): Promise<RefundResult>;
}
```

- [ ] **Step 1: Rewrite `apps/api/src/lib/payments/types.ts`**

Replace the entire file with:

```ts
export type PaymentProvider = 'paymentslk';

export type CheckoutCustomer = { name: string; email: string; phone?: string };

export type CheckoutInput = {
  amountCents: number;
  description: string;
  reference: string;
  successUrl: string;
  cancelUrl?: string;
  customer?: CheckoutCustomer;
};

export type CheckoutResult = {
  redirectUrl: string;
  merchantOrderId: string;
  paymentId: string | null;
  provider: PaymentProvider;
};

export type WebhookEvent = {
  provider: PaymentProvider;
  eventId: string;
  merchantOrderId: string;
  paymentId: string | null;
  statusCode: number;
  amountMinor: number;
  raw: unknown;
};

export type RefundInput = {
  paymentId: string;
  amountCents?: number;
  reason?: string;
};

export type RefundResult = {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  provider: PaymentProvider;
};
```

- [ ] **Step 2: Write the failing test `apps/api/tests/payments-paymentslk.test.ts`**

```ts
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
    const failed = adapter.verifyWebhook(webhookEvent({ status: 'failed' }), signedHeader(webhookEvent({ status: 'failed' })).header, env);
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
    const { header } = signedHeader(webhookEvent());
    expect(() => adapter.verifyWebhook(webhookEvent(), header.replace(/v1=.*/, 'v1=deadbeef'), env)).toThrow(/webhook_signature_invalid/);
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && bun run test tests/payments-paymentslk.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/payments/paymentslk'`

- [ ] **Step 4: Write `apps/api/src/lib/payments/paymentslk.ts`**

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && bun run test tests/payments-paymentslk.test.ts`
Expected: PASS (all)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/payments/types.ts apps/api/src/lib/payments/paymentslk.ts apps/api/tests/payments-paymentslk.test.ts
git commit -m "feat: payments.lk adapter + gateway-neutral payment types"
```

---

### Task 2: DB migration 0083 + schema rename + field renames

**Files:**
- Create: `apps/api/migrations/0083_rename_payhere_columns.sql`
- Modify: `packages/db/src/schema.ts:3496-3500` (appointmentPayments fields)
- Modify: `apps/api/src/routes/payments.ts` (field references — mechanical)
- Modify: `apps/api/src/routes/insurance-marketplace.ts:1493` (param rename)
- Modify: `apps/api/tests/lab-payments.test.ts:362`

**Interfaces (produced):** `appointmentPayments.gatewayOrderId` (col `gateway_order_id`, unique), `.gatewayPaymentId`, `.gatewayStatusCode`, `.gatewayMethod`; `.rawNotify` unchanged.

- [ ] **Step 1: Create `apps/api/migrations/0083_rename_payhere_columns.sql`**

```sql
-- 0083: gateway-neutral payment columns — payments.lk replaces PayHere.
-- SQLite RENAME COLUMN carries the unique index on payhere_order_id along.

ALTER TABLE `appointment_payments` RENAME COLUMN `payhere_order_id` TO `gateway_order_id`;
ALTER TABLE `appointment_payments` RENAME COLUMN `payhere_payment_id` TO `gateway_payment_id`;
ALTER TABLE `appointment_payments` RENAME COLUMN `payhere_status_code` TO `gateway_status_code`;
ALTER TABLE `appointment_payments` RENAME COLUMN `payhere_method` TO `gateway_method`;
```

- [ ] **Step 2: Rename fields in `packages/db/src/schema.ts`**

In the `appointmentPayments` table definition, replace lines 3496–3500 with:

```ts
    gatewayOrderId: text("gateway_order_id").notNull().unique(),
    gatewayPaymentId: text("gateway_payment_id"),
    gatewayStatusCode: text("gateway_status_code"),
    gatewayMethod: text("gateway_method"),
    rawNotify: text("raw_notify"),
```

Also update the section comment `// ─── Phase 5: PayHere online payments for appointments ──────` to `// ─── Online payments for appointments (payments.lk) ──────`, and the `payments` table comment mentioning "payhere / stripe" (line ~3464) to mention `paymentslk`.

- [ ] **Step 3: Update `apps/api/src/routes/payments.ts` field references**

Mechanical renames inside the PayHere-era code (the `/notify` handler and `GET /payments/:id`; these blocks are deleted/rewritten in Tasks 3–4, but rename now so nothing is missed):
- Insert at line ~283: `payhereOrderId: orderId` → `gatewayOrderId: orderId`
- Notify update at ~530–540: `payherePaymentId: payhere_payment_id` → `gatewayPaymentId`, `payhereStatusCode: status_code` → `gatewayStatusCode`, `payhereMethod: method` → `gatewayMethod`
- Notify audit at ~459 + ~570: `payhereOrderId` → `gatewayOrderId`, `payherePaymentId` → `gatewayPaymentId`
- `GET /payments/:id` at ~671–673: `payment.payhereMethod` → `payment.gatewayMethod`, `payhereOrderId: payment.payhereOrderId` → `gatewayOrderId: payment.gatewayOrderId`, `payherePaymentId: payment.payherePaymentId` → `gatewayPaymentId: payment.gatewayPaymentId`

- [ ] **Step 4: Rename param in `apps/api/src/routes/insurance-marketplace.ts`**

At line ~1493: `handleInsurancePremiumPaid(env, orderId, payherePaymentId, method)` → rename param `payherePaymentId` → `gatewayPaymentId`; update its audit usage at ~1614 (`payherePaymentId,` → `gatewayPaymentId,`).

- [ ] **Step 5: Update `apps/api/tests/lab-payments.test.ts:362`**

`byBookingBody.payhereOrderId ?? byBookingBody.orderId` → `byBookingBody.gatewayOrderId ?? byBookingBody.orderId`

- [ ] **Step 6: Run full API suite**

Run: `cd apps/api && bun run test`
Expected: PASS (existing tests still pass — no behavior change yet)

- [ ] **Step 7: Commit**

```bash
git add apps/api/migrations/0083_rename_payhere_columns.sql packages/db/src/schema.ts apps/api/src/routes/payments.ts apps/api/src/routes/insurance-marketplace.ts apps/api/tests/lab-payments.test.ts
git commit -m "feat: gateway-neutral payment columns (migration 0083)"
```

---

### Task 3: Generic routes — payments.lk only (TDD)

**Files:**
- Modify: `apps/api/src/routes/payments.ts` (imports + `/checkout`, `/webhook/paymentslk`, `/refund`, `/me`)
- Modify: `apps/api/src/types/index.ts:87-90` (env vars)
- Modify: `apps/api/tests/_testApp.ts` (adds `makeMockRawDb()`)
- Create: `apps/api/tests/payments-generic-routes.test.ts`

**Interfaces (consumes):** `PaymentsLkAdapter`, `PaymentsLkEnv`, `mintOrderId` (Task 1). **Produces:** module exports `paymentsLk: PaymentsLkAdapter`, `setPaymentsLkFetch(fetchImpl?)` (gateway fetch mock) and `setWebhookRawDb(rawDb?)` (raw D1 handle for webhook idempotency + `payments` row update; tests inject a fake, prod uses `env.DB`).

**Why a raw-DB hook:** `tryRecordWebhook` (`lib/payments/webhook-idempotency.ts`) and the `UPDATE payments SET paid_at` write operate on the **raw D1 handle** (same as the Stripe route did), not the Drizzle db. The fake raw handle for tests lives in `tests/_testApp.ts`.

- [ ] **Step 1: Add the fake raw-DB factory to `apps/api/tests/_testApp.ts`**

```ts
// Fake raw D1 handle for webhook idempotency tests (tryRecordWebhook +
// "UPDATE payments SET paid_at"). Tracks calls so tests can assert.
export function makeMockRawDb() {
  const state = {
    inserts: [] as Array<{ provider: string; eventId: string }>,
    updates: [] as Array<{ sql: string; binds: any[] }>,
    existing: new Set<string>(), // "provider|eventId" already recorded
  };
  const handle = {
    prepare(sql: string) {
      return {
        bind: (...binds: any[]) => ({
          async run() {
            if (sql.includes("INSERT INTO payment_webhook_events")) {
              const [id, provider, eventId] = binds;
              const key = `${provider}|${eventId}`;
              if (state.existing.has(key)) {
                throw new Error(
                  "UNIQUE constraint failed: payment_webhook_events.provider, payment_webhook_events.event_id"
                );
              }
              state.existing.add(key);
              state.inserts.push({ provider, eventId });
              return { success: true };
            }
            state.updates.push({ sql, binds });
            return { success: true };
          },
          async first() {
            return null;
          },
        }),
      };
    },
  };
  return { handle, state };
}
```

(If `paymentWebhookEvents` rows need asserting, read them from `state.inserts`.)

- [ ] **Step 2: Update env types in `apps/api/src/types/index.ts`**

Replace the PayHere block (lines ~87–90) with:

```ts
    // Payments.lk (Payable) gateway credentials. Secret key created in the
    // dashboard (sk_test_ / sk_live_); webhook secret from the endpoint
    // settings (whsec_). /payments routes return 503 when the key is
    // missing; the webhook returns 503 when the secret is missing.
    PAYMENTS_LK_SECRET_KEY?: string;
    PAYMENTS_LK_WEBHOOK_SECRET?: string;
```

- [ ] **Step 3: Write the failing test `apps/api/tests/payments-generic-routes.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { buildTestApp, postJson, makeMockRawDb } from "./_testApp";
import { MockD1 } from "./_mockDb";
import paymentsRouter, { setPaymentsLkFetch, setWebhookRawDb } from "../src/routes/payments";

const PATIENT_USER = { id: "patient-001", role: "patient" };
const PLK_ENV = {
  PAYMENTS_LK_SECRET_KEY: "sk_test_abc",
  PAYMENTS_LK_WEBHOOK_SECRET: "whsec_abc",
  PUBLIC_URL: "https://test.local",
};

function seedInvoice(db: MockD1) {
  db.seed("users", [
    { id: "patient-001", role: "patient", email: "p@test.local", name: "P" },
    { id: "staff-001", role: "hospital_admin", email: "s@test.local", name: "S" },
  ]);
  db.seed("patients", [{ id: "pat-001", userId: "patient-001" }]);
  db.seed("invoices", [
    {
      id: "inv-001",
      patientId: "patient-001",
      hospitalId: "hosp-001",
      status: "open",
      totalLkr: 3500,
      createdAt: new Date().toISOString(),
    },
  ]);
}

async function buildApp(db: MockD1, user = PATIENT_USER) {
  const app = await buildTestApp(db, user);
  app.use("*", async (c, next) => {
    for (const [k, v] of Object.entries(PLK_ENV)) (c.env as any)[k] = v;
    await next();
  });
  app.route("/payments", paymentsRouter);
  return app;
}

function checkoutResponse(id = "chk_1", paymentId = "pay_1") {
  return new Response(
    JSON.stringify({ id, url: `https://payments.lk/checkout/${id}`, payment: { id: paymentId } }),
    { status: 201 }
  );
}

function webhookBody(orderId = "HH123") {
  return JSON.stringify({
    id: "evt_w1",
    object: "event",
    type: "payment.succeeded",
    mode: "test",
    created: new Date().toISOString(),
    data: { id: "pay_w1", status: "succeeded", amountCents: 350000, reference: orderId },
  });
}

function webhookSig(body: string, ts = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", PLK_ENV.PAYMENTS_LK_WEBHOOK_SECRET).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

beforeEach(() => { setPaymentsLkFetch(undefined); setWebhookRawDb(undefined); });
afterEach(() => { setPaymentsLkFetch(undefined); setWebhookRawDb(undefined); });

describe("POST /payments/checkout (invoice)", () => {
  it("creates a payments.lk checkout and records the payment row", async () => {
    const db = new MockD1();
    seedInvoice(db);
    const fetchMock = vi.fn().mockResolvedValue(checkoutResponse());
    setPaymentsLkFetch(fetchMock as any);
    const app = await buildApp(db);

    const res = await postJson(app, "/payments/checkout", {
      invoiceId: "inv-001",
      returnUrl: "https://test.local/billing/return",
      cancelUrl: "https://test.local/billing",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("paymentslk");
    expect(body.redirectUrl).toContain("payments.lk/checkout");
    expect(body.merchantOrderId).toBe("chk_1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.payments.lk/v1/checkouts");
    expect(init.headers["Idempotency-Key"]).toMatch(/^(HH|TB|INS)/);
    const gwBody = JSON.parse(init.body);
    expect(gwBody.amountCents).toBe(350000);
    expect(gwBody.reference).toBe(init.headers["Idempotency-Key"]);

    const rows = (db as any).tables.payments?.rows ?? [];
    const pay = rows.find((r: any) => r.invoiceId === "inv-001");
    expect(pay).toBeDefined();
    expect(pay.provider).toBe("paymentslk");
    expect(pay.providerChargeId).toBe("pay_1");
  });

  it("404s on someone else's invoice", async () => {
    const db = new MockD1();
    seedInvoice(db);
    setPaymentsLkFetch(vi.fn() as any);
    const app = await buildApp(db, { id: "patient-002", role: "patient" });
    const res = await postJson(app, "/payments/checkout", { invoiceId: "inv-001", returnUrl: "https://x" });
    expect(res.status).toBe(404);
  });

  it("503s when gateway not configured", async () => {
    const db = new MockD1();
    seedInvoice(db);
    const app = await buildApp(db);
    // Override secret to missing.
    app.use("*", async (c, next) => { (c.env as any).PAYMENTS_LK_SECRET_KEY = undefined; await next(); });
    const res = await postJson(app, "/payments/checkout", { invoiceId: "inv-001", returnUrl: "https://x" });
    expect(res.status).toBe(503);
  });
});

describe("POST /payments/webhook/paymentslk", () => {
  it("records the event and updates the payments row on payment.succeeded", async () => {
    const db = new MockD1();
    seedInvoice(db);
    const fetchMock = vi.fn().mockResolvedValue(checkoutResponse());
    setPaymentsLkFetch(fetchMock as any);
    const { handle, state } = makeMockRawDb();
    setWebhookRawDb(handle as any);
    const app = await buildApp(db);
    const created = await (await postJson(app, "/payments/checkout", { invoiceId: "inv-001", returnUrl: "https://x" })).json();

    const body = webhookBody(created.merchantOrderId);
    const res = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Payments-Signature": webhookSig(body) },
      body,
    });
    expect(res.status).toBe(200);
    // Idempotency row recorded via the raw handle.
    expect(state.inserts.length).toBe(1);
    // UPDATE payments ... ran against the raw handle.
    expect(state.updates.some((u) => u.sql.includes("UPDATE payments SET paid_at"))).toBe(true);

    // Replay of the same event id → idempotent, no second insert.
    const replay = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Payments-Signature": webhookSig(body) },
      body,
    });
    const replayBody = await replay.json();
    expect(replayBody).toEqual({ ok: true, idempotent: true });
    expect(state.inserts.length).toBe(1);
  });

  it("rejects unsigned deliveries", async () => {
    const db = new MockD1();
    const app = await buildApp(db);
    const res = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: webhookBody(),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /payments/refund", () => {
  it("refunds via payments.lk for paymentslk provider", async () => {
    const db = new MockD1();
    seedInvoice(db);
    db.seed("payments", [
      { id: "pay-001", invoiceId: "inv-001", provider: "paymentslk", providerChargeId: "pay_1", amountLkr: 3500 },
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(checkoutResponse()) // unused by this test
      .mockResolvedValue(new Response(JSON.stringify({ id: "re_1", status: "pending" }), { status: 201 }));
    setPaymentsLkFetch(fetchMock as any);
    const app = await buildApp(db);

    const res = await postJson(app, "/payments/refund", { paymentId: "pay-001", amountCents: 50000, reason: "dup" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.refundId).toBe("re_1");
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("https://api.payments.lk/v1/refunds");
    expect(init.headers["Idempotency-Key"]).toBe("refund-pay_1-50000");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/api && bun run test tests/payments-generic-routes.test.ts`
Expected: FAIL (no `setPaymentsLkFetch` export; Stripe code path returns 501s)

- [ ] **Step 5: Rewrite the generic routes in `apps/api/src/routes/payments.ts`**

4a. Replace the Stripe import (line 39) and adapter instantiation (line 44):

```ts
import { PaymentsLkAdapter, mintOrderId, type PaymentsLkEnv } from "../lib/payments/paymentslk";
```

```ts
export const paymentsLk = new PaymentsLkAdapter();

/** Test hook: inject a fetch mock for gateway calls. */
export function setPaymentsLkFetch(fetchImpl?: typeof fetch): void {
  (paymentsLk as any).opts.fetchImpl = fetchImpl;
}
```

Also update the import from `@healthcare/db` (line 19) to include what the generic routes need (they currently use an undefined `schema.` — a latent bug this task fixes):

```ts
import { appointments, appointmentPayments, doctors, users, patients, testBookings, invoices, payments as paymentsTable } from "@healthcare/db";
```

(unchanged — the `schema.` references get replaced with `invoices` / `paymentsTable`).

4b. Replace `POST /checkout` (lines ~692–736):

```ts
paymentsRouter.post("/checkout", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const { invoiceId, returnUrl, cancelUrl } = body as { invoiceId?: string; returnUrl?: string; cancelUrl?: string };
  if (!invoiceId || !returnUrl) {
    return c.json({ error: "invoiceId, returnUrl required" }, 400);
  }

  if (!c.env.PAYMENTS_LK_SECRET_KEY) {
    return c.json({ error: "Payments not configured. Set PAYMENTS_LK_SECRET_KEY." }, 503);
  }

  const [invoice] = await db
    .select({ id: invoices.id, totalLkr: invoices.totalLkr })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.patientId, userId)))
    .limit(1);
  if (!invoice) {
    return c.json({ error: "invoice not found" }, 404);
  }

  const orderId = mintOrderId();
  const result = await paymentsLk.createCheckout(
    {
      amountCents: Math.round(invoice.totalLkr * 100),
      description: `HealthHub invoice ${invoice.id}`.slice(0, 120),
      reference: orderId,
      successUrl: returnUrl,
      cancelUrl,
    },
    c.env as any
  );

  await db.insert(paymentsTable).values({
    id: crypto.randomUUID(),
    invoiceId: invoice.id,
    amountLkr: invoice.totalLkr,
    method: "card",
    reference: result.merchantOrderId,
    receivedByUserId: userId,
    paidAt: new Date().toISOString(),
    provider: result.provider,
    providerChargeId: result.paymentId ?? result.merchantOrderId,
  });
  await audit(db, { userId, action: "payments.checkout", resource: "payment", resourceId: result.merchantOrderId });
  return c.json(result);
});
```

4c. Replace `POST /webhook/stripe` (lines ~738–810) with the payments.lk webhook. It dispatches all three order prefixes (appointments via `appointmentPayments`, lab bookings via `TB-`, insurance via `INS-`) exactly as the deleted `/notify` did, then falls back to the generic `payments` row update:

```ts
paymentsRouter.post("/webhook/paymentslk", async (c) => {
  const env = c.env;
  if (!env.PAYMENTS_LK_WEBHOOK_SECRET) {
    return c.text("payments not configured", 503);
  }

  const raw = await c.req.text();
  const sig = c.req.header("Payments-Signature") ?? "";
  let event;
  try {
    event = paymentsLk.verifyWebhook(raw, sig, env as any);
  } catch (e) {
    if (e instanceof PaymentError) {
      return c.json({ ok: false, code: e.code }, 401);
    }
    throw e;
  }

  // Drizzle db for row dispatch; raw D1 handle for idempotency + raw SQL.
  const db = (c.get("db") as any) ?? createDb(env.DB);
  const rawDb = (webhookRawDb as any) ?? env.DB;

  const rec = await tryRecordWebhook(rawDb, event.provider, event.eventId, event.raw);
  if (!rec.isNew) {
    return c.json({ ok: true, idempotent: true });
  }

  const orderId = event.merchantOrderId;
  try {
    // INS- orders dispatch to the insurance activation flow (same as the
    // old PayHere /notify did for INS-*).
    if (orderId.startsWith("INS-")) {
      if (event.statusCode === 2) {
        await handleInsurancePremiumPaid(env as any, orderId, event.paymentId, "paymentslk");
      } else {
        await handleInsurancePremiumFailed(env as any, orderId, String(event.statusCode));
      }
    } else {
      // Consultation payments: appointmentPayments row keyed by the minted
      // order id (appointment insert uses HH-prefixed gatewayOrderId).
      const [row] = await db
        .select()
        .from(appointmentPayments)
        .where(eq(appointmentPayments.gatewayOrderId, orderId))
        .limit(1);

      if (row) {
        const status =
          event.statusCode === 2 ? "paid" : event.statusCode === -2 ? "failed" : "failed";
        await db
          .update(appointmentPayments)
          .set({
            status,
            gatewayPaymentId: event.paymentId,
            gatewayStatusCode: String(event.statusCode),
            gatewayMethod: "card",
            rawNotify: JSON.stringify(event.raw),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(appointmentPayments.id, row.id));

        if (event.statusCode === 2) {
          await db
            .update(appointments)
            .set({ paymentStatus: "paid", status: "confirmed" })
            .where(eq(appointments.id, row.appointmentId));
          await notify({
            db,
            userId: row.userId,
            type: "appointment",
            title: "Payment confirmed",
            body: `Your appointment payment of LKR ${row.amountLkr.toFixed(2)} was successful.`,
            data: { appointmentId: row.appointmentId, paymentId: row.id },
          });
          await audit(db, {
            userId: row.userId,
            action: "payment.paid",
            entityType: "appointment",
            entityId: row.appointmentId,
            details: {
              amountLkr: row.amountLkr,
              gatewayOrderId: orderId,
              gatewayPaymentId: event.paymentId,
              provider: "paymentslk",
            },
          });
        }
      } else if (orderId.startsWith("TB-")) {
        // Lab bookings: flip test_bookings by paymentRef (same as /notify).
        const [booking] = await db
          .select()
          .from(testBookings)
          .where(eq(testBookings.paymentRef, orderId))
          .limit(1);
        if (booking && event.statusCode === 2 && booking.paymentStatus !== "paid") {
          await db
            .update(testBookings)
            .set({
              paymentStatus: "paid",
              status: booking.status === "pending" ? "confirmed" : booking.status,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(testBookings.id, booking.id));
          const [owner] = await db
            .select()
            .from(patients)
            .where(eq(patients.id, booking.patientId))
            .limit(1);
          await notify({
            db,
            env,
            userId: owner?.userId ?? booking.patientId,
            type: "lab_ready",
            title: "Payment confirmed",
            body: `Your lab booking payment of LKR ${Number(booking.totalPrice).toFixed(2)} was successful.`,
            data: { bookingId: booking.id, testBookingId: booking.id, paymentRef: orderId },
          }).catch(() => {});
          await audit(db, {
            userId: owner?.userId ?? booking.patientId,
            action: "payment.paid",
            resource: "test_booking",
            resourceId: booking.id,
            details: {
              amountLkr: booking.totalPrice,
              gatewayOrderId: orderId,
              gatewayPaymentId: event.paymentId,
              provider: "paymentslk",
            },
          }).catch(() => {});
        }
      } else if (event.statusCode === 2) {
        // Generic invoice path: stamp paid_at on the recorded charge.
        await rawDb
          .prepare(
            "UPDATE payments SET paid_at = datetime('now'), webhook_received_at = datetime('now') WHERE provider_charge_id = ?"
          )
          .bind(event.paymentId ?? orderId)
          .run();
      }
    }
  } catch (err) {
    logger.error("payments.webhook.paymentslk", "dispatch failed", {
      orderId,
      err: String(err),
    });
    // Still mark processed so payments.lk stops retrying.
  }

  await markWebhookProcessed(rawDb, rec.id, String(event.statusCode));
  await audit(db as any, {
    action: "payments.webhook",
    resource: "payment",
    resourceId: orderId,
    details: { provider: event.provider, statusCode: event.statusCode, orderId },
  });
  return c.json({ ok: true });
});
```

Add the module-level hook alongside `setPaymentsLkFetch` (4a):

```ts
let webhookRawDb: unknown = undefined;

/** Test hook: inject a raw D1 handle for webhook idempotency + raw SQL. */
export function setWebhookRawDb(rawDb?: unknown): void {
  webhookRawDb = rawDb;
}
```

4d. Replace `POST /refund` (lines ~812–849): same structure; Stripe branch becomes:

```ts
  const body = await c.req.json().catch(() => ({}));
  const { paymentId, amountCents, reason } = body as { paymentId?: string; amountCents?: number; reason?: string };
  if (!paymentId) return c.json({ error: "paymentId required" }, 400);

  const [payment] = await db
    .select({
      id: paymentsTable.id,
      provider: paymentsTable.provider,
      providerChargeId: paymentsTable.providerChargeId,
      patientId: invoices.patientId,
    })
    .from(paymentsTable)
    .innerJoin(invoices, eq(paymentsTable.invoiceId, invoices.id))
    .where(eq(paymentsTable.id, paymentId))
    .limit(1);

  if (!payment) {
    return c.json({ error: "payment not found" }, 404);
  }

  if (payment.provider === "paymentslk" && payment.providerChargeId) {
    try {
      const result = await paymentsLk.refund(
        { paymentId: payment.providerChargeId, amountCents, reason },
        c.env as any
      );
      await audit(db, { userId, action: "payments.refund", resource: "payment", resourceId: paymentId, details: { provider: payment.provider } });
      return c.json(result);
    } catch (e) {
      if (e instanceof PaymentError) {
        // Gateway refusal (e.g. not yet settled / not refundable).
        return c.json({ error: e.message }, 502);
      }
      throw e;
    }
  }

  return c.json({ error: "refund not supported for this provider" }, 501);
```

4e. `GET /me` (lines ~851–869): replace `schema.payments.*` with `paymentsTable.*` — the query logic is unchanged.

- [ ] **Step 6: Run tests**

Run: `cd apps/api && bun run test tests/payments-generic-routes.test.ts tests/payments-paymentslk.test.ts`
Expected: PASS (idempotency + the `UPDATE payments` write run against `makeMockRawDb()`; Drizzle-level row assertions use `MockD1`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/payments.ts apps/api/src/types/index.ts apps/api/tests/_testApp.ts apps/api/tests/payments-generic-routes.test.ts
git commit -m "feat: payments.lk checkout, webhook, and refund routes"
```

---

### Task 4: Initiate flows rewrite + remove /notify (TDD)

**Files:**
- Modify: `apps/api/src/routes/payments.ts` (file header, `/initiate`, delete `/notify`)
- Modify: `apps/api/tests/lab-payments.test.ts` (rewrite PayHere-specific parts)

**Interfaces (consumes):** `paymentsLk`, `mintOrderId`, `setPaymentsLkFetch`, `setWebhookRawDb`, `makeMockRawDb`, `PaymentsLkEnv`.

- [ ] **Step 1: Rewrite `/initiate` in `apps/api/src/routes/payments.ts`**

Keep: route path, `authMiddleware` + `requireRole("patient")`, ownership checks, booking-state guards, amount guards, pending-order reuse (`TB-` via `paymentRef`, appointments via existing pending `appointmentPayments` row), and `HH-`/`TB-` minting (`appointmentPayments` insert sets `gatewayOrderId`).

Replace the lab-booking tail (hash + fields + response, lines ~152–206) with:

```ts
      const result = await paymentsLk.createCheckout(
        {
          amountCents: Math.round(amount * 100),
          description: `Lab test booking ${booking.scheduledDate} ${booking.scheduledTimeSlot}`.slice(0, 120),
          reference: orderId,
          successUrl: `${publicUrl}/lab/payment/return?order=${orderId}`,
          cancelUrl: `${publicUrl}/lab/payment/cancel?order=${orderId}`,
          customer: { name: fullName, email: user?.email || "noreply@healthhub.app" },
        },
        env as any
      );

      return c.json({
        orderId,
        bookingId: testBookingId,
        testBookingId,
        paymentRef: orderId,
        amount,
        currency: "LKR",
        checkoutUrl: result.redirectUrl,
        provider: result.provider,
      });
```

Keep the `fullName` derivation block (lines ~160–172) — it feeds `customer.name`.

Replace the appointment tail (hash + fields + response, lines ~287–339) with:

```ts
    const result = await paymentsLk.createCheckout(
      {
        amountCents: Math.round(amount * 100),
        description: `Consultation ${appt.date} ${appt.time}`.slice(0, 120),
        reference: orderId,
        successUrl: `${publicUrl}/payment/return?order=${orderId}`,
        cancelUrl: `${publicUrl}/payment/cancel?order=${orderId}`,
        customer: { name: fullName, email: user?.email || "noreply@healthhub.app" },
      },
      env as any
    );

    return c.json({
      orderId,
      paymentId,
      amount,
      currency: "LKR",
      checkoutUrl: result.redirectUrl,
      provider: result.provider,
    });
```

Also: the missing-config guard (lines ~76–86) becomes:

```ts
    if (!env.PAYMENTS_LK_SECRET_KEY) {
      return c.json(
        { error: "Payments not configured. Set PAYMENTS_LK_SECRET_KEY." },
        503
      );
    }
```

and drop the `merchantId`/`secret` locals + both `computeHash` calls. Update the file-header comment (lines 1–15): payments.lk, `POST /payments/webhook/paymentslk` instead of `/notify`.

- [ ] **Step 2: Delete `POST /payments/notify`** (lines ~343–589) — the PayHere server-to-server callback. Its dispatch logic lives on in `POST /payments/webhook/paymentslk` (Task 3). Delete the `verifyNotify`/`computeHash`/`mapStatusCode` imports from `../lib/payhere` (already gone from the import list after Task 2/3 edits).

- [ ] **Step 3: Update `apps/api/tests/lab-payments.test.ts`**

3a. Replace the payhere imports (lines 23–29) with:

```ts
import { mintOrderId } from "../src/lib/payments/paymentslk";
import {
  setPaymentsLkFetch,
  setWebhookRawDb,
} from "../src/routes/payments";
import { makeMockRawDb } from "./_testApp";
```

3b. Replace `PAYHERE_ENV` (lines 51–56) with:

```ts
const PLK_ENV = {
  PAYMENTS_LK_SECRET_KEY: "sk_test_abc",
  PAYMENTS_LK_WEBHOOK_SECRET: "whsec_abc",
  PUBLIC_URL: "https://test.local",
};
```

and inject it in `buildPaymentsApp` (the loop over `PAYHERE_ENV` → `PLK_ENV`).

3c. Replace the test "PayHere helpers mint + hash + mapStatusCode" (lines ~172–192) with:

```ts
  it("mintOrderId mints HH-prefixed orders", () => {
    const raw = mintOrderId();
    expect(raw).toMatch(/^HH[0-9a-f]{20}$/);
    expect(`TB-${raw}`.startsWith("TB-")).toBe(true);
  });
```

3d. Delete `computeNotifySig` helper (lines ~153–165).

3e. Rewrite "initiate accepts testBookingId..." (lines ~246–269):

```ts
  it("initiate accepts testBookingId, mints TB- order, stores paymentRef", async () => {
    const db = new MockD1();
    seedBase(db);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "chk_t1", url: "https://payments.lk/checkout/chk_t1", payment: { id: "pay_t1" } }),
          { status: 201 }
        )
      );
    setPaymentsLkFetch(fetchMock as any);
    const app = await buildPaymentsApp(db);

    const res = await postJson(app, "/payments/initiate", {
      testBookingId: "booking-pay-001",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orderId.startsWith("TB-")).toBe(true);
    expect(body.checkoutUrl).toContain("payments.lk/checkout");
    expect(body.provider).toBe("paymentslk");
    expect(body.hash).toBeUndefined();
    expect(body.fields).toBeUndefined();
    expect(body.amount).toBe(1500);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.payments.lk/v1/checkouts");
    expect(init.headers["Idempotency-Key"]).toBe(body.orderId);
    const gwBody = JSON.parse(init.body);
    expect(gwBody.amountCents).toBe(150000);
    expect(gwBody.customer.email).toBe("p@test.com");

    const rows = (db as any).tables.testBookings?.rows ?? [];
    const updated = rows.find((r: any) => r.id === "booking-pay-001");
    expect(updated.paymentRef).toBe(body.orderId);
    expect(updated.paymentStatus).toBe("pending");
  });
```

3f. "initiate reuses pending paymentRef on retry" (lines ~271–282): mock the gateway before each call so both initiates succeed:

```ts
  it("initiate reuses pending paymentRef on retry", async () => {
    const db = new MockD1();
    seedBase(db);
    setPaymentsLkFetch(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: "chk_t1", url: "https://payments.lk/checkout/chk_t1", payment: { id: "pay_t1" } }),
          { status: 201 }
        )
      ) as any
    );
    const app = await buildPaymentsApp(db);
    const first = await (await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })).json();
    const second = await (await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })).json();
    expect(second.orderId).toBe(first.orderId);
  });
```

3g. Rewrite "notify TB- flips pending→paid" (lines ~305–346) as a webhook test:

```ts
  it("webhook TB- flips pending→paid + keeps paymentRef", async () => {
    const db = new MockD1();
    seedBase(db);
    setPaymentsLkFetch(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: "chk_t1", url: "https://payments.lk/checkout/chk_t1", payment: { id: "pay_t1" } }),
          { status: 201 }
        )
      ) as any
    );
    const { handle, state } = makeMockRawDb();
    setWebhookRawDb(handle as any);
    const app = await buildPaymentsApp(db);

    const init = await (await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })).json();
    const orderId = init.orderId as string;

    const event = JSON.stringify({
      id: "evt_tb1",
      object: "event",
      type: "payment.succeeded",
      mode: "test",
      created: new Date().toISOString(),
      data: { id: "pay_t1", status: "succeeded", amountCents: 150000, reference: orderId },
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLK_ENV.PAYMENTS_LK_WEBHOOK_SECRET).update(`${ts}.${event}`).digest("hex");

    const webhookRes = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Payments-Signature": `t=${ts},v1=${sig}` },
      body: event,
    });
    expect(webhookRes.status).toBe(200);
    expect(state.inserts.length).toBe(1);

    const rows = (db as any).tables.testBookings?.rows ?? [];
    const updated = rows.find((r: any) => r.id === "booking-pay-001");
    expect(updated.paymentStatus).toBe("paid");
    expect(updated.status).toBe("confirmed");
    expect(updated.paymentRef).toBe(orderId);

    // Replay of the same event is idempotent.
    const replay = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Payments-Signature": `t=${ts},v1=${sig}` },
      body: event,
    });
    const replayBody = await replay.json();
    expect(replayBody).toEqual({ ok: true, idempotent: true });
    expect(state.inserts.length).toBe(1);
  });
```

(Add `import { createHmac } from "node:crypto";` and extend the `./_testApp` import with `makeMockRawDb` at the top. Reset with `setWebhookRawDb(undefined)` after each test in this file.)

3h. "GET /payments/:id supports booking lookup..." (lines ~348–368): keep; update `payhereOrderId` expectation to `gatewayOrderId` (done in Task 2).

3i. Replace the "Stripe: PayHere-only for TB- documented" test (lines ~454–459) with:

```ts
  it("payments source is gateway-neutral: payments.lk webhook + TB- dispatch, no PayHere", () => {
    const src = repoRead("apps/api/src/routes/payments.ts");
    expect(src).toContain("/webhook/paymentslk");
    expect(src).toContain('startsWith("TB-")');
    expect(src).toContain("paymentsLk.createCheckout");
    expect(src.toLowerCase()).not.toContain("payhere");
    expect(src).not.toContain("/notify");
  });
```

3j. The "payments source supports TB- initiate..." test (lines ~418–429): update `expect(src).toContain("computeHash")` → `expect(src).toContain("paymentsLk.createCheckout")`; keep the other contains (`testBookingId`, `startsWith("TB-")`, `paymentRef`, `testBookings`, `mintOrderId`, `appointmentId`, `appointmentPayments`).

The mobile repoRead test (lines ~443–452) and diagnostic book/cancel tests (~194–244, ~370–441) keep unchanged (they assert strings that remain in the sources).

- [ ] **Step 4: Run tests**

Run: `cd apps/api && bun run test tests/lab-payments.test.ts tests/payments-generic-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/payments.ts apps/api/tests/lab-payments.test.ts
git commit -m "feat: payments.lk initiate flows for appointments and lab bookings"
```

---

### Task 5: Insurance marketplace pay + renew (TDD light)

**Files:**
- Modify: `apps/api/src/routes/insurance-marketplace.ts` (imports, pay endpoint tail ~672–724, renew tail ~941–983)
- Modify: `apps/api/tests/insurance-payout.test.ts:51-67`

- [ ] **Step 1: Swap imports (lines 46–51)**

```ts
import {
  mintOrderId,
  type PaymentsLkEnv,
} from "../lib/payments/paymentslk";
import { paymentsLk } from "./payments";
```

- [ ] **Step 2: Replace the pay-endpoint tail (hash/fields/response, lines ~672–724)**

Keep everything through the `orderId` minting/persist. Replace from the `const hash = await computeHash(...)` block through the `return c.json({...})` with:

```ts
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const fullName =
      user?.name ||
      user?.email?.split("@")[0] ||
      "Patient";

    const publicUrl = env.PUBLIC_URL || "https://app.healthhub.app";
    const result = await paymentsLk.createCheckout(
      {
        amountCents: Math.round(invoice.amountLkr * 100),
        description: `Health insurance premium ${enrollment.billingCycle} (policy ${enrollment.policyNumber ?? "draft"})`.slice(0, 120),
        reference: orderId,
        successUrl: `${publicUrl}/insurance/payment/return?order=${orderId}`,
        cancelUrl: `${publicUrl}/insurance/payment/cancel?order=${orderId}`,
        customer: { name: fullName, email: user?.email || "noreply@healthhub.app" },
      },
      env as any
    );

    return c.json({
      orderId,
      invoiceId: invoice.id,
      amount: invoice.amountLkr,
      currency: "LKR",
      checkoutUrl: result.redirectUrl,
      provider: result.provider,
    });
```

Drop the `merchantId`/`secret` 503 guard at ~621–629 and replace with:

```ts
    if (!env.PAYMENTS_LK_SECRET_KEY) {
      return c.json(
        { error: "Payments not configured. Set PAYMENTS_LK_SECRET_KEY." },
        503,
      );
    }
```

- [ ] **Step 3: Same replacement in the renew endpoint (lines ~933–990)** — identical shape: drop `computeHash`/`fields`/`checkoutUrl(env)`/`isSandbox`; call `paymentsLk.createCheckout` with the renew endpoint's existing description text and order id; return `{ orderId, invoiceId, amount, currency, checkoutUrl, provider }`. Keep `orderId = invoice.paymentId ?? \`INS-${mintOrderId()}\`` semantics.

- [ ] **Step 4: Update `apps/api/tests/insurance-payout.test.ts` "Stripe INS- dispatch shape" → "payments.lk INS- dispatch shape"**

```ts
  it("payments.lk INS- dispatch shape", () => {
    const src = read("apps/api/src/routes/payments.ts");
    expect(src).toContain("/webhook/paymentslk");
    const hookIdx = src.indexOf("/webhook/paymentslk");
    expect(hookIdx).toBeGreaterThan(-1);
    const hookBlock = src.slice(hookIdx, hookIdx + 5000);
    // Webhook dispatches INS- prefix to insurance handlers
    expect(hookBlock).toContain('startsWith("INS-")');
    expect(hookBlock).toContain("handleInsurancePremiumPaid");
    expect(hookBlock).toContain("handleInsurancePremiumFailed");
    // Keeps generic invoice path unchanged
    expect(hookBlock).toContain("UPDATE payments SET paid_at");
    // Idempotency via payment_webhook_events
    expect(hookBlock).toContain("tryRecordWebhook");
    expect(hookBlock).toContain("markWebhookProcessed");
  });
```

- [ ] **Step 5: Run tests**

Run: `cd apps/api && bun run test tests/insurance-payout.test.ts tests/lab-payments.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/insurance-marketplace.ts apps/api/tests/insurance-payout.test.ts
git commit -m "feat: payments.lk checkout for insurance premium pay + renew"
```

---

### Task 6: Delete dead gateway code

**Files:**
- Delete: `apps/api/src/lib/payments/stripe.ts`
- Delete: `apps/api/src/lib/payhere.ts`
- Delete: `apps/api/tests/payments-stripe.test.ts`
- Delete: `apps/mobile/src/lib/payhere.ts`

- [ ] **Step 1: Delete the four files**

```bash
git rm apps/api/src/lib/payments/stripe.ts apps/api/src/lib/payhere.ts apps/api/tests/payments-stripe.test.ts apps/mobile/src/lib/payhere.ts
```

- [ ] **Step 2: Verify no dangling imports**

Run: `grep -rn "lib/payhere\|payments/stripe\|runPayHereCheckout" apps packages --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: only mobile call sites that Task 6 (Mobile) then fixes — if any API file still imports them, fix it.

Note: run this from the repo root; `apps/*/node_modules` are excluded by the grep filter. If the grep traverses into symlinked node_modules and hangs, use the workspace grep tool instead.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove PayHere and Stripe gateway code"
```

---

### Task 7: Mobile — payments.lk checkout wrapper (Expo)

**Files:**
- Create: `apps/mobile/src/lib/payments.ts`
- Modify: `apps/mobile/src/app/(app)/book-appointment.tsx:65,361-375`
- Modify: `apps/mobile/src/app/(app)/book-test.tsx:45,313-329`
- Modify: `apps/mobile/src/app/(app)/test-booking-detail/[id].tsx:38,186-198`
- Modify: `apps/mobile/src/app/(app)/insurance/policy/[id].tsx:68` (comment only)
- Modify: `apps/mobile/src/app/(app)/insurance/payment/[enrollmentId].tsx:1-2` (comment only)

**Interfaces (produces):** `runPaymentsCheckout({ checkoutUrl, pollStatus, timeoutMs }) → { status: "paid" | "failed" | "cancelled" | "timeout" }` — same contract mobile callers already branch on.

- [ ] **Step 1: Create `apps/mobile/src/lib/payments.ts`**

```ts
/**
 * payments.lk checkout wrapper for Expo mobile.
 *
 * The backend creates the hosted checkout (payments.lk) and returns its
 * URL. We open it in the system browser (via `expo-web-browser`), then
 * poll the backend's `GET /payments/:appointmentId` when the app regains
 * focus. The payments.lk webhook has already updated the payment status
 * server-side by then; polling just confirms and the UI reactively
 * updates.
 */

import * as WebBrowser from "expo-web-browser";
import { AppState } from "react-native";

export interface PaymentsCheckoutInput {
  checkoutUrl: string;
  /** Poll this to detect when backend flipped to paid. */
  pollStatus: () => Promise<{ status: string }>;
  /** Max time to wait for paid status, in ms. Default 5min. */
  timeoutMs?: number;
}

export interface PaymentsCheckoutResult {
  status: "paid" | "failed" | "cancelled" | "timeout";
}

/** Open the hosted checkout page and wait for the result. */
export async function runPaymentsCheckout(
  input: PaymentsCheckoutInput
): Promise<PaymentsCheckoutResult> {
  const timeoutMs = input.timeoutMs ?? 5 * 60 * 1000;

  // Complete any pending session from a previous closed window.
  WebBrowser.maybeCompleteAuthSession();

  const openedAt = Date.now();

  const result = await new Promise<PaymentsCheckoutResult>((resolve) => {
    let resolved = false;

    const finish = (status: PaymentsCheckoutResult["status"]) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ status });
    };

    const sub = AppState.addEventListener("change", async (next) => {
      if (next !== "active") return;
      // App regained focus — user returned from browser.
      const elapsed = Date.now() - openedAt;
      const remaining = Math.max(0, timeoutMs - elapsed);
      const pollResult = await pollUntilSettled(
        input.pollStatus,
        remaining
      );
      if (pollResult === "paid") return finish("paid");
      if (pollResult === "timeout") return finish("timeout");
      // If still pending after window closed, treat as cancelled.
      return finish("cancelled");
    });

    const cleanup = () => {
      sub.remove();
    };

    void WebBrowser.openBrowserAsync(input.checkoutUrl).catch((err) => {
      console.error("[payments] openBrowserAsync failed:", err);
      finish("failed");
    });
  });

  return result;
}

/** Poll `pollStatus()` every 2s until status resolves to paid/failed or timeout. */
async function pollUntilSettled(
  pollStatus: () => Promise<{ status: string }>,
  maxMs: number
): Promise<"paid" | "failed" | "timeout"> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const r = await pollStatus();
      if (r.status === "paid") return "paid";
      if (r.status === "failed" || r.status === "refunded") return "failed";
    } catch {
      // network blip — keep polling
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  return "timeout";
}
```

- [ ] **Step 2: Update call sites**

2a. `book-appointment.tsx` — line 65: `import { runPayHereCheckout } from "@/lib/payhere";` → `import { runPaymentsCheckout } from "@/lib/payments";`. Lines 361–375:

```ts
          const result = await runPaymentsCheckout({
            checkoutUrl: init.checkoutUrl,
            pollStatus: async () => {
              const s: any = await api.get(`/payments/${appointmentId}`);
              return { status: s.status };
            },
          });
```

(also update the `// Initiate payment + open PayHere checkout.` comment → `// Initiate payment + open payments.lk checkout.`)

2b. `book-test.tsx` — line 45 import swap; lines 313–329:

```ts
          const result = await runPaymentsCheckout({
            checkoutUrl: init.checkoutUrl,
            pollStatus: async () => {
              const s: any = await api(`/payments/${bookingId}`);
              return { status: s.status };
            },
          });
```

(update the `charged via PayHere TB- order` comment → `charged via payments.lk TB- order`)

2c. `test-booking-detail/[id].tsx` — line 38 import swap; lines 186–198:

```ts
      const result = await runPaymentsCheckout({
        checkoutUrl: init.checkoutUrl,
        pollStatus: async () => {
          const s: any = await api(`/payments/${id}`);
          return { status: s.status };
        },
      });
```

2d. Comments only: `insurance/policy/[id].tsx:68` → `// Auto-open payments.lk checkout when renew mutation returns a checkoutUrl.`; `insurance/payment/[enrollmentId].tsx:1-2` header comment → `// payments.lk redirect for insurance premium. Polls enrollment status until active.` (Both screens consume `checkoutUrl`, which keeps its meaning — no logic change.)

- [ ] **Step 3: Verify no payhere references remain in mobile**

Run: `grep -rn "payhere\|PayHere" apps/mobile/src | grep -v node_modules`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/payments.ts apps/mobile/src/app
git commit -m "feat(mobile): open payments.lk hosted checkout"
```

---

### Task 8: Web (marketing) — drop PayHere field plumbing

**Files:**
- Modify: `apps/marketing/src/patient/hooks/diagnostic.ts:153-161`
- Modify: `apps/marketing/src/app/patient/(app)/diagnostic-tests/page.tsx:419-426`
- Modify: `apps/marketing/src/app/hospital/(hospital)/billing/[id]/page.tsx:70-80`

- [ ] **Step 1: Update the initiate hook (`diagnostic.ts`)**

```ts
export function useInitiateTestPayment() {
  return useMutation({
    mutationFn: ({ bookingId }: { bookingId: string }) =>
      api<{ orderId: string; checkoutUrl: string; amount: number }>(
        "/payments/initiate",
        { method: "POST", json: { testBookingId: bookingId } },
      ),
  });
}
```

- [ ] **Step 2: Update the lab flow page (`diagnostic-tests/page.tsx`)**

The current code (lines ~419–426) builds the URL from `fields`. Replace with a direct redirect:

```ts
        const init = await api<{ orderId: string; checkoutUrl: string; amount: number }>(
          "/payments/initiate",
          { method: "POST", json: { testBookingId: bookingId } },
        );
        if (init?.checkoutUrl) {
          window.location.href = init.checkoutUrl;
        }
```

Keep any surrounding error handling / polling of `GET /payments/:id` unchanged. (Note: this repo's Next.js version has breaking changes — this is a plain `window.location.href` assignment inside an existing event handler; do not introduce new Next APIs.)

- [ ] **Step 3: Update the hospital billing page**

Line ~74: delete the `method: "stripe",` line (the endpoint no longer accepts `method`); keep the `redirectUrl` redirect block.

- [ ] **Step 4: Verify no payhere refs remain in marketing**

Run: `grep -rn "payhere\|PayHere" apps/marketing/src | grep -v node_modules`
Expected: no output (or only inert comments — fix if found).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src
git commit -m "feat(web): redirect straight to payments.lk checkout"
```

---

### Task 9: Config + docs

**Files:**
- Modify: `apps/api/wrangler.toml:66-68` and `:145`
- Modify: `.env.example`
- Modify: `apps/api/docs/CURL.md` (PayHere/Stripe sections)
- Modify: `README.md:53,69`
- Modify: `apps/api/src/index.ts:261-263` (comment only)

- [ ] **Step 1: `apps/api/wrangler.toml`**

Replace lines ~66–68:

```toml
# Payments.lk gateway. PAYMENTS_LK_SECRET_KEY + PAYMENTS_LK_WEBHOOK_SECRET
# are set via `wrangler secret put`. Sandbox vs live is decided by the key
# prefix (sk_test_ / sk_live_) — no separate sandbox URL.
```

In the dev/env section (~line 145), delete the `PAYHERE_SANDBOX = "true"` line.

- [ ] **Step 2: `.env.example`**

Append:

```
# Payments.lk (payment gateway)
PAYMENTS_LK_SECRET_KEY=sk_test_your-sandbox-key
PAYMENTS_LK_WEBHOOK_SECRET=whsec_your-webhook-signing-secret
```

Also check the root `.env` (local dev): if it contains `PAYHERE_*` vars, replace them with `PAYMENTS_LK_*` sandbox placeholders.

- [ ] **Step 3: `apps/api/docs/CURL.md`**

Update "Last updated" to today. Replace the "PayHere appointment checkout" heading with "payments.lk appointment checkout" (same curl body). Replace the "Generic Stripe checkout" section body with:

```bash
curl -X POST http://localhost:8787/payments/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":"inv_1","returnUrl":"http://localhost:3000/return"}'
```

Replace the "Stripe webhook (simulate)" section with a payments.lk one — signature script:

```js
const ts = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "payment.succeeded",
  mode: "test",
  created: new Date().toISOString(),
  data: { id: "pay_1", status: "succeeded", amountCents: 350000, reference: "HH123" },
});
const sig = require("crypto")
  .createHmac("sha256", "whsec_x")
  .update(`${ts}.${payload}`)
  .digest("hex");
console.log(`t=${ts},v1=${sig}`);
```

then:

```bash
curl -X POST http://localhost:8787/payments/webhook/paymentslk \
  -H "Content-Type: application/json" \
  -H "Payments-Signature: t=$TS,v1=$SIG" \
  -d @- <<'EOF'
{"id":"evt_1","object":"event","type":"payment.succeeded","mode":"test","created":"2026-09-25T00:00:00.000Z","data":{"id":"pay_1","status":"succeeded","amountCents":350000,"reference":"HH123"}}
EOF
```

Expected line stays: `{"ok":true}` first call, `{"ok":true,"idempotent":true}` on replay.

- [ ] **Step 4: `README.md`**

- Line 53: `- Stripe adapter + generic /payments/checkout + webhook + refund + /me routes (apps/api/src/lib/payments/)` → `- payments.lk adapter + generic /payments/checkout + webhook + refund + /me routes (apps/api/src/lib/payments/)`
- Line 69: `Migrations live in apps/api/migrations/ (number 0001–0075).` → `(number 0001–0083).`

- [ ] **Step 5: `apps/api/src/index.ts:261-263`**

```ts
// payments.lk flow. /payments/initiate + /payments/webhook/paymentslk
// + /payments/:appointmentId. The webhook is public; others require auth.
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/wrangler.toml .env.example apps/api/docs/CURL.md README.md apps/api/src/index.ts
git commit -m "docs: payments.lk configuration and curl examples"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full API test suite**

Run: `bun run test`
Expected: all API tests PASS (stripe test deleted, lab/generic/insurance tests green)

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: API + packages clean; mobile may show pre-existing LucideIcon errors — confirm any new errors are not introduced by `src/lib/payments.ts` or the edited screens.

- [ ] **Step 3: Lint (if configured for changed apps)**

Run: `bun run lint`
Expected: no new errors from changed files (marketing has eslint config; mobile may have none).

- [ ] **Step 4: Manual smoke (optional, local)**

With `PAYMENTS_LK_SECRET_KEY=sk_test_...` in `.dev.vars` and `bun run dev:api`:
1. `curl -X POST localhost:8787/payments/initiate -H "Authorization: Bearer $TOKEN" -d '{"appointmentId":"<id>"}'` → 200 with `checkoutUrl` pointing at payments.lk.
2. Open the checkout URL, pay with the sandbox test card (expiry 01/39 approves, 05/39 declines, CVV 100).
3. Observe `payment.succeeded` webhook at `/api/payments/webhook/paymentslk`; `GET /payments/:id` returns `status: "paid"`.

- [ ] **Step 5: Final commit (if any stray changes) + summary**

```bash
git status
git log --oneline -12
```

All checkboxes ticked; report done.
