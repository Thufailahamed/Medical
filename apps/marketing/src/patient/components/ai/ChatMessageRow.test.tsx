import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatMessageRow, type ChatMessage } from "./ChatMessageRow";

const userMessage: ChatMessage = {
  id: "u1",
  role: "user",
  body: "Why is my blood pressure high?",
  createdAt: "2026-09-10T10:00:00.000Z",
};

const assistantMessage: ChatMessage = {
  id: "a1",
  role: "assistant",
  body: "Morning pressure **rises naturally** at waking.",
  createdAt: "2026-09-10T10:00:05.000Z",
};

function rowProps(message: ChatMessage) {
  return {
    message,
    isLastAssistant: message.role === "assistant",
    busy: false,
    copied: false,
    editing: false,
    onCopy: vi.fn(),
    onEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onReadAloud: vi.fn(),
    onRate: vi.fn(),
    onRegenerate: vi.fn(),
  };
}

describe("ChatMessageRow", () => {
  it("renders a user bubble with copy and edit actions", async () => {
    const user = userEvent.setup();
    const props = rowProps(userMessage);
    render(<ChatMessageRow {...props} />);
    expect(screen.getByText("Why is my blood pressure high?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(props.onCopy).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders assistant markdown and action buttons", async () => {
    const user = userEvent.setup();
    const props = rowProps(assistantMessage);
    render(<ChatMessageRow {...props} />);
    expect(screen.getByText("rises naturally")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Helpful" }));
    await user.click(
      screen.getByRole("button", { name: "Regenerate response" }),
    );
    expect(props.onRate).toHaveBeenCalledWith(1);
    expect(props.onRegenerate).toHaveBeenCalledTimes(1);
  });
});
