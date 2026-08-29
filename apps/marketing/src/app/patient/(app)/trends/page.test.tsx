import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useVitalsSeriesRaw: () => ({
    data: {
      type: "heart_rate",
      range: { from: null, to: null },
      points: [],
      stats: null,
      latestClassification: null,
    },
    isLoading: false,
  }),
  useLabResults: () => ({
    data: { items: [] },
    isLoading: false,
  }),
}));

import TrendsPage from "./page";

describe("TrendsPage", () => {
  it("renders metric tabs and ranges", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TrendsPage />
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getByText("Blood pressure")).toBeInTheDocument()
    );
    expect(screen.getByText("90d")).toBeInTheDocument();
  });
});
