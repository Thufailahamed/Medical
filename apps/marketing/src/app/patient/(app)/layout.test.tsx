/**
 * Patient (app) route-group gate.
 *
 * Mirrors the clinician gate in portal/(portal)/layout.tsx. Three
 * behaviours are load-bearing: signed-out visitors bounce to login
 * carrying a `next` param, wrong-role users land on 403, and nothing
 * redirects before the persisted store has hydrated (otherwise a hard
 * refresh would eject a signed-in patient).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const replace = vi.fn();
const realtimeSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/patient",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/portal/hooks/useRealtime", () => ({
  useRealtime: (args: unknown) => realtimeSpy(args),
}));

let mockState: {
  token: string | null;
  user: { id: string; name: string; role: string } | null;
  hydrated: boolean;
} = { token: null, user: null, hydrated: true };

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) => selector(mockState),
}));

vi.mock("@/patient/components/shell/PatientShell", () => ({
  PatientShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

import PatientAppLayout from "./layout";

describe("PatientAppLayout gate", () => {
  beforeEach(() => {
    replace.mockClear();
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/patient");
    }
  });

  it("redirects a signed-out visitor to login with a next param", () => {
    mockState = { token: null, user: null, hydrated: true };
    render(
      <PatientAppLayout>
        <p>dash</p>
      </PatientAppLayout>
    );
    expect(replace).toHaveBeenCalledWith("/login?port=patient&next=%2Fpatient");
  });

  it("redirects a doctor to 403", () => {
    mockState = {
      token: "t",
      user: { id: "u1", name: "Dr. House", role: "doctor" },
      hydrated: true,
    };
    render(
      <PatientAppLayout>
        <p>dash</p>
      </PatientAppLayout>
    );
    expect(replace).toHaveBeenCalledWith("/patient/403");
  });

  it("renders the shell for a patient", () => {
    mockState = {
      token: "t",
      user: { id: "u2", name: "Alex", role: "patient" },
      hydrated: true,
    };
    render(
      <PatientAppLayout>
        <p>dash</p>
      </PatientAppLayout>
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("shell")).toHaveTextContent("dash");
  });

  it("does not redirect before the store has hydrated", () => {
    mockState = { token: null, user: null, hydrated: false };
    render(
      <PatientAppLayout>
        <p>dash</p>
      </PatientAppLayout>
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens a realtime connection for the signed-in patient", () => {
    realtimeSpy.mockClear();
    mockState = {
      token: "tok_1",
      user: { id: "u1", name: "Test", role: "patient" },
      hydrated: true,
    };
    render(
      <PatientAppLayout>
        <p>dash</p>
      </PatientAppLayout>
    );
    expect(realtimeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ token: "tok_1", userId: "u1" })
    );
  });
});