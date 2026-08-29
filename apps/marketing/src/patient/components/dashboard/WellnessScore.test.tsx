import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { WellnessScore } from "./WellnessScore";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("WellnessScore", () => {
  it("renders the label and surfaces the empty state when /wellness/me fails", () => {
    const { container } = withClient(<WellnessScore />);
    expect(container.textContent).toMatch(/Life quality/);
  });
});
