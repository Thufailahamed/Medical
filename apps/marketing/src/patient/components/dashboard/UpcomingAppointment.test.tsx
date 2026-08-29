import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
