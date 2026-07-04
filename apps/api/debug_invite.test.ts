import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "./tests/_mockDb";
import { buildTestApp, postJson } from "./tests/_testApp";

describe("debug invite", () => {
  it("debug", async () => {
    const db = new MockD1();
    db.seed("users", [
      { id: "user-patient-1", role: "patient", name: "Alice Patient" },
      { id: "user-doctor-1", role: "doctor", name: "Dr. Bob" },
    ]);
    db.seed("patients", [{ id: "patient-1", userId: "user-patient-1" }]);
    db.seed("doctors", [{ id: "doctor-1", userId: "user-doctor-1", specialization: "GP" }]);

    const patientApp = await buildTestApp(db, { id: "user-patient-1", role: "patient" });
    db.setWhere("patients", (r) => r.userId === "user-patient-1");

    const invRes = await postJson(patientApp, "/care-team/invites", {
      role: "specialist",
      scope: "full",
      ttlHours: 24,
    });
    console.log("invRes status:", invRes.status);
    const invBody: any = await invRes.json();
    console.log("invBody:", invBody);
    console.log("share_links rows:", JSON.stringify(db.tables["share_links"]?.rows, null, 2));

    const doctorApp = await buildTestApp(db, { id: "user-doctor-1", role: "doctor" });
    db.setWhere("doctors", (r) => r.userId === "user-doctor-1");
    db.setWhere("share_links", (r) =>
      r.token === invBody.token && r.kind === "care_team_invite" && !r.revoked
    );

    const redeemRes = await postJson(doctorApp, "/care-team", {
      patientId: "patient-1",
      consentToken: invBody.token,
      role: "specialist",
    });
    console.log("redeem status:", redeemRes.status);
    const redeemBody = await redeemRes.json();
    console.log("redeem body:", JSON.stringify(redeemBody, null, 2));
  });
});
