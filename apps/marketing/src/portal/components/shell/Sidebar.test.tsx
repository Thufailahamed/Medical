/**
 * Sidebar — role-aware nav filtering tests.
 *
 * The pharmacy launch hinges on this: a pharmacy user must NOT see
 * doctor-only surfaces (Patients, Prescriptions, Lab Orders, ...),
 * and a doctor must NOT see the Pharmacy surface. These tests pin
 * the matrix.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the auth store with overridable state.
let mockUser: { id: string; name: string; email: string; role: string } | null =
  null;

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "test-token",
      locale: "en",
      user: mockUser,
    }),
}));

vi.mock("@/portal/stores/ui", () => ({
  useUiStore: (selector: any) =>
    selector({
      sidebarCollapsed: false,
      toggleSidebar: () => {},
    }),
}));

// logout: stub
vi.mock("@/portal/lib/auth", () => ({
  logout: vi.fn(),
}));

// sidebar logout pulls useRouter.replace — already mocked globally
// in vitest.setup.ts. AuthBoot is the only consumer of /auth/me and
// doesn't run inside Sidebar.

import { Sidebar } from "./Sidebar";

describe("Sidebar role filtering", () => {
  beforeEach(() => {
    mockUser = null;
  });

  it("doctor sees Pharmacy hidden, Patients visible", () => {
    mockUser = {
      id: "u1",
      name: "Dr. House",
      email: "h@clinic.lk",
      role: "doctor",
    };
    render(<Sidebar />);
    // Doctor surfaces
    expect(screen.getByRole("link", { name: /patients/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^prescriptions$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /lab orders/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /care team/i })).toBeInTheDocument();
    // Pharmacy surface must NOT appear
    expect(screen.queryByRole("link", { name: /^pharmacy$/i })).not.toBeInTheDocument();
  });

  it("pharmacy sees Pharmacy + Messages + Notifications, hides Patients / Prescriptions / Lab", () => {
    mockUser = {
      id: "u2",
      name: "City Pharma",
      email: "rx@pharma.lk",
      role: "pharmacy",
    };
    render(<Sidebar />);
    // Pharmacy surface
    expect(screen.getByRole("link", { name: /^pharmacy$/i })).toBeInTheDocument();
    // Common (Communicate group is not hidden from pharmacy)
    expect(screen.getByRole("link", { name: /messages/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /notifications/i })).toBeInTheDocument();
    // Doctor-only surfaces must be hidden
    expect(screen.queryByRole("link", { name: /patients/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^prescriptions$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /lab orders/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /clinical notes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /care team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /earnings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /walk-ins/i })).not.toBeInTheDocument();
  });

  it("wordmark shows 'Doctor Portal' for doctor, 'Pharmacy Portal' for pharmacy", () => {
    mockUser = {
      id: "u1",
      name: "Dr. A",
      email: "a@clinic.lk",
      role: "doctor",
    };
    const { rerender } = render(<Sidebar />);
    expect(screen.getByText(/doctor portal/i)).toBeInTheDocument();
    expect(screen.queryByText(/pharmacy portal/i)).not.toBeInTheDocument();

    mockUser = {
      id: "u2",
      name: "Pharm A",
      email: "a@pharma.lk",
      role: "pharmacy",
    };
    rerender(<Sidebar />);
    expect(screen.getByText(/pharmacy portal/i)).toBeInTheDocument();
    expect(screen.queryByText(/doctor portal/i)).not.toBeInTheDocument();
  });

  it("avatar initials fall back to 'RX' for pharmacy when name missing", () => {
    mockUser = {
      id: "u2",
      name: "",
      email: "rx@pharma.lk",
      role: "pharmacy",
    };
    render(<Sidebar />);
    expect(screen.getByText("RX")).toBeInTheDocument();
  });

  it("avatar initials fall back to 'DR' for doctor when name missing", () => {
    mockUser = {
      id: "u1",
      name: "",
      email: "dr@clinic.lk",
      role: "doctor",
    };
    render(<Sidebar />);
    expect(screen.getByText("DR")).toBeInTheDocument();
  });
});