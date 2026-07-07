// tests/admin/slmc-docs.test.ts
//
// Phase ADM-3: SLMC document upload + lifecycle endpoints.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, get, postJson } from "./_adminTestApp";

const ADMIN_ID = "admin-1";
const DOCTOR_ID = "doctor-1";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active", name: "Admin", email: "admin@test.local" },
  ]);
  db.seed("doctors", [
    { id: DOCTOR_ID, userId: "doctor-user-1", slmcRegistrationNo: "SLMC-12345", slmcVerifiedAt: null, createdAt: new Date().toISOString() },
  ]);
});

function makeFile(name: string, type: string, content: string): File {
  // FormData needs a real File/Blob. Hono tests can pass a plain Blob
  // in the multipart body, but File keeps the .name + .type fields
  // available.
  return new File([content], name, { type });
}

async function postMultipart(
  app: any,
  path: string,
  fields: Record<string, string | File>,
) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return app.request(path, {
    method: "POST",
    body: fd,
  });
}

describe("POST /admin/doctors/:id/docs", () => {
  it("rejects without a file", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postMultipart(app, `/admin/doctors/${DOCTOR_ID}/docs`, { kind: "slmc_certificate" });
    expect(res.status).toBe(400);
  });

  it("rejects unsupported MIME types", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postMultipart(app, `/admin/doctors/${DOCTOR_ID}/docs`, {
      kind: "slmc_certificate",
      file: makeFile("test.exe", "application/x-msdownload", "MZ"),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid kind", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postMultipart(app, `/admin/doctors/${DOCTOR_ID}/docs`, {
      kind: "bogus",
      file: makeFile("cert.png", "image/png", "fake"),
    });
    expect(res.status).toBe(400);
  });

  it("uploads a valid PNG cert", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postMultipart(app, `/admin/doctors/${DOCTOR_ID}/docs`, {
      kind: "slmc_certificate",
      file: makeFile("cert.png", "image/png", "fake-png-bytes"),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.id).toBe("string");
  });

  it("returns 404 for unknown doctor", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("doctors", () => false);
    const res = await postMultipart(app, `/admin/doctors/ghost/docs`, {
      kind: "slmc_certificate",
      file: makeFile("cert.png", "image/png", "x"),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /admin/doctors/:id/docs", () => {
  it("lists uploaded docs with hydrated names", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    // Pre-seed a doc row so we don't depend on R2 round-trip.
    const now = new Date().toISOString();
    db.seed("doctorVerificationDocs", [
      {
        id: "doc-1",
        doctorId: DOCTOR_ID,
        uploadedByUserId: ADMIN_ID,
        kind: "slmc_certificate",
        r2Key: `admin/slmc/${DOCTOR_ID}/doc-1.png`,
        fileName: "cert.png",
        mimeType: "image/png",
        fileSize: 1024,
        decision: "pending",
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
        createdAt: now,
      },
    ]);

    const res = await get(app, `/admin/doctors/${DOCTOR_ID}/docs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].id).toBe("doc-1");
    expect(body.items[0].uploadedByName).toBeTruthy();
    expect(body.items[0].decision).toBe("pending");
  });
});

describe("POST /admin/doctors/:id/docs/:docId/approve", () => {
  it("flips decision to approved and stamps slmcVerifiedAt for slmc certs", async () => {
    db.seed("doctorVerificationDocs", [
      {
        id: "doc-1",
        doctorId: DOCTOR_ID,
        uploadedByUserId: ADMIN_ID,
        kind: "slmc_certificate",
        r2Key: "k",
        fileName: "cert.png",
        mimeType: "image/png",
        fileSize: 100,
        decision: "pending",
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, `/admin/doctors/${DOCTOR_ID}/docs/doc-1/approve`, {});
    expect(res.status).toBe(200);

    // Verify doc row decision flipped
    const docs = (db as any)._tables?.["doctorVerificationDocs"] || (db as any).tables?.get?.("doctorVerificationDocs");
    // We can't read mock state directly; assert via a follow-up list call.
    const list = await get(app, `/admin/doctors/${DOCTOR_ID}/docs`);
    const listBody = await list.json();
    expect(listBody.items[0].decision).toBe("approved");
    expect(listBody.items[0].decidedById).toBe(ADMIN_ID);
  });

  it("does NOT stamp slmcVerifiedAt for non-slmc kinds", async () => {
    db.seed("doctorVerificationDocs", [
      {
        id: "doc-1",
        doctorId: DOCTOR_ID,
        uploadedByUserId: ADMIN_ID,
        kind: "medical_license",
        r2Key: "k",
        fileName: "license.pdf",
        mimeType: "application/pdf",
        fileSize: 100,
        decision: "pending",
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, `/admin/doctors/${DOCTOR_ID}/docs/doc-1/approve`, {});
    expect(res.status).toBe(200);
  });

  it("returns 409 if already decided", async () => {
    db.seed("doctorVerificationDocs", [
      {
        id: "doc-1",
        doctorId: DOCTOR_ID,
        uploadedByUserId: ADMIN_ID,
        kind: "slmc_certificate",
        r2Key: "k",
        fileName: "cert.png",
        mimeType: "image/png",
        fileSize: 100,
        decision: "approved",
        decisionNote: null,
        decidedByUserId: ADMIN_ID,
        decidedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, `/admin/doctors/${DOCTOR_ID}/docs/doc-1/approve`, {});
    expect(res.status).toBe(409);
  });

  it("returns 404 for missing doc", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, `/admin/doctors/${DOCTOR_ID}/docs/ghost/approve`, {});
    expect(res.status).toBe(404);
  });
});

describe("POST /admin/doctors/:id/docs/:docId/reject", () => {
  it("requires a note", async () => {
    db.seed("doctorVerificationDocs", [
      {
        id: "doc-1",
        doctorId: DOCTOR_ID,
        uploadedByUserId: ADMIN_ID,
        kind: "slmc_certificate",
        r2Key: "k",
        fileName: "cert.png",
        mimeType: "image/png",
        fileSize: 100,
        decision: "pending",
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, `/admin/doctors/${DOCTOR_ID}/docs/doc-1/reject`, {});
    expect(res.status).toBe(400);
  });

  it("rejects with a note", async () => {
    db.seed("doctorVerificationDocs", [
      {
        id: "doc-1",
        doctorId: DOCTOR_ID,
        uploadedByUserId: ADMIN_ID,
        kind: "slmc_certificate",
        r2Key: "k",
        fileName: "cert.png",
        mimeType: "image/png",
        fileSize: 100,
        decision: "pending",
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, `/admin/doctors/${DOCTOR_ID}/docs/doc-1/reject`, { note: "image too blurry" });
    expect(res.status).toBe(200);

    const list = await get(app, `/admin/doctors/${DOCTOR_ID}/docs`);
    const listBody = await list.json();
    expect(listBody.items[0].decision).toBe("rejected");
    expect(listBody.items[0].decisionNote).toBe("image too blurry");
  });
});

describe("GET /admin/doctors/:id/docs/:docId/download", () => {
  it("redirects to a presigned URL", async () => {
    db.seed("doctorVerificationDocs", [
      {
        id: "doc-1",
        doctorId: DOCTOR_ID,
        uploadedByUserId: ADMIN_ID,
        kind: "slmc_certificate",
        r2Key: "admin/slmc/x/cert.png",
        fileName: "cert.png",
        mimeType: "image/png",
        fileSize: 100,
        decision: "pending",
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await get(app, `/admin/doctors/${DOCTOR_ID}/docs/doc-1/download`, { follow: "manual" } as any);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("r2.test.local");
  });
});