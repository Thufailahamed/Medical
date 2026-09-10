import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mutateAsyncMock } = vi.hoisted(() => ({ mutateAsyncMock: vi.fn() }));

vi.mock("@/patient/hooks", () => ({
  useGenerateSummary: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

import { HealthSummaryCard } from "./HealthSummaryCard";

describe("HealthSummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("starts with the empty prompt", () => {
    render(<HealthSummaryCard patientId="p1" />);
    expect(screen.getByText(/Generate your briefing/i)).toBeTruthy();
  });

  it("renders the structured summary after generating", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValue({
      patientSummary: "Diabetes is stable.",
      diagnoses: ["Type 2 diabetes"],
      risks: ["Family history"],
    });
    render(<HealthSummaryCard patientId="p1" />);
    await user.click(screen.getByRole("button", { name: /Generate summary/i }));
    expect(await screen.findByText("Diabetes is stable.")).toBeTruthy();
    expect(screen.getByText("Type 2 diabetes")).toBeTruthy();
    expect(screen.getByText("Family history")).toBeTruthy();
    expect(mutateAsyncMock).toHaveBeenCalledWith("p1");
  });

  it("shows an inline error with retry", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValue(new Error("Service unavailable"));
    render(<HealthSummaryCard patientId="p1" />);
    await user.click(screen.getByRole("button", { name: /Generate summary/i }));
    expect(await screen.findByText("Service unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();
  });

  it("blocks generation without a patient id", async () => {
    const user = userEvent.setup();
    render(<HealthSummaryCard patientId="" />);
    await user.click(screen.getByRole("button", { name: /Generate summary/i }));
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByText(/profile is still loading/i)).toBeTruthy();
  });
});
