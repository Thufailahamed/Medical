import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedTabs } from "./SegmentedTabs";

describe("SegmentedTabs", () => {
  const tabs = [
    { id: "all", label: "All (3)" },
    { id: "pinned", label: "Pinned (1)" },
  ];

  it("renders every tab as a button with its label", () => {
    render(<SegmentedTabs tabs={tabs} activeId="all" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All (3)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pinned (1)" })).toBeTruthy();
  });

  it("marks only the active tab pressed with the raised tab", () => {
    const { container } = render(
      <SegmentedTabs tabs={tabs} activeId="pinned" onChange={() => {}} />
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].className).toMatch(/bg-surface\b/);
    expect(buttons[0].className).not.toMatch(/bg-surface\b/);
  });

  it("calls onChange with the tab id on click", () => {
    const onChange = vi.fn();
    render(<SegmentedTabs tabs={tabs} activeId="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Pinned (1)" }));
    expect(onChange).toHaveBeenCalledWith("pinned");
  });

  it("renders the soft segmented track", () => {
    const { container } = render(
      <SegmentedTabs tabs={tabs} activeId="all" onChange={() => {}} />
    );
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-surface-2/);
  });
});
