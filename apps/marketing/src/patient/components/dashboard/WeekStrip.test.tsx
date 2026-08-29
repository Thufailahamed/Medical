import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useHealthSummary: () => ({
    data: { alerts: { count: 0, items: [] } },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAppointments: () => ({
    data: { appointments: [] },
    isLoading: false,
    isError: false,
  }),
}));

import { WeekStrip } from "./WeekStrip";

describe("WeekStrip", () => {
  it("renders the label and a loading state, no crash", () => {
    const { container } = render(<WeekStrip />);
    expect(container.textContent).toMatch(/This week/);
  });
});
