// @ts-nocheck

import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import {
  diagnosticTestCatalog,
  labDiagnosticTests,
  testPackages,
  testPackageItems,
  testBookings,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  diagnosticTestCatalogSchema,
  testPackageSchema,
  assignPhlebotomistSchema,
  completeTestBookingSchema,
} from "../lib/validators";
import { flattenTranslated } from "../lib/validation-error";
import {
  enableTestSchema,
  updateCatalogSchema,
  bulkToggleSchema,
} from "@healthcare/shared";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

// All routes require laboratory role
router.use("*", authMiddleware, requireRole("laboratory", "super_admin"));

// ─── Phlebotomist roster (Lab Task 4) ───────────────────────
// Local drizzle table mirroring migration 0066/0078 `phlebotomists`.
// Kept local so the route works without a shared-schema bump; the
// table name matches the migration so MockD1 + D1 resolve identically.
const phlebotomists = sqliteTable("phlebotomists", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  labPartnerId: text("lab_partner_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

const createPhlebotomistSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(16),
  email: z.string().email().max(254).optional(),
});

const updatePhlebotomistSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(7).max(16).optional(),
  email: z.string().email().max(254).nullable().optional(),
  isActive: z.boolean().optional(),
});

// Back-compat assign input: phlebotomistId FK alone resolves the roster;
// free-text name/phone still works when provided (legacy callers).
const assignPhlebotomistInput = z.object({
  phlebotomistId: z.string().min(1),
  phlebotomistName: z.string().min(1).max(120).optional(),
  phlebotomistPhone: z.string().min(7).max(16).optional(),
});

// Helper: get the lab partner's user ID
function getLabId(c: any): string {
  return c.get("userId");
}

// Lab Task 3: R2 result URL validation.
// Canonical upload is POST /files/upload → `/files/download/<key>`.
// Accept:
//   - relative `/files...` (canonical same-origin R2 URL), or
//   - `https://<R2_PUBLIC_URL domain>/...` when R2_PUBLIC_URL /
//     R2_PUBLIC_BASE_URL is configured.
// Fallback (no R2 domain configured): allow any `https://` URL but the
// canonical store remains the `/files` upload (documented on complete).
function isValidResultPdfUrl(url: string, env: any): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.startsWith("/files")) return true;
  if (url.startsWith("https://")) {
    const base =
      env?.R2_PUBLIC_URL || env?.R2_PUBLIC_BASE_URL || env?.R2_PUBLIC_DOMAIN
        ? String(
            env?.R2_PUBLIC_URL ||
              env?.R2_PUBLIC_BASE_URL ||
              `https://${env?.R2_PUBLIC_DOMAIN}`
          )
        : null;
    if (base) return url.startsWith(base);
    // No R2 domain configured: allow any https URL (canonical is /files).
    return true;
  }
  return false;
}

// ─── List incoming bookings ──────────────────────────────
router.get("/bookings", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const statusFilter = c.req.query("status");
  const dateFilter = c.req.query("date");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(testBookings.labPartnerId, labId)];

  if (statusFilter) {
    conditions.push(eq(testBookings.status, statusFilter));
  }
  if (dateFilter) {
    conditions.push(eq(testBookings.scheduledDate, dateFilter));
  }

  const rows = await db
    .select()
    .from(testBookings)
    .where(and(...conditions))
    .orderBy(asc(testBookings.scheduledDate), asc(testBookings.scheduledTimeSlot))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(testBookings)
    .where(and(...conditions));

  // Enrich with test/package names
  const enriched = await Promise.all(
    rows.map(async (booking) => {
      let itemName = "";
      if (booking.bookingType === "single_test" && booking.testId) {
        const [test] = await db
          .select({ name: diagnosticTestCatalog.name })
          .from(diagnosticTestCatalog)
          .where(eq(diagnosticTestCatalog.id, booking.testId))
          .limit(1);
        itemName = test?.name || "Unknown Test";
      } else if (booking.bookingType === "package" && booking.packageId) {
        const [pkg] = await db
          .select({ name: testPackages.name })
          .from(testPackages)
          .where(eq(testPackages.id, booking.packageId))
          .limit(1);
        itemName = pkg?.name || "Unknown Package";
      }

      // Get patient info
      const [patient] = await db
        .select({
          name: users.name,
          phone: users.phone,
          email: users.email,
        })
        .from(users)
        .innerJoin(
          sql`patients`,
          sql`patients.user_id = ${users.id}`
        )
        .where(sql`patients.id = ${booking.patientId}`)
        .limit(1);

      return {
        ...booking,
        collectionAddress: JSON.parse(booking.collectionAddress),
        itemName,
        patientName: patient?.name || "Unknown",
        patientPhone: patient?.phone,
        patientEmail: patient?.email,
      };
    })
  );

  return c.json({ bookings: enriched, total: count, page, limit });
});

// ─── Get booking detail ──────────────────────────────────
router.get("/bookings/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.labPartnerId, labId))
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

// ─── Confirm booking ─────────────────────────────────────
router.patch("/bookings/:id/confirm", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.labPartnerId, labId))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.status !== "pending") {
    return c.json(
      { error: `Cannot confirm booking in '${booking.status}' status` },
      400
    );
  }

  const [updated] = await db
    .update(testBookings)
    .set({ status: "confirmed", updatedAt: new Date().toISOString() })
    .where(eq(testBookings.id, id))
    .returning();

  // Notify patient
  notify({
    db,
    env: c.env,
    userId: booking.patientId,
    type: "lab_ready",
    title: "Booking Confirmed",
    body: "Your test booking has been confirmed by the lab.",
    data: { bookingId: id, kind: "test_booking_confirmed" },
  }).catch(() => {});

  audit(db, labId, {
    action: "confirm",
    resource: "test_booking",
    resourceId: id,
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Assign phlebotomist ─────────────────────────────────
// Lab Task 4: accepts `phlebotomistId` FK (roster lookup scoped to
// labPartnerId) while keeping back-compat free-text name/phone.
//   - { phlebotomistId, phlebotomistName, phlebotomistPhone } → legacy path.
//   - { phlebotomistId } → roster lookup; 404 when unknown/other-lab.
router.patch("/bookings/:id/assign-phlebotomist", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = assignPhlebotomistInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.labPartnerId, labId))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);

  const assignable = ["confirmed", "pending"];
  if (!assignable.includes(booking.status)) {
    return c.json(
      { error: `Cannot assign phlebotomist in '${booking.status}' status` },
      400
    );
  }

  // Resolve name/phone: free-text wins (back-compat); otherwise roster FK.
  let resolvedName = parsed.data.phlebotomistName;
  let resolvedPhone = parsed.data.phlebotomistPhone;
  if (!resolvedName || !resolvedPhone) {
    const [roster] = await db
      .select()
      .from(phlebotomists)
      .where(
        and(
          eq(phlebotomists.id, parsed.data.phlebotomistId),
          eq(phlebotomists.labPartnerId, labId)
        )
      )
      .limit(1);
    if (!roster) return c.json({ error: "Phlebotomist not found" }, 404);
    resolvedName = resolvedName || (roster as any).name;
    resolvedPhone = resolvedPhone || (roster as any).phone;
  }

  const [updated] = await db
    .update(testBookings)
    .set({
      status: "phlebotomist_assigned",
      phlebotomistId: parsed.data.phlebotomistId,
      phlebotomistName: resolvedName,
      phlebotomistPhone: resolvedPhone,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(testBookings.id, id))
    .returning();

  // Notify patient with phlebotomist details
  notify({
    db,
    env: c.env,
    userId: booking.patientId,
    type: "lab_ready",
    title: "Phlebotomist Assigned",
    body: `${resolvedName} has been assigned for your sample collection.`,
    data: { bookingId: id, kind: "test_booking_phlebotomist_assigned" },
  }).catch(() => {});

  audit(db, labId, {
    action: "assign_phlebotomist",
    resource: "test_booking",
    resourceId: id,
    details: { phlebotomistName: resolvedName },
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Mark phlebotomist en-route ──────────────────────────
// Lab Task 3: missing `en-route` writer for the 9-state enum.
// Transition: phlebotomist_assigned → sample_collection_en_route.
// Scoped to owning labPartnerId; notifies patient via lab_ready.
router.patch("/bookings/:id/en-route", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.labPartnerId, labId))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.status !== "phlebotomist_assigned") {
    return c.json(
      { error: `Cannot mark en-route in '${booking.status}' status` },
      400
    );
  }

  const [updated] = await db
    .update(testBookings)
    .set({
      status: "sample_collection_en_route",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(testBookings.id, id))
    .returning();

  notify({
    db,
    env: c.env,
    userId: booking.patientId,
    type: "lab_ready",
    title: "Phlebotomist En Route",
    body: "Your phlebotomist is on the way for sample collection.",
    data: { bookingId: id, kind: "test_booking_en_route" },
  }).catch(() => {});

  audit(db, labId, {
    action: "en_route",
    resource: "test_booking",
    resourceId: id,
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Mark sample collected ───────────────────────────────
router.patch("/bookings/:id/collect-sample", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.labPartnerId, labId))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);

  const collectable = ["phlebotomist_assigned", "sample_collection_en_route"];
  if (!collectable.includes(booking.status)) {
    return c.json(
      { error: `Cannot mark sample collected in '${booking.status}' status` },
      400
    );
  }

  const [updated] = await db
    .update(testBookings)
    .set({
      status: "sample_collected",
      // Mark cash payments as paid upon collection
      paymentStatus:
        booking.paymentMethod === "cash" && booking.paymentStatus === "cash_on_collection"
          ? "paid"
          : booking.paymentStatus,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(testBookings.id, id))
    .returning();

  notify({
    db,
    env: c.env,
    userId: booking.patientId,
    type: "lab_ready",
    title: "Sample Collected",
    body: "Your sample has been collected. Results will be available soon.",
    data: { bookingId: id, kind: "test_booking_sample_collected" },
  }).catch(() => {});

  audit(db, labId, {
    action: "sample_collected",
    resource: "test_booking",
    resourceId: id,
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Mark in progress ────────────────────────────────────
router.patch("/bookings/:id/in-progress", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.labPartnerId, labId))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.status !== "sample_collected") {
    return c.json(
      { error: `Cannot mark in progress in '${booking.status}' status` },
      400
    );
  }

  const [updated] = await db
    .update(testBookings)
    .set({
      status: "in_progress",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(testBookings.id, id))
    .returning();

  audit(db, labId, {
    action: "in_progress",
    resource: "test_booking",
    resourceId: id,
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Complete booking (upload results) ───────────────────
//
// Canonical result store (Lab Task 3):
//   - `test_bookings.resultPdfUrl / resultSummary / resultReadyAt` is the
//     canonical patient-visible result for D2C lab bookings.
//   - `lab_reports` is only linked for doctor-ordered tests (physician
//     workflow); D2C fulfillment must not write `lab_reports` rows.
//   - `resultPdfUrl` must be the canonical `/files` R2 URL from
//     POST /files/upload (or the configured https:// R2 domain).
router.patch("/bookings/:id/complete", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = completeTestBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }

  // Lab Task 3: require R2/file URL (canonical POST /files/upload).
  if (!parsed.data.resultPdfUrl) {
    return c.json(
      { error: "resultPdfUrl is required (upload via POST /files/upload)" },
      400
    );
  }
  if (!isValidResultPdfUrl(parsed.data.resultPdfUrl, c.env)) {
    return c.json(
      { error: "resultPdfUrl must be a /files R2 URL (upload via POST /files/upload)" },
      400
    );
  }

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.labPartnerId, labId))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);

  const completable = ["in_progress", "sample_collected"];
  if (!completable.includes(booking.status)) {
    return c.json(
      { error: `Cannot complete booking in '${booking.status}' status` },
      400
    );
  }

  const now = new Date().toISOString();
  const [updated] = await db
    .update(testBookings)
    .set({
      status: "completed",
      resultPdfUrl: parsed.data.resultPdfUrl || null,
      resultSummary: parsed.data.resultSummary || null,
      resultReadyAt: now,
      notes: parsed.data.notes || booking.notes,
      updatedAt: now,
    })
    .where(eq(testBookings.id, id))
    .returning();

  // Notify patient that results are ready
  notify({
    db,
    env: c.env,
    userId: booking.patientId,
    type: "lab_ready",
    title: "Test Results Ready",
    body: "Your test results are now available. Tap to view.",
    data: { bookingId: id, kind: "test_booking_completed" },
  }).catch(() => {});

  audit(db, labId, {
    action: "complete",
    resource: "test_booking",
    resourceId: id,
    details: { resultPdfUrl: parsed.data.resultPdfUrl },
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Cancel booking (lab side) ───────────────────────────
router.patch("/bookings/:id/cancel", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const [booking] = await db
    .select()
    .from(testBookings)
    .where(
      and(eq(testBookings.id, id), eq(testBookings.labPartnerId, labId))
    )
    .limit(1);

  if (!booking) return c.json({ error: "Booking not found" }, 404);

  const cancellable = [
    "pending",
    "confirmed",
    "phlebotomist_assigned",
    "sample_collection_en_route",
  ];
  if (!cancellable.includes(booking.status)) {
    return c.json(
      { error: `Cannot cancel booking in '${booking.status}' status` },
      400
    );
  }

  const [updated] = await db
    .update(testBookings)
    .set({
      status: "cancelled",
      cancellationReason: body.reason || "Cancelled by lab",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(testBookings.id, id))
    .returning();

  notify({
    db,
    env: c.env,
    userId: booking.patientId,
    type: "lab_ready",
    title: "Booking Cancelled",
    body: "Your test booking has been cancelled by the lab. Please contact support for details.",
    data: { bookingId: id, kind: "test_booking_cancelled" },
  }).catch(() => {});

  audit(db, labId, {
    action: "cancel",
    resource: "test_booking",
    resourceId: id,
    details: { reason: body.reason },
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Manage Catalog ──────────────────────────────────────

// Add test to catalog
router.post("/catalog", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);

  const body = await c.req.json().catch(() => ({}));
  const parsed = diagnosticTestCatalogSchema.safeParse(body);
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

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: diagnosticTestCatalog.id })
    .from(diagnosticTestCatalog)
    .where(eq(diagnosticTestCatalog.slug, data.slug))
    .limit(1);

  if (existing) {
    return c.json({ error: "A test with this slug already exists" }, 409);
  }

  const [test] = await db
    .insert(diagnosticTestCatalog)
    .values({
      name: data.name,
      slug: data.slug,
      category: data.category,
      description: data.description || null,
      sampleType: data.sampleType,
      fastingRequired: data.fastingRequired,
      fastingHours: data.fastingHours,
      homeCollectionAvailable: data.homeCollectionAvailable,
      price: data.price,
      discountPrice: data.discountPrice || null,
      labPartnerId: labId,
      turnaroundHours: data.turnaroundHours,
      instructions: data.instructions || null,
    })
    .returning();

  audit(db, labId, {
    action: "create",
    resource: "diagnostic_test",
    resourceId: test.id,
    details: { name: data.name, category: data.category },
  }).catch(() => {});

  return c.json({ test }, 201);
});

// Update test in catalog
router.put("/catalog/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(diagnosticTestCatalog)
    .where(
      and(
        eq(diagnosticTestCatalog.id, id),
        eq(diagnosticTestCatalog.labPartnerId, labId)
      )
    )
    .limit(1);

  if (!existing) return c.json({ error: "Test not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = diagnosticTestCatalogSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }

  const [updated] = await db
    .update(diagnosticTestCatalog)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(diagnosticTestCatalog.id, id))
    .returning();

  audit(db, labId, {
    action: "update",
    resource: "diagnostic_test",
    resourceId: id,
    details: parsed.data,
  }).catch(() => {});

  return c.json({ test: updated });
});

// Delete (deactivate) test from catalog
router.delete("/catalog/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(diagnosticTestCatalog)
    .where(
      and(
        eq(diagnosticTestCatalog.id, id),
        eq(diagnosticTestCatalog.labPartnerId, labId)
      )
    )
    .limit(1);

  if (!existing) return c.json({ error: "Test not found" }, 404);

  await db
    .update(diagnosticTestCatalog)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(diagnosticTestCatalog.id, id));

  audit(db, labId, {
    action: "deactivate",
    resource: "diagnostic_test",
    resourceId: id,
  }).catch(() => {});

  return c.json({ success: true });
});

// List lab's own catalog
router.get("/catalog", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);

  const rows = await db
    .select()
    .from(diagnosticTestCatalog)
    .where(eq(diagnosticTestCatalog.labPartnerId, labId))
    .orderBy(asc(diagnosticTestCatalog.category), asc(diagnosticTestCatalog.name));

  return c.json({ tests: rows });
});

// ─── Manage Packages ─────────────────────────────────────

// Create package
router.post("/packages", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);

  const body = await c.req.json().catch(() => ({}));
  const parsed = testPackageSchema.safeParse(body);
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

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: testPackages.id })
    .from(testPackages)
    .where(eq(testPackages.slug, data.slug))
    .limit(1);

  if (existing) {
    return c.json({ error: "A package with this slug already exists" }, 409);
  }

  // Verify all tests exist and belong to this lab
  const tests = await db
    .select({ id: diagnosticTestCatalog.id })
    .from(diagnosticTestCatalog)
    .where(
      and(
        inArray(diagnosticTestCatalog.id, data.testIds),
        eq(diagnosticTestCatalog.labPartnerId, labId),
        eq(diagnosticTestCatalog.isActive, true)
      )
    );

  if (tests.length !== data.testIds.length) {
    return c.json(
      { error: "Some test IDs are invalid or don't belong to your lab" },
      400
    );
  }

  const [pkg] = await db
    .insert(testPackages)
    .values({
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      price: data.price,
      discountPrice: data.discountPrice || null,
      labPartnerId: labId,
      turnaroundHours: data.turnaroundHours,
      instructions: data.instructions || null,
    })
    .returning();

  // Link tests to package
  if (pkg) {
    await db.insert(testPackageItems).values(
      data.testIds.map((testId) => ({
        packageId: pkg.id,
        testId,
      }))
    );
  }

  audit(db, labId, {
    action: "create",
    resource: "test_package",
    resourceId: pkg.id,
    details: { name: data.name, testCount: data.testIds.length },
  }).catch(() => {});

  return c.json({ package: pkg }, 201);
});

// Update package
router.put("/packages/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(testPackages)
    .where(
      and(eq(testPackages.id, id), eq(testPackages.labPartnerId, labId))
    )
    .limit(1);

  if (!existing) return c.json({ error: "Package not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = testPackageSchema.partial().safeParse(body);
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

  const updateData: any = { updatedAt: new Date().toISOString() };
  if (data.name) updateData.name = data.name;
  if (data.slug) updateData.slug = data.slug;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price) updateData.price = data.price;
  if (data.discountPrice !== undefined) updateData.discountPrice = data.discountPrice;
  if (data.turnaroundHours) updateData.turnaroundHours = data.turnaroundHours;
  if (data.instructions !== undefined) updateData.instructions = data.instructions;

  const [updated] = await db
    .update(testPackages)
    .set(updateData)
    .where(eq(testPackages.id, id))
    .returning();

  // If testIds provided, update the package items
  if (data.testIds) {
    // Verify tests belong to this lab
    const tests = await db
      .select({ id: diagnosticTestCatalog.id })
      .from(diagnosticTestCatalog)
      .where(
        and(
          inArray(diagnosticTestCatalog.id, data.testIds),
          eq(diagnosticTestCatalog.labPartnerId, labId),
          eq(diagnosticTestCatalog.isActive, true)
        )
      );

    if (tests.length !== data.testIds.length) {
      return c.json(
        { error: "Some test IDs are invalid or don't belong to your lab" },
        400
      );
    }

    // Remove old items and add new ones
    await db
      .delete(testPackageItems)
      .where(eq(testPackageItems.packageId, id));

    await db.insert(testPackageItems).values(
      data.testIds.map((testId) => ({
        packageId: id,
        testId,
      }))
    );
  }

  audit(db, labId, {
    action: "update",
    resource: "test_package",
    resourceId: id,
    details: data,
  }).catch(() => {});

  return c.json({ package: updated });
});

// Delete (deactivate) package
router.delete("/packages/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(testPackages)
    .where(
      and(eq(testPackages.id, id), eq(testPackages.labPartnerId, labId))
    )
    .limit(1);

  if (!existing) return c.json({ error: "Package not found" }, 404);

  await db
    .update(testPackages)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(testPackages.id, id));

  audit(db, labId, {
    action: "deactivate",
    resource: "test_package",
    resourceId: id,
  }).catch(() => {});

  return c.json({ success: true });
});

// List lab's own packages
router.get("/packages", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);

  const rows = await db
    .select()
    .from(testPackages)
    .where(eq(testPackages.labPartnerId, labId))
    .orderBy(asc(testPackages.name));

  return c.json({ packages: rows });
});

// ─── Phlebotomist roster CRUD (Lab Task 4) ────────────────
// Scoped to labPartnerId. Soft deactivate on DELETE.

router.get("/phlebotomists", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const rows = await db
    .select()
    .from(phlebotomists)
    .where(eq(phlebotomists.labPartnerId, labId))
    .orderBy(asc(phlebotomists.name));
  const mapped = (rows as any[]).map((r: any) => ({
    id: r.id,
    labPartnerId: r.labPartnerId ?? r.lab_partner_id ?? labId,
    name: r.name,
    phone: r.phone,
    email: r.email ?? null,
    isActive: r.isActive ?? r.is_active ?? true,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  }));
  return c.json({ phlebotomists: mapped });
});

router.post("/phlebotomists", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = createPhlebotomistSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }
  const now = new Date().toISOString();
  const [row] = await db
    .insert(phlebotomists)
    .values({
      id: crypto.randomUUID(),
      labPartnerId: labId,
      name: parsed.data.name.trim(),
      phone: parsed.data.phone.trim(),
      email: parsed.data.email ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  audit(db, labId, {
    action: "create",
    resource: "phlebotomist",
    resourceId: (row as any).id,
    details: { name: parsed.data.name },
  }).catch(() => {});
  const mapped: any = {
    id: (row as any).id,
    labPartnerId: labId,
    name: (row as any).name,
    phone: (row as any).phone,
    email: (row as any).email ?? null,
    isActive: true,
    createdAt: (row as any).createdAt ?? now,
  };
  return c.json({ phlebotomist: mapped }, 201);
});

router.put("/phlebotomists/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = updatePhlebotomistSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }
  const [existing] = await db
    .select()
    .from(phlebotomists)
    .where(
      and(eq(phlebotomists.id, id), eq(phlebotomists.labPartnerId, labId))
    )
    .limit(1);
  if (!existing) return c.json({ error: "Phlebotomist not found" }, 404);
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone.trim();
  if (parsed.data.email !== undefined) patch.email = parsed.data.email;
  if (parsed.data.isActive !== undefined) patch.isActive = parsed.data.isActive;
  const [updated] = await db
    .update(phlebotomists)
    .set(patch)
    .where(eq(phlebotomists.id, id))
    .returning();
  audit(db, labId, {
    action: "update",
    resource: "phlebotomist",
    resourceId: id,
    details: parsed.data,
  }).catch(() => {});
  const u: any = (updated as any) ?? { ...existing, ...patch };
  return c.json({
    phlebotomist: {
      id: u.id,
      labPartnerId: labId,
      name: u.name,
      phone: u.phone,
      email: u.email ?? null,
      isActive: u.isActive ?? u.is_active ?? true,
      createdAt: u.createdAt ?? u.created_at,
      updatedAt: u.updatedAt ?? u.updated_at,
    },
  });
});

router.delete("/phlebotomists/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(phlebotomists)
    .where(
      and(eq(phlebotomists.id, id), eq(phlebotomists.labPartnerId, labId))
    )
    .limit(1);
  if (!existing) return c.json({ error: "Phlebotomist not found" }, 404);
  await db
    .update(phlebotomists)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(phlebotomists.id, id));
  audit(db, labId, {
    action: "deactivate",
    resource: "phlebotomist",
    resourceId: id,
  }).catch(() => {});
  return c.json({ success: true });
});

// ─── Dashboard stats ─────────────────────────────────────
router.get("/stats", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);

  const today = new Date().toISOString().slice(0, 10);

  const [totalBookings] = await db
    .select({ count: sql<number>`count(*)` })
    .from(testBookings)
    .where(eq(testBookings.labPartnerId, labId));

  const [todayBookings] = await db
    .select({ count: sql<number>`count(*)` })
    .from(testBookings)
    .where(
      and(
        eq(testBookings.labPartnerId, labId),
        eq(testBookings.scheduledDate, today)
      )
    );

  const [pendingBookings] = await db
    .select({ count: sql<number>`count(*)` })
    .from(testBookings)
    .where(
      and(
        eq(testBookings.labPartnerId, labId),
        eq(testBookings.status, "pending")
      )
    );

  const [completedBookings] = await db
    .select({ count: sql<number>`count(*)` })
    .from(testBookings)
    .where(
      and(
        eq(testBookings.labPartnerId, labId),
        eq(testBookings.status, "completed")
      )
    );

  const [activeTests] = await db
    .select({ count: sql<number>`count(*)` })
    .from(diagnosticTestCatalog)
    .where(
      and(
        eq(diagnosticTestCatalog.labPartnerId, labId),
        eq(diagnosticTestCatalog.isActive, true)
      )
    );

  return c.json({
    stats: {
      totalBookings: totalBookings.count,
      todayBookings: todayBookings.count,
      pendingBookings: pendingBookings.count,
      completedBookings: completedBookings.count,
      activeTests: activeTests.count,
    },
  });
});

// ─── Manage Diagnostic Test Availability (Phase 4 / Task 4) ─────
//
// Per-lab availability against the canonical diagnostic_test_catalog.
// Lives in `lab_diagnostic_tests` (0076 migration). Distinct from
// the legacy `/catalog` routes above, which mutate `diagnostic_test_catalog`
// directly. The new path-prefixed routes (`/diagnostic-tests-availability`)
// keep both flows runnable side-by-side; legacy routes can be retired
// in a later cleanup pass.

router.get("/diagnostic-tests-availability", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const includeInactive = c.req.query("includeInactive") === "true";

  const rows = await db
    .select({
      id: labDiagnosticTests.id,
      testId: labDiagnosticTests.testId,
      price: labDiagnosticTests.price,
      discountPrice: labDiagnosticTests.discountPrice,
      currency: labDiagnosticTests.currency,
      homeCollectionAvailable: labDiagnosticTests.homeCollectionAvailable,
      labCollectionAvailable: labDiagnosticTests.labCollectionAvailable,
      turnaroundHours: labDiagnosticTests.turnaroundHours,
      specialInstructions: labDiagnosticTests.specialInstructions,
      isActive: labDiagnosticTests.isActive,
      updatedAt: labDiagnosticTests.updatedAt,
      testSlug: diagnosticTestCatalog.slug,
      testName: diagnosticTestCatalog.name,
      testCode: diagnosticTestCatalog.code,
    })
    .from(labDiagnosticTests)
    .innerJoin(
      diagnosticTestCatalog,
      eq(labDiagnosticTests.testId, diagnosticTestCatalog.id)
    )
    .where(
      and(
        eq(labDiagnosticTests.labPartnerId, labId),
        includeInactive
          ? sql`1=1`
          : eq(labDiagnosticTests.isActive, true)
      )
    )
    .orderBy(asc(diagnosticTestCatalog.name));

  // Map rows to LabCatalogRowDTO shape (joined with lab name).
  const labRow = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, labId))
    .limit(1);
  const labName = labRow[0]?.name ?? "Lab";

  const items = rows.map((r) => ({
    id: r.id,
    testId: r.testId,
    labId,
    labName,
    labPartnerId: labId,
    price: r.price,
    discountPrice: r.discountPrice ?? null,
    currency: r.currency,
    homeCollectionAvailable: r.homeCollectionAvailable,
    labCollectionAvailable: r.labCollectionAvailable,
    turnaroundHours: r.turnaroundHours ?? null,
    testSlug: r.testSlug,
    testName: r.testName,
    testCode: r.testCode ?? null,
    lastToggledAt: r.updatedAt,
  }));

  return c.json({ items });
});

router.post("/diagnostic-tests-availability", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);

  const body = await c.req.json().catch(() => ({}));
  const parsed = enableTestSchema.safeParse(body);
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

  // Validate testId exists in canonical catalog.
  const [catalogTest] = await db
    .select({ id: diagnosticTestCatalog.id })
    .from(diagnosticTestCatalog)
    .where(eq(diagnosticTestCatalog.id, data.testId))
    .limit(1);
  if (!catalogTest) return c.json({ error: "Test not found" }, 404);

  if (data.discountPrice !== undefined && data.discountPrice >= data.price) {
    return c.json(
      { error: "discountPrice must be less than price" },
      400
    );
  }

  // Reject if (labPartnerId, testId) already enabled.
  const [conflict] = await db
    .select({ id: labDiagnosticTests.id })
    .from(labDiagnosticTests)
    .where(
      and(
        eq(labDiagnosticTests.labPartnerId, labId),
        eq(labDiagnosticTests.testId, data.testId)
      )
    )
    .limit(1);
  if (conflict) {
    return c.json(
      { error: "Test already enabled. Use PATCH to update." },
      409
    );
  }

  const [row] = await db
    .insert(labDiagnosticTests)
    .values({
      labPartnerId: labId,
      testId: data.testId,
      price: data.price,
      discountPrice: data.discountPrice ?? null,
      currency: data.currency ?? "LKR",
      homeCollectionAvailable: data.homeCollectionAvailable ?? true,
      labCollectionAvailable: data.labCollectionAvailable ?? true,
      turnaroundHours: data.turnaroundHours ?? null,
      specialInstructions: data.specialInstructions ?? null,
      isActive: true,
    })
    .returning();

  audit(db, labId, {
    action: "create",
    resource: "lab_diagnostic_test",
    resourceId: row.id,
    details: { testId: data.testId, price: data.price },
  }).catch(() => {});

  return c.json({ row }, 201);
});

router.patch("/diagnostic-tests-availability/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateCatalogSchema.safeParse(body);
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

  const [existing] = await db
    .select()
    .from(labDiagnosticTests)
    .where(
      and(
        eq(labDiagnosticTests.id, id),
        eq(labDiagnosticTests.labPartnerId, labId)
      )
    )
    .limit(1);
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.price !== undefined) updates.price = data.price;
  if (data.discountPrice !== undefined)
    updates.discountPrice = data.discountPrice;
  if (data.homeCollectionAvailable !== undefined)
    updates.homeCollectionAvailable = data.homeCollectionAvailable;
  if (data.labCollectionAvailable !== undefined)
    updates.labCollectionAvailable = data.labCollectionAvailable;
  if (data.turnaroundHours !== undefined)
    updates.turnaroundHours = data.turnaroundHours;
  if (data.specialInstructions !== undefined)
    updates.specialInstructions = data.specialInstructions;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const [updated] = await db
    .update(labDiagnosticTests)
    .set(updates)
    .where(eq(labDiagnosticTests.id, id))
    .returning();

  audit(db, labId, {
    action: "update",
    resource: "lab_diagnostic_test",
    resourceId: id,
    details: Object.keys(updates),
  }).catch(() => {});

  return c.json({ row: updated });
});

router.delete("/diagnostic-tests-availability/:id", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(labDiagnosticTests)
    .where(
      and(
        eq(labDiagnosticTests.id, id),
        eq(labDiagnosticTests.labPartnerId, labId)
      )
    )
    .limit(1);
  if (!existing) return c.json({ error: "Not found" }, 404);

  await db
    .update(labDiagnosticTests)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(labDiagnosticTests.id, id));

  audit(db, labId, {
    action: "deactivate",
    resource: "lab_diagnostic_test",
    resourceId: id,
  }).catch(() => {});

  return c.body(null, 204);
});

router.post("/diagnostic-tests-availability/bulk-toggle", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);

  const body = await c.req.json().catch(() => ({}));
  const parsed = bulkToggleSchema.safeParse(body);
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

  if (data.enabled) {
    if (data.price === undefined) {
      return c.json(
        { error: "price is required when enabling tests" },
        400
      );
    }
    // Resolve canonical tests exist; collect existing rows.
    const existingRows = await db
      .select({ id: labDiagnosticTests.id, testId: labDiagnosticTests.testId })
      .from(labDiagnosticTests)
      .where(
        and(
          eq(labDiagnosticTests.labPartnerId, labId),
          inArray(labDiagnosticTests.testId, data.testIds)
        )
      );
    const existingByTest = new Map(existingRows.map((r) => [r.testId, r.id]));
    let enabledCount = 0;
    for (const testId of data.testIds) {
      if (existingByTest.has(testId)) {
        await db
          .update(labDiagnosticTests)
          .set({ isActive: true, updatedAt: new Date().toISOString() })
          .where(eq(labDiagnosticTests.id, existingByTest.get(testId)!));
      } else {
        await db.insert(labDiagnosticTests).values({
          labPartnerId: labId,
          testId,
          price: data.price!,
          currency: data.currency ?? "LKR",
          homeCollectionAvailable: true,
          labCollectionAvailable: true,
          isActive: true,
        });
      }
      enabledCount++;
    }
    audit(db, labId, {
      action: "bulk-toggle",
      resource: "lab_diagnostic_test",
      details: { enabled: true, count: enabledCount },
    }).catch(() => {});
    return c.json({ enabledCount, disabledCount: 0 });
  } else {
    let disabledCount = 0;
    for (const testId of data.testIds) {
      const result = await db
        .update(labDiagnosticTests)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(labDiagnosticTests.labPartnerId, labId),
            eq(labDiagnosticTests.testId, testId)
          )
        )
        .returning({ id: labDiagnosticTests.id });
      disabledCount += result.length;
    }
    audit(db, labId, {
      action: "bulk-toggle",
      resource: "lab_diagnostic_test",
      details: { enabled: false, count: disabledCount },
    }).catch(() => {});
    return c.json({ enabledCount: 0, disabledCount });
  }
});

export default router;
