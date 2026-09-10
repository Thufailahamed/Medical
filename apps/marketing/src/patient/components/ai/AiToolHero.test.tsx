import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlaskConical } from "lucide-react";

import { AiToolHero } from "./AiToolHero";

describe("AiToolHero", () => {
  it("renders badge, title, description, trust items and back link", () => {
    render(
      <AiToolHero
        badge="Pathology"
        title="Explain a lab report"
        description="Plain-language explanations."
        icon={<FlaskConical size={12} />}
        trust={["Plain English", "Non-diagnostic"]}
        actions={<button type="button">Upload</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Explain a lab report",
    );
    expect(screen.getByText("Pathology")).toBeTruthy();
    expect(screen.getByText("Plain English")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to AI tools/i })).toHaveAttribute(
      "href",
      "/patient/ai",
    );
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
  });
});
