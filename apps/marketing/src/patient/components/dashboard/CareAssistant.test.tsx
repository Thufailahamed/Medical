import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CareAssistant } from "./CareAssistant";

describe("CareAssistant", () => {
  it("shows the prompt and a link to messages", () => {
    render(<CareAssistant />);
    expect(screen.getByText(/Care insights/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Open chat/i })
    ).toHaveAttribute("href", "/patient/messages");
  });
});
