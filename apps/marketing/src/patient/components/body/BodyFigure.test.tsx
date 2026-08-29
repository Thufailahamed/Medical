import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { BodyFigure } from "./BodyFigure";
import { BodyHotspot } from "./BodyHotspot";

describe("BodyFigure", () => {
  it("renders an SVG with a labelled role=img for assistive tech", () => {
    const { container } = render(<BodyFigure ariaLabel="Front view" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("role")).toBe("img");
    expect(svg!.getAttribute("aria-label")).toBe("Front view");
  });

  it("forwards className and renders the children overlay", () => {
    const { container } = render(
      <BodyFigure className="h-64">
        <BodyHotspot cx={50} cy={30} testId="spot-heart" />
      </BodyFigure>
    );
    expect(container.querySelector("svg.h-64")).toBeTruthy();
    expect(container.querySelector("[data-testid='spot-heart']")).toBeTruthy();
  });
});

describe("BodyHotspot", () => {
  it("renders a filled ring at the requested coordinates", () => {
    const { container } = render(
      <BodyHotspot cx={42} cy={50} testId="h1" />
    );
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    expect(circles[0].getAttribute("cx")).toBe("42");
    expect(circles[0].getAttribute("cy")).toBe("50");
  });

  it("shows the active label only when active=true", () => {
    const { container, rerender } = render(
      <BodyHotspot cx={20} cy={20} label="Heart" active={false} />
    );
    expect(container.querySelector("text")).toBeNull();

    rerender(<BodyHotspot cx={20} cy={20} label="Heart" active />);
    expect(container.querySelector("text")!.textContent).toBe("Heart");
  });
});
