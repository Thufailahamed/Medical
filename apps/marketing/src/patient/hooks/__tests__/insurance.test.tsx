import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/portal/lib/api";

vi.mock("@healthcare/shared/contracts", () => ({
  patientPaths: { insurance: { mine: () => "/insurance/me" } },
  patientKeys: { insurance: () => ["patient", "insurance", "me"] as const },
  PATIENT_QUERY_DEFAULTS: { staleTime: 60_000, retry: 1 },
}));

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

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0 } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  mockedApi.mockReset();
});

import { useInsurance } from "../insurance";

describe("useInsurance", () => {
  it("returns policy and claimsOpen on success", async () => {
    mockedApi.mockResolvedValue({
      insurance: [
        {
          id: "1",
          providerName: "Acme Health",
          policyNumber: "P-12345",
          status: "active",
          renewalDate: "2027-01-01",
        },
      ],
    });
    const { result } = renderHook(() => useInsurance(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.policy?.provider).toBe("Acme Health");
    expect(result.current.data?.policy?.number).toBe("P-12345");
    expect(result.current.data?.policy?.status).toBe("active");
    expect(result.current.data?.policy?.renewsAt).toBe("2027-01-01");
    expect(result.current.data?.claimsOpen).toBe(0);
  });

  it("returns null policy when insurance list empty", async () => {
    mockedApi.mockResolvedValue({ insurance: [] });
    const { result } = renderHook(() => useInsurance(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.policy).toBeNull();
  });
});
