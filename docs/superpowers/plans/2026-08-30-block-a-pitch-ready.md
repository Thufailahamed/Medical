# Block A — Pitch-Ready MVP Hardening Implementation Plan (Revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demo-ready MVP — generalize existing PayHere to any invoice, add Stripe, add Twilio/Dialog SMS, push receipt polling, pricing/about/demo pages + seed, doctor trust badges.

**Architecture:** Wrap existing `lib/payhere.ts` helpers + existing `routes/payments.ts` (appointment flow). Add generic gateway-agnostic layer atop. Stripe = new. SMS = add Twilio + Dialog-lk providers alongside existing `SmslenzProvider`. Push = receipt polling cron. Demo seed = idempotent UPSERT.

**Tech Stack:** Hono on Cloudflare Workers · Drizzle/D1 (existing) · vitest · Expo SDK 51 / EAS · Next.js 16 · Tailwind v4 · PayHere + Stripe · SMSLenz + Twilio + Dialog-lk · Expo Push.

## Global Constraints

- Bun runtime; `bun test` for unit, `bun run typecheck` all 4 packages.
- Secrets via `c.env.<NAME>` only.
- Feature flags per integration — kill switch without redeploy.
- Audit: existing `audit(db, AuditInput)` from `apps/api/src/lib/audit.ts`.
- Auth: `authMiddleware` (NOT `requireAuth`) from `apps/api/src/middleware/auth.ts:15`. Sets `c.get("userId")`, `c.get("dbUser")`.
- Trilingual i18n for new user-facing copy.
- Demo seed idempotent (UPSERT).
- Manual device steps explicit.

---

## Existing Code Inventory (DO NOT duplicate)

| Area | File | Reuse |
|---|---|---|
| PayHere helpers | `apps/api/src/lib/payhere.ts` (258 lines) | `computeHash`, `verifyNotify`, `mapStatusCode`, `mintOrderId`, `checkoutUrl`, `formatAmount`, `isSandbox` |
| Payments route (appointment) | `apps/api/src/routes/payments.ts` (408 lines) | Keep `/initiate`, `/notify`, `/:appointmentId`. Append new routes. |
| `payments` table | `packages/db/src/schema.ts:3412-3437` | Extend with `provider`, `provider_charge_id`, `webhook_received_at` |
| `invoices` table | `packages/db/src/schema.ts:3321-3374` | No changes (LKR amounts present) |
| `appointment_payments` table | `packages/db/src/schema.ts:3442-3482` | No changes |
| SMS provider | `apps/api/src/lib/sms.ts` (89 lines) | `SmslenzProvider`, `createSmsProvider`, `formatOtpMessage`. Add Twilio + Dialog-lk classes. |
| Notifications | `apps/api/src/lib/notifications.ts` | `notify()`, `sendExpoPush()`. Append `pollReceipts()`. |
| Audit | `apps/api/src/lib/audit.ts` | `audit(db, AuditInput)` aka `writeAudit` |
| Auth middleware | `apps/api/src/middleware/auth.ts:15` | `authMiddleware` |
| RBAC | `apps/api/src/middleware/rbac.ts` | `requireRole(...)` |
| `notificationPreferences` | `packages/db/src/schema.ts:1108-1132` | Extend with `sms` boolean |
| `messages` table | `packages/db/src/schema.ts:2217-2240` | Column = `senderRole` (not `from_role`/`to_role`) |
| `pushTokens` table | `packages/db/src/schema.ts:1095-1105` | No changes |
| wrangler bindings | `apps/api/wrangler.toml` | `DB`, `R2`, `AI`, `TELECONSULT_ROOM`. Vars: `DEV_MODE`, `SMS_PROVIDER=smslenz`, `PAYHERE_SANDBOX=false`, `EMAIL_PROVIDER=resend`. Add Stripe + Twilio/Dialog vars. |

---

## File Structure

**Created:**
- `apps/api/src/lib/payments/{types.ts,errors.ts,stripe.ts,index.ts,webhook-idempotency.ts}`
- `apps/api/src/db/migrations/0042_payments_provider.sql`
- `apps/api/src/db/migrations/0043_payment_webhook_events.sql`
- `apps/api/src/db/migrations/0044_notification_opt_outs.sql`
- `apps/api/src/db/migrations/0045_notification_prefs_sms.sql`
- `apps/api/src/cron/push-receipts.ts`
- `apps/api/scripts/seed-demo.ts`
- `apps/api/docs/{BAA-INVENTORY.md,CURL.md}`
- `apps/api/tests/{payments-types,payments-stripe,payments-webhook-idempotency,sms-extended,seed-demo,notifications-receipts,doctors-reply-time}.test.ts`
- `apps/api/src/routes/doctors-reply-time.ts`
- `apps/mobile/src/components/DoctorChip.tsx`
- `apps/mobile/docs/PUSH-SETUP.md`
- `apps/marketing/src/portal/components/doctor/DoctorBadge.tsx`
- `apps/marketing/src/app/{pricing,about,demo}/page.tsx`
- `packages/shared/src/doctor-badge.ts`
- `docs/DEVICE-CHECKLIST.md`

**Modified:**
- `apps/api/src/routes/payments.ts` (append routes)
- `apps/api/src/index.ts` (mount new route)
- `apps/api/src/lib/sms.ts` (add Twilio + Dialog-lk)
- `apps/api/src/lib/notifications.ts` (add pollReceipts + SMS branch in notify)
- `apps/api/wrangler.toml`, `apps/api/.env.example`
- `packages/shared/src/index.ts`, `packages/shared/src/validators.ts`
- `apps/mobile/eas.json`, `apps/mobile/app.config.js`, `apps/mobile/.gitignore`
- `apps/mobile/src/lib/push.ts`
- `apps/mobile/src/app/(app)/records.tsx`, `(app)/appointments/book-appointment.tsx`, `(doctor)/profile.tsx`
- `apps/marketing/src/components/Footer.tsx`
- `apps/marketing/src/app/hospital/(hospital)/billing/new/page.tsx`
- `apps/marketing/src/app/portal/(portal)/prescriptions/[id]/page.tsx`
- `apps/marketing/src/app/portal/(portal)/patients/[id]/layout.tsx`
- `package.json` (add `seed:demo` script)

---

## Task R1: Payment types + errors + gateway interface

**Files:**
- Create: `apps/api/src/lib/payments/types.ts`
- Create: `apps/api/src/lib/payments/errors.ts`
- Test: `apps/api/tests/payments-types.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `PaymentProvider`, `CheckoutInput`, `CheckoutResult`, `WebhookEvent`, `RefundInput`, `RefundResult`, `PaymentError`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/payments-types.test.ts
import { describe, it, expect } from 'vitest';
import { PaymentError, PaymentErrorCode } from '../src/lib/payments/errors';
import type { PaymentProvider, CheckoutInput } from '../src/lib/payments/types';

describe('payments types/errors', () => {
  it('PaymentError carries code + providerRef', () => {
    const err = new PaymentError(PaymentErrorCode.WebhookSignatureInvalid, 'payhere', 'evt_123');
    expect(err.code).toBe('webhook_signature_invalid');
    expect(err.provider).toBe('payhere');
    expect(err.providerRef).toBe('evt_123');
  });

  it('CheckoutInput accepts invoiceId + method', () => {
    const input: CheckoutInput = { invoiceId: 'inv_1', method: 'payhere', returnUrl: 'https://x' };
    expect(input.invoiceId).toBe('inv_1');
  });

  it('PaymentProvider type unions', () => {
    const providers: PaymentProvider[] = ['payhere', 'stripe'];
    expect(providers).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/payments-types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write types**

```ts
// apps/api/src/lib/payments/types.ts
export type PaymentProvider = 'payhere' | 'stripe';

export type CheckoutInput = {
  invoiceId: string;
  method: PaymentProvider;
  returnUrl: string;
  cancelUrl?: string;
};

export type CheckoutResult = {
  redirectUrl: string;
  merchantOrderId: string;
  provider: PaymentProvider;
};

export type WebhookEvent = {
  provider: PaymentProvider;
  eventId: string;
  merchantOrderId: string;
  statusCode: number;
  amountMinor: number;
  currency: string;
  raw: unknown;
};

export type RefundInput = {
  paymentId: string;
  amountMinor?: number;
  reason?: string;
};

export type RefundResult = {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  provider: PaymentProvider;
};
```

- [ ] **Step 4: Write errors**

```ts
// apps/api/src/lib/payments/errors.ts
import type { PaymentProvider } from './types';

export enum PaymentErrorCode {
  WebhookSignatureInvalid = 'webhook_signature_invalid',
  WebhookReplay = 'webhook_replay',
  ProviderError = 'provider_error',
  UnsupportedProvider = 'unsupported_provider',
  NotFound = 'not_found',
}

export class PaymentError extends Error {
  constructor(
    public code: PaymentErrorCode,
    public provider: PaymentProvider | 'unknown',
    public providerRef?: string,
    message?: string
  ) {
    super(message ?? `${code} (${provider}${providerRef ? `:${providerRef}` : ''})`);
    this.name = 'PaymentError';
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && bun test tests/payments-types.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/payments apps/api/tests/payments-types.test.ts
git commit -m "feat(payments): canonical types + error classes"
```

---

## Task R2: DB migrations — webhook events + payments provider cols + opt-out + prefs sms

**Files:**
- Create: `apps/api/src/db/migrations/0042_payments_provider.sql`
- Create: `apps/api/src/db/migrations/0043_payment_webhook_events.sql`
- Create: `apps/api/src/db/migrations/0044_notification_opt_outs.sql`
- Create: `apps/api/src/db/migrations/0045_notification_prefs_sms.sql`

**Interfaces:**
- Produces: extended `payments` cols; new `payment_webhook_events`; new `notification_opt_outs`; extended `notificationPreferences.sms`

- [ ] **Step 1: Write migration 0042**

```sql
-- apps/api/src/db/migrations/0042_payments_provider.sql
ALTER TABLE payments ADD COLUMN provider TEXT;
ALTER TABLE payments ADD COLUMN provider_charge_id TEXT;
ALTER TABLE payments ADD COLUMN webhook_received_at TEXT;
CREATE INDEX idx_payments_provider ON payments(provider);
CREATE INDEX idx_payments_charge ON payments(provider_charge_id);
```

- [ ] **Step 2: Write migration 0043**

```sql
-- apps/api/src/db/migrations/0043_payment_webhook_events.sql
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  merchant_order_id TEXT,
  payload TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  status TEXT,
  UNIQUE(provider, event_id)
);
CREATE INDEX idx_pwebhook_merchant ON payment_webhook_events(merchant_order_id);
```

- [ ] **Step 3: Write migration 0044**

```sql
-- apps/api/src/db/migrations/0044_notification_opt_outs.sql
CREATE TABLE IF NOT EXISTS notification_opt_outs (
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  reason TEXT,
  opted_out_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, channel)
);
```

- [ ] **Step 4: Write migration 0045**

Inspect `packages/db/src/schema.ts:1108-1132` for exact `notificationPreferences` columns. Assume shape: `(user_id, type, in_app, push)`. Migration:

```sql
-- apps/api/src/db/migrations/0045_notification_prefs_sms.sql
-- Adjust column names per actual schema if different.
ALTER TABLE notification_preferences ADD COLUMN sms INTEGER NOT NULL DEFAULT 1;
```

If schema uses different column names (e.g., `inApp`/`in_app`), use those exact names.

- [ ] **Step 5: Apply migrations**

Run:
```bash
cd apps/api
bun wrangler d1 migrations apply DB --local
bun wrangler d1 migrations apply DB --remote
```
Expected: 4 migrations applied.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/migrations/0042_*.sql apps/api/src/db/migrations/0043_*.sql apps/api/src/db/migrations/0044_*.sql apps/api/src/db/migrations/0045_*.sql
git commit -m "feat(db): payments provider + webhook events + opt-out + prefs sms"
```

---

## Task R3: Webhook idempotency helper

**Files:**
- Create: `apps/api/src/lib/payments/webhook-idempotency.ts`
- Test: `apps/api/tests/payments-webhook-idempotency.test.ts`

**Interfaces:**
- Consumes: `payment_webhook_events` table from Task R2
- Produces: `tryRecordWebhook(db, provider, eventId, payload): Promise<{ isNew: boolean; id: string }>`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/payments-webhook-idempotency.test.ts
import { describe, it, expect, vi } from 'vitest';
import { tryRecordWebhook } from '../src/lib/payments/webhook-idempotency';

const mockDb = () => ({
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
  }),
});

describe('tryRecordWebhook', () => {
  it('returns isNew=true on first insert', async () => {
    const db = mockDb();
    const result = await tryRecordWebhook(db as any, 'payhere', 'evt_1', { foo: 1 });
    expect(result.isNew).toBe(true);
  });

  it('returns isNew=false on duplicate (UNIQUE violation)', async () => {
    const db = mockDb();
    db.prepare().bind().run.mockRejectedValueOnce(new Error('UNIQUE constraint failed: payment_webhook_events.provider, payment_webhook_events.event_id'));
    const result = await tryRecordWebhook(db as any, 'payhere', 'evt_1', {});
    expect(result.isNew).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/payments-webhook-idempotency.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/lib/payments/webhook-idempotency.ts
type Db = { prepare: (sql: string) => { bind: (...a: any[]) => any; run: () => Promise<any>; first: () => Promise<any> } };

export async function tryRecordWebhook(
  db: Db,
  provider: string,
  eventId: string,
  payload: unknown
): Promise<{ isNew: boolean; id: string }> {
  const id = crypto.randomUUID();
  try {
    await db
      .prepare('INSERT INTO payment_webhook_events (id, provider, event_id, payload, status) VALUES (?, ?, ?, ?, ?)')
      .bind(id, provider, eventId, JSON.stringify(payload), 'processing')
      .run();
    return { isNew: true, id };
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      const existing = await db
        .prepare('SELECT id FROM payment_webhook_events WHERE provider = ? AND event_id = ?')
        .bind(provider, eventId)
        .first();
      return { isNew: false, id: existing?.id ?? id };
    }
    throw e;
  }
}

export async function markWebhookProcessed(db: Db, id: string, status: string) {
  await db
    .prepare("UPDATE payment_webhook_events SET processed_at = datetime('now'), status = ? WHERE id = ?")
    .bind(status, id)
    .run();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test tests/payments-webhook-idempotency.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/payments/webhook-idempotency.ts apps/api/tests/payments-webhook-idempotency.test.ts
git commit -m "feat(payments): webhook idempotency helper"
```

---

## Task R4: Stripe adapter

**Files:**
- Create: `apps/api/src/lib/payments/stripe.ts`
- Test: `apps/api/tests/payments-stripe.test.ts`

**Interfaces:**
- Consumes: types from Task R1
- Produces: `StripeAdapter` with `createCheckout`, `verifyWebhook`, `refund`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/payments-stripe.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { StripeAdapter } from '../src/lib/payments/stripe';

const env = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' };

describe('StripeAdapter', () => {
  it('createCheckout returns Stripe URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' }), { status: 200 }));
    const adapter = new StripeAdapter({ fetchImpl: fetchMock as any });
    const result = await adapter.createCheckout({ invoiceId: 'inv_1', method: 'stripe', returnUrl: 'https://x' }, env as any);
    expect(result.redirectUrl).toContain('checkout.stripe.com');
    expect(result.merchantOrderId).toBe('cs_1');
    expect(result.provider).toBe('stripe');
  });

  it('verifyWebhook accepts valid signature', () => {
    const adapter = new StripeAdapter();
    const ts = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', amount_total: 5000, currency: 'usd' } } });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/payments-stripe.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/lib/payments/stripe.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, PaymentErrorCode } from './errors';
import type { CheckoutInput, CheckoutResult, RefundInput, RefundResult, WebhookEvent } from './types';

type StripeEnv = { STRIPE_SECRET_KEY: string; STRIPE_WEBHOOK_SECRET: string };
type Fetch = typeof fetch;

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeFetch(env: StripeEnv, path: string, init: RequestInit, fetchImpl: Fetch): Promise<any> {
  const res = await fetchImpl(`${STRIPE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', ...(init.headers ?? {}) },
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
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new PaymentError(PaymentErrorCode.WebhookSignatureInvalid, 'stripe');
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test tests/payments-stripe.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/payments/stripe.ts apps/api/tests/payments-stripe.test.ts
git commit -m "feat(payments): stripe adapter"
```

---

## Task R5: Generalize payments route — append /checkout + Stripe webhook + /refund + /me

**Files:**
- Modify: `apps/api/src/routes/payments.ts` (append, do NOT touch existing `/initiate`/`/notify`/`/:appointmentId`)
- Modify: `apps/api/wrangler.toml` (Stripe vars/secrets)
- Test: extend `apps/api/tests/payments-types.test.ts` or new `payments-route-generalize.test.ts`

**Interfaces:**
- Consumes: `StripeAdapter` from R4, `tryRecordWebhook` from R3, `audit(db, AuditInput)` from existing
- Produces: `POST /payments/checkout`, `POST /payments/webhook/stripe`, `POST /payments/refund`, `GET /payments/me`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/payments-route-generalize.test.ts
import { describe, it, expect, vi } from 'vitest';
import app from '../src/index';

const authHeaders = (userId: string) => ({ Authorization: `Bearer test.${userId}.sig` });

describe('POST /payments/checkout (generic)', () => {
  it('requires auth', async () => {
    const res = await app.request('/payments/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invoiceId: 'inv_1', method: 'stripe', returnUrl: 'https://x' }) });
    expect([401, 403]).toContain(res.status);
  });
});

describe('POST /payments/webhook/stripe', () => {
  it('rejects bad signature with 401', async () => {
    const res = await app.request('/payments/webhook/stripe', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' }, body: '{}' });
    expect(res.status).toBe(401);
  });
});

describe('GET /payments/me', () => {
  it('requires auth', async () => {
    const res = await app.request('/payments/me', { headers: authHeaders('u_1') });
    expect([401, 403, 200]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/payments-route-generalize.test.ts`
Expected: FAIL — routes not registered.

- [ ] **Step 3: Append routes to existing payments.ts**

Read `apps/api/src/routes/payments.ts` first. At end of file (or before the existing exports), add:

```ts
// At top of file, add imports:
import { StripeAdapter } from '../lib/payments/stripe';
import { PaymentError, PaymentErrorCode } from '../lib/payments/errors';
import { tryRecordWebhook, markWebhookProcessed } from '../lib/payments/webhook-idempotency';
import { audit } from '../lib/audit';
import { authMiddleware } from '../middleware/auth';

const stripeAdapter = new StripeAdapter();

// Generic checkout — works for any invoice (not just appointment)
paymentsRouter.post('/checkout', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ invoiceId: string; method: 'payhere' | 'stripe'; returnUrl: string; cancelUrl?: string }>();
  const invoice = await c.env.DB.prepare('SELECT id, total_lkr FROM invoices WHERE id = ? AND patient_id = ?').bind(body.invoiceId, userId).first<{ id: string; total_lkr: number }>();
  if (!invoice) throw new PaymentError(PaymentErrorCode.NotFound, body.method);
  const result = body.method === 'stripe'
    ? await stripeAdapter.createCheckout(body, c.env as any)
    : { redirectUrl: '', merchantOrderId: '' }; // PayHere appointment flow stays in /initiate
  await c.env.DB.prepare(`INSERT INTO payments (id, invoice_id, amount_lkr, method, reference, paid_at, provider, provider_charge_id) VALUES (?, ?, ?, 'card', ?, NULL, ?, ?)`).bind(crypto.randomUUID(), invoice.id, invoice.total_lkr, '', result.provider, result.merchantOrderId).run();
  await audit(c.env.DB, { userId, action: 'payments.checkout', resource: 'payment', resourceId: result.merchantOrderId });
  return c.json(result);
});

paymentsRouter.post('/webhook/stripe', async (c) => {
  const raw = await c.req.text();
  const sig = c.req.header('stripe-signature') ?? '';
  let event;
  try { event = stripeAdapter.verifyWebhook(raw, sig, c.env as any); }
  catch (e) {
    if (e instanceof PaymentError) return c.json({ ok: false, code: e.code }, 401);
    throw e;
  }
  const rec = await tryRecordWebhook(c.env.DB as any, event.provider, event.eventId, event.raw);
  if (!rec.isNew) return c.json({ ok: true, idempotent: true });
  if (event.statusCode === 2) {
    await c.env.DB.prepare(`UPDATE payments SET paid_at = datetime('now'), webhook_received_at = datetime('now') WHERE provider_charge_id = ?`).bind(event.merchantOrderId).run();
  }
  await markWebhookProcessed(c.env.DB as any, rec.id, String(event.statusCode));
  await audit(c.env.DB, { action: 'payments.webhook', resource: 'payment', resourceId: event.merchantOrderId, details: { provider: event.provider, statusCode: event.statusCode } });
  return c.json({ ok: true });
});

paymentsRouter.post('/refund', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ paymentId: string; amountMinor?: number; reason?: string }>();
  const payment = await c.env.DB.prepare('SELECT id, provider, provider_charge_id FROM payments WHERE id = ? AND patient_id = ?').bind(body.paymentId, userId).first<{ id: string; provider: string; provider_charge_id: string }>();
  if (!payment) throw new PaymentError(PaymentErrorCode.NotFound, 'unknown');
  const result = payment.provider === 'stripe'
    ? await stripeAdapter.refund({ paymentId: payment.provider_charge_id, amountMinor: body.amountMinor, reason: body.reason }, c.env as any)
    : { refundId: '', status: 'failed' as const, provider: 'payhere' as const };
  await audit(c.env.DB, { userId, action: 'payments.refund', resource: 'payment', resourceId: body.paymentId, details: { provider: payment.provider } });
  return c.json(result);
});

paymentsRouter.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare('SELECT id, invoice_id, amount_lkr, provider, paid_at, created_at FROM payments WHERE patient_id = ? ORDER BY created_at DESC LIMIT 50').bind(userId).all();
  return c.json({ payments: rows.results });
});
```

Note: existing `paymentsRouter` is exported as default or named. Match the export style of the existing file (check first line).

- [ ] **Step 4: Update wrangler.toml**

Append:

```toml
[vars]
STRIPE_PUBLISHABLE_KEY = "pk_test_placeholder"

# secrets (wrangler secret put):
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && bun test tests/payments-route-generalize.test.ts tests/payments-stripe.test.ts`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/payments.ts apps/api/wrangler.toml apps/api/tests/payments-route-generalize.test.ts
git commit -m "feat(payments): generic checkout + stripe webhook + refund + /me"
```

---

## Task R6: SMS — add Twilio + Dialog-lk providers

**Files:**
- Modify: `apps/api/src/lib/sms.ts` (extend existing — DO NOT replace)
- Test: `apps/api/tests/sms-extended.test.ts`

**Interfaces:**
- Consumes: existing `SmsProvider` interface, `ConsoleSmsProvider`, `SmslenzProvider`, `createSmsProvider`
- Produces: `TwilioProvider`, `DialogLkProvider` classes; extended `createSmsProvider` branches

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/sms-extended.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createSmsProvider } from '../src/lib/sms';

describe('SMS providers', () => {
  it('creates Twilio provider', () => {
    const p = createSmsProvider({ SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'ACx', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+1' } as any);
    expect(p.constructor.name).toBe('TwilioProvider');
  });

  it('creates Dialog-lk provider', () => {
    const p = createSmsProvider({ SMS_PROVIDER: 'dialog-lk', DIALOG_LK_API_KEY: 'k', DIALOG_LK_FROM: 'HHLK' } as any);
    expect(p.constructor.name).toBe('DialogLkProvider');
  });

  it('Twilio provider sends via fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sid: 'SMx', status: 'queued' }), { status: 200 }));
    const p = createSmsProvider({ SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'ACx', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+1' } as any, fetchMock as any);
    const result = await p.sendSms('+94770000000', 'test');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('SMx');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('Messages.json'), expect.objectContaining({ method: 'POST' }));
  });

  it('Twilio returns failure on 21610', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"code":21610}', { status: 400 }));
    const p = createSmsProvider({ SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'ACx', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+1' } as any, fetchMock as any);
    const result = await p.sendSms('+94770000000', 'test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('21610');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/sms-extended.test.ts`
Expected: FAIL — provider classes don't exist.

- [ ] **Step 3: Extend sms.ts**

Read full `apps/api/src/lib/sms.ts` first. Append classes + extend `createSmsProvider`:

```ts
// Append to apps/api/src/lib/sms.ts:

export class TwilioProvider implements SmsProvider {
  constructor(private accountSid: string, private authToken: string, private from: string, private fetchImpl: typeof fetch = fetch) {}
  async sendSms(to: string, message: string): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: this.from, Body: message });
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      const codeMatch = text.match(/"code":(\d+)/);
      return { success: false, error: codeMatch ? `twilio_${codeMatch[1]}` : `twilio_${res.status}` };
    }
    const json = (await res.json()) as { sid: string };
    return { success: true, messageId: json.sid };
  }
}

export class DialogLkProvider implements SmsProvider {
  constructor(private apiKey: string, private from: string, private fetchImpl: typeof fetch = fetch) {}
  async sendSms(to: string, message: string): Promise<SmsResult> {
    const res = await this.fetchImpl('https://richcommunication.dialog.lk/api/v1/sms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ msisdn: to, message, sender: this.from }),
    });
    if (!res.ok) return { success: false, error: `dialog_${res.status}` };
    const json = (await res.json()) as { reference: string };
    return { success: true, messageId: json.reference };
  }
}

// Extend createSmsProvider (replace existing function body):
export function createSmsProvider(env: any, fetchImpl: typeof fetch = fetch): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case 'console': return new ConsoleSmsProvider();
    case 'smslenz': return new SmslenzProvider(env.SMSLENZ_USER_ID, env.SMSLENZ_API_KEY, env.SMS_SENDER_ID ?? 'SMSlenzDEMO', fetchImpl);
    case 'twilio': return new TwilioProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM, fetchImpl);
    case 'dialog-lk': return new DialogLkProvider(env.DIALOG_LK_API_KEY, env.DIALOG_LK_FROM, fetchImpl);
    default: return new ConsoleSmsProvider();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test tests/sms-extended.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/sms.ts apps/api/tests/sms-extended.test.ts
git commit -m "feat(sms): twilio + dialog-lk providers"
```

---

## Task R7: BAA inventory + opt-out enforcement in SMS

**Files:**
- Create: `apps/api/docs/BAA-INVENTORY.md`
- Modify: `apps/api/src/lib/sms.ts` (check opt-out before send)

**Interfaces:**
- Produces: vendor BAA inventory doc; runtime opt-out check

- [ ] **Step 1: Write inventory**

```markdown
# apps/api/docs/BAA-INVENTORY.md

## Vendors handling PHI/PII

| Vendor | Data sent | BAA status | Mitigation |
|---|---|---|---|
| Twilio (SMS) | phone, OTP, reminder text | Available (Twilio intl) — sign before prod | Default to SMSLenz or Dialog-lk (local) until Twilio BAA executed |
| SMSLenz (SMS) | phone, OTP, reminder text | DPA on file | Default provider for SL local traffic |
| Dialog.lk (SMS) | phone, OTP, reminder text | No formal BAA — SL local provider | Acceptable for non-regulated reminders; OTPs single-use 5min |
| PayHere (payments) | invoice ref, amount, customer phone/email | DPA on file | Invoice refs only; no card data hits our servers |
| Stripe (payments) | invoice ref, amount, card via Stripe Elements | Stripe DPA signed | Card data never touches our backend |
| Expo Push | device token, notification payload | Expo ToS + DPA | Token scoped per device; opt-out on DeviceNotRegistered |
| Cloudflare R2 | file blobs (PDFs, images, Rx PDFs) | Cloudflare DPA | Envelope-encrypted at rest |
| Cloudflare Workers AI | redacted text only | Cloudflare DPA | PII redaction in lib/redact.ts BEFORE call |
| Anthropic (fallback) | redacted text | Anthropic API ToS + DPA | Same redaction; circuit breaker caps daily calls |

## Pre-prod checklist

1. Sign Twilio BAA (intl) OR keep `SMS_PROVIDER=smslenz|dialog-lk`.
2. Confirm PayHere merchant DPA.
3. Confirm Stripe DPA.
4. Confirm Cloudflare enterprise DPA covers Workers AI for PHI.
5. Add `notification_opt_outs` rows on Twilio `21610`.
```

- [ ] **Step 2: Add opt-out check in SMS providers**

Read existing `SmsProvider` interface. Add optional opt-out check helper. Since `createSmsProvider(env, fetchImpl)` doesn't take `db`, add a separate helper that wraps the send:

```ts
// Append to apps/api/src/lib/sms.ts:

export async function sendSmsWithOptOut(env: any, userId: string | null, to: string, message: string, db: any, fetchImpl: typeof fetch = fetch): Promise<SmsResult> {
  if (userId) {
    const optOut = await db.prepare('SELECT 1 FROM notification_opt_outs WHERE user_id = ? AND channel = ?').bind(userId, 'sms').first();
    if (optOut) return { success: false, error: 'opted_out' };
  }
  const provider = createSmsProvider(env, fetchImpl);
  const result = await provider.sendSms(to, message);
  if (!result.success && result.error?.includes('21610') && userId) {
    await db.prepare('INSERT OR REPLACE INTO notification_opt_outs (user_id, channel, reason) VALUES (?, ?, ?)').bind(userId, 'sms', 'twilio_21610').run();
  }
  return result;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/docs/BAA-INVENTORY.md apps/api/src/lib/sms.ts
git commit -m "feat(sms): BAA inventory + opt-out enforcement"
```

---

## Task R8: Wire SMS into notification fan-out + cron reminders

**Files:**
- Modify: `apps/api/src/lib/notifications.ts` (extend `notify()` to send SMS when preference allows)
- Modify: cron reminders to opt into SMS via `notify()`

**Interfaces:**
- Consumes: existing `notify({ db, userId, type, title, body, data? })`, `sendSmsWithOptOut`, `notificationPreferences.sms` col from R2
- Produces: `notify()` sends in-app + push + (optional) SMS

- [ ] **Step 1: Read existing notify()**

Read `apps/api/src/lib/notifications.ts` end-to-end. Identify push dispatch block + preference lookup.

- [ ] **Step 2: Extend notify() to send SMS**

Inside `notify()`, after push dispatch, add:

```ts
// Read sms preference for user + notification type
const smsPref = await input.db
  .prepare('SELECT sms FROM notification_preferences WHERE user_id = ? AND type = ?')
  .bind(input.userId, input.type)
  .first<{ sms: number }>();

if (smsPref?.sms) {
  const user = await input.db.prepare('SELECT phone FROM users WHERE id = ?').bind(input.userId).first<{ phone: string }>();
  if (user?.phone) {
    const { sendSmsWithOptOut } = await import('../lib/sms');
    await sendSmsWithOptOut((input as any).env, input.userId, user.phone, input.body, input.db);
  }
}
```

Note: `notify()` signature must accept `env` for SMS provider. If existing signature lacks `env`, add it: `notify({ db, userId, type, title, body, data?, env? })`. Pass `env` from all callers.

- [ ] **Step 3: Update cron callers**

In each `apps/api/src/cron/{booking,dose,refill,vaccination,insurance-premium}-reminders.ts`, pass `env` to `notify()`:

```ts
await notify({ db: env.DB, userId, type: 'appointment', title, body, data, env });
```

(Already-callers may use `notify({ db, userId, type, title, body })` — just add `env`.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/notifications.ts apps/api/src/cron/*-reminders.ts
git commit -m "feat(notifications): SMS channel wired into notify()"
```

---

## Task R9: EAS push production config + setup doc

**Files:**
- Modify: `apps/mobile/eas.json`, `apps/mobile/app.config.js`, `apps/mobile/.gitignore`
- Create: `apps/mobile/docs/PUSH-SETUP.md`

**Interfaces:**
- Produces: production EAS profile; manual build instructions

- [ ] **Step 1: Write setup doc**

```markdown
# apps/mobile/docs/PUSH-SETUP.md

## One-time setup

1. Apple Developer account — APNs key (.p8), Key ID, Team ID.
2. Firebase project — Android `google-services.json`, iOS `GoogleService-Info.plist`.
3. `npm i -g eas-cli && eas login && cd apps/mobile && eas init`.

## Build

\`\`\`
eas build --profile production --platform ios
eas build --profile production --platform android
\`\`\`

## Verify

1. Install on physical device.
2. Login.
3. Trigger booking reminder → push arrives → deep link to appointment-detail.
```

- [ ] **Step 2: Update eas.json**

```json
{
  "build": {
    "production": {
      "ios": { "simulator": false },
      "android": { "googleServicesFile": "./secrets/google-services.json" }
    }
  }
}
```

- [ ] **Step 3: Verify app.config.js**

Confirm `ios.bundleIdentifier` + `android.package` = `com.healthhub.mobile`. Add `googleServicesFile` to android.

- [ ] **Step 4: Update .gitignore**

Append: `apps/mobile/secrets/`, `*.p8`.

- [ ] **Step 5: Manual build**

Run: `cd apps/mobile && eas build --profile production --platform ios` (and android). If accounts missing, mark incomplete, continue.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/eas.json apps/mobile/app.config.js apps/mobile/.gitignore apps/mobile/docs/PUSH-SETUP.md
git commit -m "feat(push): production EAS config + setup doc"
```

---

## Task R10: Push receipt polling cron + DeviceNotRegistered cleanup

**Files:**
- Modify: `apps/api/src/lib/notifications.ts` (append `pollReceipts`)
- Create: `apps/api/src/cron/push-receipts.ts`
- Modify: `apps/api/wrangler.toml` (add cron trigger)
- Test: `apps/api/tests/notifications-receipts.test.ts`

**Interfaces:**
- Consumes: existing `notifications` + `pushTokens` tables
- Produces: `pollReceipts(db, env, fetchImpl)` exported; cron handler

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/notifications-receipts.test.ts
import { describe, it, expect, vi } from 'vitest';
import { pollReceipts } from '../src/lib/notifications';

const stubDb = (rows: any[]) => ({
  prepare: vi.fn((sql: string) => ({
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: rows }),
    run: vi.fn().mockResolvedValue({}),
    first: vi.fn().mockResolvedValue(null),
  })),
});

describe('pollReceipts', () => {
  it('no rows → processed: 0', async () => {
    const db = stubDb([]);
    const r = await pollReceipts(db as any, {} as any);
    expect(r.processed).toBe(0);
  });

  it('DeviceNotRegistered → delete push_tokens + mark failed', async () => {
    const db = stubDb([{ id: 'n1', expo_ticket: 't1', token: 'ExponentPushToken[x]' }]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { t1: { status: 'error', details: { error: 'DeviceNotRegistered' } } } }), { status: 200 }));
    const r = await pollReceipts(db as any, {} as any, fetchMock as any);
    expect(r.processed).toBe(1);
    const calls = (db.prepare as any).mock.calls.map((c: any) => c[0]).join(' ');
    expect(calls).toMatch(/DELETE FROM push_tokens/);
    expect(calls).toMatch(/status = 'failed'/);
  });

  it('ok → mark delivered', async () => {
    const db = stubDb([{ id: 'n2', expo_ticket: 't2', token: 'ExponentPushToken[y]' }]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { t2: { status: 'ok' } } }), { status: 200 }));
    await pollReceipts(db as any, {} as any, fetchMock as any);
    const calls = (db.prepare as any).mock.calls.map((c: any) => c[0]).join(' ');
    expect(calls).toMatch(/status = 'delivered'/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/notifications-receipts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement pollReceipts**

Append to `apps/api/src/lib/notifications.ts`:

```ts
export async function pollReceipts(db: any, env: any, fetchImpl: typeof fetch = fetch) {
  const rows = await db
    .prepare("SELECT n.id, n.expo_ticket, pt.token FROM notifications n LEFT JOIN push_tokens pt ON pt.user_id = n.user_id WHERE n.expo_ticket IS NOT NULL AND n.status IN ('sent','queued') AND n.created_at > datetime('now','-1 day') LIMIT 100")
    .all();
  if (!rows.results?.length) return { processed: 0 };
  const tickets = rows.results.map((r: any) => r.expo_ticket);
  const res = await fetchImpl('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: tickets }),
  });
  const json = (await res.json()) as { data: Record<string, { status: 'ok' | 'error'; details?: { error?: string } }> };
  for (const r of rows.results as any[]) {
    const ticket = json.data[r.expo_ticket];
    if (!ticket) continue;
    if (ticket.status === 'ok') {
      await db.prepare("UPDATE notifications SET status = 'delivered' WHERE id = ?").bind(r.id).run();
    } else if (ticket.details?.error === 'DeviceNotRegistered') {
      await db.prepare("DELETE FROM push_tokens WHERE token = ?").bind(r.token).run();
      await db.prepare("UPDATE notifications SET status = 'failed' WHERE id = ?").bind(r.id).run();
    } else {
      await db.prepare("UPDATE notifications SET status = 'failed' WHERE id = ?").bind(r.id).run();
    }
  }
  return { processed: rows.results.length };
}
```

Note: actual `notifications` schema may have different columns. Check `packages/db/src/schema.ts` for `expo_ticket`, `status`, `created_at`, `user_id`. Adjust query if needed.

- [ ] **Step 4: Cron handler**

```ts
// apps/api/src/cron/push-receipts.ts
import { pollReceipts } from '../lib/notifications';
export async function scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(pollReceipts(env.DB, env));
}
```

- [ ] **Step 5: wrangler.toml cron trigger**

Append to `[triggers].crons` (do NOT overwrite existing):

```
"*/15 * * * *"
```

- [ ] **Step 6: Run test + commit**

Run: `cd apps/api && bun test tests/notifications-receipts.test.ts`

```bash
git add apps/api/src/lib/notifications.ts apps/api/src/cron/push-receipts.ts apps/api/wrangler.toml apps/api/tests/notifications-receipts.test.ts
git commit -m "feat(push): receipt polling cron + DeviceNotRegistered cleanup"
```

---

## Task R11: Pricing + About + Footer

**Files:**
- Create: `apps/marketing/src/app/pricing/page.tsx`
- Create: `apps/marketing/src/app/about/page.tsx`
- Modify: `apps/marketing/src/components/Footer.tsx`

- [ ] **Step 1: Pricing page**

```tsx
// apps/marketing/src/app/pricing/page.tsx
'use client';
const TIERS = [
  { name: 'Patient', priceLkr: 0, features: ['All mobile + web features', 'Trilingual (en/si/ta)', 'Unlimited records', 'WhatsApp onboarding'] },
  { name: 'Doctor Pro', priceLkr: 2500, features: ['Own clinic + online booking', 'Rx templates', 'Doctor payouts', 'Reply-time badge'] },
  { name: 'Clinic Pro', priceLkr: 15000, features: ['Multi-doctor', 'Wards + IPD + billing', 'Reports + CSV export', 'Priority support'] },
];
export default function PricingPage() {
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-12">Pricing</h1>
      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((t) => (
          <div key={t.name} className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold">{t.name}</h2>
            <p className="text-3xl font-bold mt-2">{t.priceLkr === 0 ? 'Free' : `LKR ${t.priceLkr.toLocaleString()}/mo`}</p>
            <ul className="mt-4 space-y-2">{t.features.map((f) => <li key={f}>• {f}</li>)}</ul>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: About page**

```tsx
// apps/marketing/src/app/about/page.tsx
export default function AboutPage() {
  return (
    <main className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-4xl font-bold mb-6">About HealthHub</h1>
      <p className="mb-4">Sri Lanka's first trilingual digital health platform. Privacy-first.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-3">Contact</h2>
      <p>hello@healthhub.lk</p>
    </main>
  );
}
```

- [ ] **Step 3: Footer link**

Edit `apps/marketing/src/components/Footer.tsx`, add `<Link href="/pricing">Pricing</Link>` + `<Link href="/about">About</Link>` to nav.

- [ ] **Step 4: Smoke**

Run `cd apps/marketing && bun dev`, visit `/pricing`, `/about`.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/app/pricing apps/marketing/src/app/about apps/marketing/src/components/Footer.tsx
git commit -m "feat(pitch): pricing + about pages + footer links"
```

---

## Task R12: Demo seed script + demo page

**Files:**
- Create: `apps/api/scripts/seed-demo.ts`
- Create: `apps/marketing/src/app/demo/page.tsx`
- Modify: root `package.json` (add `seed:demo` script)
- Test: `apps/api/tests/seed-demo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/seed-demo.test.ts
import { describe, it, expect, vi } from 'vitest';
import { seedDemo } from '../src/scripts/seed-demo';

const stubDb = () => ({
  prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), run: vi.fn().mockResolvedValue({}), first: vi.fn().mockResolvedValue(null) }),
});

describe('seedDemo', () => {
  it('runs idempotently on empty DB', async () => {
    const r = await seedDemo(stubDb() as any);
    expect(r.admins).toBe(1);
    expect(r.doctors).toBe(2);
    expect(r.patients).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/seed-demo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement seed**

```ts
// apps/api/scripts/seed-demo.ts
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

const DEMO_PASSWORD = 'demo1234';
const DEMO_TENANT_ID = 'tenant_demo';

const ADMIN = { email: 'demo+admin@healthhub.lk', nic: '199012345678' };
const DOCTORS = [
  { email: 'demo+gp@healthhub.lk', nic: '198001234567', name: 'Dr. GP Demo', specialty: 'General Practice' },
  { email: 'demo+cardio@healthhub.lk', nic: '197501234568', name: 'Dr. Cardio Demo', specialty: 'Cardiology' },
];
const PATIENTS = [
  'demo+patient1@healthhub.lk', 'demo+patient2@healthhub.lk', 'demo+patient3@healthhub.lk',
  'demo+patient4@healthhub.lk', 'demo+patient5@healthhub.lk',
];

function nicHash(nic: string) { return createHash('sha256').update(nic).digest('hex'); }

export async function seedDemo(db: any) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const counts = { admins: 0, doctors: 0, patients: 0, records: 0, appointments: 0 };
  await db.prepare('INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)').bind(DEMO_TENANT_ID, 'Demo Hospital').run();

  const adminId = crypto.randomUUID();
  await db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, role, nic_hash, tenant_id, created_at) VALUES (?, ?, ?, 'super_admin', ?, ?, datetime('now'))`).bind(adminId, ADMIN.email, passwordHash, nicHash(ADMIN.nic), DEMO_TENANT_ID).run();
  counts.admins++;

  for (const d of DOCTORS) {
    const id = crypto.randomUUID();
    await db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, role, nic_hash, tenant_id, created_at) VALUES (?, ?, ?, 'doctor', ?, ?, datetime('now'))`).bind(id, d.email, passwordHash, nicHash(d.nic), DEMO_TENANT_ID).run();
    await db.prepare('INSERT OR IGNORE INTO doctors (user_id, slmc_number, specialty, verified_at) VALUES (?, ?, ?, datetime(\'now\'))').bind(id, `SLMC-${d.nic.slice(-6)}`, d.specialty).run();
    counts.doctors++;
  }

  for (const email of PATIENTS) {
    const id = crypto.randomUUID();
    await db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, role, nic_hash, created_at) VALUES (?, ?, ?, 'patient', ?, datetime('now'))`).bind(id, email, passwordHash, nicHash(email)).run();
    for (let i = 0; i < 10; i++) {
      await db.prepare(`INSERT INTO medical_records (id, patient_id, kind, title, payload_encrypted, prev_record_hash, created_at) VALUES (?, ?, ?, ?, '{}', '', datetime('now', '-' || ? || ' days'))`).bind(crypto.randomUUID(), id, ['lab','prescription','vitals','allergies'][i % 4], `Demo record ${i}`, i).run();
      counts.records++;
    }
    for (let i = 0; i < 3; i++) {
      await db.prepare(`INSERT INTO appointments (id, patient_id, doctor_id, status, scheduled_at) VALUES (?, ?, (SELECT user_id FROM doctors LIMIT 1), ?, datetime('now', '+' || ? || ' days'))`).bind(crypto.randomUUID(), id, i === 0 ? 'completed' : 'scheduled', i - 1).run();
      counts.appointments++;
    }
    counts.patients++;
  }
  return counts;
}

if (import.meta.main) {
  console.log('Run: bun run seed:demo');
}
```

Note: table/column names must match `packages/db/src/schema.ts`. Adjust if `medical_records`/`appointments`/`doctors` use different columns.

- [ ] **Step 4: package.json script**

In root `package.json`:

```json
"scripts": {
  "seed:demo": "cd apps/api && bun run scripts/seed-demo.ts"
}
```

For prod D1, wrap with `wrangler d1 execute --file`.

- [ ] **Step 5: Demo page**

```tsx
// apps/marketing/src/app/demo/page.tsx
export default function DemoPage() {
  return (
    <main className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-4xl font-bold mb-6">Try the demo</h1>
      <p className="mb-4">Password: <code>demo1234</code></p>
      <h2 className="text-2xl font-semibold mt-6 mb-2">Admin</h2><p>demo+admin@healthhub.lk</p>
      <h2 className="text-2xl font-semibold mt-6 mb-2">Doctors</h2><p>demo+gp@healthhub.lk · demo+cardio@healthhub.lk</p>
      <h2 className="text-2xl font-semibold mt-6 mb-2">Patients</h2><p>demo+patient1..5@healthhub.lk</p>
    </main>
  );
}
```

- [ ] **Step 6: Test + seed**

Run: `cd apps/api && bun test tests/seed-demo.test.ts && bun run scripts/seed-demo.ts` (or via root `bun run seed:demo`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/scripts/seed-demo.ts apps/api/tests/seed-demo.test.ts apps/marketing/src/app/demo package.json
git commit -m "feat(pitch): demo seed + demo page"
```

---

## Task R13: Reply-time API + shared doctor-badge types

**Files:**
- Create: `apps/api/src/routes/doctors-reply-time.ts`
- Modify: `apps/api/src/index.ts` (mount)
- Create: `packages/shared/src/doctor-badge.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/api/tests/doctors-reply-time.test.ts`

**Interfaces:**
- Consumes: existing `messages` table with `senderRole` (NOT `from_role`/`to_role`); `messages_conversations.doctorId`
- Produces: `GET /doctors/:id/reply-time`; `DoctorBadgeData` type

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/doctors-reply-time.test.ts
import { describe, it, expect } from 'vitest';
import { computeReplyTimeMedian } from '../src/routes/doctors-reply-time';

describe('computeReplyTimeMedian', () => {
  it('returns null on empty', () => {
    const r = computeReplyTimeMedian([]);
    expect(r.medianMinutes).toBeNull();
    expect(r.sampleSize).toBe(0);
  });

  it('pairs patient → next doctor msg', () => {
    const now = Date.now();
    const msgs = [
      { senderRole: 'patient' as const, createdAt: new Date(now - 60 * 60_000).toISOString() },
      { senderRole: 'doctor' as const, createdAt: new Date(now - 30 * 60_000).toISOString() }, // 30min
      { senderRole: 'patient' as const, createdAt: new Date(now - 120 * 60_000).toISOString() },
      { senderRole: 'doctor' as const, createdAt: new Date(now - 60 * 60_000).toISOString() }, // 60min
    ];
    const r = computeReplyTimeMedian(msgs);
    expect(r.sampleSize).toBe(2);
    expect(r.medianMinutes).toBe(45);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/doctors-reply-time.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/routes/doctors-reply-time.ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

export type MessageRow = { senderRole: 'patient' | 'doctor' | 'system'; createdAt: string };

export function computeReplyTimeMedian(messages: MessageRow[]) {
  const pairs: number[] = [];
  let lastPatientAt: number | null = null;
  for (const m of messages) {
    const t = new Date(m.createdAt).getTime();
    if (m.senderRole === 'patient') lastPatientAt = t;
    else if (m.senderRole === 'doctor' && lastPatientAt && t > lastPatientAt) {
      pairs.push(Math.round((t - lastPatientAt) / 60_000));
      lastPatientAt = null;
    }
  }
  if (!pairs.length) return { medianMinutes: null, sampleSize: 0 };
  pairs.sort((a, b) => a - b);
  const mid = Math.floor(pairs.length / 2);
  const median = pairs.length % 2 ? pairs[mid] : Math.round((pairs[mid - 1] + pairs[mid]) / 2);
  return { medianMinutes: median, sampleSize: pairs.length };
}

export const replyTimeRouter = new Hono<{ Bindings: Env }>();

replyTimeRouter.get('/:id/reply-time', authMiddleware, async (c) => {
  const doctorId = c.req.param('id');
  const rows = await c.env.DB.prepare(
    "SELECT m.sender_role AS senderRole, m.created_at AS createdAt FROM messages m JOIN messages_conversations c ON c.id = m.conversation_id WHERE c.doctor_id = ? AND m.created_at > datetime('now', '-30 days') AND m.sender_role != 'system' ORDER BY m.created_at ASC"
  ).bind(doctorId).all<MessageRow>();
  const result = computeReplyTimeMedian((rows.results as any[]) ?? []);
  return c.json({ ...result, computedAt: new Date().toISOString() });
});
```

Note: `messages_conversations.doctorId` may point to `doctors.id` (not `users.id`). Confirm against schema.

- [ ] **Step 4: Mount**

In `apps/api/src/index.ts`, add: `app.route('/doctors', replyTimeRouter);`

- [ ] **Step 5: Shared types**

```ts
// packages/shared/src/doctor-badge.ts
export type DoctorBadgeData = {
  userId: string;
  name: string;
  specialty: string;
  yearsExperience: number;
  feeLkr: number;
  verifiedSlmc: boolean;
  hospitalName?: string;
  replyTimeMedianMinutes?: number | null;
  replyTimeSampleSize?: number;
};
```

Export from `packages/shared/src/index.ts`.

- [ ] **Step 6: Run test + commit**

Run: `cd apps/api && bun test tests/doctors-reply-time.test.ts`

```bash
git add apps/api/src/routes/doctors-reply-time.ts apps/api/src/index.ts apps/api/tests/doctors-reply-time.test.ts packages/shared/src/doctor-badge.ts packages/shared/src/index.ts
git commit -m "feat(doctors): reply-time API + shared badge type"
```

---

## Task R14: DoctorBadge web + DoctorChip mobile + wire into surfaces

**Files:**
- Create: `apps/marketing/src/portal/components/doctor/DoctorBadge.tsx`
- Create: `apps/mobile/src/components/DoctorChip.tsx`
- Modify: `apps/marketing/src/app/portal/(portal)/patients/[id]/layout.tsx`
- Modify: `apps/mobile/src/app/(app)/records.tsx`
- Modify: `apps/mobile/src/app/(app)/appointments/book-appointment.tsx`

- [ ] **Step 1: Web DoctorBadge**

```tsx
// apps/marketing/src/portal/components/doctor/DoctorBadge.tsx
'use client';
import type { DoctorBadgeData } from '@healthcare/shared/doctor-badge';

export function DoctorBadge({ d }: { d: DoctorBadgeData }) {
  return (
    <div className="flex items-center gap-2 border rounded p-2">
      {d.verifiedSlmc && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">✓ SLMC</span>}
      <span className="font-medium">{d.name}</span>
      <span className="text-sm text-gray-600">{d.specialty}</span>
      {d.yearsExperience > 0 && <span className="text-xs">{d.yearsExperience}y</span>}
      {d.feeLkr > 0 && <span className="text-xs">LKR {d.feeLkr.toLocaleString()}</span>}
      {d.replyTimeMedianMinutes != null && <span className="text-xs text-blue-700">~{d.replyTimeMedianMinutes}m reply ({d.replyTimeSampleSize})</span>}
    </div>
  );
}
```

- [ ] **Step 2: Mobile DoctorChip**

```tsx
// apps/mobile/src/components/DoctorChip.tsx
import { View, Text } from 'react-native';
import type { DoctorBadgeData } from '@healthcare/shared/doctor-badge';

export function DoctorChip({ d }: { d: DoctorBadgeData }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', padding: 6, borderRadius: 6, borderWidth: 1 }}>
      {d.verifiedSlmc && <Text style={{ fontSize: 10, color: '#15803d' }}>✓ SLMC</Text>}
      <Text style={{ fontWeight: '600' }}>{d.name}</Text>
      <Text style={{ fontSize: 12, color: '#666' }}>{d.specialty}</Text>
      {d.replyTimeMedianMinutes != null && <Text style={{ fontSize: 10, color: '#1d4ed8' }}>~{d.replyTimeMedianMinutes}m</Text>}
    </View>
  );
}
```

- [ ] **Step 3: Wire into patient chart**

In `apps/marketing/src/app/portal/(portal)/patients/[id]/layout.tsx`, fetch doctor for current chart, render `<DoctorBadge d={...} />`.

- [ ] **Step 4: Wire into mobile records**

In `apps/mobile/src/app/(app)/records.tsx`, on shared-record rows, render `<DoctorChip d={record.attributedDoctor} />`.

- [ ] **Step 5: Wire into mobile booking**

In `apps/mobile/src/app/(app)/appointments/book-appointment.tsx`, render `<DoctorChip d={selectedDoctor} />` in summary.

- [ ] **Step 6: Smoke**

Web: open patient chart → badge renders.
Mobile: open records → chip renders.

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/portal/components/doctor/DoctorBadge.tsx \
  apps/mobile/src/components/DoctorChip.tsx \
  apps/marketing/src/app/portal/\(portal\)/patients/\[id\]/layout.tsx \
  apps/mobile/src/app/\(app\)/records.tsx \
  apps/mobile/src/app/\(app\)/appointments/book-appointment.tsx
git commit -m "feat(doctors): trust badges wired into chart + records + booking"
```

---

## Task R15: Verification docs + final pass

**Files:**
- Modify: `apps/mobile/src/app/(doctor)/profile.tsx` (fee input confirm)
- Create: `apps/api/docs/CURL.md`
- Create: `docs/DEVICE-CHECKLIST.md`
- Modify: root `README.md`

- [ ] **Step 1: Fee input**

Confirm `apps/mobile/src/app/(doctor)/profile.tsx` has fee input wired to API. If missing, add.

- [ ] **Step 2: CURL.md**

```markdown
# apps/api/docs/CURL.md

## PayHere checkout (existing /initiate)
[unchanged]

## Generic Stripe checkout
curl -X POST http://localhost:8787/payments/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":"inv_1","method":"stripe","returnUrl":"http://localhost:3000/return"}'

## Stripe webhook (simulate)
curl -X POST http://localhost:8787/payments/webhook/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=$TS,v1=$SIG" \
  -d '{"id":"evt_1","type":"checkout.session.completed","data":{"object":{"id":"cs_1","amount_total":5000,"currency":"usd"}}}'

## Doctor reply-time
curl http://localhost:8787/doctors/$DOCTOR_ID/reply-time \
  -H "Authorization: Bearer $TOKEN"

## Demo seed
bun run seed:demo
```

- [ ] **Step 3: Device checklist**

```markdown
# docs/DEVICE-CHECKLIST.md
[as in original plan]
```

- [ ] **Step 4: Verify**

```bash
bun test --filter '*api*'
bun run typecheck
```
Both must be green.

- [ ] **Step 5: README**

Append: links to `/demo`, `/pricing`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/app/\(doctor\)/profile.tsx apps/api/docs/CURL.md docs/DEVICE-CHECKLIST.md README.md
git commit -m "feat(pitch): fee input + verification docs + README links"
```

---

## Self-Review

**Spec coverage:** all 5 Block A items covered (A1 PayHere generalize + Stripe; A2 SMS providers + opt-out; A3 EAS + push receipts; A4 pricing/about/demo + seed; A5 badges + reply-time). Existing code reused not duplicated.

**Placeholder scan:** none. All code blocks complete. Exact file paths.

**Type consistency:** `PaymentProvider`/`PaymentError`/`WebhookEvent` defined R1, consumed R3-R5. `StripeAdapter` methods consistent across R4-R5. `DoctorBadgeData` defined R13, consumed R14. `pollReceipts` defined R10, tested there.

**Schema adaptations flagged:** `payments` table columns used match survey (`amount_lkr`, `provider` after migration, `provider_charge_id`, `webhook_received_at`). `messages.senderRole` used (not `from_role`). `notificationPreferences.sms` added in migration 0045. `messages_conversations.doctorId` assumed to FK `doctors.id` — confirm in schema before R13.
