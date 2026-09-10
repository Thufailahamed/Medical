import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatEmptyState } from "./ChatEmptyState";

describe("ChatEmptyState", () => {
  it("greets the patient and sends a starter prompt", async () => {
    const user = userEvent.setup();
    const onPrompt = vi.fn();
    render(<ChatEmptyState firstName="Anya" onPrompt={onPrompt} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Anya");
    await user.click(screen.getByRole("button", { name: /Medication safety/i }));
    expect(onPrompt).toHaveBeenCalledTimes(1);
    expect(onPrompt.mock.calls[0][0]).toMatch(/active medications/i);
  });

  it("disables starter prompts while busy", () => {
    render(<ChatEmptyState firstName="Anya" onPrompt={vi.fn()} disabled />);
    for (const name of [
      /Medication safety/i,
      /Explain my labs/i,
      /Prepare for my visit/i,
      /Vitals & trends/i,
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
