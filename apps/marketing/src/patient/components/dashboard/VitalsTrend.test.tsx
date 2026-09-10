import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useVitalsSeries: vi.fn(() => ({
    data: {
      points: [
        { ts: "2024-01-01", value: 70, secondary: null },
        { ts: "2024-01-02", value: 72, secondary: null },
        { ts: "2024-01-03", value: 75, secondary: null },
      ],
      stats: null,
      latestClassification: null,
      range: { from: null, to: null },
      type: "heart_rate",
    },
    isLoading: false,
    isError: false,
  })),
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

  it("renders 4-cell overview strip with sparklines", () => {
    const { container } = withClient(<VitalsTrend />);
    expect(screen.getAllByText("Heart rate").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Blood pressure")).toBeTruthy();
    expect(screen.getByText(/SpO₂/)).toBeTruthy();
    expect(screen.getByText("Weight")).toBeTruthy();
    // 4 overview cells + 1 trend area = at least 4 polylines
    expect(container.querySelectorAll("polyline").length).toBeGreaterThanOrEqual(4);
  });
});
