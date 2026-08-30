import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useVitalsSeries: () => ({
    data: { points: [], stats: null, latestClassification: null, range: { from: null, to: null }, type: "heart_rate" },
    isLoading: false,
    isError: false,
  }),
}));

import { VitalsTrend } from "./VitalsTrend";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("VitalsTrend", () => {
  it("renders all four dashboard vital tabs by name", () => {
    withClient(<VitalsTrend />);
    expect(screen.getByRole("tab", { name: "Heart Check" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Saturation" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Pressure" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Temperature" })).toBeTruthy();
  });

  it("shows an empty state when there are no readings", () => {
    withClient(<VitalsTrend />);
    expect(screen.getByText(/No heart rate yet/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Add first reading/i })).toBeTruthy();
  });
});
