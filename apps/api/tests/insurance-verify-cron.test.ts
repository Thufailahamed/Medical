import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const read = (rel: string) => readFileSync(resolve(repo, rel), "utf8");

function sliceBlock(src: string, marker: string, len = 6000) {
  const idx = src.indexOf(marker);
  if (idx === -1) return "";
  return src.slice(idx, idx + len);
}

function verifyBlock(src: string) {
  const marker = "/ecards/verify";
  const idx = src.indexOf(marker);
  if (idx === -1) return "";
  // Isolate to this route: cut at next route registration after the marker.
  const after = src.slice(idx + marker.length);
  const nextGet = after.search(/marketplaceRouter\.(get|post|put|delete)\(/);
  const end = nextGet === -1 ? after.length : nextGet;
  // Include a bit before marker for the handler signature (public check needs
  // the `marketplaceRouter.get("/ecards/verify", ...)` call itself).
  const start = Math.max(0, idx - 500);
  return src.slice(start, idx + marker.length + end);
}

describe("ecard verify", () => {
  it("exposes public GET /ecards/verify?token=", () => {
    const src = read("apps/api/src/routes/insurance-marketplace.ts");
    expect(src).toContain("/ecards/verify");
    // Must read token query param
    const block = sliceBlock(src, "/ecards/verify", 6000);
    expect(block).toMatch(/token/);
    expect(block).toContain("qrToken");
  });

  it("verify is public for hospital scan (no auth), with rate-limit note", () => {
    const src = read("apps/api/src/routes/insurance-marketplace.ts");
    const block = verifyBlock(src);
    expect(block.length).toBeGreaterThan(0);
    // Public: verify route registration must NOT include patient auth.
    // Hono signature: marketplaceRouter.get("/ecards/verify", async (c) => ...)
    // i.e. no authMiddleware / requireRole between path and handler.
    expect(block).not.toMatch(/requireRole\("patient"\)/);
    expect(block).not.toContain("authMiddleware");
    // Rate-limit note for public endpoint (comment above route)
    const withComment = src.slice(Math.max(0, src.indexOf("/ecards/verify") - 800), src.indexOf("/ecards/verify") + 800);
    expect(withComment.toLowerCase()).toContain("rate");
  });

  it("verify checks active + validUntil, logs scan via audit, returns valid shape or {valid:false} 404", () => {
    const src = read("apps/api/src/routes/insurance-marketplace.ts");
    const block = sliceBlock(src, "/ecards/verify", 8000);
    expect(block).toContain("active");
    expect(block).toContain("validUntil");
    expect(block).toContain("audit(");
    expect(block).toMatch(/holderName/);
    expect(block).toMatch(/providerName/);
    expect(block).toMatch(/planName/);
    expect(block).toMatch(/policyNumber/);
    expect(block).toMatch(/coverageAmountLkr/);
    expect(block).toMatch(/valid/);
    // Invalid/expired returns {valid:false} with 404
    expect(block).toContain("404");
    expect(block).toMatch(/valid:\s*false/);
  });

  it("passes env to all notify() in insurance marketplace + operator + crons for SMS", () => {
    const mkt = read("apps/api/src/routes/insurance-marketplace.ts");
    const op = read("apps/api/src/routes/insurance-operator.ts");
    const rem = read("apps/api/src/cron/insurance-premium-reminders.ts");
    const grace = read("apps/api/src/cron/insurance-grace-expiry.ts");
    const billing = read("apps/api/src/cron/insurance-billing.ts");
    // lib/notifications SMS branch needs env
    const lib = read("apps/api/src/lib/notifications.ts");
    expect(lib).toMatch(/if\s*\(\s*env\s*&&\s*sms/);

    for (const [name, src] of [
      ["marketplace", mkt],
      ["operator", op],
      ["reminders", rem],
      ["grace", grace],
    ] as const) {
      const matches = [...src.matchAll(/await\s+notify\(\{([\s\S]*?)\}\);/g)];
      expect(matches.length, `${name} should have notify calls`).toBeGreaterThan(0);
      for (const m of matches) {
        expect(m[1], `${name} notify missing env`).toMatch(/env/);
      }
    }
    // Billing must notify after invoice creation (with env)
    expect(billing).toContain("notify(");
    expect(billing).toMatch(/env/);
  });

  it("premium reminders dedup (no double-send same day)", () => {
    const src = read("apps/api/src/cron/insurance-premium-reminders.ts");
    // Must have in-memory guard and/or audit/notifications lookup or remindedAt/attemptCount
    expect(src).toMatch(/notified|remindedAt|attemptCount|auditLogs|notifications/);
    // Must skip if already notified
    expect(src).toMatch(/skip|already|continue|hasReminded|notifiedToday|today/);
    // Must pass env to notify (SMS)
    expect(src).toMatch(/notify\(\{[\s\S]*?env/);
  });

  it("billing keeps per-day idempotency and notifies after invoice creation", () => {
    const src = read("apps/api/src/cron/insurance-billing.ts");
    // Per-day idempotency: checks existing open invoice for same day
    expect(src).toMatch(/dupe|existing|idempotency/i);
    expect(src).toContain("todayIso");
    // Notify after insert
    const insertIdx = src.indexOf(".insert(");
    expect(insertIdx).toBeGreaterThan(-1);
    const afterInsert = src.slice(insertIdx);
    expect(afterInsert).toContain("notify(");
  });

  it("softens marketing copy from licensed broker claims to onboarding-in-progress", () => {
    const src = read("apps/marketing/src/app/insurance/page.tsx");
    expect(src).not.toMatch(/licensed insurance broker/i);
    expect(src).not.toMatch(/Sri Lanka Insurance/);
    expect(src).not.toMatch(/Ceylinco/);
    // Must signal onboarding / partner language instead
    expect(src.toLowerCase()).toMatch(/onboarding|partner|regulated insurer|subject to/);
  });
});
