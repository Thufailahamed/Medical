import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatusDots } from "./StatusDots";

describe("StatusDots", () => {
  it("renders a diamond dot plus text label", () => {
    const { getByText, container } = render(<StatusDots status="confirmed" />);
    expect(getByText("Confirmed")).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("maps cancelled to muted tone and in_progress to amber", () => {
    const { container, rerender } = render(<StatusDots status="cancelled" />);
    expect(container.innerHTML).toMatch(/text-text-muted/);
    rerender(<StatusDots status="in_progress" />);
    expect(container.innerHTML).toMatch(/bg-warn/);
  });
});
