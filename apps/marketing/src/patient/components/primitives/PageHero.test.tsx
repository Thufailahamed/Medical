import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  PageHero,
  HeroStatusPill,
  heroPrimaryAction,
  heroSecondaryAction,
} from "./PageHero";

describe("PageHero", () => {
  it("renders kicker, title and description on the ink surface", () => {
    const { container } = render(
      <PageHero
        kicker="Biometric Telemetry"
        title="Clinical Vitals"
        description="Log and monitor readings."
      />,
    );
    expect(container.querySelector(".pt-hero")).toBeTruthy();
    expect(
      container.querySelector(".pt-hero-kicker")?.textContent,
    ).toContain("Biometric Telemetry");
    expect(screen.getByText("Clinical Vitals")).toBeTruthy();
    expect(screen.getByText("Log and monitor readings.")).toBeTruthy();
  });

  it("renders actions with hero action classes", () => {
    render(
      <PageHero
        title="T"
        actions={
          <>
            <button type="button" className={heroSecondaryAction}>
              Symptom
            </button>
            <button type="button" className={heroPrimaryAction}>
              Add reading
            </button>
          </>
        }
      />,
    );
    expect(
      document.querySelector(".hero-secondary")?.textContent,
    ).toContain("Symptom");
    expect(
      document.querySelector(".hero-primary")?.textContent,
    ).toContain("Add reading");
  });

  it("renders the dashed footer strip", () => {
    render(<PageHero title="T" footer={<span>7-day window</span>} />);
    const footer = document.querySelector(".pt-hero-footer");
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain("7-day window");
  });

  it("HeroStatusPill renders label with pulse dot", () => {
    render(<HeroStatusPill label="Vitals steady" tone="success" />);
    expect(screen.getByText("Vitals steady")).toBeTruthy();
  });

  it("omits the footer strip when footer is not passed", () => {
    const { container } = render(<PageHero title="T" />);
    expect(container.querySelector(".pt-hero-footer")).toBeNull();
  });
});
