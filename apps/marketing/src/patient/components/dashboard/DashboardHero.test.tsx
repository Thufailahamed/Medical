import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useProfile: () => ({ data: { name: "Test User" }, isLoading: false }),
  useHealthSummary: () => ({ data: undefined, isLoading: false }),
  useWellness: () => ({ data: { score: 78, level: { label: "Good" } }, isLoading: false }),
  useVitalsAlerts: () => ({ data: { count: 0 }, isLoading: false }),
  useInsurance: () => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

import { DashboardHero } from "./DashboardHero";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("DashboardHero", () => {
  it("renders greeting heading", () => {
    const { container } = withClient(<DashboardHero />);
    expect(container.textContent ?? "").toMatch(/Good (morning|afternoon|evening|night)/);
  });

  it("renders Log vitals CTA", () => {
    const { container } = withClient(<DashboardHero />);
    expect(container.textContent ?? "").toContain("Log vitals");
  });
});
