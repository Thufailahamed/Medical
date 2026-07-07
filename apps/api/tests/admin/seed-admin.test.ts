// tests/admin/seed-admin.test.ts
//
// Phase ADM-1: seed-admin.ts idempotency. First call creates a
// super_admin; subsequent calls no-op.

import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "../../src/lib/crypto";
import { seedAdmin } from "../../src/lib/seed-admin";
import { MockD1 } from "../_mockDb";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
});

describe("seedAdmin", () => {
  it("creates a super_admin on first call", async () => {
    const out = await seedAdmin(db, { ADMIN_EMAIL: "ops@test.local", ADMIN_PASSWORD: "Secret#123" });
    expect(out.ok).toBe(true);
    expect(out.alreadyExisted).toBe(false);
    expect(out.email).toBe("ops@test.local");
    const admin = db.tables.users?.rows.find((u: any) => u.role === "super_admin");
    expect(admin).toBeTruthy();
    expect(admin.email).toBe("ops@test.local");
    expect(admin.status).toBe("active");
    // Password should be hashed, not stored in plaintext.
    expect(admin.passwordHash).toBeTruthy();
    expect(admin.passwordHash).not.toBe("Secret#123");
  });

  it("is idempotent on second call", async () => {
    const first = await seedAdmin(db, { ADMIN_EMAIL: "ops@test.local" });
    expect(first.alreadyExisted).toBe(false);
    const second = await seedAdmin(db, { ADMIN_EMAIL: "ops@test.local" });
    expect(second.ok).toBe(true);
    expect(second.alreadyExisted).toBe(true);
    const admins = db.tables.users?.rows.filter((u: any) => u.role === "super_admin") ?? [];
    expect(admins.length).toBe(1);
  });
});