import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MiniSparkline } from "./MiniSparkline";

describe("MiniSparkline", () => {
  it("returns null when fewer than 2 points", () => {
    const { container } = render(<MiniSparkline points={[1]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a polyline with normalized path", () => {
    const { container } = render(<MiniSparkline points={[1, 3, 2, 5, 4]} width={80} height={24} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute("points")).toBeTruthy();
    const title = container.querySelector("title");
    expect(title?.textContent).toMatch(/min|max/);
  });
});
