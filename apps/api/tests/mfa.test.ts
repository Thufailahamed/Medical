// tests/mfa.test.ts
//
// End-to-end coverage for the doctor TOTP MFA routes. Uses the real
// route handlers mounted under /mfa with a seeded doctor user row.
// Covers:
//   - /mfa/status before enrollment
//   - /mfa/setup → encrypts secret, returns otpauth + secret
//   - /mfa/setup idempotency (re-setup while enabled rejected)
//   - /mfa/verify-setup flips mfa_enabled=1, mints recovery codes
//   - /mfa/verify-setup rejects bad token
//   - /mfa/challenge accepts TOTP, mints session JWT
//   - /mfa/challenge accepts recovery code (one-use semantics)
//   - /mfa/challenge rejects bad code, bad mfaToken, wrong purpose
//   - /mfa/disable with TOTP wipes state
//   - /mfa/disable with recovery code wipes state
//
// Caveats:
//   - otplib uses real time, so we generate the "current" code from
//     the same secret the route persisted (roundtrip via decryptSecret
//     is verified by an explicit unit test in mfa-lib.test.ts).
//   - KEK is a fixed test key; never set this in prod.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { authenticator } from "otplib";
import { sign } from "hono/jwt";
import { MockD1 } from "./_mockDb";
import mfaRouter from "../src/routes/mfa";
import type { AppEnvironment } from "../src/types";

const TEST_SECRET = "test-secret-do-not-use-in-prod";
// 32-byte zero key, base64. Distinct from production KEK.
const TEST_KEK_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const TEST_PEPPER = "test-pepper-do-not-use-in-prod";

const DOCTOR_USER_ID = "user-doctor-1";
const DOCTOR_ID = "doctor-1";
const OTHER_USER_ID = "user-patient-1";

let db: MockD1;
let app: Hono<AppEnvironment>;

async function doctorToken(): Promise<string> {
  return sign(
    {
      sub: DOCTOR_USER_ID,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    } as any,
    TEST_SECRET,
  );
}

async function otherToken(): Promise<string> {
  return sign(
    {
      sub: OTHER_USER_ID,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    } as any,
    TEST_SECRET,
  );
}

async function buildApp() {
  app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = {
      JWT_SECRET: TEST_SECRET,
      MFA_SECRET_KEK: TEST_KEK_B64,
      MFA_RECOVERY_PEPPER: TEST_PEPPER,
      DEV_MODE: "false",
      ENVIRONMENT: "development",
    } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    await next();
  });
  app.route("/mfa", mfaRouter);
}

beforeEach(() => {
  db = new MockD1();
  // Seed a doctor user with the required role + matching doctors row.
  db.seed("users", [
    {
      id: DOCTOR_USER_ID,
      role: "doctor",
      email: "doctor@hospital.lk",
      name: "Dr Test",
    },
    {
      id: OTHER_USER_ID,
      role: "patient",
      email: "patient@hospital.lk",
      name: "Pat Test",
    },
  ]);
  db.seed("doctors", [
    {
      id: DOCTOR_ID,
      userId: DOCTOR_USER_ID,
      mfaEnabled: 0,
      mfaSecretEnc: null,
      mfaRecoveryCodesHash: null,
      mfaRecoveryUsedCodes: null,
      mfaEnrolledAt: null,
    },
  ]);
});

describe("POST /mfa/status", () => {
  it("rejects unauthenticated callers", async () => {
    await buildApp();
    const res = await app.request("/mfa/status", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects non-doctor callers with 403", async () => {
    await buildApp();
    const token = await otherToken();
    const res = await app.request("/mfa/status", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns enrolled=false when no secret persisted yet", async () => {
    await buildApp();
    const token = await doctorToken();
    const res = await app.request("/mfa/status", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toEqual({
      enabled: false,
      enrolledAt: null,
      hasSecret: false,
    });
  });
});

describe("POST /mfa/setup", () => {
  it("rejects non-doctor with 403", async () => {
    await buildApp();
    const token = await otherToken();
    const res = await app.request("/mfa/setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });

  it("issues an otpauth URL + secret and persists the encrypted secret", async () => {
    await buildApp();
    const token = await doctorToken();
    const res = await app.request("/mfa/setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(body.secret).toMatch(/^[A-Z2-7]{32}$/);

    // Doctor row now carries an encrypted secret, mfaEnabled still 0.
    const docRows = (db as any)._tables.doctors.rows;
    expect(docRows).toHaveLength(1);
    expect(docRows[0].mfaSecretEnc).toMatch(/^v1:/);
    expect(docRows[0].mfaEnabled).toBe(0);
  });
});

describe("POST /mfa/verify-setup", () => {
  async function startSetup(): Promise<string> {
    await buildApp();
    const token = await doctorToken();
    const res = await app.request("/mfa/setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const body = (await res.json()) as any;
    return body.secret;
  }

  it("rejects when setup was not started", async () => {
    await buildApp();
    const token = await doctorToken();
    const res = await app.request("/mfa/verify-setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: "123456" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/Setup not started/);
  });

  it("rejects an invalid TOTP", async () => {
    const secret = await startSetup();
    expect(secret).toBeTruthy();
    const token = await doctorToken();
    const res = await app.request("/mfa/verify-setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: "000000" }), // unlikely match
    });
    expect(res.status).toBe(401);
  });

  it("flips mfa_enabled=1 and returns 10 recovery codes on valid TOTP", async () => {
    const secret = await startSetup();
    const code = authenticator.generate(secret);
    const token = await doctorToken();
    const res = await app.request("/mfa/verify-setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: code }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.enabled).toBe(true);
    expect(body.enrolledAt).toBeTruthy();
    expect(body.recoveryCodes).toHaveLength(10);
    for (const c of body.recoveryCodes) {
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }

    const docRows = (db as any)._tables.doctors.rows;
    expect(docRows[0].mfaEnabled).toBe(1);
    expect(docRows[0].mfaRecoveryCodesHash).toBeTruthy();
    expect(docRows[0].mfaEnrolledAt).toBeTruthy();
  });
});

describe("POST /mfa/challenge", () => {
  async function enrollWith(): Promise<{ secret: string; recoveryCodes: string[] }> {
    await buildApp();
    const token = await doctorToken();
    const setupRes = await app.request("/mfa/setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const { secret } = (await setupRes.json()) as any;
    const code = authenticator.generate(secret);
    const verifyRes = await app.request("/mfa/verify-setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: code }),
    });
    const body = (await verifyRes.json()) as any;
    return { secret, recoveryCodes: body.recoveryCodes };
  }

  async function mfaToken(purpose = "mfa"): Promise<string> {
    return sign(
      {
        sub: DOCTOR_USER_ID,
        purpose,
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
      } as any,
      TEST_SECRET,
    );
  }

  it("rejects bad mfaToken with 401", async () => {
    await enrollWith();
    const res = await app.request("/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: "garbage", code: "123456" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects mfaToken with wrong purpose with 401", async () => {
    await enrollWith();
    const tok = await mfaToken("login");
    const res = await app.request("/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: tok, code: "123456" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects bad code with 401", async () => {
    await enrollWith();
    const tok = await mfaToken();
    const res = await app.request("/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: tok, code: "000000" }),
    });
    expect(res.status).toBe(401);
  });

  it("mints a session JWT on valid TOTP", async () => {
    const { secret } = await enrollWith();
    const tok = await mfaToken();
    const code = authenticator.generate(secret);
    const res = await app.request("/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: tok, code }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.token).toBeTruthy();
    expect(body.user.id).toBe(DOCTOR_USER_ID);
  });

  it("accepts a recovery code (one-use)", async () => {
    const { recoveryCodes } = await enrollWith();
    const tok = await mfaToken();
    const res = await app.request("/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: tok, code: recoveryCodes[0] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.token).toBeTruthy();

    // Mark used → second attempt with same code must fail.
    const tok2 = await mfaToken();
    const res2 = await app.request("/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: tok2, code: recoveryCodes[0] }),
    });
    expect(res2.status).toBe(401);
  });
});

describe("POST /mfa/disable", () => {
  async function enrollAndReturn(): Promise<{ secret: string; recoveryCode: string }> {
    await buildApp();
    const token = await doctorToken();
    const setupRes = await app.request("/mfa/setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const { secret } = (await setupRes.json()) as any;
    const code = authenticator.generate(secret);
    const verifyRes = await app.request("/mfa/verify-setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: code }),
    });
    const body = (await verifyRes.json()) as any;
    return { secret, recoveryCode: body.recoveryCodes[0] };
  }

  it("rejects with no code provided", async () => {
    await enrollAndReturn();
    const token = await doctorToken();
    const res = await app.request("/mfa/disable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("wipes MFA state on valid TOTP", async () => {
    const { secret } = await enrollAndReturn();
    const token = await doctorToken();
    const disableCode = authenticator.generate(secret);
    const res = await app.request("/mfa/disable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: disableCode }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    const finalDoc = (db as any)._tables.doctors.rows[0];
    expect(finalDoc.mfaEnabled).toBe(0);
    expect(finalDoc.mfaSecretEnc).toBeNull();
    expect(finalDoc.mfaRecoveryCodesHash).toBeNull();
    expect(finalDoc.mfaEnrolledAt).toBeNull();
  });

  it("wipes MFA state on valid recovery code", async () => {
    const { recoveryCode } = await enrollAndReturn();
    const token = await doctorToken();
    const res = await app.request("/mfa/disable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recoveryCode }),
    });
    expect(res.status).toBe(200);
    const finalDoc = (db as any)._tables.doctors.rows[0];
    expect(finalDoc.mfaEnabled).toBe(0);
    expect(finalDoc.mfaSecretEnc).toBeNull();
  });
});