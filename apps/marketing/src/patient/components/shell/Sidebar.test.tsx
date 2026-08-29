import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { useAuthStore } from "@/portal/stores/auth";

import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/patient/appointments",
}));

beforeEach(() => {
  useAuthStore.setState({
    token: "tok",
    user: null,
    activeTenant: null,
    activeHospitalId: null,
    activeClinicId: null,
    locale: "en",
    hydrated: true,
  } as any);
});

describe("Sidebar", () => {
  it("renders all seven primary nav items", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("nav-dashboard")).toBeTruthy();
    expect(screen.getByTestId("nav-health")).toBeTruthy();
    expect(screen.getByTestId("nav-appointments")).toBeTruthy();
    expect(screen.getByTestId("nav-records")).toBeTruthy();
    expect(screen.getByTestId("nav-medications")).toBeTruthy();
    expect(screen.getByTestId("nav-messages")).toBeTruthy();
    expect(screen.getByTestId("nav-profile")).toBeTruthy();
  });

  it("marks the active route with aria-current=page", () => {
    render(<Sidebar />);
    const active = screen.getByTestId("nav-appointments");
    expect(active.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark unrelated nav items active", () => {
    render(<Sidebar />);
    const dash = screen.getByTestId("nav-dashboard");
    expect(dash.getAttribute("aria-current")).toBeNull();
  });

  it("shows the user's first name when present", () => {
    useAuthStore.setState({
      user: { id: "u", name: "Anya Perera", role: "patient" } as any,
    } as any);
    render(<Sidebar />);
    expect(screen.getByTitle("Anya Perera")).toBeTruthy();
  });

  it("omits the name chip entirely when the user is null", () => {
    const { container } = render(<Sidebar />);
    // No element with the special truncate class is rendered without a
    // logged-in user. Cheapest check: no `truncate` paragraph exists.
    expect(container.querySelectorAll("p.truncate")).toHaveLength(0);
  });
});
