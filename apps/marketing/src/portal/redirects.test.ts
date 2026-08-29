import { describe, expect, it } from "vitest";

import { consolidationRedirects } from "../../next.config";

/**
 * The /portal/me/* consolidation moves 17 pages to /patient/* and drops
 * two duplicates. The redirect list is a static helper exported from
 * next.config.ts so this test catches the most common regression —
 * someone deletes a redirect entry — without spinning up a Next server.
 */
const EXPECTED = [
  // 13 insurance paths (root + 12 sub-routes).
  ["/portal/me/insurance", "/patient/insurance"],
  ["/portal/me/insurance/marketplace", "/patient/insurance/marketplace"],
  ["/portal/me/insurance/marketplace/:providerId", "/patient/insurance/marketplace/:providerId"],
  ["/portal/me/insurance/plans/:planId", "/patient/insurance/plans/:planId"],
  ["/portal/me/insurance/quote", "/patient/insurance/quote"],
  ["/portal/me/insurance/enroll/:planId", "/patient/insurance/enroll/:planId"],
  ["/portal/me/insurance/payment/:enrollmentId", "/patient/insurance/payment/:enrollmentId"],
  ["/portal/me/insurance/policy/:id", "/patient/insurance/policy/:id"],
  ["/portal/me/insurance/ecard/:id", "/patient/insurance/ecard/:id"],
  ["/portal/me/insurance/coverage-check", "/patient/insurance/coverage-check"],
  ["/portal/me/insurance/claims", "/patient/insurance/claims"],
  ["/portal/me/insurance/claims/new", "/patient/insurance/claims/new"],
  ["/portal/me/insurance/claims/:id", "/patient/insurance/claims/:id"],
  // share / audit / imaging.
  ["/portal/me/share", "/patient/share"],
  ["/portal/me/audit", "/patient/audit"],
  ["/portal/me/imaging", "/patient/imaging"],
  ["/portal/me/imaging/:studyUid", "/patient/imaging/:studyUid"],
  // Two duplicates redirect to the real pages under /patient.
  ["/portal/me/records", "/patient/records"],
  ["/portal/me/notifications", "/patient/notifications"],
] as const;

describe("consolidationRedirects", () => {
  it.each(EXPECTED)("redirects %s to %s", (source, destination) => {
    const entry = consolidationRedirects().find((r) => r.source === source);
    expect(entry, `no redirect for ${source}`).toBeDefined();
    expect(entry!.destination).toBe(destination);
    expect(entry!.permanent).toBe(true);
  });

  it("returns no duplicate sources", () => {
    const sources = consolidationRedirects().map((r) => r.source);
    expect(new Set(sources).size).toBe(sources.length);
  });
});
