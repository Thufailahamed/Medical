import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useMedications: () => ({
    data: { medicines: [] },
    isLoading: false,
    isError: false,
  }),
  useMedicationStats: () => ({
    data: {
      activeCount: 0,
      todayCount: 0,
      todayTaken: 0,
      streakDays: 0,
      last7Days: [],
    },
    isLoading: false,
    isError: false,
  }),
  useRefillDue: () => ({
    data: {
      refills: [
        {
          id: "m1",
          name: "Aspirin",
          dosage: "81mg",
          frequency: null,
          timing: null,
          startDate: "2026-01-01",
          expectedEndDate: "2026-08-30",
          daysRemaining: 5,
          refillReminder: true,
          source: "explicit",
        },
      ],
      count: 1,
    },
    isLoading: false,
    isError: false,
  }),
}));

import MedicationsPage from "./page";

describe("MedicationsPage", () => {
  it("renders the section header", () => {
    render(<MedicationsPage />);
    expect(screen.getByText(/Medications/)).toBeTruthy();
  });

  it("shows refill CTA when refills are due", () => {
    render(<MedicationsPage />);
    expect(screen.getByText(/1 medicine.*need refill/i)).toBeTruthy();
  });
});
