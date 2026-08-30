import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useHealthSummary: () => ({
    data: {
      demographics: {
        name: "Thufail",
        age: 23,
        sex: "male",
        bloodGroup: "B+",
        bmi: 23.8,
        bmiCategory: "Healthy",
      },
      activeMedicines: [{ name: "Med", dosage: "1", frequency: null }],
      alerts: { count: 0, items: [] },
    },
    isLoading: false,
    isError: false,
  }),
  useVitalsAlerts: () => ({
    data: { items: [], count: 0 },
    isLoading: false,
    isError: false,
  }),
  useVitalsSeries: () => ({
    data: {
      points: [],
      stats: null,
      latestClassification: null,
      range: { from: null, to: null },
      type: "heart_rate",
    },
    isLoading: false,
    isError: false,
  }),
  useWellness: () => ({
    data: { score: 64, level: { label: "Fair" }, components: {} },
    isLoading: false,
    isError: false,
  }),
}));

import HealthPage from "./page";

describe("HealthPage", () => {
  it("renders vitals, alerts, profile snapshot without a duplicate page title", () => {
    render(<HealthPage />);
    expect(screen.getByText(/Recent alerts/)).toBeTruthy();
    expect(screen.getByText(/About you/)).toBeTruthy();
    expect(screen.getByText(/No heart rate yet/i)).toBeTruthy();
    expect(screen.getByText(/Looking good/)).toBeTruthy();
    expect(screen.getByText(/Wellness/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Log reading/i })).toBeTruthy();
    // Topbar owns "My Health" — page should not restate a giant Health title
    expect(screen.queryByRole("heading", { name: /^Health$/i })).toBeNull();
  });
});
