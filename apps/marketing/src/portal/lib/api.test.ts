import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub the stores BEFORE importing api so the api module captures the
// mocked store getters. We override the .getState() method on each
// stub instance.
import { useActiveFamilyMemberStore } from "@/patient/stores/activeFamilyMember";
import { useAuthStore } from "@/portal/stores/auth";

import { ApiError, api } from "@/portal/lib/api";

// ─── Helpers ──────────────────────────────────────────────
function setAuth(partial: Partial<{
  token: string | null;
  refreshToken: string | null;
  locale: string | null;
  activeHospitalId: string | null;
  activeClinicId: string | null;
}>) {
  vi.spyOn(useAuthStore, "getState").mockReturnValue({
    token: partial.token ?? "test-token",
    refreshToken: partial.refreshToken ?? null,
    locale: partial.locale ?? "en",
    activeHospitalId: partial.activeHospitalId ?? null,
    activeClinicId: partial.activeClinicId ?? null,
    // Anything else useAuthStore.getState() returns in the wrapper we
    // don't care about here; cast through unknown to bypass TS.
    ...({} as any),
  } as any);
}

function setActiveFm(value: string | null) {
  vi.spyOn(useActiveFamilyMemberStore, "getState").mockReturnValue({
    activeFamilyMemberId: value,
    setActiveFamilyMemberId: vi.fn(),
    clear: vi.fn(),
  });
}

function mockFetchOnce(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
      })
    );
}

// ─── Tests ────────────────────────────────────────────────
describe("api() — header forwarding", () => {
  beforeEach(() => {
    setAuth({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards x-active-family-member-id when the store has a value", async () => {
    setActiveFm("fm-1");
    const fetchSpy = mockFetchOnce({ ok: true });

    await api("/medical-records/me");

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["x-active-family-member-id"]).toBe("fm-1");
  });

  it("omits the header when the store is empty", async () => {
    setActiveFm(null);
    const fetchSpy = mockFetchOnce({ ok: true });

    await api("/medical-records/me");

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["x-active-family-member-id"]).toBeUndefined();
  });

  it("still forwards auth + locale + tenant headers alongside the family header", async () => {
    setActiveFm("fm-1");
    setAuth({
      token: "abc",
      locale: "si",
      activeHospitalId: "h-9",
    });
    const fetchSpy = mockFetchOnce({ ok: true });

    await api("/medical-records/me");

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer abc");
    expect(headers["Accept-Language"]).toBe("si");
    expect(headers["x-active-hospital-id"]).toBe("h-9");
    expect(headers["x-active-family-member-id"]).toBe("fm-1");
  });
});

describe("api() — 410 Gone family_member_gone clears the store", () => {
  beforeEach(() => {
    setAuth({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes useActiveFamilyMemberStore.getState().clear() on 410 + family_member_gone", async () => {
    setActiveFm("fm-stale");
    const clear = vi.fn();
    vi.spyOn(useActiveFamilyMemberStore, "getState").mockReturnValue({
      activeFamilyMemberId: "fm-stale",
      setActiveFamilyMemberId: vi.fn(),
      clear,
    });
    mockFetchOnce(
      { error: "Gone", reason: "family_member_gone" },
      410
    );

    await expect(api("/medical-records/me")).rejects.toBeInstanceOf(ApiError);

    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("does NOT clear the store on other 4xx responses", async () => {
    setActiveFm("fm-1");
    const clear = vi.fn();
    vi.spyOn(useActiveFamilyMemberStore, "getState").mockReturnValue({
      activeFamilyMemberId: "fm-1",
      setActiveFamilyMemberId: vi.fn(),
      clear,
    });
    mockFetchOnce({ error: "Bad request" }, 400);

    await expect(api("/medical-records/me")).rejects.toBeInstanceOf(ApiError);

    expect(clear).not.toHaveBeenCalled();
  });
});
