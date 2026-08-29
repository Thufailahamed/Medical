import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useMedicationsToday: () => ({
    data: { medicines: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
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
}));

import { MedicationsToday } from "./MedicationsToday";

describe("MedicationsToday", () => {
  it("renders the header card and today label", () => {
    const { container } = render(<MedicationsToday />);
    expect(container.textContent).toMatch(/Today's plan/);
  });
});
