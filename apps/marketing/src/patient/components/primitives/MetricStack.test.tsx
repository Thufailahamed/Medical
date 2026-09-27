import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MetricStack } from "./MetricStack";

describe("MetricStack", () => {
  it("renders label/value rows with divide styling", () => {
    const { getByText } = render(
      <MetricStack items={[{ label: "Awaiting confirmation", value: "3", accent: "amber" }]} />
    );
    expect(getByText("Awaiting confirmation")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });

  it("applies compact density when compact=true", () => {
    const { container } = render(
      <MetricStack compact items={[{ label: "A", value: "1" }]} />
    );
    expect(container.querySelector("dl")?.className).toMatch(/divide-y/);
  });
});
