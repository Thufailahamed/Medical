import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useHealthSummary: () => ({ data: null, isLoading: false, isError: false }),
  useVitalsAlerts: () => ({ data: { items: [], count: 0 }, isLoading: false, isError: false }),
  useVitalsSeries: () => ({ data: { points: [], stats: null, latestClassification: null, range: { from: null, to: null }, type: "heart_rate" }, isLoading: false, isError: false }),
}));

import HealthPage from "./page";

describe("HealthPage", () => {
  it("renders the health page and recent alerts", () => {
    render(<HealthPage />);
    expect(screen.getByText(/Health/)).toBeTruthy();
    expect(screen.getByText(/Recent alerts/)).toBeTruthy();
  });
});
