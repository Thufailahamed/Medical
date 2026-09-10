// @ts-nocheck
import { describe, it, expect } from "vitest";
import { buildTestApp, postJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import authRouter from "../src/routes/auth";

describe("lab provider registration", () => {
  it("persists lab_profiles and returns 202 pending", async () => {
    const db = new MockD1();
    db.seed("users", []);
    const app = await buildTestApp(db, null);
    app.route("/auth", authRouter);
    const res = await postJson(app, "/auth/register", {
      name: "City Diagnostics",
      email: "labx@example.com",
      phone: "0771234567",
      password: "password123",
      role: "laboratory",
      licenseNumber: "LAB-001",
      address: "Main St Colombo",
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.requiresApproval).toBe(true);
    const tables: any = (db as any).tables;
    const rows =
      tables.labProfiles?.rows ??
      tables["lab_profiles"]?.rows ??
      tables.lab_profiles?.rows ??
      [];
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.licenseNumber ?? row.license_number).toBe("LAB-001");
  });

  it("rejects laboratory without license/address", async () => {
    const db = new MockD1();
    db.seed("users", []);
    const app = await buildTestApp(db, null);
    app.route("/auth", authRouter);
    const res = await postJson(app, "/auth/register", {
      name: "No License Lab",
      email: "nolic@example.com",
      password: "password123",
      role: "laboratory",
    });
    expect(res.status).toBe(400);
  });
});
