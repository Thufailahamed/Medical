import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useAllergies: () => ({
    data: {
      allergies: [
        {
          id: "1",
          substance: "Peanuts",
          severity: "severe",
          reaction: "Hives",
          onsetDate: null,
          notes: null,
          active: true,
          recordedAt: "2026-01-01",
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useAddAllergy: () => ({ mutateAsync: vi.fn() }),
  useEditAllergy: () => ({ mutateAsync: vi.fn() }),
  useDeleteAllergy: () => ({ mutate: vi.fn() }),
}));

import AllergiesPage from "./page";

describe("AllergiesPage", () => {
  it("renders list of allergies", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AllergiesPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("Peanuts")).toBeInTheDocument());
    expect(screen.getByText("severe")).toBeInTheDocument();
  });
});
