import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useVaccinations: () => ({
    data: {
      administered: [
        {
          id: "1",
          vaccineName: "MMR",
          dose: "1",
          administeredAt: "2026-02-01",
          provider: null,
          lotNumber: null,
          notes: null,
          recordType: "vaccination",
        },
      ],
      catalog: [],
    },
    isLoading: false,
    isError: false,
  }),
  useVaccinationsDue: () => ({
    data: { due: [], overdue: [], upcoming: [] },
    isLoading: false,
    isError: false,
  }),
  useAddVaccination: () => ({ mutateAsync: vi.fn() }),
}));

import VaccinationsPage from "./page";

describe("VaccinationsPage", () => {
  it("renders administered vaccines", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <VaccinationsPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("MMR")).toBeInTheDocument());
    expect(screen.getByText("Nothing due right now")).toBeInTheDocument();
  });
});
