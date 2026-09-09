// @ts-nocheck
//
// Lab Task 1 — contract guards (RED→GREEN).
// Covers: catalog {items,nextCursor}, detail bare DTO, packages {items},
// shared patientPaths real backend paths, notify({db,env,...lab_ready}),
// mobile ?q=/items/bare-DTO readers, lab-portal PATCH complete.
//

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTestApp, getJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import diagnosticTestsRouter from "../src/routes/diagnostic-tests";
import { patientPaths } from "../../../packages/shared/src/contracts/paths";

function repoRead(rel: string): string {
  const candidates = [
    join(process.cwd(), rel),
    join(process.cwd(), "..", "..", rel),
    join(process.cwd(), "apps/api", rel),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8");
    } catch {}
  }
  // fallback via import.meta.url (tests/ -> repo root = ../../../..)
  try {
    const url = new URL(`../../../../${rel}`, import.meta.url);
    return readFileSync(url, "utf8");
  } catch {}
  throw new Error(`cannot read repo file: ${rel}`);
}

const PATIENT_USER = { id: "patient-001", role: "patient" };

function seedBase(db: MockD1) {
  db.seed("users", [
    { id: "patient-001", supabaseId: "supabase-p1", role: "patient", name: "Test Patient", email: "p@test.com" },
    { id: "lab-001", supabaseId: "supabase-l1", role: "laboratory", name: "Test Lab", email: "lab@test.com" },
  ]);
  db.seed("patients", [
    { id: "pat-001", userId: "patient-001", gender: "male", dateOfBirth: "1990-01-01" },
  ]);
  db.seed("diagnostic_test_catalog", [
    {
      id: "test-001", name: "Complete Blood Count", slug: "complete-blood-count",
      category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0,
      homeCollectionAvailable: true, price: 1500, discountPrice: null,
      labPartnerId: "lab-001", turnaroundHours: 24, isActive: true,
      visibility: "public", isBookable: true, isDoctorOrderable: true,
      currency: "LKR", synonyms: "[]", displayOrder: 0,
      description: "Basic blood test", instructions: null,
    },
  ]);
}

describe("lab contracts", () => {
  it("catalog returns items envelope", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await getJson(app, "/diagnostic-tests/catalog");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toHaveProperty("nextCursor");
  });

  it("test detail returns bare DTO", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await getJson(app, "/diagnostic-tests/complete-blood-count");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Complete Blood Count");
    expect(body).not.toHaveProperty("test");
  });

  it("packages returns items envelope", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await getJson(app, "/diagnostic-tests/packages");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("shared diagnostic paths point to real backend", () => {
    expect(patientPaths.diagnostic.bookings()).toBe("/diagnostic-tests/bookings");
    expect(patientPaths.diagnostic.bookingDetail("b1")).toBe("/diagnostic-tests/bookings/b1");
    expect(patientPaths.diagnostic.rateTest("b1")).toBe("/diagnostic-tests/bookings/b1/rating");
    // book: real backend is POST /diagnostic-tests/book (no slug in URL)
    const bookPath =
      typeof (patientPaths.diagnostic as any).book === "function"
        ? (patientPaths.diagnostic as any).book()
        : (patientPaths.diagnostic as any).bookPackage("any-slug");
    expect(bookPath).toBe("/diagnostic-tests/book");
  });

  it("notify uses object signature with lab_ready and env", () => {
    const diag = repoRead("apps/api/src/routes/diagnostic-tests.ts");
    const portal = repoRead("apps/api/src/routes/lab-partner-portal.ts");
    for (const src of [diag, portal]) {
      expect(src).not.toMatch(/notify\(\s*db\s*,/);
      expect(src).toContain("notify({");
      expect(src).toContain('type: "lab_ready"');
      expect(src).toContain("env");
    }
  });

  it("mobile catalog uses ?q= and items", () => {
    const hook = repoRead("apps/mobile/src/hooks/useApi.ts");
    // useTestCatalog must send ?q= (backend catalogQuerySchema expects q)
    expect(hook).toContain('params.set("q", filters.search)');
    const catalog = repoRead("apps/mobile/src/app/(app)/test-catalog.tsx");
    expect(catalog).toContain("testsData?.items");
    expect(catalog).not.toContain("testsData?.tests");
  });

  it("mobile detail reads bare DTO", () => {
    const detail = repoRead("apps/mobile/src/app/(app)/test-detail/[slug].tsx");
    expect(detail).not.toContain("const { test, packages } = data");
    expect(detail).not.toContain("!data?.test");
  });

  it("mobile packages reads items", () => {
    const pkg = repoRead("apps/mobile/src/app/(app)/test-packages.tsx");
    expect(pkg).toContain("?.items");
    // must not rely solely on legacy .packages envelope
    expect(pkg).not.toMatch(/data\?\.packages \?\? \[\]/);
  });

  it("lab-portal complete uses PATCH complete", () => {
    const hook = repoRead("apps/marketing/src/app/lab-portal/hooks/useApi.ts");
    expect(hook).toContain("/complete");
    expect(hook).toContain('method: "PATCH"');
    expect(hook).toContain("resultPdfUrl");
    expect(hook).not.toContain("/results");
  });

  it("web diagnostic hooks use real paths", () => {
    const hook = repoRead("apps/marketing/src/patient/hooks/diagnostic.ts");
    expect(hook).not.toContain("/me/bookings");
    expect(hook).not.toContain("/packages/");
  });
});
