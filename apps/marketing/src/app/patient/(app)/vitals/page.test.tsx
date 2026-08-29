import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useVitalsSeries: () => ({
    data: {
      type: "heart_rate",
      range: { from: null, to: null },
      points: [
        { t: "2026-01-01", value: 72, secondary: null, id: "1", unit: "bpm", context: null },
      ],
      stats: null,
      latestClassification: null,
    },
    isLoading: false,
    isError: false,
  }),
  useVitalsAlerts: () => ({
    data: { items: [], count: 0 },
    isLoading: false,
  }),
  useSymptoms: () => ({
    data: { symptoms: [] },
    isLoading: false,
    isError: false,
  }),
  useAddSymptom: () => ({ mutateAsync: vi.fn() }),
  useDeleteSymptom: () => ({ mutate: vi.fn() }),
  useAddVital: () => ({ mutateAsync: vi.fn() }),
}));

import VitalsPage from "./page";

describe("VitalsPage", () => {
  it("renders vitals cards and diary", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <VitalsPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("Heart rate")).toBeInTheDocument());
    expect(screen.getByText("Blood pressure")).toBeInTheDocument();
    expect(screen.getByText("SpO₂")).toBeInTheDocument();
    expect(screen.getByText("Symptom diary")).toBeInTheDocument();
  });
});
