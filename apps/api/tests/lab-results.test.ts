// @ts-nocheck
//
// Lab Task 3 — real result upload + single result store + en-route (RED→GREEN).
// Covers:
//   PATCH /lab-portal/bookings/:id/en-route phlebotomist_assigned→sample_collection_en_route
//   PATCH /lab-portal/bookings/:id/complete requires /files R2 URL
//   POST /diagnostic-tests/book slot capacity (409 when >20 per date+slot)
//   Canonical store: test_bookings.result* (lab_reports only for doctor orders)
//   Lab-portal timeline includes en-route + file picker via POST /files/upload
//

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTestApp, postJson, patchJson, getJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import labPortalRouter from "../src/routes/lab-partner-portal";
import diagnosticTestsRouter from "../src/routes/diagnostic-tests";

function repoRead(rel: string): string {
  const candidates = [
    join(process.cwd(), rel),
    join(process.cwd(), "..", "..", rel),
    join(process.cwd(), "apps/api", rel),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8");
    } catch {}
  }
  try {
    const url = new URL(`../../../../${rel}`, import.meta.url);
    return readFileSync(url, "utf8");
  } catch {}
  throw new Error(`cannot read repo file: ${rel}`);
}

const LAB_USER = { id: "lab-001", role: "laboratory" };
const PATIENT_USER = { id: "patient-001", role: "patient" };

function seedLab(db: MockD1) {
  db.seed("users", [
    { id: "lab-001", supabaseId: "supabase-l1", role: "laboratory", name: "Test Lab", email: "lab@test.com" },
    { id: "lab-other", supabaseId: "supabase-l2", role: "laboratory", name: "Other Lab", email: "other@test.com" },
    { id: "patient-001", supabaseId: "supabase-p1", role: "patient", name: "Test Patient", email: "p@test.com" },
  ]);
  db.seed("patients", [{ id: "pat-001", userId: "patient-001" }]);
  db.seed("diagnostic_test_catalog", [
    {
      id: "test-001", name: "Complete Blood Count", slug: "complete-blood-count",
      category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0,
      homeCollectionAvailable: true, price: 1500, discountPrice: null,
      labPartnerId: "lab-001", turnaroundHours: 24, isActive: true,
      visibility: "public", isBookable: true, isDoctorOrderable: true,
      currency: "LKR", synonyms: "[]", displayOrder: 0,
    },
  ]);
  db.seed("test_bookings", [
    {
      id: "booking-enroute-001", patientId: "pat-001", labPartnerId: "lab-001",
      bookingType: "single_test", testId: "test-001", packageId: null,
      status: "phlebotomist_assigned", scheduledDate: "2099-12-01", scheduledTimeSlot: "08:00-10:00",
      collectionAddress: JSON.stringify({ line1: "123 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
      phlebotomistId: "phleb-001", phlebotomistName: "Kamal", phlebotomistPhone: "0771111111",
      totalPrice: 1500, paymentStatus: "paid", paymentMethod: "online",
      resultPdfUrl: null, resultSummary: null,
    },
    {
      id: "booking-complete-001", patientId: "pat-001", labPartnerId: "lab-001",
      bookingType: "single_test", testId: "test-001", packageId: null,
      status: "in_progress", scheduledDate: "2099-12-02", scheduledTimeSlot: "08:00-10:00",
      collectionAddress: JSON.stringify({ line1: "123 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
      totalPrice: 1500, paymentStatus: "paid", paymentMethod: "online",
      resultPdfUrl: null, resultSummary: null,
    },
  ]);
}

describe("lab results", () => {
  it("en-route transitions phlebotomist_assigned → sample_collection_en_route", async () => {
    const db = new MockD1();
    seedLab(db);
    const app = await buildTestApp(db, LAB_USER);
    app.route("/lab-portal", labPortalRouter);

    const res = await patchJson(app, "/lab-portal/bookings/booking-enroute-001/en-route", {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.status).toBe("sample_collection_en_route");
  });

  it("en-route rejects invalid source status", async () => {
    const db = new MockD1();
    seedLab(db);
    // pending booking cannot go en-route
    db.seed("test_bookings", [
      {
        id: "booking-pending-001", patientId: "pat-001", labPartnerId: "lab-001",
        bookingType: "single_test", testId: "test-001", packageId: null,
        status: "pending", scheduledDate: "2099-12-03", scheduledTimeSlot: "08:00-10:00",
        collectionAddress: JSON.stringify({ line1: "x", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
        totalPrice: 1500, paymentStatus: "pending", paymentMethod: "online",
      },
    ]);
    const app = await buildTestApp(db, LAB_USER);
    app.route("/lab-portal", labPortalRouter);
    const res = await patchJson(app, "/lab-portal/bookings/booking-pending-001/en-route", {});
    expect(res.status).toBe(400);
  });

  it("en-route is scoped to owning lab (404 for other lab)", async () => {
    const db = new MockD1();
    seedLab(db);
    const app = await buildTestApp(db, { id: "lab-other", role: "laboratory" });
    app.route("/lab-portal", labPortalRouter);
    const res = await patchJson(app, "/lab-portal/bookings/booking-enroute-001/en-route", {});
    expect(res.status).toBe(404);
  });

  it("complete accepts canonical /files R2 URL", async () => {
    const db = new MockD1();
    seedLab(db);
    const app = await buildTestApp(db, LAB_USER);
    app.route("/lab-portal", labPortalRouter);
    const res = await patchJson(app, "/lab-portal/bookings/booking-complete-001/complete", {
      resultPdfUrl: "/files/download/medical%2Flab-001%2Freport.pdf?stream=1",
      resultSummary: "All normal",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.status).toBe("completed");
    expect(body.booking.resultPdfUrl).toContain("/files");
  });

  it("complete rejects non-R2 resultPdfUrl", async () => {
    const db = new MockD1();
    seedLab(db);
    const app = await buildTestApp(db, LAB_USER);
    app.route("/lab-portal", labPortalRouter);
    const res = await patchJson(app, "/lab-portal/bookings/booking-complete-001/complete", {
      resultPdfUrl: "not-a-url",
      resultSummary: "x",
    });
    expect(res.status).toBe(400);
  });

  it("complete requires resultPdfUrl (upload via POST /files/upload)", async () => {
    const db = new MockD1();
    seedLab(db);
    const app = await buildTestApp(db, LAB_USER);
    app.route("/lab-portal", labPortalRouter);
    const res = await patchJson(app, "/lab-portal/bookings/booking-complete-001/complete", {
      resultSummary: "missing url",
    });
    expect(res.status).toBe(400);
  });

  it("book rejects when slot capacity exceeded (409)", async () => {
    const db = new MockD1();
    db.seed("users", [
      { id: "patient-001", supabaseId: "supabase-p1", role: "patient", name: "Test Patient", email: "p@test.com" },
      { id: "lab-001", supabaseId: "supabase-l1", role: "laboratory", name: "Test Lab", email: "lab@test.com" },
    ]);
    db.seed("patients", [{ id: "pat-001", userId: "patient-001" }]);
    db.seed("diagnostic_test_catalog", [
      {
        id: "test-001", name: "CBC", slug: "cbc",
        category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0,
        homeCollectionAvailable: true, price: 1500, discountPrice: null,
        labPartnerId: "lab-001", turnaroundHours: 24, isActive: true,
        visibility: "public", isBookable: true, isDoctorOrderable: true,
        currency: "LKR", synonyms: "[]", displayOrder: 0,
      },
    ]);
    // Fill the slot with 20 active bookings (different patients to dodge duplicate guard).
    const rows: any[] = [];
    for (let i = 0; i < 20; i++) {
      db.seed("users", [{ id: `patient-cap-${i}`, role: "patient", name: `Cap ${i}`, email: `cap${i}@test.com` }]);
      db.seed("patients", [{ id: `pat-cap-${i}`, userId: `patient-cap-${i}` }]);
      rows.push({
        id: `cap-booking-${i}`, patientId: `pat-cap-${i}`, labPartnerId: "lab-001",
        bookingType: "single_test", testId: "test-001", packageId: null,
        status: "confirmed", scheduledDate: "2099-11-11", scheduledTimeSlot: "08:00-10:00",
        collectionAddress: JSON.stringify({ line1: "x", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
        totalPrice: 1500, paymentStatus: "pending", paymentMethod: "online",
      });
    }
    db.seed("test_bookings", rows);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await postJson(app, "/diagnostic-tests/book", {
      bookingType: "single_test",
      testId: "test-001",
      scheduledDate: "2099-11-11",
      scheduledTimeSlot: "08:00-10:00",
      collectionAddress: { line1: "123 St", city: "Colombo", district: "Colombo", contactPhone: "0771234567" },
      paymentMethod: "cash",
    });
    expect(res.status).toBe(409);
  });

  it("canonical store documented: test_bookings.result* primary, lab_reports only for doctor orders", () => {
    const src = repoRead("apps/api/src/routes/lab-partner-portal.ts");
    expect(src).toContain("test_bookings");
    expect(src).toContain("lab_reports");
    expect(src.toLowerCase()).toContain("canonical");
  });

  it("lab-portal timeline includes en-route + file picker uploads via POST /files/upload", () => {
    const page = repoRead("apps/marketing/src/app/lab-portal/(portal)/bookings/[id]/page.tsx");
    expect(page).toContain("sample_collection_en_route");
    expect(page).toContain("/files/upload");
    expect(page).toContain('type="file"');
    const hook = repoRead("apps/marketing/src/app/lab-portal/hooks/useApi.ts");
    expect(hook).toContain("en-route");
  });

  it("en-route uses scoped labPartnerId, lab_ready notify with env, and audit", () => {
    const src = repoRead("apps/api/src/routes/lab-partner-portal.ts");
    expect(src).toContain("/en-route");
    expect(src).toContain("sample_collection_en_route");
    expect(src).toContain("labPartnerId");
    expect(src).toContain('type: "lab_ready"');
    expect(src).toContain("env: c.env");
    expect(src).toContain("audit(");
  });

  it("keeps 9-state status enum (no schema drops)", () => {
    const schema = repoRead("packages/db/src/schema.ts");
    for (const s of ["pending", "confirmed", "phlebotomist_assigned", "sample_collection_en_route", "sample_collected", "in_progress", "completed", "cancelled", "rescheduled"]) {
      expect(schema).toContain(`"${s}"`);
    }
  });
});
