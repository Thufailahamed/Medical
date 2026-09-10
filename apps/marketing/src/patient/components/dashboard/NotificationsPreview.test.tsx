import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useNotifications: vi.fn(() => ({
    data: { notifications: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

import { NotificationsPreview } from "./NotificationsPreview";

function withClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NotificationsPreview", () => {
  it("renders empty state when no notifications", () => {
    withClient(<NotificationsPreview />);
    expect(screen.getByText(/caught up/i)).toBeTruthy();
  });

  it("renders View all link", () => {
    const { container } = withClient(<NotificationsPreview />);
    const link = container.querySelector('a[href="/patient/notifications"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toMatch(/View all/);
  });
});
