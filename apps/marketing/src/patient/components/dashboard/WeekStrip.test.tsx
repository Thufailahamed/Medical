import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { WeekStrip } from "./WeekStrip";

function renderWithClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("WeekStrip", () => {
  it("renders the label and a loading state, no crash", () => {
    const { container } = renderWithClient(<WeekStrip />);
    expect(container.textContent).toMatch(/This week/);
  });
});
