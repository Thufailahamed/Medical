import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bot } from "lucide-react";

import { AiToolCard } from "./AiToolCard";

describe("AiToolCard", () => {
  it("renders title, description, cta and link target", () => {
    render(
      <AiToolCard
        href="/patient/ai/chat"
        title="Care Chat"
        description="Multi-turn conversation."
        cta="Open chat"
        icon={<Bot size={16} />}
        accent="sky"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/patient/ai/chat",
    );
    expect(screen.getByText("Care Chat")).toBeTruthy();
    expect(screen.getByText("Multi-turn conversation.")).toBeTruthy();
    expect(screen.getByText("Open chat")).toBeTruthy();
  });
});
