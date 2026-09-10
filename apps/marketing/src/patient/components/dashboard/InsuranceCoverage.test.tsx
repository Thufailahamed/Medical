import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useInsurance: vi.fn(() => ({
    data: null,
    isLoading: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

import { InsuranceCoverage } from "./InsuranceCoverage";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("InsuranceCoverage", () => {
  it("renders skeleton when loading", () => {
    const { container } = withClient(<InsuranceCoverage />);
    expect(container.querySelector('[data-testid="insurance-skeleton"]')).not.toBeNull();
  });

  it("renders provider, policy number, renewal chip, claims", async () => {
    const { useInsurance } = await import("@/patient/hooks");
    (useInsurance as any).mockReturnValue({
      data: {
        policy: {
          provider: "Acme Health",
          number: "P-12345",
          status: "active",
          renewsAt: new Date(Date.now() + 42 * 86_400_000).toISOString(),
        },
        claimsOpen: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    withClient(<InsuranceCoverage />);
    expect(screen.getByText("Acme Health")).toBeTruthy();
    expect(screen.getByText("P-12345")).toBeTruthy();
    expect(screen.getByText(/renews in/i)).toBeTruthy();
    expect(screen.getByText(/2 open claims/)).toBeTruthy();
  });
});
