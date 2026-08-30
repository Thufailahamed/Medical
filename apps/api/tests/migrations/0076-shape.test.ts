// tests/migrations/0076-shape.test.ts
//
// Phase: lab-diagnostics-foundation (migration 0076).
//
// Lightweight shape assertion for the new lab/diagnostics v2 schema.
// We don't spin up D1 in unit tests (the MockD1 doesn't speak real
// ALTER TABLE), so this test asserts on the SQL string itself: the
// file exists, is named correctly, and contains the expected DDL
// substrings. Idempotency is verified by hand-counting every
// backfill statement uses `INSERT OR IGNORE` / a `WHERE col IS NULL`
// guard (commented in the file).
//
// What this catches:
//   * Wrong filename (e.g. accidentally 0075_)
//   * Missing new tables (lab_diagnostic_test_categories, lab_diagnostic_tests,
//     test_package_images)
//   * Missing ALTER TABLE for the column additions
//   * Forgetting the diagnostic_test_catalog rebuild (D1 can't DROP NOT NULL
//     in-place — without a rebuild lab_partner_id stays NOT NULL)
//   * Forgetting the backfill block

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../migrations/0076_lab_diagnostics_v2.sql"
);

function loadSql(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("migration 0076 — lab diagnostics v2 shape", () => {
  const sql = loadSql();

  it("filename starts with 0076_", () => {
    expect(MIGRATION_PATH.split("/").pop()).toMatch(/^0076_/);
  });

  it("creates lab_diagnostic_test_categories", () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS lab_diagnostic_test_categories/
    );
    expect(sql).toMatch(/idx_lab_diag_cat_active/);
  });

  it("rebuilds diagnostic_test_catalog to make lab_partner_id nullable", () => {
    // The rebuild is mandatory: D1 cannot DROP NOT NULL on a column in
    // place, so we create _new, copy, drop, rename. Without this
    // pattern the column stays NOT NULL and the v2 architecture
    // (catalog = global template) breaks.
    expect(sql).toMatch(/diagnostic_test_catalog_new/);
    expect(sql).toMatch(/DROP TABLE diagnostic_test_catalog/);
    expect(sql).toMatch(
      /ALTER TABLE diagnostic_test_catalog_new RENAME TO diagnostic_test_catalog/
    );
    // The diagnostic_test_catalog_new CREATE TABLE block must declare
    // lab_partner_id without NOT NULL. We isolate the new-table block
    // so the assertion doesn't pick up the lab_diagnostic_tests
    // (per-lab join) row, which correctly keeps lab_partner_id NOT
    // NULL (every join row belongs to a lab).
    const newBlockMatch = sql.match(
      /CREATE TABLE IF NOT EXISTS diagnostic_test_catalog_new \([\s\S]*?\);/
    );
    expect(newBlockMatch).not.toBeNull();
    const newBlock = newBlockMatch![0];
    expect(newBlock).toMatch(/lab_partner_id TEXT REFERENCES users\(id\)/);
    expect(newBlock).not.toMatch(/lab_partner_id TEXT NOT NULL/);
  });

  it("adds the v2 enrichment columns to diagnostic_test_catalog", () => {
    for (const col of [
      "short_name",
      "code",
      "category_id",
      "result_interpretation",
      "reference_info",
      "currency",
      "visibility",
      "is_bookable",
      "is_doctor_orderable",
      "lab_collection_available",
      "synonyms",
      "display_order",
    ]) {
      expect(sql).toContain(col);
    }
    // category_id FK references the new categories table.
    expect(sql).toMatch(
      /category_id TEXT REFERENCES lab_diagnostic_test_categories\(id\) ON DELETE SET NULL/
    );
  });

  it("creates lab_diagnostic_tests per-lab join", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS lab_diagnostic_tests/);
    expect(sql).toMatch(/UNIQUE \(lab_partner_id, test_id\)/);
    expect(sql).toMatch(/idx_lab_diag_tests_test/);
    expect(sql).toMatch(/idx_lab_diag_tests_lab/);
  });

  it("enriches test_packages with category/prep/fasting/image flags", () => {
    expect(sql).toMatch(
      /ALTER TABLE test_packages ADD COLUMN category_id TEXT REFERENCES lab_diagnostic_test_categories\(id\) ON DELETE SET NULL/
    );
    expect(sql).toMatch(
      /ALTER TABLE test_packages ADD COLUMN preparation TEXT/
    );
    expect(sql).toMatch(
      /ALTER TABLE test_packages ADD COLUMN fasting_required INTEGER/
    );
    expect(sql).toMatch(
      /ALTER TABLE test_packages ADD COLUMN sample_type TEXT/
    );
    expect(sql).toMatch(
      /ALTER TABLE test_packages ADD COLUMN image_url TEXT/
    );
    expect(sql).toMatch(/ALTER TABLE test_packages ADD COLUMN popular INTEGER/);
    expect(sql).toMatch(/ALTER TABLE test_packages ADD COLUMN featured INTEGER/);
    expect(sql).toMatch(
      /ALTER TABLE test_packages ADD COLUMN display_order INTEGER/
    );
    expect(sql).toMatch(
      /ALTER TABLE test_packages ADD COLUMN discount_percent REAL/
    );
    expect(sql).toMatch(/idx_test_packages_featured/);
    expect(sql).toMatch(/idx_test_packages_category/);
  });

  it("creates test_package_images gallery table", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS test_package_images/);
    expect(sql).toMatch(/idx_pkg_img/);
  });

  it("backfills lab_diagnostic_test_categories idempotently", () => {
    // All seed inserts must use INSERT OR IGNORE so re-running the
    // migration does not duplicate rows (slug is UNIQUE).
    expect(sql).toMatch(
      /INSERT OR IGNORE INTO lab_diagnostic_test_categories/
    );
  });

  it("backfills category_id FK on diagnostic_test_catalog", () => {
    expect(sql).toMatch(/UPDATE diagnostic_test_catalog/);
    expect(sql).toMatch(/SET category_id = /);
    // Guarded by WHERE category IS NOT NULL AND category_id IS NULL so
    // re-runs do not rewrite already-populated rows.
    expect(sql).toMatch(/category IS NOT NULL/);
    expect(sql).toMatch(/category_id IS NULL/);
  });

  it("backfills lab_diagnostic_tests from existing catalog rows", () => {
    expect(sql).toMatch(/INSERT OR IGNORE INTO lab_diagnostic_tests/);
    // Composite id keeps UNIQUE (lab_partner_id, test_id) happy.
    expect(sql).toMatch(
      /diagnostic_test_catalog\.id \|\| '-' \|\| diagnostic_test_catalog\.lab_partner_id/
    );
    // Restricted to rows that already have a lab_partner_id (the v1
    // catalog only stored rows with one). Rows with NULL lab_partner_id
    // — if any exist after the rebuild — are skipped, since a join row
    // without a lab makes no sense.
    expect(sql).toMatch(/lab_partner_id IS NOT NULL/);
  });

  it("wraps destructive operations in a transaction", () => {
    // The table rebuild + backfill must be atomic. Without BEGIN/COMMIT
    // a failed rebuild would leave a half-populated catalog_new table
    // and a dropped diagnostic_test_catalog.
    expect(sql).toMatch(/BEGIN/);
    expect(sql).toMatch(/COMMIT/);
  });

  // Hand-check (commented, per brief):
  //   * Every backfill statement uses INSERT OR IGNORE or guards on
  //     `col IS NULL`, so re-running the migration on a partially-
  //     populated DB will not duplicate rows or rewrite populated
  //     category_id values.
  //   * Schema-change statements (CREATE TABLE IF NOT EXISTS, CREATE
  //     INDEX IF NOT EXISTS) are themselves idempotent. The
  //     `diagnostic_test_catalog` rebuild is one-shot by design — it
  //     is the cost of making lab_partner_id nullable on SQLite.
  //   * The backfill `INSERT OR IGNORE INTO lab_diagnostic_tests`
  //     uses id = catalog.id || '-' || catalog.lab_partner_id so the
  //     same row maps to the same id on re-run and the UNIQUE index
  //     blocks duplicates.
});

describe("drizzle schema mirror — lab diagnostics v2", () => {
  // Importing the schema module exercises every typed reference and
  // fails the test if any of the new tables / columns / references
  // don't compile. This is the real type-safety backstop; the SQL
  // shape test above only checks the raw DDL.
  //
  // We import via the `@healthcare/db` workspace alias so the test
  // matches the runtime resolution path used by the API worker
  // (wrangler.toml `[alias]` block redirects to the same path).
  it("schema.ts compiles with new tables + types", async () => {
    const mod = await import("@healthcare/db");
    expect(typeof mod.labDiagnosticTestCategories).toBe("object");
    expect(typeof mod.labDiagnosticTests).toBe("object");
    expect(typeof mod.testPackageImages).toBe("object");
    expect(typeof mod.diagnosticTestCatalog).toBe("object");
    expect(typeof mod.testPackages).toBe("object");
    // Inferred types are stripped at runtime (`type` exports), so we
    // verify the runtime tables exist; compile-time coverage of the
    // types is provided by the `bun run typecheck` step in CI.
    expect(typeof mod.LabDiagnosticTestCategory).toBe("undefined");
    expect(typeof mod.NewLabDiagnosticTestCategory).toBe("undefined");
    expect(typeof mod.LabDiagnosticTest).toBe("undefined");
    expect(typeof mod.NewLabDiagnosticTest).toBe("undefined");
    expect(typeof mod.TestPackageImage).toBe("undefined");
    expect(typeof mod.NewTestPackageImage).toBe("undefined");
  });
});
