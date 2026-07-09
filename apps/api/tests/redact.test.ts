// apps/api/tests/redact.test.ts
//
// PII regex coverage for the LLM pre-prompt scrubber. Anything that
// slips past these patterns gets sent to Workers AI verbatim —
// downstream consequences are unbounded (privacy leak to a shared
// inference endpoint).

import { describe, it, expect } from "vitest";

import { redactPii, redactMessages } from "../src/lib/redact";

describe("redactPii — Sri Lankan NIC", () => {
  it("strips old-format NIC (9 digits + V/X)", () => {
    expect(redactPii("Patient NIC: 912345678V")).toBe(
      "Patient NIC: [REDACTED]"
    );
    expect(redactPii("nic=901234567X done")).toBe("nic=[REDACTED] done");
    expect(redactPii("lowercase x: 901234567x")).toBe("lowercase x: [REDACTED]");
  });

  it("strips new-format NIC (12 digits)", () => {
    expect(redactPii("NIC 199123456789 attached")).toBe(
      "NIC [REDACTED] attached"
    );
  });

  it("does not strip 10-digit phone numbers as NICs", () => {
    // 0771234567 — matches the phone regex, not NIC.
    expect(redactPii("Call 0771234567 please")).toBe(
      "Call [REDACTED] please"
    );
  });

  it("does not strip 11-digit numbers (no false NIC match)", () => {
    // 11 digits is between old (9) and new (12) — neither regex matches.
    expect(redactPii("Ref 12345678901 ok")).toBe("Ref 12345678901 ok");
  });
});

describe("redactPii — phone numbers", () => {
  it("strips international SL phones (+94...)", () => {
    expect(redactPii("Call +94771234567 today")).toBe(
      "Call [REDACTED] today"
    );
  });

  it("strips 94-prefix without plus", () => {
    expect(redactPii("Phone 94771234567 ok")).toBe("Phone [REDACTED] ok");
  });

  it("strips domestic 0-prefix SL phones", () => {
    expect(redactPii("Mobile: 0771234567")).toBe("Mobile: [REDACTED]");
    expect(redactPii("Landline 0112345678")).toBe("Landline [REDACTED]");
  });
});

describe("redactPii — email", () => {
  it("strips standard email addresses", () => {
    expect(redactPii("Contact alice@example.com soon")).toBe(
      "Contact [REDACTED] soon"
    );
  });

  it("strips emails with subdomains and plus-tags", () => {
    expect(redactPii("Mail: bob+test@mail.health.lk now")).toBe(
      "Mail: [REDACTED] now"
    );
  });
});

describe("redactPii — pass-through", () => {
  it("leaves clean text unchanged", () => {
    const clean = "BP 120/80, HR 72, no complaints today.";
    expect(redactPii(clean)).toBe(clean);
  });

  it("handles empty input", () => {
    expect(redactPii("")).toBe("");
  });

  it("strips multiple PII in one string", () => {
    const s = "Patient 912345678V / 0771234567 / a@b.co";
    expect(redactPii(s)).toBe("Patient [REDACTED] / [REDACTED] / [REDACTED]");
  });
});

describe("redactMessages", () => {
  it("redacts content but preserves role + structure", () => {
    const out = redactMessages([
      { role: "system", content: "You are a doctor." },
      { role: "user", content: "Patient 912345678V has BP 120." },
    ]);
    expect(out[0].content).toBe("You are a doctor.");
    expect(out[1].content).toBe("Patient [REDACTED] has BP 120.");
    expect(out[1].role).toBe("user");
  });

  it("does not mutate input array", () => {
    const original = [{ role: "user", content: "nic 912345678V" }];
    redactMessages(original);
    expect(original[0].content).toBe("nic 912345678V");
  });
});