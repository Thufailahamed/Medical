import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useMedications: () => ({ data: { medicines: [] }, isLoading: false, isError: false }),
  useMedicationStats: () => ({ data: { activeCount: 0, todayCount: 0, todayTaken: 0, streakDays: 0, last7Days: [] }, isLoading: false, isError: false }),
}));

import MedicationsPage from "./page";

describe("MedicationsPage", () => {
  it("renders the section header", () => {
    render(<MedicationsPage />);
    expect(screen.getByText(/Medications/)).toBeTruthy();
  });
});
