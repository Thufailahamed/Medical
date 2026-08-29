/**
 * Patient root layout — token scope + provider mounting.
 *
 * The wrapper element is load-bearing: every design token in
 * globals.css is scoped to [data-app="patient"], so if this attribute
 * regresses the entire portal renders unstyled.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/portal/components/Providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/portal/components/AuthBoot", () => ({
  AuthBoot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import PatientLayout from "./layout";

describe("PatientLayout", () => {
  it("scopes children under data-app=\"patient\"", () => {
    const { container } = render(
      <PatientLayout>
        <p>child</p>
      </PatientLayout>
    );
    const wrapper = container.querySelector('[data-app="patient"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveTextContent("child");
  });

  it("does not emit its own html or body element", () => {
    const { container } = render(
      <PatientLayout>
        <p>child</p>
      </PatientLayout>
    );
    expect(container.querySelector("html")).toBeNull();
    expect(container.querySelector("body")).toBeNull();
  });
});