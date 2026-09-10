import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatShellHeader } from "./ChatShellHeader";

describe("ChatShellHeader", () => {
  it("changes the model through the dropdown", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    render(
      <ChatShellHeader
        modelId="wellness-72"
        onModelChange={onModelChange}
        onNewChat={vi.fn()}
        hasMessages={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Wellness 72/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /Wellness Pro/i }));
    expect(onModelChange).toHaveBeenCalledWith("wellness-pro");
  });

  it("shows New chat only when a conversation exists", async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();
    const { rerender } = render(
      <ChatShellHeader
        modelId="wellness-72"
        onModelChange={vi.fn()}
        onNewChat={onNewChat}
        hasMessages={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /New chat/i })).toBeNull();
    rerender(
      <ChatShellHeader
        modelId="wellness-72"
        onModelChange={vi.fn()}
        onNewChat={onNewChat}
        hasMessages
      />,
    );
    await user.click(screen.getByRole("button", { name: /New chat/i }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("links back to the workspace and to the lab explainer", () => {
    render(
      <ChatShellHeader
        modelId="wellness-72"
        onModelChange={vi.fn()}
        onNewChat={vi.fn()}
        hasMessages={false}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Back to AI workspace/i }),
    ).toHaveAttribute("href", "/patient/ai");
    expect(screen.getByRole("link", { name: /Lab explainer/i })).toHaveAttribute(
      "href",
      "/patient/ai/lab-explain",
    );
  });
});
