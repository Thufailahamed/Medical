import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useProfile: () => ({ data: null, isLoading: false, isError: false }),
}));

import ProfilePage from "./page";

describe("ProfilePage", () => {
  it("renders the section header", () => {
    render(<ProfilePage />);
    expect(screen.getAllByText(/Profile/).length).toBeGreaterThan(0);
  });
});
