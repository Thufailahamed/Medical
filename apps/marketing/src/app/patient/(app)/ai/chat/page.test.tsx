import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { apiMock, searchParamsMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  searchParamsMock: { current: new URLSearchParams() },
}));

vi.mock("@/portal/lib/api", () => ({
  api: apiMock,
  ApiError: class ApiError extends Error {},
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock.current,
}));

vi.mock("@/patient/hooks", () => ({
  usePatientProfile: () => ({
    data: { patient: { patients: { id: "p1" }, users: { name: "Anya Perera" } } },
    isLoading: false,
  }),
}));

import AiChatPage from "./page";

describe("AiChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsMock.current = new URLSearchParams();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows the greeting empty state", () => {
    render(<AiChatPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Anya/ }),
    ).toBeTruthy();
    expect(screen.getByText(/Care Chat/i)).toBeTruthy();
  });

  it("sends a typed message and renders the reply", async () => {
    apiMock.mockResolvedValue({ reply: "Take your medication with food." });
    const user = userEvent.setup();
    render(<AiChatPage />);

    await user.type(
      screen.getByLabelText("Message HealthHub"),
      "How do I take my meds?",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "/ai/chat",
        expect.objectContaining({
          method: "POST",
          json: expect.objectContaining({ message: "How do I take my meds?" }),
        }),
      ),
    );
    expect(
      await screen.findByText("Take your medication with food."),
    ).toBeTruthy();
  });

  it("auto-sends the ?prompt= from the hub", async () => {
    apiMock.mockResolvedValue({ reply: "Here is your answer." });
    searchParamsMock.current = new URLSearchParams({ prompt: "Hello from hub" });
    render(<AiChatPage />);

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "/ai/chat",
        expect.objectContaining({
          json: expect.objectContaining({ message: "Hello from hub" }),
        }),
      ),
    );
  });
});
