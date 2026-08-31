// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
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

// Helper: get the lab partner's user ID
function getLabId(c: any): string {
  return c.get("userId");
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
  notify(db, booking.patientId, {
    type: "test_booking_confirmed",
    title: "Booking Confirmed",
    body: "Your test booking has been confirmed by the lab.",
    data: { bookingId: id },
  }).catch(() => {});

  audit(db, labId, {
    action: "confirm",
    resource: "test_booking",
    resourceId: id,
  }).catch(() => {});

  return c.json({ booking: updated });
});

// ─── Assign phlebotomist ─────────────────────────────────
router.patch("/bookings/:id/assign-phlebotomist", async (c) => {
  const db = c.get("db");
  const labId = getLabId(c);
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = assignPhlebotomistSchema.safeParse(body);
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

  const [updated] = await db
    .update(testBookings)
    .set({
      status: "phlebotomist_assigned",
      phlebotomistId: parsed.data.phlebotomistId,
      phlebotomistName: parsed.data.phlebotomistName,
      phlebotomistPhone: parsed.data.phlebotomistPhone,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(testBookings.id, id))
    .returning();

  // Notify patient with phlebotomist details
  notify(db, booking.patientId, {
    type: "test_booking_phlebotomist_assigned",
    title: "Phlebotomist Assigned",
    body: `${parsed.data.phlebotomistName} has been assigned for your sample collection.`,
    data: { bookingId: id },
  }).catch(() => {});

  audit(db, labId, {
    action: "assign_phlebotomist",
    resource: "test_booking",
    resourceId: id,
    details: { phlebotomistName: parsed.data.phlebotomistName },
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

  notify(db, booking.patientId, {
    type: "test_booking_sample_collected",
    title: "Sample Collected",
    body: "Your sample has been collected. Results will be available soon.",
    data: { bookingId: id },
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
  notify(db, booking.patientId, {
    type: "test_booking_completed",
    title: "Test Results Ready",
    body: "Your test results are now available. Tap to view.",
    data: { bookingId: id },
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

  notify(db, booking.patientId, {
    type: "test_booking_cancelled",
    title: "Booking Cancelled",
    body: "Your test booking has been cancelled by the lab. Please contact support for details.",
    data: { bookingId: id },
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
