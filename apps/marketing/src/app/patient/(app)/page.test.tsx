import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock all hooks to short-circuit real fetches.
vi.mock("@/patient/hooks", () => ({
  useVitalsSeries: () => ({ data: { points: [], stats: null, latestClassification: null, range: { from: null, to: null }, type: "heart_rate" }, isLoading: false, isError: false }),
  useWellness: () => ({ data: null, isLoading: false, isError: false }),
  useHealthSummary: () => ({ data: null, isLoading: false, isError: false }),
  useAppointments: () => ({ data: { appointments: [] }, isLoading: false, isError: false }),
  useMedicationsToday: () => ({ data: { medicines: [] }, isLoading: false, isError: false }),
  useRecords: () => ({ data: { records: [] }, isLoading: false, isError: false }),
  useTimeline: () => ({ data: { events: [] }, isLoading: false, isError: false }),
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("renders the eight dashboard widgets", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Wellness score/)).toBeTruthy();
    expect(screen.getByText(/This week/)).toBeTruthy();
    expect(screen.getByText(/Today's medications/)).toBeTruthy();
    expect(screen.getByText(/Next up/)).toBeTruthy();
    expect(screen.getByText(/Recent records/)).toBeTruthy();
    expect(screen.getByText(/Recent activity/)).toBeTruthy();
    expect(screen.getByText(/Care assistant/)).toBeTruthy();
  });
});
