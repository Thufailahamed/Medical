import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RecentActivity } from "./RecentActivity";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("RecentActivity", () => {
  it("renders the placeholder label", () => {
    const { container } = withClient(<RecentActivity />);
    expect(container.textContent).toMatch(/Recent activity/);
  });
});
