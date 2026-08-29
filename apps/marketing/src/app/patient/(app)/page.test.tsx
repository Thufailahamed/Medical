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
  useWellness: () => ({
    data: { score: 82, level: { label: "Good" }, components: {} },
    isLoading: false,
    isError: false,
  }),
  useHealthSummary: () => ({
    data: {
      demographics: { bloodGroup: "O+", bmi: 22.1, bmiCategory: "Normal" },
      alerts: { count: 0, items: [] },
      conditions: [],
    },
    isLoading: false,
    isError: false,
  }),
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
  useMedicationStats: () => ({
    data: { todayTaken: 0, todayCount: 0, streakDays: 0 },
    isLoading: false,
    isError: false,
  }),
  useTodayDoses: () => ({
    data: { doses: [] },
    isLoading: false,
    isError: false,
  }),
  useMarkDoseTaken: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSkipDose: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVitalsAlerts: () => ({
    data: { items: [], count: 0 },
    isLoading: false,
    isError: false,
  }),
  useRecords: () => ({ data: { records: [] }, isLoading: false, isError: false }),
  useRecordStats: () => ({
    data: { total: 12, byType: {} },
    isLoading: false,
    isError: false,
  }),
  useProfile: () => ({
    data: { name: "Anya Perera", id: "u1" },
    isLoading: false,
    isError: false,
  }),
  useAllergies: () => ({
    data: { allergies: [] },
    isLoading: false,
    isError: false,
  }),
  useVaccinationsDue: () => ({
    data: { due: [], overdue: [], upcoming: [] },
    isLoading: false,
    isError: false,
  }),
  useConversations: () => ({
    data: { conversations: [] },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("renders a focused home with only essential sections", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Anya/)).toBeTruthy();
    expect(screen.getByText(/Quick actions/)).toBeTruthy();
    expect(screen.getAllByText(/Medications/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Today's plan/)).toBeTruthy();
    expect(screen.getByText(/Next up/)).toBeTruthy();
    expect(screen.getByText(/This week/)).toBeTruthy();
    expect(screen.getByText(/Recent records/)).toBeTruthy();
    expect(screen.getByText(/Care insights/)).toBeTruthy();
    expect(screen.getAllByText(/Ask AI/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wellness/).length).toBeGreaterThan(0);

    // Removed noise: no duplicate stat strip, body map, week strip, or activity feed
    expect(screen.queryByText(/Do something now/)).toBeNull();
    expect(screen.queryByText(/Life quality/)).toBeNull();
    expect(screen.queryByText(/Recent activity/)).toBeNull();
  });
});
