import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const rows = [
  {
    id: "past-today", date: "2026-09-22", time: "09:00", status: "scheduled", mode: "in_person",
    doctorName: "Dr. Elapsed", doctorSpecialization: null, hospitalName: null,
    startsAt: 0, isPast: true, isLive: false, bucket: "missed",
  },
  {
    id: "next", date: "2026-09-22", time: "18:00", status: "confirmed", mode: "video",
    doctorName: "Dr. Next", doctorSpecialization: null, hospitalName: null,
    startsAt: Date.now() + 3 * 3600_000, isPast: false, isLive: false, bucket: "today",
  },
];

vi.mock("@/patient/hooks", () => ({
  useAppointments: () => ({ data: { appointments: rows }, isLoading: false, isError: false }),
}));
vi.mock("@/portal/lib/api", () => ({
  teleconsultApi: { getActiveForMe: async () => ({ session: null }) },
}));

import { UpcomingAppointment } from "./UpcomingAppointment";

describe("UpcomingAppointment", () => {
  it("picks the bucket-based next visit, not the elapsed one", () => {
    render(<UpcomingAppointment />);
    expect(screen.getByText(/Dr. Next/)).toBeTruthy();
    expect(screen.queryByText(/Dr. Elapsed/)).toBeNull();
  });

  it("never links to __pending__ and hides Join without a live session", () => {
    const { container } = render(<UpcomingAppointment />);
    expect(container.innerHTML).not.toContain("__pending__");
    expect(screen.queryByTestId("join-call-link")).toBeNull();
  });
});
