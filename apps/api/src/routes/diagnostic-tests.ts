// @ts-nocheck
//
// Phase: lab-diagnostics-foundation (Task 3 — catalog API rewrite).
//
// Public catalog + packages endpoints. DB-backed (migration 0076 +
// the seed script in apps/api/scripts/seed-diagnostics.ts). The
// legacy `CURATED_PACKAGES_DATA` in-memory fallback is gone.
//
// Routes rewritten in this slice:
//   GET /diagnostic-tests/categories        → trilingual category list
//   GET /diagnostic-tests/catalog           → cursor-paginated test list
//   GET /diagnostic-tests/:slug             → single test (canonical DTO)
//   GET /diagnostic-tests/catalog/search    → alias for /catalog?q=
//   GET /diagnostic-tests/packages          → package list
//   GET /diagnostic-tests/packages/:slug    → package detail
//
// Out of scope (Tasks 4-6): /book, /bookings/*, /time-slots, and the
// legacy /popular + /validate-promo aliases — all untouched here.

import { Hono } from "hono";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  diagnosticTestCatalog,
  labDiagnosticTestCategories,
  labDiagnosticTests,
  testPackages,
  testPackageItems,
  testBookings,
  users,
  notifications,
} from "@healthcare/db";
import {
  catalogQuerySchema,
  type DiagnosticCategoryDTO,
  type DiagnosticTestDTO,
  type LabAvailabilityDTO,
  type PackageItemDTO,
  type TestPackageDTO,
} from "@healthcare/shared";
import { authMiddleware } from "../middleware/auth";
import { resolvePatientContext } from "../lib/caretaker";
import {
  testBookingSchema,
  testBookingCancelSchema,
  testBookingRescheduleSchema,
} from "../lib/validators";
import { flattenTranslated } from "../lib/validation-error";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

const BOOKING_ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "phlebotomist_assigned",
  "sample_collection_en_route",
  "sample_collected",
  "in_progress",
];

// ─── Helpers ────────────────────────────────────────────────

function parseSynonyms(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string");
  } catch {
    /* fall through */
  }
  return [];
}

function parseLocale(raw: string | undefined): "en" | "si" | "ta" {
  return raw === "si" || raw === "ta" ? raw : "en";
}

function categoryNameFromRow(
  row: { name: string; nameSi: string | null; nameTa: string | null },
  locale: "en" | "si" | "ta",
): string {
  if (locale === "si") return row.nameSi ?? row.name;
  if (locale === "ta") return row.nameTa ?? row.name;
  return row.name;
}

function buildCursor(row: { id: string; slug: string }): string {
  // Opaque, URL-safe. Just `${id}:${slug}` for now — enough for tests;
  // we can swap to a signed token if clients start depending on the
  // payload contents.
  return Buffer.from(`${row.id}:${row.slug}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): { id: string; slug: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [id, slug] = decoded.split(":");
    if (!id || !slug) return null;
    return { id, slug };
  } catch {
    return null;
  }
}

// Shared catalog handler logic. Pulls candidates, applies JS-side
// filters (q / price / cursor) and sort, hydrates category slugs,
// emits DTOs + nextCursor. Used by both /catalog and
// /catalog/search so the two endpoints never drift.
async function runCatalogQuery(
  db: any,
  q: import("@healthcare/shared").CatalogQuery,
): Promise<{ items: DiagnosticTestDTO[]; nextCursor: string | null }> {
  const cursor = decodeCursor(q.cursor);
  const limit = q.limit ?? 20;

  const conditions: any[] = [eq(diagnosticTestCatalog.isActive, true)];
  if (q.category) conditions.push(eq(diagnosticTestCatalog.category, q.category));
  if (q.sampleType) conditions.push(eq(diagnosticTestCatalog.sampleType, q.sampleType));
  if (q.isBookable !== undefined)
    conditions.push(eq(diagnosticTestCatalog.isBookable, q.isBookable));
  if (q.homeCollection !== undefined)
    conditions.push(
      eq(diagnosticTestCatalog.homeCollectionAvailable, q.homeCollection),
    );

  const baseRows = (await db
    .select({
      id: diagnosticTestCatalog.id,
      slug: diagnosticTestCatalog.slug,
      name: diagnosticTestCatalog.name,
      shortName: diagnosticTestCatalog.shortName,
      code: diagnosticTestCatalog.code,
      categoryId: diagnosticTestCatalog.categoryId,
      description: diagnosticTestCatalog.description,
      sampleType: diagnosticTestCatalog.sampleType,
      fastingRequired: diagnosticTestCatalog.fastingRequired,
      fastingHours: diagnosticTestCatalog.fastingHours,
      homeCollectionAvailable: diagnosticTestCatalog.homeCollectionAvailable,
      labCollectionAvailable: diagnosticTestCatalog.labCollectionAvailable,
      price: diagnosticTestCatalog.price,
      discountPrice: diagnosticTestCatalog.discountPrice,
      turnaroundHours: diagnosticTestCatalog.turnaroundHours,
      instructions: diagnosticTestCatalog.instructions,
      resultInterpretation: diagnosticTestCatalog.resultInterpretation,
      referenceInfo: diagnosticTestCatalog.referenceInfo,
      visibility: diagnosticTestCatalog.visibility,
      isBookable: diagnosticTestCatalog.isBookable,
      isDoctorOrderable: diagnosticTestCatalog.isDoctorOrderable,
      synonyms: diagnosticTestCatalog.synonyms,
      displayOrder: diagnosticTestCatalog.displayOrder,
      currency: diagnosticTestCatalog.currency,
    })
    .from(diagnosticTestCatalog)
    .where(and(...conditions))) as Array<any>;

  const enriched = await Promise.all(
    baseRows.map(async (row) => {
      const avail = await buildLabAvailability(db, row.id);
      const effectiveMinPrice =
        avail.minPrice > 0 ? avail.minPrice : row.discountPrice ?? row.price;
      return { row, avail, effectiveMinPrice };
    }),
  );

  let filtered = enriched;
  if (q.q) {
    const needle = q.q.toLowerCase();
    filtered = filtered.filter(({ row }) => {
      const haystack = [
        row.name,
        row.shortName ?? "",
        row.code ?? "",
        parseSynonyms(row.synonyms).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }
  if (q.minPrice !== undefined) {
    filtered = filtered.filter((e) => e.effectiveMinPrice >= q.minPrice!);
  }
  if (q.maxPrice !== undefined) {
    filtered = filtered.filter((e) => e.effectiveMinPrice <= q.maxPrice!);
  }

  filtered.sort((a, b) => {
    if (q.sort === "price") {
      return (
        a.effectiveMinPrice - b.effectiveMinPrice ||
        a.row.slug.localeCompare(b.row.slug) ||
        a.row.id.localeCompare(b.row.id)
      );
    }
    if (q.sort === "name") {
      return (
        a.row.name.localeCompare(b.row.name) ||
        a.row.id.localeCompare(b.row.id)
      );
    }
    return (
      (a.row.displayOrder ?? 0) - (b.row.displayOrder ?? 0) ||
      a.row.id.localeCompare(b.row.id)
    );
  });

  if (cursor) {
    const idx = filtered.findIndex((e) => e.row.id === cursor.id);
    if (idx >= 0) filtered = filtered.slice(idx + 1);
  }

  const categoryIds = Array.from(
    new Set(
      filtered
        .slice(0, limit + 1)
        .map((e) => e.row.categoryId)
        .filter((id): id is string => !!id),
    ),
  );
  const categoryRows = categoryIds.length
    ? ((await db
        .select({ id: labDiagnosticTestCategories.id, slug: labDiagnosticTestCategories.slug })
        .from(labDiagnosticTestCategories)
        .where(
          sql`${labDiagnosticTestCategories.id} IN (${sql.join(
            categoryIds.map((id) => sql`${id}`),
            sql.raw(","),
          )})`,
        )) as Array<{ id: string; slug: string }>)
    : [];
  const categorySlugById = new Map<string, string>();
  for (const cr of categoryRows) categorySlugById.set(cr.id, cr.slug);

  const page = filtered.slice(0, limit);
  const items: DiagnosticTestDTO[] = page.map(
    ({ row, avail, effectiveMinPrice }) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortName: row.shortName,
      code: row.code,
      categorySlug: row.categoryId
        ? categorySlugById.get(row.categoryId) ?? null
        : null,
      description: row.description,
      sampleType: row.sampleType,
      fastingRequired: !!row.fastingRequired,
      fastingHours: row.fastingHours,
      homeCollectionAvailable: !!row.homeCollectionAvailable,
      labCollectionAvailable: !!row.labCollectionAvailable,
      turnaroundHours: row.turnaroundHours,
      instructions: row.instructions,
      resultInterpretation: row.resultInterpretation,
      referenceInfo: row.referenceInfo,
      visibility: row.visibility,
      isBookable: !!row.isBookable,
      isDoctorOrderable: !!row.isDoctorOrderable,
      synonyms: parseSynonyms(row.synonyms),
      minPrice: effectiveMinPrice,
      currency: row.currency ?? avail.currency,
      availableAt: avail.availableAt,
      laboratoryCount: avail.laboratoryCount,
    }),
  );

  const nextCursor =
    filtered.length > limit ? buildCursor(items[items.length - 1]) : null;

  return { items, nextCursor };
}

async function buildLabAvailability(
  db: any,
  testId: string,
): Promise<{ availableAt: LabAvailabilityDTO[]; laboratoryCount: number; minPrice: number; currency: string }> {
  // Pull every active offer for this test + the lab's display name.
  // Use raw `select` (not Drizzle join helper) so the test mock + the
  // production D1 both surface the joined fields under their camelCase
  // row keys.
  const rows = (await db
    .select({
      id: labDiagnosticTests.id,
      labPartnerId: labDiagnosticTests.labPartnerId,
      price: labDiagnosticTests.price,
      discountPrice: labDiagnosticTests.discountPrice,
      currency: labDiagnosticTests.currency,
      homeCollectionAvailable: labDiagnosticTests.homeCollectionAvailable,
      labCollectionAvailable: labDiagnosticTests.labCollectionAvailable,
      turnaroundHours: labDiagnosticTests.turnaroundHours,
      isActive: labDiagnosticTests.isActive,
    })
    .from(labDiagnosticTests)
    .where(
      and(
        eq(labDiagnosticTests.testId, testId),
        eq(labDiagnosticTests.isActive, true),
      ),
    )) as Array<{
    id: string;
    labPartnerId: string;
    price: number;
    discountPrice: number | null;
    currency: string;
    homeCollectionAvailable: boolean;
    labCollectionAvailable: boolean;
    turnaroundHours: number | null;
    isActive: boolean;
  }>;

  if (rows.length === 0) {
    return { availableAt: [], laboratoryCount: 0, minPrice: 0, currency: "LKR" };
  }

  // Hydrate lab names in one query.
  const labIds = Array.from(new Set(rows.map((r) => r.labPartnerId)));
  const labRows = (await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(labIds.map((id) => sql`${id}`), sql.raw(","))})`)) as Array<{
    id: string;
    name: string;
  }>;
  const labNameById = new Map<string, string>();
  for (const lr of labRows) labNameById.set(lr.id, lr.name);

  const availableAt: LabAvailabilityDTO[] = rows.map((r) => ({
    labId: r.labPartnerId,
    labName: labNameById.get(r.labPartnerId) ?? "",
    price: r.price,
    discountPrice: r.discountPrice,
    currency: r.currency,
    homeCollectionAvailable: !!r.homeCollectionAvailable,
    labCollectionAvailable: !!r.labCollectionAvailable,
    turnaroundHours: r.turnaroundHours,
  }));

  const minPrice = availableAt.reduce(
    (min, offer) => Math.min(min, offer.discountPrice ?? offer.price),
    Infinity,
  );

  return {
    availableAt,
    laboratoryCount: labIds.length,
    minPrice: Number.isFinite(minPrice) ? minPrice : 0,
    currency: rows[0].currency,
  };
}

// ─── GET /diagnostic-tests/categories ────────────────────────

router.get("/categories", async (c) => {
  const db = c.get("db");
  const locale = parseLocale(c.req.query("locale"));

  const rows = (await db
    .select({
      id: labDiagnosticTestCategories.id,
      slug: labDiagnosticTestCategories.slug,
      name: labDiagnosticTestCategories.name,
      nameSi: labDiagnosticTestCategories.nameSi,
      nameTa: labDiagnosticTestCategories.nameTa,
      icon: labDiagnosticTestCategories.icon,
      displayOrder: labDiagnosticTestCategories.displayOrder,
    })
    .from(labDiagnosticTestCategories)
    .where(eq(labDiagnosticTestCategories.isActive, true))
    .orderBy(asc(labDiagnosticTestCategories.displayOrder))) as Array<{
    id: string;
    slug: string;
    name: string;
    nameSi: string | null;
    nameTa: string | null;
    icon: string | null;
    displayOrder: number;
  }>;

  const categories: DiagnosticCategoryDTO[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: categoryNameFromRow(r, locale),
    name_si: r.nameSi,
    name_ta: r.nameTa,
    icon: r.icon,
    displayOrder: r.displayOrder,
  }));

  return c.json({ categories });
});

// ─── GET /diagnostic-tests/catalog ───────────────────────────
//
// Cursor-paginated. The cursor is opaque base64url(`id:slug`). For
// tiebreakers when ids collide on the same slug the next page picks
// up at `(slug > cursorSlug OR (slug = cursorSlug AND id > cursorId))`.
// To keep the predicate MockD1-portable we just filter on a stable
// (displayOrder, slug, id) tuple — see the WHERE clause below.

router.get("/catalog", async (c) => {
  const db = c.get("db");
  const parsed = catalogQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query", details: parsed.error.flatten() }, 400);
  }
  const result = await runCatalogQuery(db, parsed.data);
  return c.json(result);
});

// ─── GET /diagnostic-tests/catalog/search (alias) ────────────

router.get("/catalog/search", async (c) => {
  // Alias for /catalog — search box hits this URL. Same handler, same
  // shape. Forward the querystring as-is.
  const db = c.get("db");
  const parsed = catalogQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query", details: parsed.error.flatten() }, 400);
  }
  const result = await runCatalogQuery(db, parsed.data);
  return c.json(result);
});

// ─── GET /diagnostic-tests/packages ──────────────────────────

router.get("/packages", async (c) => {
  const db = c.get("db");
  const limitRaw = c.req.query("limit");
  const limit = Math.min(50, Math.max(1, parseInt(limitRaw || "20", 10) || 20));

  const pkgRows = (await db
    .select({
      id: testPackages.id,
      slug: testPackages.slug,
      name: testPackages.name,
      description: testPackages.description,
      categoryId: testPackages.categoryId,
      preparation: testPackages.preparation,
      fastingRequired: testPackages.fastingRequired,
      sampleType: testPackages.sampleType,
      imageUrl: testPackages.imageUrl,
      price: testPackages.price,
      discountPrice: testPackages.discountPrice,
      discountPercent: testPackages.discountPercent,
      currency: testPackages.currency,
      popular: testPackages.popular,
      featured: testPackages.featured,
      displayOrder: testPackages.displayOrder,
    })
    .from(testPackages)
    .where(eq(testPackages.isActive, true))
    .orderBy(
      asc(testPackages.displayOrder),
      asc(testPackages.slug),
      asc(testPackages.id),
    )
    .limit(limit)) as Array<any>;

  if (pkgRows.length === 0) {
    return c.json({ items: [], nextCursor: null });
  }

  const pkgIds = pkgRows.map((p) => p.id);
  const categoryIds = Array.from(
    new Set(pkgRows.map((p) => p.categoryId).filter((id): id is string => !!id)),
  );

  const itemRows = (await db
    .select({
      id: testPackageItems.id,
      packageId: testPackageItems.packageId,
      testId: testPackageItems.testId,
      testSlug: diagnosticTestCatalog.slug,
      testName: diagnosticTestCatalog.name,
    })
    .from(testPackageItems)
    .innerJoin(diagnosticTestCatalog, eq(testPackageItems.testId, diagnosticTestCatalog.id))
    .where(
      sql`${testPackageItems.packageId} IN (${sql.join(
        pkgIds.map((id) => sql`${id}`),
        sql.raw(","),
      )})`,
    )) as Array<{
    id: string;
    packageId: string;
    testId: string;
    testSlug: string;
    testName: string;
  }>;

  // Item display order = stable insertion order; we use the row id as a
  // surrogate since testPackageItems doesn't carry a displayOrder column.
  const itemsByPkg = new Map<string, PackageItemDTO[]>();
  for (const ir of itemRows) {
    const arr = itemsByPkg.get(ir.packageId) ?? [];
    arr.push({ testSlug: ir.testSlug, testName: ir.testName, displayOrder: arr.length });
    itemsByPkg.set(ir.packageId, arr);
  }

  const categoryRows = categoryIds.length
    ? ((await db
        .select({ id: labDiagnosticTestCategories.id, slug: labDiagnosticTestCategories.slug })
        .from(labDiagnosticTestCategories)
        .where(
          sql`${labDiagnosticTestCategories.id} IN (${sql.join(
            categoryIds.map((id) => sql`${id}`),
            sql.raw(","),
          )})`,
        )) as Array<{ id: string; slug: string }>)
    : [];
  const categorySlugById = new Map<string, string>();
  for (const cr of categoryRows) categorySlugById.set(cr.id, cr.slug);

  // LaboratoryCount = distinct labPartners offering this package via
  // the test rows that compose it. Cheaper alternative would be to
  // count distinct lab_partner_id on lab_diagnostic_tests rows for
  // each constituent testId; we approximate with the labPartnerId on
  // the package itself (single lab today) so the count matches what
  // patients see — singular "1 lab" until per-package offers ship.
  const laboratoryCount = new Map<string, number>();
  for (const p of pkgRows) {
    // Defer to the package's own labPartnerId for now — every package
    // ships with one lab (see seed). When multi-lab offers arrive this
    // will become a join on lab_diagnostic_tests by test_id.
    laboratoryCount.set(p.id, p.labPartnerId ? 1 : 0);
  }

  const items: TestPackageDTO[] = pkgRows.map((p) => {
    const tests = itemsByPkg.get(p.id) ?? [];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      categorySlug: p.categoryId ? categorySlugById.get(p.categoryId) ?? null : null,
      preparation: p.preparation,
      fastingRequired: !!p.fastingRequired,
      sampleType: p.sampleType,
      imageUrl: p.imageUrl,
      price: p.price,
      discountPrice: p.discountPrice,
      discountPercent: p.discountPercent,
      currency: p.currency,
      popular: !!p.popular,
      featured: !!p.featured,
      displayOrder: p.displayOrder,
      tests,
      testCount: tests.length,
      laboratoryCount: laboratoryCount.get(p.id) ?? 0,
    };
  });

  return c.json({ items, nextCursor: null });
});

// ─── GET /diagnostic-tests/packages/:slug ────────────────────

router.get("/packages/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const [pkg] = (await db
    .select({
      id: testPackages.id,
      slug: testPackages.slug,
      name: testPackages.name,
      description: testPackages.description,
      categoryId: testPackages.categoryId,
      preparation: testPackages.preparation,
      fastingRequired: testPackages.fastingRequired,
      sampleType: testPackages.sampleType,
      imageUrl: testPackages.imageUrl,
      price: testPackages.price,
      discountPrice: testPackages.discountPrice,
      discountPercent: testPackages.discountPercent,
      currency: testPackages.currency,
      popular: testPackages.popular,
      featured: testPackages.featured,
      displayOrder: testPackages.displayOrder,
      labPartnerId: testPackages.labPartnerId,
    })
    .from(testPackages)
    .where(
      and(eq(testPackages.slug, slug), eq(testPackages.isActive, true)),
    )
    .limit(1)) as Array<any>;

  if (!pkg) return c.json({ error: "Package not found" }, 404);

  const categorySlug = pkg.categoryId
    ? (((await db
        .select({ slug: labDiagnosticTestCategories.slug })
        .from(labDiagnosticTestCategories)
        .where(eq(labDiagnosticTestCategories.id, pkg.categoryId))
        .limit(1)) as Array<{ slug: string }>)[0]?.slug ?? null)
    : null;

  const itemRows = (await db
    .select({
      testId: testPackageItems.testId,
      testSlug: diagnosticTestCatalog.slug,
      testName: diagnosticTestCatalog.name,
    })
    .from(testPackageItems)
    .innerJoin(diagnosticTestCatalog, eq(testPackageItems.testId, diagnosticTestCatalog.id))
    .where(eq(testPackageItems.packageId, pkg.id))) as Array<{
    testId: string;
    testSlug: string;
    testName: string;
  }>;

  const tests: PackageItemDTO[] = itemRows.map((r, idx) => ({
    testSlug: r.testSlug,
    testName: r.testName,
    displayOrder: idx,
  }));

  const dto: TestPackageDTO = {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    description: pkg.description,
    categorySlug,
    preparation: pkg.preparation,
    fastingRequired: !!pkg.fastingRequired,
    sampleType: pkg.sampleType,
    imageUrl: pkg.imageUrl,
    price: pkg.price,
    discountPrice: pkg.discountPrice,
    discountPercent: pkg.discountPercent,
    currency: pkg.currency,
    popular: !!pkg.popular,
    featured: !!pkg.featured,
    displayOrder: pkg.displayOrder,
    tests,
    testCount: tests.length,
    laboratoryCount: pkg.labPartnerId ? 1 : 0,
  };

  return c.json(dto);
});

// ─── GET /diagnostic-tests/:slug (test detail) ───────────────
//
// Catch-all — registered LAST so the more specific /packages,
// /categories, /catalog/* paths win. Hits `/cbc`, `/lipid-profile`
// etc.

router.get("/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const [row] = (await db
    .select({
      id: diagnosticTestCatalog.id,
      slug: diagnosticTestCatalog.slug,
      name: diagnosticTestCatalog.name,
      shortName: diagnosticTestCatalog.shortName,
      code: diagnosticTestCatalog.code,
      categoryId: diagnosticTestCatalog.categoryId,
      description: diagnosticTestCatalog.description,
      sampleType: diagnosticTestCatalog.sampleType,
      fastingRequired: diagnosticTestCatalog.fastingRequired,
      fastingHours: diagnosticTestCatalog.fastingHours,
      homeCollectionAvailable: diagnosticTestCatalog.homeCollectionAvailable,
      labCollectionAvailable: diagnosticTestCatalog.labCollectionAvailable,
      price: diagnosticTestCatalog.price,
      discountPrice: diagnosticTestCatalog.discountPrice,
      turnaroundHours: diagnosticTestCatalog.turnaroundHours,
      instructions: diagnosticTestCatalog.instructions,
      resultInterpretation: diagnosticTestCatalog.resultInterpretation,
      referenceInfo: diagnosticTestCatalog.referenceInfo,
      visibility: diagnosticTestCatalog.visibility,
      isBookable: diagnosticTestCatalog.isBookable,
      isDoctorOrderable: diagnosticTestCatalog.isDoctorOrderable,
      synonyms: diagnosticTestCatalog.synonyms,
      displayOrder: diagnosticTestCatalog.displayOrder,
      currency: diagnosticTestCatalog.currency,
    })
    .from(diagnosticTestCatalog)
    .where(
      and(
        eq(diagnosticTestCatalog.slug, slug),
        eq(diagnosticTestCatalog.visibility, "public"),
      ),
    )
    .limit(1)) as Array<any>;

  if (!row) return c.json({ error: "Test not found" }, 404);

  const categorySlug = row.categoryId
    ? (((await db
        .select({ slug: labDiagnosticTestCategories.slug })
        .from(labDiagnosticTestCategories)
        .where(eq(labDiagnosticTestCategories.id, row.categoryId))
        .limit(1)) as Array<{ slug: string }>)[0]?.slug ?? null)
    : null;

  const avail = await buildLabAvailability(db, row.id);

  const dto: DiagnosticTestDTO = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    code: row.code,
    categorySlug,
    description: row.description,
    sampleType: row.sampleType,
    fastingRequired: !!row.fastingRequired,
    fastingHours: row.fastingHours,
    homeCollectionAvailable: !!row.homeCollectionAvailable,
    labCollectionAvailable: !!row.labCollectionAvailable,
    turnaroundHours: row.turnaroundHours,
    instructions: row.instructions,
    resultInterpretation: row.resultInterpretation,
    referenceInfo: row.referenceInfo,
    visibility: row.visibility,
    isBookable: !!row.isBookable,
    isDoctorOrderable: !!row.isDoctorOrderable,
    synonyms: parseSynonyms(row.synonyms),
    minPrice: avail.minPrice > 0 ? avail.minPrice : row.discountPrice ?? row.price,
    currency: row.currency ?? avail.currency,
    availableAt: avail.availableAt,
    laboratoryCount: avail.laboratoryCount,
  };

  return c.json(dto);
});

// ─── Book a test (patient) ───────────────────────────────
router.post("/book", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json().catch(() => ({}));
  const parsed = testBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }
  const data = parsed.data;

  // Resolve patient
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);
  const patientId = patient.id;

  // Reject past dates
  const today = new Date().toISOString().slice(0, 10);
  if (data.scheduledDate < today) {
    return c.json({ error: "Cannot book a past date" }, 400);
  }

  // Validate test/package exists and get price
  let totalPrice = 0;
  let labPartnerId = "";
  let testName = "";

  if (data.bookingType === "single_test" && data.testId) {
    const [test] = await db
      .select()
      .from(diagnosticTestCatalog)
      .where(
        and(
          eq(diagnosticTestCatalog.id, data.testId),
          eq(diagnosticTestCatalog.isActive, true)
        )
      )
      .limit(1);

    if (!test) return c.json({ error: "Test not found or inactive" }, 404);
    if (!test.homeCollectionAvailable) {
      return c.json(
        { error: "This test requires lab visit, home collection not available" },
        400
      );
    }

    totalPrice = test.discountPrice ?? test.price;
    labPartnerId = test.labPartnerId;
    testName = test.name;
  } else if (data.bookingType === "package" && data.packageId) {
    const [pkg] = await db
      .select()
      .from(testPackages)
      .where(
        and(
          eq(testPackages.id, data.packageId),
          eq(testPackages.isActive, true)
        )
      )
      .limit(1);

    if (!pkg) return c.json({ error: "Package not found or inactive" }, 404);

    totalPrice = pkg.discountPrice ?? pkg.price;
    labPartnerId = pkg.labPartnerId;
    testName = pkg.name;
  } else {
    return c.json({ error: "Invalid booking type" }, 400);
  }

  // Check for existing active booking for same test/package on same date
  const existingBooking = await db
    .select({ id: testBookings.id })
    .from(testBookings)
    .where(
      and(
        eq(testBookings.patientId, patientId),
        eq(testBookings.scheduledDate, data.scheduledDate),
        data.bookingType === "single_test" && data.testId
          ? eq(testBookings.testId, data.testId)
          : eq(testBookings.packageId, data.packageId!),
        inArray(testBookings.status, BOOKING_ACTIVE_STATUSES)
      )
    )
    .limit(1);

  if (existingBooking.length > 0) {
    return c.json(
      { error: "You already have an active booking for this test on this date" },
      409
    );
  }

  // Determine payment status based on method
  const paymentStatus =
    data.paymentMethod === "cash" ? "cash_on_collection" : "pending";

  const [booking] = await db
    .insert(testBookings)
    .values({
      patientId,
      labPartnerId,
      bookingType: data.bookingType,
      testId: data.testId || null,
      packageId: data.packageId || null,
      status: "pending",
      scheduledDate: data.scheduledDate,
      scheduledTimeSlot: data.scheduledTimeSlot,
      collectionAddress: JSON.stringify(data.collectionAddress),
      totalPrice,
      paymentStatus,
      paymentMethod: data.paymentMethod,
      notes: data.notes || null,
    })
    .returning();

  // Notify patient
  notify(db, userId, {
    type: "test_booking_created",
    title: "Test Booking Confirmed",
    body: `Your booking for ${testName} on ${data.scheduledDate} has been received.`,
    data: { bookingId: booking.id },
  }).catch(() => {});

  audit(db, userId, {
    action: "create",
    resource: "test_booking",
    resourceId: booking.id,
    details: {
      bookingType: data.bookingType,
      testId: data.testId,
      packageId: data.packageId,
      scheduledDate: data.scheduledDate,
    },
  }).catch(() => {});

  return c.json({ booking }, 201);
});

// ─── List my bookings (patient) ──────────────────────────
router.get("/bookings", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const statusFilter = c.req.query("status");

  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ bookings: [] });

  const conditions = [eq(testBookings.patientId, patient.id)];

  if (statusFilter === "active") {
    conditions.push(inArray(testBookings.status, BOOKING_ACTIVE_STATUSES));
  } else if (statusFilter === "completed") {
    conditions.push(eq(testBookings.status, "completed"));
  } else if (statusFilter === "cancelled") {
    conditions.push(
      inArray(testBookings.status, ["cancelled", "rescheduled"])
    );
  }

  const rows = await db
    .select()
    .from(testBookings)
    .where(and(...conditions))
    .orderBy(desc(testBookings.createdAt));

  // Enrich with test/package names
  const enriched = await Promise.all(
    rows.map(async (booking) => {
      let itemName = "";
      let itemSlug = "";

      if (booking.bookingType === "single_test" && booking.testId) {
        const [test] = await db
          .select({
            name: diagnosticTestCatalog.name,
            slug: diagnosticTestCatalog.slug,
          })
          .from(diagnosticTestCatalog)
          .where(eq(diagnosticTestCatalog.id, booking.testId))
          .limit(1);
        itemName = test?.name || "Unknown Test";
        itemSlug = test?.slug || "";
      } else if (booking.bookingType === "package" && booking.packageId) {
        const [pkg] = await db
          .select({
            name: testPackages.name,
            slug: testPackages.slug,
          })
          .from(testPackages)
          .where(eq(testPackages.id, booking.packageId))
          .limit(1);
        itemName = pkg?.name || "Unknown Package";
        itemSlug = pkg?.slug || "";
      }

      return {
        ...booking,
        collectionAddress: JSON.parse(booking.collectionAddress),
        itemName,
        itemSlug,
      };
    })
  );

  return c.json({ bookings: enriched });
});

// ─── Booking detail (patient) ────────────────────────────
router.get("/bookings/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.patientId, patient.id))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);

  let itemName = "";
  let itemDetails: any = null;

  if (booking.bookingType === "single_test" && booking.testId) {
    const [test] = await db
      .select()
      .from(diagnosticTestCatalog)
      .where(eq(diagnosticTestCatalog.id, booking.testId))
      .limit(1);
    itemName = test?.name || "Unknown Test";
    itemDetails = test;
  } else if (booking.bookingType === "package" && booking.packageId) {
    const [pkg] = await db
      .select()
      .from(testPackages)
      .where(eq(testPackages.id, booking.packageId))
      .limit(1);
    itemName = pkg?.name || "Unknown Package";

    if (pkg) {
      const items = await db
        .select({
          id: diagnosticTestCatalog.id,
          name: diagnosticTestCatalog.name,
          category: diagnosticTestCatalog.category,
          sampleType: diagnosticTestCatalog.sampleType,
        })
        .from(testPackageItems)
        .innerJoin(
          diagnosticTestCatalog,
          eq(testPackageItems.testId, diagnosticTestCatalog.id)
        )
        .where(eq(testPackageItems.packageId, pkg.id));

      itemDetails = { ...pkg, tests: items };
    }
  }

  return c.json({
    booking: {
      ...booking,
      collectionAddress: JSON.parse(booking.collectionAddress),
      itemName,
      itemDetails,
    },
  });
});

// ─── Cancel booking (patient) ────────────────────────────
router.patch("/bookings/:id/cancel", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = testBookingCancelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }

  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.patientId, patient.id))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);

  // Can only cancel active bookings (before sample collection)
  const cancellable = ["pending", "confirmed", "phlebotomist_assigned"];
  if (!cancellable.includes(booking.status)) {
    return c.json(
      {
        error: `Cannot cancel booking in '${booking.status}' status. Only bookings before sample collection can be cancelled.`,
      },
      400
    );
  }

  const [updated] = await db
    .update(testBookings)
    .set({
      status: "cancelled",
      cancellationReason: parsed.data.cancellationReason || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(testBookings.id, id))
    .returning();

  // Handle refund for online/card payments
  if (booking.paymentStatus === "paid") {
    await db
      .update(testBookings)
      .set({ paymentStatus: "refunded" })
      .where(eq(testBookings.id, id));
  }

  notify(db, userId, {
    type: "test_booking_cancelled",
    title: "Test Booking Cancelled",
    body: `Your booking has been cancelled.`,
    data: { bookingId: id },
  }).catch(() => {});

  audit(db, userId, {
    action: "cancel",
    resource: "test_booking",
    resourceId: id,
    details: { reason: parsed.data.cancellationReason },
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Reschedule booking (patient) ────────────────────────
router.patch("/bookings/:id/reschedule", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = testBookingRescheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }

  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.patientId, patient.id))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);

  const reschedulable = ["pending", "confirmed", "phlebotomist_assigned"];
  if (!reschedulable.includes(booking.status)) {
    return c.json(
      { error: `Cannot reschedule booking in '${booking.status}' status` },
      400
    );
  }

  // Reject past dates
  const today = new Date().toISOString().slice(0, 10);
  if (parsed.data.scheduledDate < today) {
    return c.json({ error: "Cannot reschedule to a past date" }, 400);
  }

  const [updated] = await db
    .update(testBookings)
    .set({
      scheduledDate: parsed.data.scheduledDate,
      scheduledTimeSlot: parsed.data.scheduledTimeSlot,
      status: "pending", // Reset to pending for re-confirmation
      phlebotomistId: null,
      phlebotomistName: null,
      phlebotomistPhone: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(testBookings.id, id))
    .returning();

  notify(db, userId, {
    type: "test_booking_rescheduled",
    title: "Test Booking Rescheduled",
    body: `Your booking has been rescheduled to ${parsed.data.scheduledDate}.`,
    data: { bookingId: id },
  }).catch(() => {});

  audit(db, userId, {
    action: "reschedule",
    resource: "test_booking",
    resourceId: id,
    details: {
      newDate: parsed.data.scheduledDate,
      newTimeSlot: parsed.data.scheduledTimeSlot,
    },
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Available time slots (public) ───────────────────────
router.get("/time-slots", (c) => {
  const slots = [
    { id: "morning_early", label: "Early Morning", time: "06:00-08:00", icon: "sunrise" },
    { id: "morning", label: "Morning", time: "08:00-10:00", icon: "sun" },
    { id: "morning_late", label: "Late Morning", time: "10:00-12:00", icon: "sun" },
    { id: "afternoon", label: "Afternoon", time: "12:00-14:00", icon: "sun" },
    { id: "afternoon_late", label: "Late Afternoon", time: "14:00-16:00", icon: "sun" },
    { id: "evening", label: "Evening", time: "16:00-18:00", icon: "sunset" },
  ];

  return c.json({ slots });
});

export default router;
