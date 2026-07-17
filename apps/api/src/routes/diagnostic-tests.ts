// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, asc, like, sql, inArray } from "drizzle-orm";
import {
  diagnosticTestCatalog,
  testPackages,
  testPackageItems,
  testBookings,
  patients,
  users,
  notifications,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
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

// ─── Browse test catalog (public) ────────────────────────
router.get("/catalog", async (c) => {
  const db = c.get("db");
  const category = c.req.query("category");
  const search = c.req.query("search");
  const labId = c.req.query("labId");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(diagnosticTestCatalog.isActive, true)];

  if (category) {
    conditions.push(eq(diagnosticTestCatalog.category, category));
  }
  if (labId) {
    conditions.push(eq(diagnosticTestCatalog.labPartnerId, labId));
  }
  if (search) {
    conditions.push(
      sql`lower(${diagnosticTestCatalog.name}) like ${"%" + search.toLowerCase() + "%"}`
    );
  }

  const rows = await db
    .select()
    .from(diagnosticTestCatalog)
    .where(and(...conditions))
    .orderBy(asc(diagnosticTestCatalog.name))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(diagnosticTestCatalog)
    .where(and(...conditions));

  return c.json({ tests: rows, total: count, page, limit });
});

// ─── Test detail by slug (public) ────────────────────────
router.get("/catalog/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const [test] = await db
    .select()
    .from(diagnosticTestCatalog)
    .where(
      and(
        eq(diagnosticTestCatalog.slug, slug),
        eq(diagnosticTestCatalog.isActive, true)
      )
    )
    .limit(1);

  if (!test) return c.json({ error: "Test not found" }, 404);

  // Find packages that include this test
  const packageRows = await db
    .select({
      id: testPackages.id,
      name: testPackages.name,
      slug: testPackages.slug,
      price: testPackages.price,
      discountPrice: testPackages.discountPrice,
    })
    .from(testPackageItems)
    .innerJoin(testPackages, eq(testPackageItems.packageId, testPackages.id))
    .where(
      and(
        eq(testPackageItems.testId, test.id),
        eq(testPackages.isActive, true)
      )
    );

  return c.json({ test, packages: packageRows });
});

// ─── Browse packages (public) ────────────────────────────
router.get("/packages", async (c) => {
  const db = c.get("db");
  const labId = c.req.query("labId");
  const search = c.req.query("search");

  const conditions = [eq(testPackages.isActive, true)];

  if (labId) {
    conditions.push(eq(testPackages.labPartnerId, labId));
  }
  if (search) {
    conditions.push(
      sql`lower(${testPackages.name}) like ${"%" + search.toLowerCase() + "%"}`
    );
  }

  const rows = await db
    .select()
    .from(testPackages)
    .where(and(...conditions))
    .orderBy(asc(testPackages.name));

  // For each package, get the test count and total individual price
  const packagesWithMeta = await Promise.all(
    rows.map(async (pkg) => {
      const items = await db
        .select({ testId: testPackageItems.testId })
        .from(testPackageItems)
        .where(eq(testPackageItems.packageId, pkg.id));

      const testIds = items.map((i) => i.testId);
      let totalIndividualPrice = 0;

      if (testIds.length > 0) {
        const tests = await db
          .select({
            price: diagnosticTestCatalog.price,
            discountPrice: diagnosticTestCatalog.discountPrice,
          })
          .from(diagnosticTestCatalog)
          .where(inArray(diagnosticTestCatalog.id, testIds));

        totalIndividualPrice = tests.reduce(
          (sum, t) => sum + (t.discountPrice ?? t.price),
          0
        );
      }

      return {
        ...pkg,
        testCount: testIds.length,
        totalIndividualPrice,
        savings: totalIndividualPrice - (pkg.discountPrice ?? pkg.price),
      };
    })
  );

  return c.json({ packages: packagesWithMeta });
});

// ─── Package detail (public) ─────────────────────────────
router.get("/packages/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const [pkg] = await db
    .select()
    .from(testPackages)
    .where(
      and(eq(testPackages.slug, slug), eq(testPackages.isActive, true))
    )
    .limit(1);

  if (!pkg) return c.json({ error: "Package not found" }, 404);

  const items = await db
    .select({
      id: testPackageItems.id,
      testId: diagnosticTestCatalog.id,
      testName: diagnosticTestCatalog.name,
      testSlug: diagnosticTestCatalog.slug,
      testCategory: diagnosticTestCatalog.category,
      testPrice: diagnosticTestCatalog.price,
      testDiscountPrice: diagnosticTestCatalog.discountPrice,
      sampleType: diagnosticTestCatalog.sampleType,
      fastingRequired: diagnosticTestCatalog.fastingRequired,
    })
    .from(testPackageItems)
    .innerJoin(
      diagnosticTestCatalog,
      eq(testPackageItems.testId, diagnosticTestCatalog.id)
    )
    .where(eq(testPackageItems.packageId, pkg.id));

  const totalIndividualPrice = items.reduce(
    (sum, t) => sum + (t.testDiscountPrice ?? t.testPrice),
    0
  );

  return c.json({
    package: {
      ...pkg,
      tests: items,
      testCount: items.length,
      totalIndividualPrice,
      savings: totalIndividualPrice - (pkg.discountPrice ?? pkg.price),
    },
  });
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

// ─── Get categories (public) ─────────────────────────────
router.get("/categories", async (c) => {
  const db = c.get("db");

  const rows = await db
    .select({
      category: diagnosticTestCatalog.category,
      count: sql<number>`count(*)`,
    })
    .from(diagnosticTestCatalog)
    .where(eq(diagnosticTestCatalog.isActive, true))
    .groupBy(diagnosticTestCatalog.category)
    .orderBy(desc(sql`count(*)`));

  return c.json({ categories: rows });
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
