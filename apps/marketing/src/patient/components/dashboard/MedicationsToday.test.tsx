import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MedicationsToday } from "./MedicationsToday";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MedicationsToday", () => {
  it("renders the header card and today label", () => {
    const { container } = withClient(<MedicationsToday />);
    expect(container.textContent).toMatch(/Today's medications/);
  });
});
