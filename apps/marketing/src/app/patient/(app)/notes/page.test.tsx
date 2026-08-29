import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useNotes: () => ({
    data: {
      notes: [
        {
          id: "1",
          title: "Follow-up",
          body: "Call Dr. Smith",
          pinned: true,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useAddNote: () => ({ mutateAsync: vi.fn() }),
  useEditNote: () => ({ mutate: vi.fn() }),
  useDeleteNote: () => ({ mutate: vi.fn() }),
}));

import NotesPage from "./page";

describe("NotesPage", () => {
  it("renders pinned note", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <NotesPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("Follow-up")).toBeInTheDocument());
    expect(screen.getByText("Pinned (1)")).toBeInTheDocument();
  });
});
