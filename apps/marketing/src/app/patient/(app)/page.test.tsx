import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
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
  useWellness: () => ({ data: null, isLoading: false, isError: false }),
  useHealthSummary: () => ({ data: null, isLoading: false, isError: false }),
  useAppointments: () => ({
    data: { appointments: [] },
    isLoading: false,
    isError: false,
  }),
  useMedicationsToday: () => ({
    data: { medicines: [] },
    isLoading: false,
    isError: false,
  }),
  useMedicationStats: () => ({ data: null, isLoading: false, isError: false }),
  useVitalsAlerts: () => ({
    data: { items: [], count: 0 },
    isLoading: false,
    isError: false,
  }),
  useRecords: () => ({ data: { records: [] }, isLoading: false, isError: false }),
  useTimeline: () => ({ data: { events: [] }, isLoading: false, isError: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("renders the health monitoring dashboard widgets", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Health Monitoring/)).toBeTruthy();
    expect(screen.getByText(/Life quality/)).toBeTruthy();
    expect(screen.getAllByText(/This week/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Today's plan/)).toBeTruthy();
    expect(screen.getByText(/Next up/)).toBeTruthy();
    expect(screen.getByText(/Recent records/)).toBeTruthy();
    expect(screen.getByText(/Recent activity/)).toBeTruthy();
    expect(screen.getByText(/Care insights/)).toBeTruthy();
    expect(screen.getByText(/Body scan/)).toBeTruthy();
  });
});
