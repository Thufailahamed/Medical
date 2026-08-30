// tests/seed-diagnostics.test.ts
//
// Phase: lab-diagnostics-foundation (Task 2 — seed script).
//
// Verifies the seed script in `apps/api/scripts/seed-diagnostics.ts`
// against the MockD1 harness used by the rest of the test suite. The
// image ingestion step is decoupled from the DB step so we can inject
// a fake `imageMap` (slug → URL) and skip network calls entirely — the
// `urls.json` OSS bucket is not network-reachable from CI.
//
// What we cover:
//   * Idempotency — running seed twice leaves row counts unchanged
//   * ≥15 category rows are inserted
//   * ≥40 test rows are inserted, with the slug/code columns intact
//   * ≥8 package rows are inserted with their test_package_items joins
//   * At least one laboratory-role user gets ≥1 lab_diagnostic_tests
//     row with `isActive: true`
//   * Image ingestion: at least one package has its `image_url` set to
//     the public asset path, and packages without a matching entry get
//     the fallback `default-package.jpg`
//
// All assertions read through MockD1's `tables` accessor (camelCase
// keys) — see `tests/_mockDb.ts` notes about row storage.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "./_mockDb";
import { seedDiagnostics } from "../scripts/seed-diagnostics";

const FALLBACK_URL = "/assets/lab/packages/default-package.jpg";

// Fake imageMap for tests — two real entries (lab-full-body, lab-diabetic)
// + one that intentionally doesn't match any package slug so we exercise
// the "skip with log" branch.
const FAKE_IMAGE_MAP: Record<string, string> = {
  "full-body-health-checkup": "https://example.test/lab-full-body.jpg",
  "comprehensive-diabetic-screen": "https://example.test/lab-diabetic.jpg",
  "not-a-package-anymore": "https://example.test/lab-orphan.jpg",
};

function seedLabUser(db: MockD1) {
  // One laboratory-role user so per-lab availability has a target.
  db.seed("users", [
    {
      id: "lab-user-001",
      supabaseId: "supabase-lab1",
      role: "laboratory",
      name: "Test Lab",
      email: "lab@test.local",
    },
    {
      id: "patient-001",
      supabaseId: "supabase-p1",
      role: "patient",
      name: "Test Patient",
      email: "p@test.local",
    },
  ]);
}

describe("seedDiagnostics", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
    seedLabUser(db);
  });

  it("inserts ≥15 lab_diagnostic_test_categories", async () => {
    await seedDiagnostics(db, { imageMap: {} });
    const rows = db.tables.labDiagnosticTestCategories?.rows ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const slugs = rows.map((r) => r.slug);
    for (const required of [
      "cardiology",
      "diabetes",
      "thyroid",
      "liver",
      "kidney",
      "cbc",
      "pregnancy",
    ]) {
      expect(slugs).toContain(required);
    }
  });

  it("inserts ≥40 diagnostic_test_catalog rows with slug + code intact", async () => {
    await seedDiagnostics(db, { imageMap: {} });
    const rows = db.tables.diagnosticTestCatalog?.rows ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(40);
    // Spot-check canonical slugs/codes from the brief.
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    expect(bySlug.get("cbc")?.code).toBe("CBC");
    expect(bySlug.get("lipid-profile")?.code).toBe("LIPID");
    expect(bySlug.get("tsh")?.code).toBe("TSH");
    expect(bySlug.get("lft")?.code).toBe("LFT");
    expect(bySlug.get("hba1c")?.code).toBe("HBA1C");
    expect(bySlug.get("vitamin-d-25-oh")?.code).toBe("VIT_D");
  });

  it("inserts ≥8 test_packages with test_package_items rows", async () => {
    await seedDiagnostics(db, { imageMap: {} });
    const packages = db.tables.testPackages?.rows ?? [];
    const items = db.tables.testPackageItems?.rows ?? [];
    expect(packages.length).toBeGreaterThanOrEqual(8);
    expect(items.length).toBeGreaterThan(0);
    // The 5 required slugs from the brief must be present.
    const slugs = packages.map((p) => p.slug);
    for (const required of [
      "full-body-health-checkup",
      "senior-citizen-wellness",
      "cardiac-wellness-profile",
      "comprehensive-diabetic-screen",
      "essential-health-checkup",
    ]) {
      expect(slugs).toContain(required);
    }
    // Each package must have at least one item linked.
    for (const p of packages) {
      const myItems = items.filter((i) => i.packageId === p.id);
      expect(myItems.length).toBeGreaterThan(0);
    }
  });

  it("creates lab_diagnostic_tests for first laboratory-role user", async () => {
    await seedDiagnostics(db, { imageMap: {} });
    const rows = db.tables.labDiagnosticTests?.rows ?? [];
    const myRows = rows.filter((r) => r.labPartnerId === "lab-user-001");
    expect(myRows.length).toBeGreaterThan(0);
    const activeRows = myRows.filter((r) => r.isActive);
    expect(activeRows.length).toBeGreaterThan(0);
    // Per-lab price should equal or discount the catalog base price.
    const first = activeRows[0];
    expect(first.price).toBeGreaterThan(0);
    expect(first.currency).toBe("LKR");
  });

  it("populates image_url from the imageMap (full-body + diabetic)", async () => {
    await seedDiagnostics(db, { imageMap: FAKE_IMAGE_MAP, skipNetworkFetch: true });
    const packages = db.tables.testPackages?.rows ?? [];
    const fullBody = packages.find((p) => p.slug === "full-body-health-checkup");
    const diabetic = packages.find((p) => p.slug === "comprehensive-diabetic-screen");
    expect(fullBody?.imageUrl).toBe("/assets/lab/packages/full-body-health-checkup.jpg");
    expect(diabetic?.imageUrl).toBe("/assets/lab/packages/comprehensive-diabetic-screen.jpg");
  });

  it("falls back to default-package.jpg for unmatched packages", async () => {
    await seedDiagnostics(db, { imageMap: {} });
    const packages = db.tables.testPackages?.rows ?? [];
    // At least one package must reference the fallback image.
    const fallbacks = packages.filter((p) => p.imageUrl === FALLBACK_URL);
    expect(fallbacks.length).toBeGreaterThan(0);
  });

  it("is idempotent: second run leaves row counts unchanged", async () => {
    await seedDiagnostics(db, { imageMap: FAKE_IMAGE_MAP, skipNetworkFetch: true });
    const countsAfter1 = {
      categories: db.tables.labDiagnosticTestCategories?.rows.length ?? 0,
      tests: db.tables.diagnosticTestCatalog?.rows.length ?? 0,
      packages: db.tables.testPackages?.rows.length ?? 0,
      items: db.tables.testPackageItems?.rows.length ?? 0,
      labTests: db.tables.labDiagnosticTests?.rows.length ?? 0,
    };
    await seedDiagnostics(db, { imageMap: FAKE_IMAGE_MAP, skipNetworkFetch: true });
    const countsAfter2 = {
      categories: db.tables.labDiagnosticTestCategories?.rows.length ?? 0,
      tests: db.tables.diagnosticTestCatalog?.rows.length ?? 0,
      packages: db.tables.testPackages?.rows.length ?? 0,
      items: db.tables.testPackageItems?.rows.length ?? 0,
      labTests: db.tables.labDiagnosticTests?.rows.length ?? 0,
    };
    expect(countsAfter2).toEqual(countsAfter1);
  });

  it("logs a warning when no laboratory-role users exist", async () => {
    // Fresh DB with no users at all.
    const empty = new MockD1();
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      await seedDiagnostics(empty, { imageMap: {} });
    } finally {
      console.warn = origWarn;
    }
    // Still seeded categories + tests + packages even with no lab users.
    expect(empty.tables.labDiagnosticTestCategories?.rows.length ?? 0).toBeGreaterThanOrEqual(15);
    expect(empty.tables.diagnosticTestCatalog?.rows.length ?? 0).toBeGreaterThanOrEqual(40);
    expect(empty.tables.testPackages?.rows.length ?? 0).toBeGreaterThanOrEqual(8);
    // And the warning was logged.
    const labWarn = warnings.find((w) => /laboratory/i.test(w));
    expect(labWarn).toBeDefined();
  });
});