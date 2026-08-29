import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useProfile: () => ({ data: null, isLoading: false, isError: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/portal/lib/auth", () => ({
  logout: vi.fn(),
}));

import ProfilePage from "./page";

describe("ProfilePage", () => {
  it("renders the section header", () => {
    render(<ProfilePage />);
    expect(screen.getAllByText(/Profile/).length).toBeGreaterThan(0);
  });

  it("shows a log out action", () => {
    render(<ProfilePage />);
    expect(screen.getByRole("button", { name: /Log out/i })).toBeTruthy();
  });
});
