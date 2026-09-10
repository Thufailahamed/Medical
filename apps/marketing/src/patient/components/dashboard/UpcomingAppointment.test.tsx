import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useAppointments: () => ({
    data: { appointments: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import { UpcomingAppointment } from "./UpcomingAppointment";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("UpcomingAppointment", () => {
  it("renders the placeholder label", () => {
    const { container } = withClient(<UpcomingAppointment />);
    expect(container.textContent).toMatch(/Next up/);
  });
});
