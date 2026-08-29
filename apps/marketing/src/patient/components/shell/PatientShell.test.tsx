import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuthStore } from "@/portal/stores/auth";

import { PatientShell } from "./PatientShell";

vi.mock("@/patient/hooks/useNotifications", () => ({
  useUnreadNotificationsCount: () => 0,
}));

vi.mock("@/patient/hooks/useActiveFamilyMember", () => ({
  useActiveFamilyMember: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useFamilyMembers: () => ({
    data: { family: [] },
    isLoading: false,
  }),
}));

vi.mock("@/portal/hooks/useRealtime", () => ({
  useRealtime: () => undefined,
}));

vi.mock("@/patient/hooks", () => ({
  useWellness: () => ({ data: null }),
  useMedicationStats: () => ({ data: null }),
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
    expect(screen.getByLabelText("Primary navigation")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("renders the topbar page title for the current route", () => {
    renderWithClient(
      <PatientShell>
        <span>x</span>
      </PatientShell>
    );
    expect(screen.getByTestId("patient-topbar")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Dashboard",
    );
  });

  it("shows the signed-in name in the account menu trigger", () => {
    useAuthStore.setState({
      user: { id: "u", name: "Nimal Perera", role: "patient" } as any,
    } as any);
    renderWithClient(
      <PatientShell>
        <span>x</span>
      </PatientShell>
    );
    expect(screen.getByLabelText("Open account menu").textContent).toMatch(
      /Nimal/,
    );
  });
});
