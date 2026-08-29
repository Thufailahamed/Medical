import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useConversations: () => ({ data: { conversations: [] }, isLoading: false, isError: false }),
  useConversationMessages: () => ({ data: { messages: [] }, isLoading: false, isError: false }),
}));

import MessagesPage from "./page";

describe("MessagesPage", () => {
  it("renders the section header", () => {
    render(<MessagesPage />);
    expect(screen.getByText(/Messages/)).toBeTruthy();
  });
});
