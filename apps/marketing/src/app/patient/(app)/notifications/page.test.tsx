import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useNotifications: () => ({ data: { items: [] }, isLoading: false, isError: false }),
}));

import NotificationsPage from "./page";

describe("NotificationsPage", () => {
  it("renders the section header", () => {
    render(<NotificationsPage />);
    expect(screen.getByText(/Notifications/)).toBeTruthy();
  });
});
