import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuthStore } from "@/portal/stores/auth";

import { PatientShell } from "./PatientShell";

vi.mock("@/patient/hooks/useNotifications", () => ({
  useUnreadNotificationsCount: () => 0,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/patient",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/portal/lib/auth", () => ({
  logout: vi.fn(),
}));

function renderWithClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
  );
}

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

describe("PatientShell", () => {
  it("renders the sidebar rail, the topbar, and the main slot", () => {
    renderWithClient(
      <PatientShell>
        <div data-testid="child">hello</div>
      </PatientShell>
    );
    expect(screen.getByLabelText("Primary")).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("renders inside the rounded plate container (data-app=patient lives higher up)", () => {
    const { container } = renderWithClient(
      <PatientShell>
        <span>x</span>
      </PatientShell>
    );
    // The shell begins with an outer padding div, then the plate.
    const plate = container.querySelector<HTMLElement>(
      "div[style*='--radius-plate']"
    ) ?? container.querySelector("div[style*='radius-plate']");
    expect(plate).toBeTruthy();
    expect(plate!.style.borderRadius).not.toBe("");
  });

  it("falls back to a generic greeting when no user is logged in", () => {
    renderWithClient(
      <PatientShell>
        <span>x</span>
      </PatientShell>
    );
    expect(screen.getByText("Welcome back")).toBeTruthy();
  });

  it("greets the user by first name when present", () => {
    useAuthStore.setState({
      user: { id: "u", name: "Nimal Perera", role: "patient" } as any,
    } as any);
    renderWithClient(
      <PatientShell>
        <span>x</span>
      </PatientShell>
    );
    expect(screen.getByText(/Welcome to Nimal!/)).toBeTruthy();
  });
});
