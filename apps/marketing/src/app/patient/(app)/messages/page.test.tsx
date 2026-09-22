import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useConversations: () => ({ data: { conversations: [] }, isLoading: false, isError: false }),
  useConversationMessages: () => ({ data: { messages: [] }, isLoading: false, isError: false }),
  usePatientProfile: () => ({ data: undefined, isLoading: false, isError: false }),
}));

import MessagesPage from "./page";

describe("MessagesPage", () => {
  it("renders the section header", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MessagesPage />
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("heading", { name: /Messages & Care Team Communications/ }),
    ).toBeTruthy();
  });
});
