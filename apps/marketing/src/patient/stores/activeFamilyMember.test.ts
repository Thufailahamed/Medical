import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  useActiveFamilyMemberStore,
} from "@/patient/stores/activeFamilyMember";

// Zustand persist stores under this key in localStorage.
const STORAGE_KEY = "healthcare-active-family-member";

describe("useActiveFamilyMemberStore", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store between tests so persisted state from one test does
    // not leak into the next.
    useActiveFamilyMemberStore.setState({ activeFamilyMemberId: null });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts at null when nothing is persisted", () => {
    expect(useActiveFamilyMemberStore.getState().activeFamilyMemberId).toBeNull();
  });

  it("setActiveFamilyMemberId updates state and persists to localStorage", async () => {
    useActiveFamilyMemberStore.getState().setActiveFamilyMemberId("fm-1");
    expect(useActiveFamilyMemberStore.getState().activeFamilyMemberId).toBe("fm-1");
    // Persist middleware writes asynchronously; wait one tick.
    await new Promise((r) => setTimeout(r, 0));
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw!).toContain("fm-1");
  });

  it("clear() resets state and removes the persisted entry", async () => {
    useActiveFamilyMemberStore.getState().setActiveFamilyMemberId("fm-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();

    useActiveFamilyMemberStore.getState().clear();
    expect(useActiveFamilyMemberStore.getState().activeFamilyMemberId).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy(); // entry still exists but value is null
    expect(raw!).toContain("null");
  });
});
