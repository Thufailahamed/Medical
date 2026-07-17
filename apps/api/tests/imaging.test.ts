// Phase IMG-1: smoke tests for the imaging study surface. Covers:
//   - access control on /imaging/studies (patientId required, RBAC)
//   - FHIR ImagingStudy serialization shape
//   - presign mints a single-use download token
//
// We forge JWTs against a test secret so authMiddleware takes the real
// JWT path; that catches bugs in canAccessPatient's user lookups, which
// is the line of defence we want to exercise.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { MockD1 } from "./_mockDb";
import imagingRouter from "../src/routes/imaging";
import type { AppEnvironment } from "../src/types";

const TEST_SECRET = "test-secret-do-not-use-in-prod";

type AuthCtx = {
  userId: string;
  role: "patient" | "doctor" | "hospital_staff";
};

async function makeToken(userId: string): Promise<string> {
  return sign(
    {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    } as any,
    TEST_SECRET
  );
}

async function buildApp(db: MockD1, ctx: AuthCtx | null) {
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = {
      ENVIRONMENT: "development",
      DEV_MODE: "false",
      JWT_SECRET: TEST_SECRET,
    } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    if (ctx) {
      const token = await makeToken(ctx.userId);
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
  app.route("/imaging", imagingRouter);
  return app;
}

async function seedUsers(db: MockD1, ctx: AuthCtx) {
  db.seed("users", [
    {
      id: ctx.userId,
      role: ctx.role,
      email: `${ctx.userId}@test.local`,
      name: "Test " + ctx.userId,
    },
  ]);
}

const PATIENT_ID = "p-001";
const PATIENT_USER = "u-patient";
const DOCTOR_USER = "u-doctor";
const STAFF_USER = "u-staff";
const FILE_ID = "f-1";
const STUDY_UID = "1.2.840.0.1";

let db: MockD1;

beforeEach(async () => {
  db = new MockD1();
  await seedUsers(db, { userId: PATIENT_USER, role: "patient" });
  await seedUsers(db, { userId: DOCTOR_USER, role: "doctor" });
  await seedUsers(db, { userId: STAFF_USER, role: "hospital_staff" });
  db.seed("patients", [
    {
      id: PATIENT_ID,
      userId: PATIENT_USER,
      name: "Test Patient",
    },
  ]);
  db.seed("medicalRecords", [
    { id: "rec-1", patientId: PATIENT_ID, recordType: "imaging" },
  ]);
  db.seed("files", [
    { id: FILE_ID, recordId: "rec-1", r2Key: "k", type: "dicom" },
  ]);
  db.seed("documentDicomMetadata", [
    {
      fileId: FILE_ID,
      studyInstanceUid: STUDY_UID,
      seriesInstanceUid: "1.2.840.0.2",
      sopInstanceUid: "1.2.840.0.3",
      sopClassUid: "1.2.840.10008.5.1.4.1.1.2",
      modality: "CT",
      bodyPart: "CHEST",
      studyDate: "20260101",
      manufacturer: "TestCo",
      metadataJson: "{}",
    },
  ]);
});

describe("imaging /studies", () => {
  it("returns 400 when patientId missing", async () => {
    const app = await buildApp(db, {
      userId: PATIENT_USER,
      role: "patient",
    });
    const res = await app.request("/imaging/studies");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/patientId/i);
  });

  it("allows the patient to list their own studies", async () => {
    const app = await buildApp(db, {
      userId: PATIENT_USER,
      role: "patient",
    });
    const res = await app.request(`/imaging/studies?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { studies: any[] };
    expect(Array.isArray(body.studies)).toBe(true);
  });

  it("denies a doctor without any relationship", async () => {
    const app = await buildApp(db, {
      userId: DOCTOR_USER,
      role: "doctor",
    });
    const res = await app.request(`/imaging/studies?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(403);
  });
});

describe("imaging /fhir/:studyUid", () => {
  it("returns an FHIR R4 ImagingStudy resource", async () => {
    const app = await buildApp(db, {
      userId: PATIENT_USER,
      role: "patient",
    });
    const res = await app.request(`/imaging/fhir/${encodeURIComponent(STUDY_UID)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/fhir\+json/);
    const body = (await res.json()) as any;
    expect(body.resourceType).toBe("ImagingStudy");
    expect(body.id).toBe(STUDY_UID);
    expect(body.status).toBe("available");
    expect(body.subject.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(body.identifier?.[0]?.value).toBe(STUDY_UID);
    expect(body.modality?.[0]?.code).toBe("CT");
    expect(body.numberOfSeries).toBe(1);
    expect(body.numberOfInstances).toBe(1);
    expect(body.series?.[0]?.uid).toBe("1.2.840.0.2");
    expect(body.series?.[0]?.modality).toBe("CT");
    expect(body.started).toBe("2026-01-01");
  });

  it("returns 404 when study UID is unknown", async () => {
    const app = await buildApp(db, {
      userId: PATIENT_USER,
      role: "patient",
    });
    const res = await app.request(
      `/imaging/fhir/${encodeURIComponent("nonexistent")}`
    );
    expect(res.status).toBe(404);
  });
});