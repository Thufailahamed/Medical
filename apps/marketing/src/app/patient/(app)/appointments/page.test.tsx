import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useAppointments: () => ({
    data: { appointments: [] },
    isLoading: false,
    isError: false,
  }),
}));

import AppointmentsPage from "./page";

describe("AppointmentsPage", () => {
  it("renders the page header", () => {
    render(<AppointmentsPage />);
    expect(screen.getByText(/Appointments/)).toBeTruthy();
  });
});
