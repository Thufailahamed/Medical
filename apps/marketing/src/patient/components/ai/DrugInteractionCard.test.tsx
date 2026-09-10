import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";

const { mutateAsyncMock } = vi.hoisted(() => ({ mutateAsyncMock: vi.fn() }));

vi.mock("@/patient/hooks", () => ({
  useCheckDrugInteractions: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

import {
  DrugInteractionCard,
  type DrugInteractionHandle,
} from "./DrugInteractionCard";

describe("DrugInteractionCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists active medications and checks all of them via the ref handle", () => {
    mutateAsyncMock.mockResolvedValue({ items: [], message: null });
    const ref = createRef<DrugInteractionHandle>();
    render(<DrugInteractionCard ref={ref} activeMedNames={["Metformin", "Atorvastatin"]} />);

    expect(screen.getByText("Metformin")).toBeTruthy();
    ref.current?.checkAll();
    expect(mutateAsyncMock).toHaveBeenCalledWith(["Metformin", "Atorvastatin"]);
  });

  it("maps severity to the right accessible result", async () => {
    mutateAsyncMock.mockResolvedValue({
      items: [
        {
          medicines: ["Warfarin", "Aspirin"],
          severity: "severe",
          note: "Increased bleeding risk",
          recommendation: "Contact your doctor before combining.",
        },
      ],
      message: null,
    });
    const user = userEvent.setup();
    render(<DrugInteractionCard activeMedNames={[]} />);
    await user.type(screen.getByLabelText("Medications"), "Warfarin, Aspirin");
    await user.click(screen.getByRole("button", { name: /Check interactions/i }));

    expect(await screen.findByText("Increased bleeding risk")).toBeTruthy();
    expect(screen.getByText("severe")).toBeTruthy();
    expect(screen.getByText("Contact your doctor before combining.")).toBeTruthy();
  });

  it("shows the clear state when no interactions are found", async () => {
    mutateAsyncMock.mockResolvedValue({
      items: [],
      message: "No interactions found.",
    });
    const user = userEvent.setup();
    render(<DrugInteractionCard activeMedNames={[]} />);
    await user.type(screen.getByLabelText("Medications"), "Paracetamol");
    await user.click(screen.getByRole("button", { name: /Check interactions/i }));
    expect(await screen.findByText(/No adverse interactions detected/i)).toBeTruthy();
  });
});
