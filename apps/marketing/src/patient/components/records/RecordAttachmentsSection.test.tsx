import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addMut: vi.fn(),
  delMut: vi.fn(),
  presignMut: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  openSpy: vi.fn(),
}));

vi.mock("@/patient/hooks", () => ({
  useRecordAttachments: () => ({
    data: {
      files: [
        {
          id: "f1",
          fileName: "lab.pdf",
          mimeType: "application/pdf",
          size: 1024,
          uploadedAt: "2026-08-01T00:00:00Z",
        },
      ],
    },
    isLoading: false,
  }),
  useAddAttachment: () => ({ mutateAsync: mocks.addMut, isPending: false }),
  useDeleteAttachment: () => ({ mutateAsync: mocks.delMut, isPending: false }),
  usePresignAttachment: () => ({ mutateAsync: mocks.presignMut, isPending: false }),
}));
vi.mock("@/portal/components/ui/Toast", () => ({ toast: mocks.toast }));
vi.stubGlobal("open", mocks.openSpy);

import { RecordAttachmentsSection } from "./RecordAttachmentsSection";

beforeEach(() => {
  mocks.addMut.mockReset();
  mocks.delMut.mockReset();
  mocks.presignMut.mockReset();
  mocks.toast.success.mockReset();
  mocks.toast.error.mockReset();
  mocks.openSpy.mockReset();
  vi.stubGlobal("open", mocks.openSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RecordAttachmentsSection", () => {
  it("renders one row per file with Download + Delete", () => {
    render(<RecordAttachmentsSection recordId="r1" />);
    expect(screen.getByText("lab.pdf")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^download$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeTruthy();
  });

  it("presigns and opens the URL on Download click", async () => {
    mocks.presignMut.mockResolvedValueOnce({
      token: "t",
      expiresAt: "x",
      url: "https://example.com/d",
    });
    render(<RecordAttachmentsSection recordId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /^download$/i }));
    await waitFor(() =>
      expect(mocks.presignMut).toHaveBeenCalledWith({ fileId: "f1" }),
    );
    expect(mocks.openSpy).toHaveBeenCalledWith(
      "https://example.com/d",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("confirms then deletes", async () => {
    mocks.delMut.mockResolvedValueOnce({});
    vi.stubGlobal("confirm", () => true);
    render(<RecordAttachmentsSection recordId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(mocks.delMut).toHaveBeenCalledWith({ id: "f1", recordId: "r1" }),
    );
  });

  it("rejects a 51MB file before submitting", async () => {
    render(<RecordAttachmentsSection recordId="r1" />);
    const input = screen.getByLabelText(/add attachment/i) as HTMLInputElement;
    const big = new File([new Uint8Array(51 * 1024 * 1024)], "huge.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [big] } });
    expect(mocks.addMut).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalled();
  });

  it("uploads a valid file via FormData", async () => {
    mocks.addMut.mockResolvedValueOnce({ file: { id: "f2" } });
    render(<RecordAttachmentsSection recordId="r1" />);
    const input = screen.getByLabelText(/add attachment/i) as HTMLInputElement;
    const file = new File(["x"], "ok.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mocks.addMut).toHaveBeenCalledWith({ file }));
  });
});