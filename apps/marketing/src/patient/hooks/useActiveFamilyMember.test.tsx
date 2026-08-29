import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { api } from "@/portal/lib/api";
import {
  useActiveFamilyMember,
  useFamilyMembers,
  useSetActiveFamilyMember,
} from "@/patient/hooks/useActiveFamilyMember";
import { useActiveFamilyMemberStore } from "@/patient/stores/activeFamilyMember";

vi.mock("@/portal/lib/api", () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

const mockedApi = vi.mocked(api);

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  useActiveFamilyMemberStore.setState({ activeFamilyMemberId: null });
  localStorage.clear();
  mockedApi.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useActiveFamilyMember", () => {
  it("hits /family/active and returns the resolved member", async () => {
    mockedApi.mockResolvedValueOnce({
      activeId: "fm-1",
      member: { id: "fm-1", name: "Thufail", relationship: "self" },
    });

    const { result } = renderHook(() => useActiveFamilyMember(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi).toHaveBeenCalledWith("/family/active");
    expect(result.current.data).toEqual({
      activeId: "fm-1",
      member: { id: "fm-1", name: "Thufail", relationship: "self" },
    });
  });

  it("seeds the persisted store from the server column on success", async () => {
    useActiveFamilyMemberStore.getState().setActiveFamilyMemberId(null);
    mockedApi.mockResolvedValueOnce({
      activeId: "fm-7",
      member: { id: "fm-7", name: "Dev", relationship: "self" },
    });

    renderHook(() => useActiveFamilyMember(), { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(useActiveFamilyMemberStore.getState().activeFamilyMemberId).toBe(
        "fm-7"
      )
    );
  });
});

describe("useFamilyMembers", () => {
  it("hits /patients/me/family and returns the list", async () => {
    mockedApi.mockResolvedValueOnce({
      family: [
        { id: "fm-1", name: "Thufail", relationship: "self" },
        { id: "fm-2", name: "Amma", relationship: "mother" },
      ],
    });

    const { result } = renderHook(() => useFamilyMembers(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi).toHaveBeenCalledWith("/patients/me/family");
    expect(result.current.data?.family).toHaveLength(2);
  });
});

describe("useSetActiveFamilyMember", () => {
  it("optimistically updates the store and PATCHes /family/active", async () => {
    mockedApi.mockResolvedValueOnce({ activeId: "fm-2" });

    const { result } = renderHook(() => useSetActiveFamilyMember(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync("fm-2");

    expect(mockedApi).toHaveBeenCalledWith(
      "/family/active",
      expect.objectContaining({ method: "PATCH" })
    );
    const init = mockedApi.mock.calls[0]![1] as { json: unknown };
    expect(init.json).toEqual({ memberId: "fm-2" });
    // Optimistic update landed before the API call resolved.
    expect(useActiveFamilyMemberStore.getState().activeFamilyMemberId).toBe(
      "fm-2"
    );
  });

  it("clears the store when memberId is null", async () => {
    useActiveFamilyMemberStore.getState().setActiveFamilyMemberId("fm-2");
    mockedApi.mockResolvedValueOnce({ activeId: null });

    const { result } = renderHook(() => useSetActiveFamilyMember(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync(null);

    expect(useActiveFamilyMemberStore.getState().activeFamilyMemberId).toBeNull();
  });
});
