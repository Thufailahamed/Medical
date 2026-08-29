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

  it("renders the main column with the topbar greeting when no user is logged in", () => {
    renderWithClient(
      <PatientShell>
        <span>x</span>
      </PatientShell>
    );
    // Topbar greets with one of: Up late / Good morning / Good afternoon / Good evening / Good night
    const heading = screen.queryByRole("heading", { level: 1 });
    expect(heading?.textContent ?? "").toMatch(
      /Up late|Good (morning|afternoon|evening|night)/
    );
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
    const heading = screen.queryByRole("heading", { level: 1 });
    expect(heading?.textContent ?? "").toMatch(/Nimal/);
  });
});
