import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { api } from "@/portal/lib/api";
import { ActiveMemberPill } from "@/patient/components/shell/ActiveMemberPill";
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
    React.createElement(
      QueryClientProvider,
      { client: qc },
      ui
    )
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

describe("ActiveMemberPill", () => {
  it("renders nothing when no active family member is set", () => {
    const { container } = renderWith(<ActiveMemberPill />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the member name when an active FM is set", async () => {
    useActiveFamilyMemberStore.getState().setActiveFamilyMemberId("fm-1");
    mockedApi.mockResolvedValueOnce({
      family: [{ id: "fm-1", name: "Thufail", relationship: "self" }],
    });

    renderWith(<ActiveMemberPill />);

    await waitFor(() =>
      expect(screen.getByTestId("active-member-pill")).toBeInTheDocument()
    );
    // Family query is in-flight; pill renders fallback until it
    // resolves. Wait for the resolved name before asserting.
    expect(await screen.findByText("Thufail")).toBeInTheDocument();
  });

  it("opens the picker sheet on click", async () => {
    useActiveFamilyMemberStore.getState().setActiveFamilyMemberId("fm-1");
    mockedApi.mockResolvedValueOnce({
      family: [
        { id: "fm-1", name: "Thufail", relationship: "self" },
        { id: "fm-2", name: "Amma", relationship: "mother" },
      ],
    });

    const user = userEvent.setup();
    renderWith(<ActiveMemberPill />);

    await waitFor(() =>
      expect(screen.getByTestId("active-member-pill")).toBeInTheDocument()
    );
    await user.click(screen.getByTestId("active-member-pill"));

    expect(
      await screen.findByText("Self (you)", {}, { timeout: 1000 })
    ).toBeInTheDocument();
    expect(screen.getByText("Amma")).toBeInTheDocument();
  });
});
