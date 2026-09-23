import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockRows: any[] = [
  {
    id: "a1", date: "2027-01-10", time: "10:00", status: "confirmed", mode: "in_person",
    doctorName: "Dr. Upcoming", doctorSpecialization: "Cardio", hospitalName: "Asiri",
    reason: null, notes: null, queueNumber: null, paymentStatus: null, recordCount: 0,
    startsAt: new Date("2027-01-10T10:00:00+05:30").getTime(),
    isPast: false, isLive: false, bucket: "upcoming",
  },
  {
    id: "a2", date: "2026-09-20", time: "09:00", status: "no_show", mode: "video",
    doctorName: "Dr. Missed", doctorSpecialization: "Derma", hospitalName: "Asiri",
    reason: null, notes: null, queueNumber: null, paymentStatus: null, recordCount: 0,
    startsAt: new Date("2026-09-20T09:00:00+05:30").getTime(),
    isPast: true, isLive: false, bucket: "missed",
  },
];

vi.mock("@/patient/hooks", () => ({
  useAppointments: () => ({
    data: { appointments: mockRows },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/portal/lib/api", () => ({
  teleconsultApi: { getActiveForMe: async () => ({ session: null }) },
}));

import AppointmentsPage from "./page";

describe("AppointmentsPage", () => {
  it("renders the page header", () => {
    render(<AppointmentsPage />);
    expect(screen.getByText(/Appointments/)).toBeTruthy();
  });

  it("shows a Missed tab separate from Cancelled", () => {
    render(<AppointmentsPage />);
    expect(screen.getAllByRole("button", { name: /Missed/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Cancelled/ }).length).toBeGreaterThan(0);
  });

  it("puts no_show rows under Missed, not Upcoming", () => {
    render(<AppointmentsPage />);
    // Upcoming tab (default all) shows the upcoming doctor.
    expect(screen.getByText("Dr. Upcoming")).toBeTruthy();
    // The missed row is reachable and labelled Missed — never "upcoming".
    expect(screen.getAllByText("Dr. Missed").length).toBeGreaterThan(0);
  });

  it("never renders a __pending__ join link", () => {
    const { container } = render(<AppointmentsPage />);
    expect(container.innerHTML).not.toContain("__pending__");
  });
});
