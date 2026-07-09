// tests/logger.test.ts
//
// Verifies that the logger scrubs PII (NIC, phone, email) before
// forwarding to console.*. Logs are a privacy surface — a leaked
// OTP or NIC in stdout is the kind of thing that ends up in a
// regulator's incident report.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../src/lib/logger";

describe("logger PII redaction", () => {
  beforeEach(() => {
    // Force every level through.
    (globalThis as any).__LOG_LEVEL__ = "debug";
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).__LOG_LEVEL__ = undefined;
  });

  it("redacts SL NIC (old format 9+V) from message", () => {
    logger.info("auth.otp", "OTP code sent to 901234567V");
    const out = (console.info as any).mock.calls[0][0] as string;
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("901234567V");
  });

  it("redacts SL NIC (new format 12 digits) from message", () => {
    logger.info("auth.otp", "User 200012345678 verified");
    const out = (console.info as any).mock.calls[0][0] as string;
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("200012345678");
  });

  it("redacts SL phone number from message", () => {
    logger.info("sms.send", "Sent to +94771234567 successfully");
    const out = (console.info as any).mock.calls[0][0] as string;
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("+94771234567");
  });

  it("redacts email from message", () => {
    logger.info("auth.otp", "OTP sent to john.doe@example.com");
    const out = (console.info as any).mock.calls[0][0] as string;
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("john.doe@example.com");
  });

  it("redacts PII inside meta object recursively", () => {
    logger.info("payments.notify", "notify received", {
      orderId: "HH12345",
      patient: { name: "Jane Doe", phone: "+94771234567" },
      list: [{ nic: "901234567V" }],
    });
    const out = (console.info as any).mock.calls[0][0] as string;
    expect(out).not.toContain("+94771234567");
    expect(out).not.toContain("901234567V");
    // non-PII fields preserved
    expect(out).toContain("HH12345");
  });

  it("preserves non-PII content untouched", () => {
    logger.info("cron.tick", "booking-reminders ran 3 jobs");
    const out = (console.info as any).mock.calls[0][0] as string;
    expect(out).toBe("[info] [cron.tick] booking-reminders ran 3 jobs");
  });

  it("survives circular references in meta without throwing", () => {
    const a: any = { x: 1 };
    a.self = a;
    expect(() => logger.error("test", "circular", a)).not.toThrow();
    const out = (console.error as any).mock.calls[0][0] as string;
    expect(out).toContain("circular");
  });

  it("respects minimum log level — debug dropped at info", () => {
    (globalThis as any).__LOG_LEVEL__ = "info";
    logger.debug("test", "should be dropped");
    expect(console.debug).not.toHaveBeenCalled();
    logger.error("test", "should pass");
    expect(console.error).toHaveBeenCalled();
  });
});