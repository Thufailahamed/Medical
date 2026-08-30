// @ts-nocheck
//
// Phase: lab-diagnostics-foundation (Task 3 — catalog API rewrite).
//
// End-to-end tests for the rewritten /diagnostic-tests/{catalog,
// categories, :slug, catalog/search, packages, packages/:slug}
// routes. Each route is mounted on a fresh Hono app alongside the
// real router under test (no stubbed auth middleware) so the tests
// exercise the live Drizzle queries + MockD1 wiring.
//
// MockD1 quirks (per memory): rows stored camelCase; `like`/`gte`
// don't parse — tests that filter by `q` use setWhere() (via the
// router) or seed their own predicate, but the row-shape assertions
// still flow through the real route.
//
// What's covered:
//   * categories: returns 5+ rows, ordering respected, trilingual
//     switch via ?locale=si|ta works
//   * catalog list: empty DB → empty list; seeded DB → ≥40 tests
//   * catalog filter by category (slug) returns only matching tests
//   * catalog filter by q (name / code / synonyms LIKE)
//   * catalog price filter (minPrice/maxPrice)
//   * catalog sort=price returns ascending
//   * catalog cursor: nextCursor populated when limit < total
//   * test by slug: returns canonical DTO + availableAt; 404 missing
//   * search alias: returns same shape as /catalog
//   * package list + detail: items + laboratoryCount hydrated
//
// All seeded via the real seedDiagnostics script so we hit the same
// row shapes the production server sees after `bun run seed:diagnostics`.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import diagnosticTestsRouter from "../src/routes/diagnostic-tests";
import { MockD1 } from "./_mockDb";
import { seedDiagnostics } from "../scripts/seed-diagnostics";
import type { AppEnvironment } from "../src/types";

const TEST_SECRET = "test-secret-do-not-use-in-prod";

async function makeToken(userId: string): Promise<string> {
  return sign(
    {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    } as any,
    TEST_SECRET,
  );
}

// Build a fresh Hono app with the catalog router mounted at
// /diagnostic-tests. Mirrors _testApp.ts but tailored to the public
// routes — we don't need auth on the catalog endpoints, but seeding
// the DB row + signing a token keeps authMiddleware quiet if a route
// ever opts into it later.
async function buildApp(db: MockD1, userId?: string) {
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = c.env || ({} as any);
    (c.env as any).JWT_SECRET = TEST_SECRET;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    if (userId) {
      const token = await makeToken(userId);
      const req = new Request(c.req.raw, {
        headers: {
          ...Object.fromEntries(c.req.raw.headers.entries()),
          Authorization: `Bearer ${token}`,
        },
      });
      c.req.raw = req;
    }
    await next();
  });
  app.route("/diagnostic-tests", diagnosticTestsRouter);
  return app;
}

async function getJson(app: Hono<AppEnvironment>, path: string) {
  return app.request(path, { method: "GET" });
}

function seedLabUser(db: MockD1) {
  db.seed("users", [
    {
      id: "lab-user-001",
      supabaseId: "supabase-lab1",
      role: "laboratory",
      name: "Test Lab",
      email: "lab@test.local",
    },
  ]);
}

describe("GET /diagnostic-tests/categories", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
    seedLabUser(db);
  });

  it("returns 5+ categories ordered by displayOrder ASC", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(await buildApp(db), "/diagnostic-tests/categories");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories.length).toBeGreaterThanOrEqual(15);
    // Ordering: each subsequent row's displayOrder >= previous
    const orders = body.categories.map((c: any) => c.displayOrder);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
    }
    // Required slugs from the seed brief.
    const slugs = body.categories.map((c: any) => c.slug);
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

  it("switches name field when ?locale=si", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/categories?locale=si",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const cardiology = body.categories.find((c: any) => c.slug === "cardiology");
    expect(cardiology).toBeDefined();
    expect(cardiology.name).toBe("හෘද රෝග");
  });

  it("switches name field when ?locale=ta", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/categories?locale=ta",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const diabetes = body.categories.find((c: any) => c.slug === "diabetes");
    expect(diabetes).toBeDefined();
    expect(diabetes.name).toBe("நீரிழிவு");
  });
});

describe("GET /diagnostic-tests/catalog", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
    seedLabUser(db);
  });

  it("returns empty list when DB has no tests", async () => {
    const res = await getJson(await buildApp(db), "/diagnostic-tests/catalog");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });

  it("returns ≥40 tests with the canonical DTO shape", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/catalog?limit=50",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(40);
    // Spot-check the DTO shape on the first row.
    const first = body.items[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("slug");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("categorySlug");
    expect(first).toHaveProperty("sampleType");
    expect(first).toHaveProperty("fastingRequired");
    expect(first).toHaveProperty("isBookable");
    expect(first).toHaveProperty("synonyms");
    expect(Array.isArray(first.synonyms)).toBe(true);
    expect(first).toHaveProperty("minPrice");
    expect(first).toHaveProperty("availableAt");
    expect(Array.isArray(first.availableAt)).toBe(true);
    expect(first).toHaveProperty("laboratoryCount");
    expect(first).toHaveProperty("visibility");
  });

  it("filters by category slug", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/catalog?category=diabetes&limit=50",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.categorySlug).toBe("diabetes");
    }
  });

  it("filters by q across name / code / synonyms", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/catalog?q=cbc&limit=50",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // The CBC tests carry "Full Blood Count" + "CBC" in name/synonyms.
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      const haystack =
        `${item.name} ${item.code ?? ""} ${(item.synonyms ?? []).join(" ")}`.toLowerCase();
      expect(haystack).toContain("cbc");
    }
  });

  it("filters by price range", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/catalog?minPrice=1500&maxPrice=2500&limit=50",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.minPrice).toBeGreaterThanOrEqual(1500);
      expect(item.minPrice).toBeLessThanOrEqual(2500);
    }
  });

  it("sort=price returns ascending", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/catalog?sort=price&limit=20",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    for (let i = 1; i < body.items.length; i++) {
      expect(body.items[i].minPrice).toBeGreaterThanOrEqual(
        body.items[i - 1].minPrice,
      );
    }
  });

  it("paginates with cursor when limit < total", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/catalog?limit=5",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(5);
    expect(body.nextCursor).toBeTruthy();
    // Follow the cursor — next page should also be 5 items.
    const res2 = await getJson(
      await buildApp(db),
      `/diagnostic-tests/catalog?limit=5&cursor=${encodeURIComponent(body.nextCursor)}`,
    );
    const body2 = await res2.json();
    expect(body2.items.length).toBeGreaterThan(0);
    // No overlap between pages.
    const idsPage1 = new Set(body.items.map((i: any) => i.id));
    for (const it of body2.items) {
      expect(idsPage1.has(it.id)).toBe(false);
    }
  });
});

describe("GET /diagnostic-tests/:slug (test detail)", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
    seedLabUser(db);
  });

  it("returns the canonical DTO + availableAt when slug exists", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/cbc",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.slug).toBe("cbc");
    expect(body.code).toBe("CBC");
    expect(body).toHaveProperty("availableAt");
    expect(Array.isArray(body.availableAt)).toBe(true);
    // At least one lab should have an active offer after seeding.
    expect(body.laboratoryCount).toBeGreaterThan(0);
  });

  it("returns 404 when slug does not exist", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/this-does-not-exist",
    );
    expect(res.status).toBe(404);
  });

  it("hides internal-visibility tests from the public endpoint", async () => {
    // Seed a single internal test directly so we don't depend on
    // whether the seed ships an internal row.
    db.seed("diagnostic_test_catalog", [
      {
        id: "test-internal-001",
        slug: "internal-marker",
        name: "Internal Marker",
        shortName: null,
        code: "INT-1",
        category: "other",
        categoryId: null,
        sampleType: "blood",
        fastingRequired: false,
        fastingHours: 0,
        homeCollectionAvailable: false,
        labCollectionAvailable: true,
        price: 100,
        discountPrice: null,
        turnaroundHours: 24,
        instructions: null,
        isActive: true,
        visibility: "internal",
        isBookable: false,
        isDoctorOrderable: true,
        synonyms: null,
        displayOrder: 0,
        currency: "LKR",
      },
    ]);
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/internal-marker",
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /diagnostic-tests/catalog/search (alias)", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
    seedLabUser(db);
  });

  it("returns the same shape as /catalog when ?q= is supplied", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/catalog/search?q=cbc&limit=50",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body).toHaveProperty("nextCursor");
    for (const item of body.items) {
      const haystack =
        `${item.name} ${item.code ?? ""} ${(item.synonyms ?? []).join(" ")}`.toLowerCase();
      expect(haystack).toContain("cbc");
    }
  });
});

describe("GET /diagnostic-tests/packages + /packages/:slug", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
    seedLabUser(db);
  });

  it("returns ≥8 packages hydrated with testCount + laboratoryCount", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/packages?limit=50",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(8);
    for (const pkg of body.items) {
      expect(pkg).toHaveProperty("slug");
      expect(pkg).toHaveProperty("name");
      expect(pkg).toHaveProperty("price");
      expect(pkg).toHaveProperty("tests");
      expect(Array.isArray(pkg.tests)).toBe(true);
      expect(pkg.testCount).toBeGreaterThan(0);
    }
  });

  it("package detail returns tests[] hydrated by slug", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/packages/full-body-health-checkup",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("full-body-health-checkup");
    expect(Array.isArray(body.tests)).toBe(true);
    expect(body.tests.length).toBeGreaterThan(0);
    expect(body.testCount).toBe(body.tests.length);
  });

  it("package detail 404 on missing slug", async () => {
    await seedDiagnostics(db, { imageMap: {}, skipNetworkFetch: true });
    const res = await getJson(
      await buildApp(db),
      "/diagnostic-tests/packages/does-not-exist",
    );
    expect(res.status).toBe(404);
  });
});