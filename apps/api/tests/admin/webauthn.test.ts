// tests/admin/webauthn.test.ts
//
// Phase ADM-3: passkey enrollment + assertion flows (mocked; real
// WebAuthn would use navigator.credentials in the browser).

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, get, postJson, del } from "./_adminTestApp";

const ADMIN_ID = "admin-1";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active", name: "Admin", email: "admin@test.local" },
  ]);
});

function b64url(input: string | Buffer): string {
  const b = typeof input === "string" ? Buffer.from(input) : input;
  return b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function buildClientDataJson(challenge: string, type: "webauthn.create" | "webauthn.get"): string {
  const obj = { type, challenge, origin: "http://localhost:3000", crossOrigin: false };
  return b64url(Buffer.from(JSON.stringify(obj)));
}

describe("GET /admin/webauthn/status", () => {
  it("returns enrolled=false when no passkeys", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await get(app, "/admin/webauthn/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrolled).toBe(false);
    expect(body.credentials).toEqual([]);
  });

  it("returns enrolled=true with credentials list", async () => {
    db.seed("adminPasskeys", [
      {
        id: "cred-1",
        userId: ADMIN_ID,
        credentialId: "cred-id-1",
        publicKey: "pub-1",
        counter: 0,
        transports: null,
        deviceName: "iPhone 15",
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await get(app, "/admin/webauthn/status");
    const body = await res.json();
    expect(body.enrolled).toBe(true);
    expect(body.credentials.length).toBe(1);
    expect(body.credentials[0].deviceName).toBe("iPhone 15");
  });
});

describe("POST /admin/webauthn/register/options", () => {
  it("issues a challenge with RP + user fields", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin", email: "admin@test.local", name: "Admin" });
    const res = await postJson(app, "/admin/webauthn/register/options", {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.challenge).toBe("string");
    expect(body.rp.id).toBeTruthy();
    expect(body.user.name).toBe("admin@test.local");
    expect(body.user.displayName).toBe("Admin");
    expect(body.pubKeyCredParams.length).toBeGreaterThan(0);
  });
});

describe("POST /admin/webauthn/register/verify", () => {
  it("rejects when no challenge was issued", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, "/admin/webauthn/register/verify", {
      id: "cred-x",
      rawId: "cred-x",
      type: "public-key",
      response: {
        clientDataJSON: buildClientDataJson("anything", "webauthn.create"),
        attestationObject: b64url("fake-attestation"),
      },
      deviceName: "Test",
    });
    expect(res.status).toBe(400);
  });

  it("rejects on challenge mismatch", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    await postJson(app, "/admin/webauthn/register/options", {});
    const res = await postJson(app, "/admin/webauthn/register/verify", {
      id: "cred-x",
      rawId: "cred-x",
      type: "public-key",
      response: {
        clientDataJSON: buildClientDataJson("WRONG", "webauthn.create"),
        attestationObject: b64url("fake-attestation"),
      },
      deviceName: "Test",
    });
    expect(res.status).toBe(400);
  });

  it("rejects wrong ceremony type", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const optsRes = await postJson(app, "/admin/webauthn/register/options", {});
    const { challenge } = await optsRes.json();
    const res = await postJson(app, "/admin/webauthn/register/verify", {
      id: "cred-x",
      rawId: "cred-x",
      type: "public-key",
      response: {
        clientDataJSON: buildClientDataJson(challenge, "webauthn.get"),
        attestationObject: b64url("fake-attestation"),
      },
      deviceName: "Test",
    });
    expect(res.status).toBe(400);
  });

  it("succeeds with a matching challenge and returns a step-up token", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const optsRes = await postJson(app, "/admin/webauthn/register/options", {});
    const { challenge } = await optsRes.json();
    const res = await postJson(app, "/admin/webauthn/register/verify", {
      id: "cred-new",
      rawId: "cred-new",
      type: "public-key",
      response: {
        clientDataJSON: buildClientDataJson(challenge, "webauthn.create"),
        attestationObject: b64url("fake-attestation-blob"),
      },
      deviceName: "MacBook Touch ID",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.id).toBe("string");
    expect(typeof body.stepUpToken).toBe("string");
    expect(body.stepUpToken.length).toBeGreaterThan(20);

    // Status should now show enrolled
    const statusRes = await get(app, "/admin/webauthn/status");
    const statusBody = await statusRes.json();
    expect(statusBody.enrolled).toBe(true);
    expect(statusBody.credentials[0].deviceName).toBe("MacBook Touch ID");
  });
});

describe("POST /admin/webauthn/auth/options", () => {
  it("returns 400 with no_passkeys when not enrolled", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, "/admin/webauthn/auth/options", {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("no_passkeys");
  });

  it("returns allowCredentials when enrolled", async () => {
    db.seed("adminPasskeys", [
      {
        id: "cred-1",
        userId: ADMIN_ID,
        credentialId: "cred-id-1",
        publicKey: "pub-1",
        counter: 0,
        transports: null,
        deviceName: "iPhone",
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, "/admin/webauthn/auth/options", {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowCredentials.length).toBe(1);
    expect(body.allowCredentials[0].id).toBe("cred-id-1");
  });
});

describe("POST /admin/webauthn/auth/verify", () => {
  it("rejects unknown credential", async () => {
    db.seed("adminPasskeys", [
      {
        id: "cred-1",
        userId: ADMIN_ID,
        credentialId: "cred-id-1",
        publicKey: "pub-1",
        counter: 0,
        transports: null,
        deviceName: "iPhone",
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const optsRes = await postJson(app, "/admin/webauthn/auth/options", {});
    const { challenge } = await optsRes.json();
    const res = await postJson(app, "/admin/webauthn/auth/verify", {
      id: "ghost",
      rawId: "ghost",
      type: "public-key",
      response: {
        clientDataJSON: buildClientDataJson(challenge, "webauthn.get"),
        authenticatorData: b64url("auth-data"),
        signature: b64url("sig"),
      },
    });
    expect(res.status).toBe(404);
  });

  it("succeeds for an enrolled credential and returns a step-up token", async () => {
    db.seed("adminPasskeys", [
      {
        id: "cred-1",
        userId: ADMIN_ID,
        credentialId: "cred-id-1",
        publicKey: "pub-1",
        counter: 0,
        transports: null,
        deviceName: "iPhone",
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const optsRes = await postJson(app, "/admin/webauthn/auth/options", {});
    const { challenge } = await optsRes.json();
    const res = await postJson(app, "/admin/webauthn/auth/verify", {
      id: "cred-id-1",
      rawId: "cred-id-1",
      type: "public-key",
      response: {
        clientDataJSON: buildClientDataJson(challenge, "webauthn.get"),
        authenticatorData: b64url("auth-data"),
        signature: b64url("sig"),
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.stepUpToken).toBe("string");
    expect(body.expiresIn).toBe(300);
  });
});

describe("DELETE /admin/webauthn/credentials/:id", () => {
  it("removes a credential owned by the caller", async () => {
    db.seed("adminPasskeys", [
      {
        id: "cred-1",
        userId: ADMIN_ID,
        credentialId: "cred-id-1",
        publicKey: "pub-1",
        counter: 0,
        transports: null,
        deviceName: "iPhone",
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await del(app, "/admin/webauthn/credentials/cred-1");
    expect(res.status).toBe(200);
    const status = await get(app, "/admin/webauthn/status");
    const statusBody = await status.json();
    expect(statusBody.enrolled).toBe(false);
  });

  it("returns 404 for unknown credential", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await del(app, "/admin/webauthn/credentials/ghost");
    expect(res.status).toBe(404);
  });
});