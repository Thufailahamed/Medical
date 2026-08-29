import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { api } from "@/portal/lib/api";
import { FamilyMemberPickerSheet } from "@/patient/components/shell/FamilyMemberPickerSheet";
import { useActiveFamilyMemberStore } from "@/patient/stores/activeFamilyMember";

vi.mock("@/portal/lib/api", () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

const mockedApi = vi.mocked(api);

function renderWith(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } },
  });
  return render(
    React.createElement(QueryClientProvider, { client: qc }, ui)
  );
}

beforeEach(() => {
  useActiveFamilyMemberStore.setState({ activeFamilyMemberId: null });
  localStorage.clear();
  mockedApi.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FamilyMemberPickerSheet", () => {
  it("renders Self + one row per member", async () => {
    mockedApi.mockResolvedValueOnce({
      family: [
        { id: "fm-1", name: "Thufail", relationship: "self" },
        { id: "fm-2", name: "Amma", relationship: "mother" },
      ],
    });

    renderWith(
      <FamilyMemberPickerSheet open={true} onClose={vi.fn()} />
    );

    expect(await screen.findByText("Self (you)")).toBeInTheDocument();
    expect(await screen.findByText("Amma")).toBeInTheDocument();
    expect(screen.getByText("mother")).toBeInTheDocument();
  });

  it("highlights the active member row", async () => {
    useActiveFamilyMemberStore.getState().setActiveFamilyMemberId("fm-2");
    mockedApi.mockResolvedValueOnce({
      family: [
        { id: "fm-1", name: "Thufail", relationship: "self" },
        { id: "fm-2", name: "Amma", relationship: "mother" },
      ],
    });

    renderWith(
      <FamilyMemberPickerSheet open={true} onClose={vi.fn()} />
    );

    const ammaButton = await screen.findByRole("button", { name: /Amma/ });
    expect(ammaButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders the empty state when no members", async () => {
    mockedApi.mockResolvedValueOnce({ family: [] });

    renderWith(
      <FamilyMemberPickerSheet open={true} onClose={vi.fn()} />
    );

    expect(
      await screen.findByText(/No family members on file/i)
    ).toBeInTheDocument();
  });

  it("selects a member on click and PATCHes /family/active", async () => {
    mockedApi
      .mockResolvedValueOnce({
        family: [
          { id: "fm-1", name: "Thufail", relationship: "self" },
          { id: "fm-2", name: "Amma", relationship: "mother" },
        ],
      })
      .mockResolvedValueOnce({ activeId: "fm-2" });

    const user = userEvent.setup();
    renderWith(
      <FamilyMemberPickerSheet open={true} onClose={vi.fn()} />
    );

    await screen.findByText("Amma");
    await user.click(screen.getByRole("button", { name: /Amma/ }));

    await waitFor(() =>
      expect(useActiveFamilyMemberStore.getState().activeFamilyMemberId).toBe(
        "fm-2"
      )
    );
    expect(mockedApi).toHaveBeenCalledWith(
      "/family/active",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("clears the active member when Self is clicked", async () => {
    useActiveFamilyMemberStore.getState().setActiveFamilyMemberId("fm-2");
    mockedApi
      .mockResolvedValueOnce({
        family: [{ id: "fm-2", name: "Amma", relationship: "mother" }],
      })
      .mockResolvedValueOnce({ activeId: null });

    const user = userEvent.setup();
    renderWith(
      <FamilyMemberPickerSheet open={true} onClose={vi.fn()} />
    );

    await screen.findByText("Self (you)");
    await user.click(screen.getByRole("button", { name: /Self/i }));

    await waitFor(() =>
      expect(useActiveFamilyMemberStore.getState().activeFamilyMemberId).toBeNull()
    );
  });
});
