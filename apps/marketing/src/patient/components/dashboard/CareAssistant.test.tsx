import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useConversations: () => ({
    data: { conversations: [] },
    isLoading: false,
    isError: false,
  }),
}));

import { CareAssistant } from "./CareAssistant";

describe("CareAssistant", () => {
  it("shows the prompt and links to AI + messages", () => {
    render(<CareAssistant />);
    expect(screen.getByText(/Care insights/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ask AI/i })).toHaveAttribute(
      "href",
      "/patient/ai/chat",
    );
    expect(screen.getByRole("link", { name: /Messages/i })).toHaveAttribute(
      "href",
      "/patient/messages",
    );
  });
});
