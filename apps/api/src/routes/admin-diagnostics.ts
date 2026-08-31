// @ts-nocheck
//
// Phase: lab-diagnostics-foundation (Task 5 — admin packages + image).
//
// super_admin CRUD for `test_packages` and image assignment. Distinct
// from the lab-portner-portal package routes which scope to the
// calling lab. Admin packages are global — `labPartnerId` is REQUIRED
// in payloads so the canonical ownership FK holds.

import { Hono } from "hono";
import { eq, and, desc, asc } from "drizzle-orm";
import { z } from "zod";
import {
  testPackages,
  testPackageItems,
  testPackageImages,
  diagnosticTestCatalog,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const adminRouter = new Hono<AppEnvironment>();
adminRouter.use("*", authMiddleware, requireRole("super_admin"));

const packageCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  discountPrice: z.number().nonnegative().optional(),
  labPartnerId: z.string().min(1),
  categoryId: z.string().optional(),
  category: z.string().optional(),
  preparation: z.string().max(2000).optional(),
  fastingRequired: z.boolean().optional(),
  sampleType: z.string().max(40).optional(),
  imageUrl: z.string().url().optional(),
  popular: z.boolean().optional(),
  featured: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  discountPercent: z.number().nonnegative().max(100).optional(),
  turnaroundHours: z.number().int().positive().optional(),
  instructions: z.string().max(2000).optional(),
  testIds: z.array(z.string().min(1)).optional(),
});

const packageUpdateSchema = packageCreateSchema.partial();

const packageImageSchema = z.object({
  imageUrl: z.string().url(),
  displayOrder: z.number().int().nonnegative().optional(),
});

// ─── List ───────────────────────────────────────────────

adminRouter.get("/diagnostics/packages", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(testPackages)
    .orderBy(desc(testPackages.featured), asc(testPackages.displayOrder), asc(testPackages.name));
  return c.json({ packages: rows });
});

// ─── Get one ────────────────────────────────────────────

adminRouter.get("/diagnostics/packages/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [pkg] = await db.select().from(testPackages).where(eq(testPackages.id, id)).limit(1);
  if (!pkg) return c.json({ error: "Package not found" }, 404);

  const items = await db
    .select({
      id: testPackageItems.id,
      testId: testPackageItems.testId,
      testSlug: diagnosticTestCatalog.slug,
      testName: diagnosticTestCatalog.name,
    })
    .from(testPackageItems)
    .innerJoin(diagnosticTestCatalog, eq(testPackageItems.testId, diagnosticTestCatalog.id))
    .where(eq(testPackageItems.packageId, id));

  const images = await db
    .select()
    .from(testPackageImages)
    .where(eq(testPackageImages.packageId, id))
    .orderBy(asc(testPackageImages.displayOrder));

  return c.json({ package: pkg, items, images });
});

// ─── Create ─────────────────────────────────────────────

adminRouter.post("/diagnostics/packages", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = packageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const data = parsed.data;

  const [dup] = await db
    .select({ id: testPackages.id })
    .from(testPackages)
    .where(eq(testPackages.slug, data.slug))
    .limit(1);
  if (dup) return c.json({ error: "A package with this slug already exists" }, 409);

  const [pkg] = await db
    .insert(testPackages)
    .values({
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      price: data.price,
      discountPrice: data.discountPrice ?? null,
      labPartnerId: data.labPartnerId,
      categoryId: data.categoryId ?? null,
      category: data.category ?? null,
      preparation: data.preparation ?? null,
      fastingRequired: data.fastingRequired ?? false,
      sampleType: data.sampleType ?? null,
      imageUrl: data.imageUrl ?? null,
      popular: data.popular ?? false,
      featured: data.featured ?? false,
      displayOrder: data.displayOrder ?? 0,
      discountPercent: data.discountPercent ?? null,
      turnaroundHours: data.turnaroundHours ?? 48,
      instructions: data.instructions ?? null,
    })
    .returning();

  if (data.testIds && data.testIds.length > 0) {
    for (const testId of data.testIds) {
      await db
        .insert(testPackageItems)
        .values({ packageId: pkg.id, testId })
        .onConflictDoNothing();
    }
  }

  audit(db, userId, {
    action: "create",
    resource: "test_package",
    resourceId: pkg.id,
    details: { name: data.name, slug: data.slug },
  }).catch(() => {});

  return c.json({ package: pkg }, 201);
});

// ─── Update ─────────────────────────────────────────────

adminRouter.patch("/diagnostics/packages/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = packageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const data = parsed.data;

  const [existing] = await db
    .select()
    .from(testPackages)
    .where(eq(testPackages.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "Package not found" }, 404);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const k of [
    "name", "slug", "description", "price", "discountPrice", "labPartnerId",
    "categoryId", "category", "preparation", "fastingRequired", "sampleType",
    "imageUrl", "popular", "featured", "displayOrder", "discountPercent",
    "turnaroundHours", "instructions",
  ] as const) {
    if (data[k] !== undefined) updates[k] = data[k];
  }

  const [updated] = await db
    .update(testPackages)
    .set(updates)
    .where(eq(testPackages.id, id))
    .returning();

  audit(db, userId, {
    action: "update",
    resource: "test_package",
    resourceId: id,
    details: Object.keys(updates),
  }).catch(() => {});

  return c.json({ package: updated });
});

// ─── Deactivate ─────────────────────────────────────────

adminRouter.delete("/diagnostics/packages/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [existing] = await db.select().from(testPackages).where(eq(testPackages.id, id)).limit(1);
  if (!existing) return c.json({ error: "Package not found" }, 404);

  await db
    .update(testPackages)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(testPackages.id, id));

  audit(db, userId, {
    action: "deactivate",
    resource: "test_package",
    resourceId: id,
  }).catch(() => {});

  return c.body(null, 204);
});

// ─── Image assignment ───────────────────────────────────
//
// Accepts a JSON body with `imageUrl`. Real multipart upload + R2
// plumbing belongs to a later phase; this endpoint lets admin wire a
// pre-uploaded CDN URL to the package and persists a row to
// test_package_images for the gallery.

adminRouter.put("/diagnostics/packages/:id/image", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = packageImageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const [existing] = await db.select().from(testPackages).where(eq(testPackages.id, id)).limit(1);
  if (!existing) return c.json({ error: "Package not found" }, 404);

  await db
    .update(testPackages)
    .set({ imageUrl: parsed.data.imageUrl, updatedAt: new Date().toISOString() })
    .where(eq(testPackages.id, id));

  const [img] = await db
    .insert(testPackageImages)
    .values({
      packageId: id,
      imageUrl: parsed.data.imageUrl,
      displayOrder: parsed.data.displayOrder ?? 0,
    })
    .returning();

  audit(db, userId, {
    action: "set-image",
    resource: "test_package",
    resourceId: id,
    details: { imageUrl: parsed.data.imageUrl },
  }).catch(() => {});

  return c.json({ image: img, package: { ...existing, imageUrl: parsed.data.imageUrl } });
});

export default adminRouter;
