import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/patient/hooks", () => ({
  useCreateRecord: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecord: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import NewRecordPage from "./page";

describe("NewRecordPage", () => {
  it("renders the create form heading + title input", () => {
    render(<NewRecordPage />);
    expect(screen.getByText(/New medical record/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/CBC 2026-08-15/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy();
  });
});