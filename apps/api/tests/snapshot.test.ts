// tests/snapshot.test.ts
//
// Tier 1 records: Patient Health Snapshot. Tests the pure
// `buildSnapshot()` helper + the GET /me/snapshot route.
//
// We test the helper directly because it's the single source of truth
// for both /me/snapshot and /doctor-portal/patients/:id/snapshot. The
// route is just an HTTP shell.

import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

import { buildSnapshot } from "../src/lib/snapshot";
import { MockD1 } from "./_mockDb";

function db() {
  return new MockD1();
}

describe("buildSnapshot", () => {
  it("returns empty snapshot for a patient with no data", async () => {
    const d = db();
    const snap = await buildSnapshot(d, "pat-empty");
    expect(snap.redBanner).toEqual([]);
    expect(snap.drugAllergyWarnings).toEqual([]);
    expect(snap.chronicConditions).toEqual([]);
    expect(snap.activeMedicines).toEqual([]);
    expect(snap.recentVitals.bp).toEqual([]);
    expect(snap.upcomingFollowUps).toEqual([]);
    expect(snap.recentVisits).toEqual([]);
    expect(snap.fetchedAt).toBeTruthy();
  });

  it("surfaces severe + critical allergies in red banner", async () => {
    const d = db();
    d.seed("allergies", [
      {
        id: "a-1",
        patientId: "pat-1",
        substance: "Penicillin",
        severity: "severe",
        reaction: "Anaphylaxis",
        active: 1,
      },
      {
        id: "a-2",
        patientId: "pat-1",
        substance: "Pollen",
        severity: "mild",
        active: 1,
      },
    ]);
    const snap = await buildSnapshot(d, "pat-1");
    expect(snap.redBanner).toHaveLength(1);
    expect(snap.redBanner[0].substance).toBe("Penicillin");
  });

  it("flags drug-allergy match between active medicine and active allergy", async () => {
    const d = db();
    d.seed("allergies", [
      { id: "a-1", patientId: "pat-1", substance: "Penicillin", severity: "severe", active: 1 },
    ]);
    d.seed("medicines", [
      { id: "m-1", patientId: "pat-1", name: "Amoxicillin-Penicillin combo", active: 1 },
      { id: "m-2", patientId: "pat-1", name: "Paracetamol", active: 1 },
    ]);
    const snap = await buildSnapshot(d, "pat-1");
    expect(snap.drugAllergyWarnings).toHaveLength(1);
    expect(snap.drugAllergyWarnings[0].medicine).toContain("Penicillin");
    expect(snap.drugAllergyWarnings[0].allergen).toBe("Penicillin");
    expect(snap.activeMedicines).toHaveLength(2);
  });

  it("derives chronic conditions from 'chronic' tag", async () => {
    const d = db();
    d.seed("medical_records", [
      {
        id: "r-1",
        patientId: "pat-1",
        kind: "clinical_note",
        title: "Hypertension review",
        diagnosis: "BP stable",
        tags: JSON.stringify(["chronic"]),
        date: "2026-01-01",
        createdAt: "2026-01-01",
      },
      {
        id: "r-2",
        patientId: "pat-1",
        kind: "prescription",
        title: "Paracetamol script",
        tags: JSON.stringify([]),
        date: "2026-02-01",
        createdAt: "2026-02-01",
      },
    ]);
    const snap = await buildSnapshot(d, "pat-1");
    expect(snap.chronicConditions).toHaveLength(1);
    expect(snap.chronicConditions[0].title).toBe("Hypertension review");
  });

  it("derives chronic conditions from keyword match on diagnosis", async () => {
    const d = db();
    d.seed("medical_records", [
      {
        id: "r-1",
        patientId: "pat-1",
        kind: "clinical_note",
        title: "Follow-up",
        diagnosis: "Type 2 Diabetes — well controlled",
        tags: JSON.stringify([]),
        date: "2026-01-01",
        createdAt: "2026-01-01",
      },
    ]);
    const snap = await buildSnapshot(d, "pat-1");
    expect(snap.chronicConditions).toHaveLength(1);
  });

  it("groups vitals into buckets and returns last 3 per bucket", async () => {
    const d = db();
    const rows = [];
    for (let i = 0; i < 5; i++) {
      rows.push({
        id: `v-hr-${i}`,
        patientId: "pat-1",
        type: "heart_rate",
        value: 70 + i,
        recordedAt: `2026-01-0${i + 1}T00:00:00Z`,
        unit: "bpm",
      });
    }
    d.seed("vitals", rows);
    const snap = await buildSnapshot(d, "pat-1");
    expect(snap.recentVitals.hr).toHaveLength(3);
    expect(snap.recentVitals.hr[0].value).toBe(74); // newest first
  });

  it("returns upcoming follow-ups sorted asc", async () => {
    const d = db();
    const today = new Date();
    const future = (offset: number) =>
      new Date(today.getTime() + offset * 86_400_000)
        .toISOString()
        .slice(0, 10);
    d.seed("medical_records", [
      {
        id: "f-1",
        patientId: "pat-1",
        kind: "follow_up",
        title: "Later follow-up",
        followUpDate: future(14),
        date: future(14),
        createdAt: future(14),
      },
      {
        id: "f-2",
        patientId: "pat-1",
        kind: "follow_up",
        title: "Sooner follow-up",
        followUpDate: future(7),
        date: future(7),
        createdAt: future(7),
      },
    ]);
    const snap = await buildSnapshot(d, "pat-1");
    expect(snap.upcomingFollowUps).toHaveLength(2);
    expect(snap.upcomingFollowUps[0].title).toBe("Sooner follow-up");
  });
});
