import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useWellness: () => ({ data: { score: 82, level: { label: "Good" } }, isLoading: false, isError: false }),
  useVitalsAlerts: () => ({ data: { count: 0, items: [] }, isLoading: false, isError: false }),
  useMedicationStats: () => ({ data: { todayTaken: 2, todayCount: 3, streakDays: 4 }, isLoading: false, isError: false }),
  useAppointments: () => ({ data: { appointments: [{ date: "2099-01-02", time: "10:00", doctorName: "Dr. Silva", doctorSpecialization: "GP", hospitalName: "General", mode: "video" }] }, isLoading: false, isError: false }),
  useVitalsSeries: () => ({ data: { points: [
    { t: "2026-09-12T08:00:00Z", value: 70 },
    { t: "2026-09-13T08:00:00Z", value: 72 },
    { t: "2026-09-14T08:00:00Z", value: 68 },
  ] }, isLoading: false, isError: false }),
}));

import { HealthSummaryStrip } from "./HealthSummaryStrip";

describe("HealthSummaryStrip", () => {
  it("renders four glanceable tiles with links", () => {
    render(<HealthSummaryStrip />);
    expect(screen.getByText("Wellness")).toBeTruthy();
    expect(screen.getByText("82")).toBeTruthy();
    expect(screen.getByText("Vitals steady")).toBeTruthy();
    expect(screen.getByText("Adherence")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.getByText("Next visit")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Wellness/i })).toHaveProperty("href");
  });

  it("renders the vitals sparkline from real readings", () => {
    const { container } = render(<HealthSummaryStrip />);
    expect(container.querySelectorAll("polyline").length).toBeGreaterThanOrEqual(1);
  });
});
