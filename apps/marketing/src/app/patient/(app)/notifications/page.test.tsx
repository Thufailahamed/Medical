import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useNotifications: () => ({ data: { notifications: [] }, isLoading: false, isError: false }),
  useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

import NotificationsPage from "./page";

describe("NotificationsPage", () => {
  it("renders the section header", () => {
    render(<NotificationsPage />);
    expect(screen.getByText(/Notifications/)).toBeTruthy();
  });
});
