// tests/seed-diagnostics.test.ts
//
// Phase: lab-diagnostics-foundation (Task 2 — seed script + fix round).
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
//   * C1 fix: the `default-package.jpg` placeholder exists on disk and
//     is a non-empty valid JPG
//   * I1 fix: `loadImageManifest` iterates every line in urls.json;
//     non-lab entries emit a `console.warn` (not a silent skip)
//   * I2 fix: `LAB_IMAGE_SLUG_OVERRIDES` env var is parsed and merged
//     into the filename → package-slug map
//
// All assertions read through MockD1's `tables` accessor (camelCase
// keys) — see `tests/_mockDb.ts` notes about row storage.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockD1 } from "./_mockDb";
import { seedDiagnostics, loadImageManifest } from "../scripts/seed-diagnostics";

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

// ─── C1 fix: default-package.jpg placeholder ───────────────────
//
// After ingesting images into a fresh temp dir, the script must
// also ensure `default-package.jpg` is present at the destination so
// the fallback path always resolves to a real asset.
describe("seedDiagnostics — image ingestion hardening", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "seed-img-"));
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("C1: writes default-package.jpg placeholder when missing", async () => {
    const db = new MockD1();
    db.seed("users", [
      {
        id: "lab-user-001",
        supabaseId: "supabase-lab1",
        role: "laboratory",
        name: "Test Lab",
        email: "lab@test.local",
      },
    ]);
    await seedDiagnostics(db, {
      imageMap: {},
      imageOutputDir: tmpDir,
      skipNetworkFetch: true,
    });
    const placeholder = join(tmpDir, "default-package.jpg");
    expect(existsSync(placeholder)).toBe(true);
    const bytes = readFileSync(placeholder);
    expect(bytes.length).toBeGreaterThan(0);
    // First 3 bytes of any valid JPEG: 0xFF 0xD8 0xFF.
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
  });

  it("C1: also creates the destination directory defensively", async () => {
    const db = new MockD1();
    const nested = join(tmpDir, "deeply", "nested", "packages");
    expect(existsSync(nested)).toBe(false);
    await seedDiagnostics(db, {
      imageMap: {},
      imageOutputDir: nested,
      skipNetworkFetch: true,
    });
    expect(existsSync(nested)).toBe(true);
    expect(existsSync(join(nested, "default-package.jpg"))).toBe(true);
  });
});

// ─── I1 fix: iterate all urls.json entries ─────────────────────
//
// The brief requires the loader to attempt every line in urls.json
// and `console.warn` for non-lab entries (rather than silently
// skipping).
describe("loadImageManifest — iterates every entry", () => {
  let tmpDir: string;
  let urlsFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "seed-urls-"));
    urlsFile = join(tmpDir, "urls.json");
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("I1: iterates every line; non-lab entries produce a console.warn", async () => {
    // 9-line urls.json shaped exactly like the real one — 7 insurance +
    // 2 lab. The loader must attempt every line; lab entries land in
    // the returned map; insurance entries trigger console.warn.
    const lines = [
      JSON.stringify({ node_id: "n1", download_url: "https://x.test/insurance-individual.png?e=1" }),
      JSON.stringify({ node_id: "n2", download_url: "https://x.test/insurance-family.jpg?e=1" }),
      JSON.stringify({ node_id: "n3", download_url: "https://x.test/insurance-senior.jpg?e=1" }),
      JSON.stringify({ node_id: "n4", download_url: "https://x.test/insurance-critical-illness.jpg?e=1" }),
      JSON.stringify({ node_id: "n5", download_url: "https://x.test/insurance-cancer.jpg?e=1" }),
      JSON.stringify({ node_id: "n6", download_url: "https://x.test/insurance-dental.jpg?e=1" }),
      JSON.stringify({ node_id: "n7", download_url: "https://x.test/insurance-maternity.jpg?e=1" }),
      JSON.stringify({ node_id: "n8", download_url: "https://x.test/lab-full-body.jpg?e=1" }),
      JSON.stringify({ node_id: "n9", download_url: "https://x.test/lab-diabetic.jpg?e=1" }),
    ];
    writeFileSync(urlsFile, lines.join("\n"));

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    let map: Record<string, string> = {};
    try {
      map = await loadImageManifest(urlsFile);
    } finally {
      console.warn = origWarn;
    }

    // The 2 lab entries land in the map keyed by their filename slug.
    expect(map["full-body"]).toContain("lab-full-body.jpg");
    expect(map["diabetic"]).toContain("lab-diabetic.jpg");
    // No insurance entries leak in.
    expect(Object.keys(map)).not.toContain("insurance-individual");
    expect(Object.keys(map)).not.toContain("insurance-family");

    // Every one of the 7 insurance filenames produced a warn line.
    const fnameWarns = warnings.filter((w) => /Skipping non-lab image:/i.test(w));
    expect(fnameWarns.length).toBeGreaterThanOrEqual(7);
    for (const fname of [
      "insurance-individual.png",
      "insurance-family.jpg",
      "insurance-senior.jpg",
      "insurance-critical-illness.jpg",
      "insurance-cancer.jpg",
      "insurance-dental.jpg",
      "insurance-maternity.jpg",
    ]) {
      expect(fnameWarns.some((w) => w.includes(fname))).toBe(true);
    }
  });

  it("I1: returns an empty map + warns if urls.json is missing", async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    let map: Record<string, string> = {};
    try {
      map = await loadImageManifest(join(tmpDir, "does-not-exist.json"));
    } finally {
      console.warn = origWarn;
    }
    expect(Object.keys(map)).toHaveLength(0);
    expect(warnings.some((w) => /not found/i.test(w))).toBe(true);
  });
});

// ─── I2 fix: LAB_IMAGE_SLUG_OVERRIDES env var ──────────────────
//
// The loader / ingest pipeline must honour operator-supplied
// filename→package-slug overrides via an env var so that adding a new
// `lab-XYZ.jpg` to the OSS bucket doesn't require a code change.
describe("seedDiagnostics — LAB_IMAGE_SLUG_OVERRIDES", () => {
  let tmpDir: string;
  let origEnv: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "seed-overrides-"));
    origEnv = process.env.LAB_IMAGE_SLUG_OVERRIDES;
  });

  afterEach(() => {
    if (origEnv === undefined) delete process.env.LAB_IMAGE_SLUG_OVERRIDES;
    else process.env.LAB_IMAGE_SLUG_OVERRIDES = origEnv;
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("I2: env var overrides are parsed and merged into the imageMap slug map", async () => {
    // Set an env var that points the lab-full-body filename slug at a
    // synthetic package slug. The ingest step should land the bytes
    // at <slug>.jpg, not at <lab-full-body>.jpg.
    process.env.LAB_IMAGE_SLUG_OVERRIDES =
      "lab-full-body:full-body-health-checkup,foo:bar-package";
    const { ingestImages } = await import("../scripts/seed-diagnostics");
    const map = { "full-body": "https://example.test/lab-full-body.jpg" };
    const out = await ingestImages(map, tmpDir, { skipNetworkFetch: true });
    // Override routed full-body → full-body-health-checkup.
    expect(out["full-body-health-checkup"]).toBe(
      "/assets/lab/packages/full-body-health-checkup.jpg",
    );
    expect(out["full-body"]).toBeUndefined();
  });
});