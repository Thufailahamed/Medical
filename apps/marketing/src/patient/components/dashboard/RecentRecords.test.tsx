import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useRecords: () => ({
    data: { records: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import { RecentRecords } from "./RecentRecords";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("RecentRecords", () => {
  it("renders the placeholder label", () => {
    const { container } = withClient(<RecentRecords />);
    expect(container.textContent).toMatch(/Recent records/);
  });
});
