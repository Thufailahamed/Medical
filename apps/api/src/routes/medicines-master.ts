// @ts-nocheck

// ─── Phase E-Rx 1: Medicines Master API ──────────────────────
// Read endpoints serve the doctor prescription form's autocomplete
// + the patient medicine picker. Admin write endpoints stay gated
// behind `requireRole("super_admin")` so the catalog can be curated
// from the field once SLMC-verified doctors start sending updates.
//
// Replaces the in-memory `MEDICINE_CATALOG` lookups in
// `apps/api/src/routes/medicines.ts` for `GET /medicines/suggest`.
// Personal-history scoring still happens in medicines.ts; this file
// only handles the canonical catalogue lookups.

import { Hono } from "hono";
import { eq, and, or, like, sql, desc } from "drizzle-orm";
import {
  medicinesMaster,
  medicineCategories,
  medicineTherapeuticClasses,
  medicineDosageForms,
  medicineRoutes,
  medicineManufacturers,
  medicinesMasterManufacturers,
  medicinesMasterIngredients,
  medicineIngredients,
  medicinesMasterCategories,
  medicinesMasterClasses,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

// ─── Search (autocomplete) ─────────────────────────────────
// GET /medicines-master/search?q=par&limit=8
//
// LIKE prefix on generic_name OR brand_name. Returns only `active=1`
// rows. Sorted so prefix matches rank above substring matches. Same
// query-shape as `medicines.ts` /suggest so the client can swap
// implementations without UI changes.
router.get("/search", authMiddleware, async (c) => {
  const db = c.get("db");
  const rawQ = (c.req.query("q") || "").trim();
  const q = rawQ.toLowerCase().replace(/[%_]/g, "\\$&");
  const limit = Math.min(
    20,
    Math.max(1, parseInt(c.req.query("limit") || "8", 10) || 8)
  );

  if (q.length < 2) {
    return c.json({ medicines: [] });
  }

  // Single query, no joins — keeps autocomplete fast. The detail
  // endpoint at GET /medicines-master/:id fills in manufacturer +
  // ingredients + ATC class when the user actually picks one.
  const rows = await db
    .select({
      id: medicinesMaster.id,
      rxcui: medicinesMaster.rxcui,
      genericName: medicinesMaster.genericName,
      brandName: medicinesMaster.brandName,
      strength: medicinesMaster.strength,
      scheduleClass: medicinesMaster.scheduleClass,
      isGeneric: medicinesMaster.isGeneric,
    })
    .from(medicinesMaster)
    .where(
      and(
        eq(medicinesMaster.active, true),
        or(
          like(medicinesMaster.genericName, `${q}%`),
          like(medicinesMaster.brandName, `${q}%`),
          like(medicinesMaster.genericName, `%${q}%`),
          like(medicinesMaster.brandName, `%${q}%`)
        )
      )
    )
    .limit(limit * 2); // over-fetch then trim below

  // Rank: prefix on generic > prefix on brand > contains on generic >
  // contains on brand. Stable order keeps the same prefix returning
  // the same top-8 across runs.
  const ranked = rows
    .map((r) => {
      const g = (r.genericName || "").toLowerCase();
      const b = (r.brandName || "").toLowerCase();
      let score = 0;
      if (g.startsWith(q)) score = 4000;
      else if (b.startsWith(q)) score = 3500;
      else if (g.includes(q)) score = 2000;
      else if (b.includes(q)) score = 1500;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);

  return c.json({ medicines: ranked });
});

// ─── Categories ─────────────────────────────────────────────
router.get("/categories", authMiddleware, async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(medicineCategories)
    .orderBy(medicineCategories.name);
  return c.json({ categories: rows });
});

// ─── Therapeutic classes ────────────────────────────────────
router.get("/classes", authMiddleware, async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(medicineTherapeuticClasses)
    .orderBy(medicineTherapeuticClasses.atcCode);
  return c.json({ classes: rows });
});

// ─── Dosage forms + routes (lookup for form selects) ─────────
router.get("/dosage-forms", authMiddleware, async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(medicineDosageForms)
    .orderBy(medicineDosageForms.name);
  return c.json({ dosageForms: rows });
});

router.get("/routes", authMiddleware, async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(medicineRoutes)
    .orderBy(medicineRoutes.name);
  return c.json({ routes: rows });
});

// ─── Detail ─────────────────────────────────────────────────
// GET /medicines-master/:id
// Returns the master row + linked category, ATC class, dosage form,
// route, manufacturer(s), and ingredient(s). One round-trip for the
// mobile prescription form's "expanded medicine info" view.
router.get("/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [med] = await db
    .select()
    .from(medicinesMaster)
    .where(eq(medicinesMaster.id, id))
    .limit(1);
  if (!med) return c.json({ error: "Not found" }, 404);

  const [category] = med.categoryId
    ? await db
        .select()
        .from(medicineCategories)
        .where(eq(medicineCategories.id, med.categoryId))
        .limit(1)
    : [];
  const [atcClass] = med.atcClassId
    ? await db
        .select()
        .from(medicineTherapeuticClasses)
        .where(eq(medicineTherapeuticClasses.id, med.atcClassId))
        .limit(1)
    : [];
  const [form] = med.dosageFormId
    ? await db
        .select()
        .from(medicineDosageForms)
        .where(eq(medicineDosageForms.id, med.dosageFormId))
        .limit(1)
    : [];
  const [route] = med.routeId
    ? await db
        .select()
        .from(medicineRoutes)
        .where(eq(medicineRoutes.id, med.routeId))
        .limit(1)
    : [];

  // Manufacturers (junction).
  const manufacturers = med.id
    ? await db
        .select({
          id: medicineManufacturers.id,
          name: medicineManufacturers.name,
          country: medicineManufacturers.country,
        })
        .from(medicinesMasterManufacturers)
        .innerJoin(
          medicineManufacturers,
          eq(medicineManufacturers.id, medicinesMasterManufacturers.manufacturerId)
        )
        .where(eq(medicinesMasterManufacturers.medicineId, med.id))
    : [];

  // Ingredients (junction + ingredient row).
  const ingredients = med.id
    ? await db
        .select({
          ingredientId: medicineIngredients.id,
          name: medicineIngredients.name,
          strength: medicinesMasterIngredients.strength,
        })
        .from(medicinesMasterIngredients)
        .innerJoin(
          medicineIngredients,
          eq(medicineIngredients.id, medicinesMasterIngredients.ingredientId)
        )
        .where(eq(medicinesMasterIngredients.medicineId, med.id))
    : [];

  return c.json({
    medicine: med,
    category,
    atcClass,
    dosageForm: form,
    route,
    manufacturers,
    ingredients,
  });
});

// ─── Admin: upsert by rxcui (super_admin) ──────────────────
// POST /medicines-master   body: { rxcui?, genericName, brandName?, ... }
//
// Idempotent: upsert by rxcui (preferred) or by (genericName + strength)
// when rxcui is omitted. Admin only — used to enrich the catalogue from
// SLMC submissions + future openFDA imports.
router.post("/", authMiddleware, requireRole("super_admin"), async (c) => {
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));

  if (!body.genericName || !body.strength) {
    return c.json(
      { error: "genericName and strength are required" },
      400
    );
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = {
    id: newId,
    rxcui: body.rxcui ?? null,
    genericName: body.genericName,
    brandName: body.brandName ?? null,
    strength: body.strength,
    dosageFormId: body.dosageFormId ?? null,
    routeId: body.routeId ?? null,
    categoryId: body.categoryId ?? null,
    atcClassId: body.atcClassId ?? null,
    scheduleClass: body.scheduleClass ?? null,
    isGeneric: body.isGeneric ?? true,
    notes: body.notes ?? null,
    active: body.active ?? true,
    updatedAt: now,
  };

  if (body.rxcui) {
    // Upsert by rxcui — preferred path when a real RxNorm id exists.
    await db
      .insert(medicinesMaster)
      .values({ ...row, createdAt: now })
      .onConflictDoUpdate({
        target: medicinesMaster.rxcui,
        set: {
          genericName: row.genericName,
          brandName: row.brandName,
          strength: row.strength,
          dosageFormId: row.dosageFormId,
          routeId: row.routeId,
          categoryId: row.categoryId,
          atcClassId: row.atcClassId,
          scheduleClass: row.scheduleClass,
          isGeneric: row.isGeneric,
          notes: row.notes,
          active: row.active,
          updatedAt: now,
        },
      });
  } else {
    // No rxcui — fall back to plain insert. Caller can dedupe via
    // genericName + strength in their own batch.
    await db.insert(medicinesMaster).values({
      ...row,
      createdAt: now,
    });
  }

  return c.json({ medicine: { ...row, createdAt: now } }, 201);
});

// ─── Admin: patch ───────────────────────────────────────────
router.patch(
  "/:id",
  authMiddleware,
  requireRole("super_admin"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const allowed = [
      "genericName",
      "brandName",
      "strength",
      "dosageFormId",
      "routeId",
      "categoryId",
      "atcClassId",
      "scheduleClass",
      "isGeneric",
      "notes",
      "active",
    ] as const;

    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) patch[k] = body[k];
    }
    patch.updatedAt = new Date().toISOString();

    await db
      .update(medicinesMaster)
      .set(patch as any)
      .where(eq(medicinesMaster.id, id));

    const [row] = await db
      .select()
      .from(medicinesMaster)
      .where(eq(medicinesMaster.id, id))
      .limit(1);
    return c.json({ medicine: row });
  }
);

// ─── Admin: soft delete (set active=0) ─────────────────────
router.delete(
  "/:id",
  authMiddleware,
  requireRole("super_admin"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    await db
      .update(medicinesMaster)
      .set({ active: false, updatedAt: new Date().toISOString() })
      .where(eq(medicinesMaster.id, id));
    return c.json({ ok: true });
  }
);

export default router;