/**
 * Unified /login — port-aware RBAC gate.
 *
 * Signing in with a role that doesn't match the selected port must
 * clear the session and show an inline error. Matching roles land.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams("port=doctor"),
  useParams: () => ({}),
}));

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
    },
  ),
}));

const mockLogin = vi.fn();
vi.mock("@/portal/lib/auth", () => ({
  login: (...args: any[]) => mockLogin(...args),
  loginWithPhone: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/portal/components/ui/Toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import LoginPage from "./page";

describe("Unified LoginPage port RBAC", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockLogout.mockReset();
    mockSetSession.mockReset();
    mockReplace.mockReset();
    currentUser = null;
  });

  async function submitForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/email or phone/i), "user@x.lk");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(
      screen.getByRole("button", { name: /sign in to doctor/i }),
    );
  }

  it("allows a doctor on the Doctor port", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({
      id: "u4",
      name: "Dr. House",
      email: "d@x.lk",
      role: "doctor",
    });

    render(<LoginPage />);
    await submitForm(user);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    expect(mockLogout).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/portal/dashboard");
    });
  });

  it("rejects a patient on the Doctor port", async () => {
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
      expect(mockLogout).toHaveBeenCalled();
    });
    expect(
      screen.getByText(/switch to the "Patient" tab to sign in/i),
    ).toBeInTheDocument();
  });

  it("rejects a hospital_admin on the Doctor port", async () => {
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
      expect(mockLogout).toHaveBeenCalled();
    });
    expect(
      screen.getByText(/switch to the "Facility" tab to sign in/i),
    ).toBeInTheDocument();
  });

  it("surfaces a friendly error when login throws", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));

    render(<LoginPage />);
    await submitForm(user);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
