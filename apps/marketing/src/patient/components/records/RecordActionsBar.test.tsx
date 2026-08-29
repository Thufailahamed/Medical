import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  restore: vi.fn(),
  move: vi.fn(),
  del: vi.fn(),
  reextract: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/patient/hooks", () => ({
  useArchiveRecord: () => ({ mutateAsync: mocks.archive, isPending: false }),
  useRestoreRecord: () => ({ mutateAsync: mocks.restore, isPending: false }),
  useMoveRecord: () => ({ mutateAsync: mocks.move, isPending: false }),
  useDeleteRecord: () => ({ mutateAsync: mocks.del, isPending: false }),
  useReExtractRecord: () => ({ mutateAsync: mocks.reextract, isPending: false }),
}));
vi.mock("@/portal/components/ui/Toast", () => ({ toast: mocks.toast }));

import { RecordActionsBar } from "./RecordActionsBar";

beforeEach(() => {
  mocks.archive.mockReset();
  mocks.restore.mockReset();
  mocks.move.mockReset();
  mocks.del.mockReset();
  mocks.reextract.mockReset();
  mocks.toast.success.mockReset();
  mocks.toast.error.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecordActionsBar", () => {
  it("renders Edit, Archive, Return, Re-extract, Delete when not archived + has attachments", () => {
    render(
      <RecordActionsBar
        recordId="r1"
        archived={false}
        hasAttachments={true}
        onEdit={() => {}}
        onDeleteSuccess={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^return to me$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^re-extract$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeTruthy();
  });

  it("shows Restore instead of Archive when archived=true", () => {
    render(
      <RecordActionsBar
        recordId="r1"
        archived={true}
        hasAttachments={false}
        onEdit={() => {}}
        onDeleteSuccess={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^restore$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^archive$/i })).toBeNull();
  });

  it("disables Re-extract when no attachments", () => {
    render(
      <RecordActionsBar
        recordId="r1"
        archived={false}
        hasAttachments={false}
        onEdit={() => {}}
        onDeleteSuccess={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /^re-extract$/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe("Attach a file first");
  });

  it("calls archive then toasts on click", async () => {
    mocks.archive.mockResolvedValueOnce({});
    render(
      <RecordActionsBar
        recordId="r1"
        archived={false}
        hasAttachments={false}
        onEdit={() => {}}
        onDeleteSuccess={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith("r1"));
    expect(mocks.toast.success).toHaveBeenCalledWith("Record archived");
  });

  it("confirms then deletes and fires onDeleteSuccess", async () => {
    mocks.del.mockResolvedValueOnce({});
    const onDeleteSuccess = vi.fn();
    const confirmStub = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmStub);
    render(
      <RecordActionsBar
        recordId="r1"
        archived={false}
        hasAttachments={false}
        onEdit={() => {}}
        onDeleteSuccess={onDeleteSuccess}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith("r1"));
    expect(onDeleteSuccess).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});