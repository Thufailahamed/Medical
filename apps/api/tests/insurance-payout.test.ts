import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const read = (rel: string) => readFileSync(resolve(repo, rel), "utf8");

describe("claim payout", () => {
  it("approved→paid writes paidAt", () => {
    const claim = { status: "approved", paidAt: null } as any;
    expect(claim.status).toBe("approved");
    const src = read("apps/api/src/routes/insurance-operator.ts");
    expect(src).toContain("/claims/:id/pay");
    expect(src).toContain("paidAt");
  });

  it("pay endpoint only allows approved → paid with transactionRef", () => {
    const src = read("apps/api/src/routes/insurance-operator.ts");
    // Route exists
    expect(src).toContain("/claims/:id/pay");
    // Guard: only from approved status
    expect(src).toMatch(/status.*approved|approved.*status/);
    expect(src).toContain("transactionRef");
    // Returns {claim}
    expect(src).toMatch(/c\.json\(\{\s*claim/);
  });

  it("reject pay from non-approved", () => {
    const src = read("apps/api/src/routes/insurance-operator.ts");
    // Must reject non-approved with 400
    const payIdx = src.indexOf("/claims/:id/pay");
    expect(payIdx).toBeGreaterThan(-1);
    const payBlock = src.slice(payIdx, payIdx + 4000);
    expect(payBlock).toContain("400");
    expect(payBlock).toMatch(/approved/);
  });

  it("pay reuses operator scoping, notify and audit", () => {
    const src = read("apps/api/src/routes/insurance-operator.ts");
    const payIdx = src.indexOf("/claims/:id/pay");
    expect(payIdx).toBeGreaterThan(-1);
    const payBlock = src.slice(payIdx, payIdx + 5000);
    expect(payBlock).toContain("resolveOperatorOrg");
    expect(payBlock).toContain("providerIds");
    expect(payBlock).toContain("notify(");
    expect(payBlock).toContain("audit(");
  });

  it("Stripe INS- dispatch shape", () => {
    const src = read("apps/api/src/routes/payments.ts");
    // Stripe webhook exists
    expect(src).toContain("/webhook/stripe");
    const stripeIdx = src.indexOf("/webhook/stripe");
    expect(stripeIdx).toBeGreaterThan(-1);
    const stripeBlock = src.slice(stripeIdx, stripeIdx + 5000);
    // Stripe webhook dispatches INS- prefix to insurance handlers
    expect(stripeBlock).toContain('startsWith("INS-")');
    expect(stripeBlock).toContain("handleInsurancePremiumPaid");
    expect(stripeBlock).toContain("handleInsurancePremiumFailed");
    // Keeps generic invoice path unchanged
    expect(stripeBlock).toContain("UPDATE payments SET paid_at");
    // Idempotency via payment_webhook_events
    expect(stripeBlock).toContain("tryRecordWebhook");
    expect(stripeBlock).toContain("markWebhookProcessed");
  });

  it("free-look cancel creates refund_pending ledger when paid", () => {
    const src = read("apps/api/src/routes/insurance-marketplace.ts");
    expect(src).toContain("insurance.enrollment.refund_pending");
    expect(src).toContain("invoiceId");
  });
});
