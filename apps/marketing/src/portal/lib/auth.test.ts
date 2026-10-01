import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, logout } from "./auth";
import { useAuthStore } from "@/portal/stores/auth";
import { useAuthStore as useHospitalAuthStore } from "@/hospital/stores/auth";

vi.mock("./api", () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

import { api } from "./api";

describe("portal/lib/auth multi-portal synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useHospitalAuthStore.getState().logout();
  });

  it("synchronizes the hospital store when hospital_admin logs in", async () => {
    const mockUser = {
      id: "hosp-admin-1",
      email: "admin@devhospital.lk",
      name: "Hospital Admin",
      role: "hospital_admin",
      activeTenantType: "hospital",
      activeTenantId: "hosp-1",
    };
    (api as any).mockResolvedValueOnce({
      user: mockUser,
      session: {
        access_token: "hosp-jwt-token",
        refresh_token: "hosp-refresh-token",
      },
    });

    const user = await login({
      email: "admin@devhospital.lk",
      password: "DevPass#1234",
    });

    expect(user.role).toBe("hospital_admin");
    // Main portal store is updated
    expect(useAuthStore.getState().token).toBe("hosp-jwt-token");
    expect(useAuthStore.getState().user?.email).toBe("admin@devhospital.lk");

    // Hospital store is synchronized so (hospital)/layout.tsx doesn't bounce to login
    expect(useHospitalAuthStore.getState().token).toBe("hosp-jwt-token");
    expect(useHospitalAuthStore.getState().user?.email).toBe("admin@devhospital.lk");
    expect(useHospitalAuthStore.getState().activeHospitalId).toBe("hosp-1");
  });

  it("does not populate hospital store when doctor or patient logs in", async () => {
    const mockUser = {
      id: "doc-1",
      email: "doctor@hospital.lk",
      name: "Dr. Doc",
      role: "doctor",
    };
    (api as any).mockResolvedValueOnce({
      user: mockUser,
      session: {
        access_token: "doc-jwt-token",
        refresh_token: "doc-refresh-token",
      },
    });

    await login({
      email: "doctor@hospital.lk",
      password: "dev",
    });

    expect(useAuthStore.getState().token).toBe("doc-jwt-token");
    expect(useHospitalAuthStore.getState().token).toBeNull();
  });

  it("clears both stores on logout", async () => {
    useAuthStore.getState().setSession({
      token: "jwt-1",
      user: { id: "1", role: "hospital_admin", name: "Admin", email: "a@h.lk", phone: null },
    });
    useHospitalAuthStore.getState().setSession({
      token: "jwt-1",
      user: { id: "1", role: "hospital_admin", name: "Admin", email: "a@h.lk", phone: null },
    });

    (api as any).mockResolvedValueOnce({ message: "Logged out" });
    await logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useHospitalAuthStore.getState().token).toBeNull();
  });
});
