import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AiCommandBar } from "./AiCommandBar";

describe("AiCommandBar", () => {
  it("submits trimmed text and clears the input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AiCommandBar onSubmit={onSubmit} quickPrompts={[]} />);

    const input = screen.getByLabelText("Ask the AI assistant");
    await user.type(input, "  Explain my labs  ");
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("Explain my labs");
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("submits an empty prompt when the field is blank", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AiCommandBar onSubmit={onSubmit} quickPrompts={[]} />);
    await user.click(screen.getByRole("button", { name: /Ask AI/i }));
    expect(onSubmit).toHaveBeenCalledWith("");
  });

  it("runs quick prompts", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AiCommandBar
        onSubmit={vi.fn()}
        quickPrompts={[{ label: "Summarize my record", onSelect }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Summarize my record" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("focuses the input on Ctrl+K", async () => {
    const user = userEvent.setup();
    render(<AiCommandBar onSubmit={vi.fn()} quickPrompts={[]} />);
    const input = screen.getByLabelText("Ask the AI assistant");
    input.blur();
    await user.keyboard("{Control>}k{/Control}");
    expect(document.activeElement).toBe(input);
  });
});
