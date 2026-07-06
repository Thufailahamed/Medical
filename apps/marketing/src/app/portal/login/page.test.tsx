/**
 * Login page — RBAC gate test.
 *
 * The post-login role check is the load-bearing security boundary
 * for the portal. A non-clinician account (patient, hospital_staff,
 * insurance, ambulance, etc.) must NOT be allowed to log in at
 * /portal/login — they get bounced with a toast and the session is
 * cleared. Doctors and pharmacists are allowed in.
 *
 * Pinned here so a future refactor of the LoginForm can't quietly
 * drop the role check.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- Mocks ----------------------------------------------------------------

// useSearchParams: return a known next= param
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("vitest")>("vitest");
  return {
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => "/portal/login",
    useSearchParams: () => new URLSearchParams("next=/portal/dashboard"),
    useParams: () => ({}),
  };
});

// Auth store: stub the logout + setSession methods.
const mockLogout = vi.fn();
const mockSetSession = vi.fn();
let currentUser: { id: string; name: string; email: string; role: string } | null =
  null;

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: Object.assign(
    (selector: any) =>
      selector({
        token: null,
        locale: "en",
        user: currentUser,
        logout: mockLogout,
      }),
    {
      getState: () => ({
        token: null,
        locale: "en",
        user: currentUser,
        logout: mockLogout,
        setSession: mockSetSession,
      }),
    }
  ),
}));

// login helper: return whatever the test wants.
const mockLogin = vi.fn();
vi.mock("@/portal/lib/auth", () => ({
  login: (...args: any[]) => mockLogin(...args),
  logout: vi.fn(),
}));

// Toast stub.
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("@/portal/components/ui/Toast", () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
    success: (...args: any[]) => mockToastSuccess(...args),
  },
}));

// --- Tests ----------------------------------------------------------------

import LoginPage from "./page";

describe("LoginPage RBAC gate", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockLogout.mockReset();
    mockSetSession.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
    currentUser = null;
  });

  async function submitForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/email or phone/i), "user@x.lk");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
  }

  it("rejects a patient login (wrong portal)", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({
      id: "u1",
      name: "Pat Ient",
      email: "p@x.lk",
      role: "patient",
    });

    render(<LoginPage />);
    await submitForm(user);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    // Bouncing back / not navigating away is implied by the toast +
    // logout + absence of a router.replace. We assert via state.
    expect(mockLogout).toHaveBeenCalled();
  });

  it("rejects a hospital_admin login (wrong portal)", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({
      id: "u2",
      name: "Adm In",
      email: "a@x.lk",
      role: "hospital_admin",
    });

    render(<LoginPage />);
    await submitForm(user);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(mockLogout).toHaveBeenCalled();
  });

  it("rejects a laboratory login (wrong portal)", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({
      id: "u3",
      name: "Lab Tech",
      email: "l@x.lk",
      role: "laboratory",
    });

    render(<LoginPage />);
    await submitForm(user);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(mockLogout).toHaveBeenCalled();
  });

  it("allows a doctor login (does NOT toast error)", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({
      id: "u4",
      name: "Dr. House",
      email: "d@x.lk",
      role: "doctor",
    });

    render(<LoginPage />);
    await submitForm(user);

    // After doctor login completes, the toast.error must NOT have
    // been called and logout must not have fired.
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("allows a pharmacy login (does NOT toast error)", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({
      id: "u5",
      name: "City Pharma",
      email: "rx@x.lk",
      role: "pharmacy",
    });

    render(<LoginPage />);
    await submitForm(user);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when login throws", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));

    render(<LoginPage />);
    await submitForm(user);

    // The error path renders an inline alert ("Invalid credentials")
    // AND triggers friendlyError. We assert the inline alert appears.
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });
});