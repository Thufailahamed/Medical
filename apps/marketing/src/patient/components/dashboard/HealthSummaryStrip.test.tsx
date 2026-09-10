import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useWellness: () => ({ data: { score: 82, level: { label: "Good" } }, isLoading: false, isError: false }),
  useVitalsAlerts: () => ({ data: { count: 0, items: [] }, isLoading: false, isError: false }),
  useMedicationStats: () => ({ data: { todayTaken: 2, todayCount: 3, streakDays: 4 }, isLoading: false, isError: false }),
  useAppointments: () => ({ data: { appointments: [{ date: "2099-01-02", time: "10:00", doctorName: "Dr. Silva", doctorSpecialization: "GP", hospitalName: "General", mode: "video" }] }, isLoading: false, isError: false }),
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

  it("renders at least 4 sparkline polylines", () => {
    const { container } = render(<HealthSummaryStrip />);
    expect(container.querySelectorAll("polyline").length).toBeGreaterThanOrEqual(4);
  });
});
