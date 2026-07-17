// PACS admin API smoke tests.
//
// Verifies the most important safety properties:
//   - Credentials are accepted in plaintext on POST but never appear
//     in any response body or list response.
//   - The encrypted cipher rows are stored under usernameEnc/passwordEnc.
//   - Test-connection returns a 502 when PACS responds with 401.
//   - Disable soft-deletes (sets enabled=false).
//
// Uses MockD1 + a stub fetch via global override. We bypass real auth
// by mounting the router with `authMiddleware` skipped — RBAC is tested
// in middleware tests; here we focus on the route's data shape.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import adminPacsRouter from "../src/routes/admin-pacs";
import { authMiddleware } from "../src/middleware/auth";
import { tenantContextMiddleware } from "../src/middleware/tenant-context";
import type { AppEnvironment } from "../src/types";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

const ENV: any = (() => {
  const bytes = new Uint8Array(32);
  webcrypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return {
    ENVIRONMENT: "development",
    DEV_MODE: "true",
    RECORD_KEK_PRIMARY: Buffer.from(s, "binary").toString("base64"),
  };
})();

function buildApp(mockDb: MockD1) {
  // We rely on DEV_MODE bypass in authMiddleware: when DEV_MODE=true and
  // no Authorization header, the middleware inserts the DEV_USER as a
  // patient. We seed that user with role=hospital_admin + tenant so
  // tenantContextMiddleware + requireRole both pass.
  const app = new Hono<AppEnvironment>();
  // Mount the real middleware in the order the prod app does it, so
  // c.get("dbUser"), c.get("userRole"), c.get("activeHospitalId") are
  // all populated by the time the route handler runs.
  app.use("*", async (c, next) => {
    c.env = ENV;
    c.set("db", mockDb as any);
    await next();
  });
  // Lazy-import so we don't add a circular import at module top.
  app.use("*", authMiddleware);
  app.use("*", tenantContextMiddleware);
  app.route("/hospital-admin/pacs", adminPacsRouter);
  return app;
}

function seedHospital(mockDb: MockD1, hospitalId: string) {
  // DEV_USER from authMiddleware + hospital owned by that user, so
  // tenantContextMiddleware's hospital_admin check passes.
  mockDb.seed("users", [{
    id: "dev-user-001",
    supabaseId: "dev-user-001",
    role: "hospital_admin",
    email: "dev@healthhub.local",
    name: "Dev Admin",
    activeTenantType: "hospital",
    activeTenantId: hospitalId,
  }]);
  mockDb.seed("hospitals", [{
    id: hospitalId,
    userId: "dev-user-001",
    name: "Test Hospital",
    createdAt: "2026-07-01",
  }]);
}

beforeEach(() => {
  // Default fetch returns 200 empty JSON for all PACS calls so
  // /test-connection succeeds unless a test overrides.
  (globalThis as any).fetch = vi.fn(async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
});

// All test requests carry x-active-hospital-id so the tenant context
// middleware resolves the active tenant for the dev user.
const HOSPITAL_HEADERS = { "x-active-hospital-id": "hosp-1" };

describe("admin-pacs: create + list", () => {
  it("encrypts creds on write + plaintext never appears in list response", async () => {
    const mockDb = new MockD1();
    seedHospital(mockDb, "hosp-1");
    const app = buildApp(mockDb);

    const createRes = await app.request("/hospital-admin/pacs/integrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-active-hospital-id": "hosp-1" },
      body: JSON.stringify({
        name: "Main PACS",
        baseUrl: "https://pacs.example.com/dicom-web",
        username: "pacs-user",
        password: "VERY-SECRET-PASSWORD",
        syncIntervalMinutes: 60,
      }),
    });
    if (createRes.status !== 200) {
      const body = await createRes.clone().json().catch(() => "<no body>");
      console.error("create status", createRes.status, "body", body);
    }
    expect(createRes.status).toBe(200);
    const created = await createRes.json();

    // Cipher rows are present (not plaintext).
    const integ = mockDb.tables.hospitalPacsIntegrations.rows[0];
    expect(integ.usernameEnc).toBeTruthy();
    expect(integ.passwordEnc).toBeTruthy();
    expect(String(integ.usernameEnc)).not.toContain("pacs-user");
    expect(String(integ.passwordEnc)).not.toContain("VERY-SECRET-PASSWORD");
    expect(integ.kekVersion).toBeTruthy();

    // List omits creds.
    const listRes = await app.request("/hospital-admin/pacs/integrations", {
      headers: HOSPITAL_HEADERS,
    });
    const list = await listRes.json();
    expect(listRes.status).toBe(200);
    const listJson = JSON.stringify(list);
    expect(listJson).not.toContain("pacs-user");
    expect(listJson).not.toContain("VERY-SECRET-PASSWORD");
    expect(list.integrations[0].name).toBe("Main PACS");
    expect(list.integrations[0].baseUrl).toBe("https://pacs.example.com/dicom-web");

    // Body should echo an id only.
    expect(created.ok).toBe(true);
    expect(typeof created.id).toBe("string");
  });

  it("rejects POST without password", async () => {
    const mockDb = new MockD1();
    seedHospital(mockDb, "hosp-1");
    const app = buildApp(mockDb);
    const res = await app.request("/hospital-admin/pacs/integrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-active-hospital-id": "hosp-1" },
      body: JSON.stringify({
        name: "X",
        baseUrl: "https://pacs.example.com",
        username: "u",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid URL", async () => {
    const mockDb = new MockD1();
    seedHospital(mockDb, "hosp-1");
    const app = buildApp(mockDb);
    const res = await app.request("/hospital-admin/pacs/integrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-active-hospital-id": "hosp-1" },
      body: JSON.stringify({
        name: "X",
        baseUrl: "not a url",
        username: "u",
        password: "p",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("reject interval below 5", async () => {
    const mockDb = new MockD1();
    seedHospital(mockDb, "hosp-1");
    const app = buildApp(mockDb);
    const res = await app.request("/hospital-admin/pacs/integrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-active-hospital-id": "hosp-1" },
      body: JSON.stringify({
        name: "X",
        baseUrl: "https://pacs.example.com",
        username: "u",
        password: "p",
        syncIntervalMinutes: 1,
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("admin-pacs: test-connection", () => {
  it("returns 502 when PACS replies 401", async () => {
    // Override the global fetch to return 401.
    (globalThis as any).fetch = vi.fn(async () =>
      new Response("unauthorized", { status: 401 })
    );

    const mockDb = new MockD1();
    seedHospital(mockDb, "hosp-1");
    const app = buildApp(mockDb);

    const createRes = await app.request("/hospital-admin/pacs/integrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-active-hospital-id": "hosp-1" },
      body: JSON.stringify({
        name: "X",
        baseUrl: "https://pacs.example.com",
        username: "u",
        password: "p",
      }),
    });
    const { id } = await createRes.json();

    const testRes = await app.request(
      `/hospital-admin/pacs/integrations/${id}/test-connection`,
      { method: "POST", headers: { "x-active-hospital-id": "hosp-1" } }
    );
    expect(testRes.status).toBe(502);
    const body = await testRes.json();
    expect(body.ok).toBe(false);
    expect(body.statusCode).toBe(401);
  });

  it("returns 200 when PACS replies empty list", async () => {
    const mockDb = new MockD1();
    seedHospital(mockDb, "hosp-1");
    const app = buildApp(mockDb);
    const createRes = await app.request("/hospital-admin/pacs/integrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-active-hospital-id": "hosp-1" },
      body: JSON.stringify({
        name: "X",
        baseUrl: "https://pacs.example.com",
        username: "u",
        password: "p",
      }),
    });
    const { id } = await createRes.json();

    const testRes = await app.request(
      `/hospital-admin/pacs/integrations/${id}/test-connection`,
      { method: "POST", headers: { "x-active-hospital-id": "hosp-1" } }
    );
    expect(testRes.status).toBe(200);
    const body = await testRes.json();
    expect(body.ok).toBe(true);
    expect(typeof body.roundtripMs).toBe("number");
  });
});

describe("admin-pacs: disable (soft delete)", () => {
  it("sets enabled=false on DELETE", async () => {
    const mockDb = new MockD1();
    seedHospital(mockDb, "hosp-1");
    const app = buildApp(mockDb);
    const createRes = await app.request("/hospital-admin/pacs/integrations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-active-hospital-id": "hosp-1" },
      body: JSON.stringify({
        name: "X",
        baseUrl: "https://pacs.example.com",
        username: "u",
        password: "p",
      }),
    });
    const { id } = await createRes.json();

    const delRes = await app.request(
      `/hospital-admin/pacs/integrations/${id}`,
      { method: "DELETE", headers: { "x-active-hospital-id": "hosp-1" } }
    );
    expect(delRes.status).toBe(200);

    const listRes = await app.request("/hospital-admin/pacs/integrations", {
      headers: HOSPITAL_HEADERS,
    });
    const list = await listRes.json();
    const integ = list.integrations.find((x: any) => x.id === id);
    expect(integ.enabled).toBe(false);
  });
});