import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { Card } from "./Card";

describe("Card", () => {
  it("renders children inside the rounded white plate", () => {
    const { container } = render(
      <Card>
        <span data-testid="child">hi</span>
      </Card>
    );
    expect(container.querySelector("[data-testid='child']")).toBeTruthy();
  });

  it("uses the patient-card surface class", () => {
    const { container } = render(<Card>x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/patient-card/);
  });

  it("pads by default and omits padding when padded=false", () => {
    const { container: c1, rerender } = render(<Card>x</Card>);
    expect(c1.firstChild).toBeTruthy();
    expect((c1.firstChild as HTMLElement).className).toMatch(/\bp-5\b/);

    rerender(<Card padded={false}>y</Card>);
    const el = c1.firstChild as HTMLElement;
    expect(el.className).not.toMatch(/\bp-5\b/);
  });

  it("honours the `as` prop so the element can be a section or article", () => {
    const { container } = render(
      <Card as="section" aria-label="dashboard">
        x
      </Card>
    );
    expect(container.querySelector("section")).toBeTruthy();
  });

  it("renders a pastel corner blob by default", () => {
    const { container } = render(<Card>x</Card>);
    expect(container.querySelector(".patient-card-blob")).toBeTruthy();
  });
});
