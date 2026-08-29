import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useHealthSummary: () => ({ data: null, isLoading: false, isError: false }),
  useVitalsAlerts: () => ({ data: { items: [], count: 0 }, isLoading: false, isError: false }),
  useVitalsSeries: () => ({ data: { points: [], stats: null, latestClassification: null, range: { from: null, to: null }, type: "heart_rate" }, isLoading: false, isError: false }),
}));

import HealthPage from "./page";

describe("HealthPage", () => {
  it("renders the body map card and the vitals trend header", () => {
    render(<HealthPage />);
    expect(screen.getByText(/Body map/)).toBeTruthy();
    expect(screen.getByText(/Tap a region/)).toBeTruthy();
  });
});
