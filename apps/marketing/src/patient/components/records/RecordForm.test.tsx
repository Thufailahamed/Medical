import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mutateAsync = vi.fn();
vi.mock("@/patient/hooks", () => ({
  useCreateRecord: () => ({ mutateAsync, isPending: false }),
  useUpdateRecord: () => ({ mutateAsync, isPending: false }),
  useFamilyMembers: () => ({ data: { family: [] }, isLoading: false }),
}));

import { RecordForm } from "./RecordForm";

describe("RecordForm", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
  });

  it("renders the title input and the kind chips", () => {
    render(<RecordForm mode="create" onSuccess={() => {}} />);
    expect(screen.getByPlaceholderText(/CBC 2026-08-15/i)).toBeTruthy();
    expect(screen.getByTestId("kind-chips")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Lab report/i })).toBeTruthy();
  });

  it("calls useCreateRecord with normalised tags on submit", async () => {
    mutateAsync.mockResolvedValueOnce({ id: "r1", envelopeVersion: "v1" });
    const onSuccess = vi.fn();
    render(<RecordForm mode="create" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/CBC/i), {
      target: { value: "Lipid panel" },
    });
    fireEvent.change(screen.getByPlaceholderText(/annual, fasting/i), {
      target: { value: "Annual, Annual, fasting " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "lab_report",
          title: "Lipid panel",
          tags: ["annual", "fasting"],
        }),
      );
    });
    expect(onSuccess).toHaveBeenCalledWith("r1");
  });

  it("pre-fills and disables kind chips in edit mode", () => {
    render(
      <RecordForm
        mode="edit"
        recordId="r1"
        initial={{ kind: "imaging", title: "MRI knee", tags: ["left"] }}
        onSuccess={() => {}}
      />,
    );
    const titleInput = screen.getByPlaceholderText(/CBC/i) as HTMLInputElement;
    expect(titleInput.value).toBe("MRI knee");
    const imagingChip = screen.getByRole("button", { name: /^Imaging$/i });
    expect(imagingChip.getAttribute("aria-pressed")).toBe("true");
  });
});
