// Phase MTN-1 mobile: active-tenant store. Mirrors stores/activeFamilyMember.ts.
//
// The local view holds which hospital/clinic the user is currently
// "acting in". Every API call forwards `x-active-hospital-id` or
// `x-active-clinic-id` from this store (see lib/api.ts). The server
// column `users.active_tenant_*` is the durable cross-device source.
//
// On boot the API interceptor sends the header; if the server can't
// validate the membership it falls back to the durable column. PATCH
// /me/active-tenant syncs both sides after the user picks a tenant.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

export type TenantType = "hospital" | "clinic";

export interface TenantRef {
  id: string;
  name: string;
  role?: string | null;
}

interface ActiveTenantState {
  activeHospitalId: string | null;
  activeClinicId: string | null;
  myHospitals: TenantRef[];
  myClinics: TenantRef[];
  // Hydrated from GET /me/tenants on boot. The API interceptor only
  // needs the active ids; the membership list is for the switcher.
  setMemberships: (
    hospitals: TenantRef[],
    clinics: TenantRef[],
    activeHospitalId: string | null,
    activeClinicId: string | null
  ) => void;
  setActiveHospital: (id: string | null) => void;
  setActiveClinic: (id: string | null) => void;
  clear: () => void;
}

export const useActiveTenantStore = create<ActiveTenantState>()(
  persist(
    (set) => ({
      activeHospitalId: null,
      activeClinicId: null,
      myHospitals: [],
      myClinics: [],
      setMemberships: (hospitals, clinics, activeHospId, activeClinicId) =>
        set({
          myHospitals: hospitals,
          myClinics: clinics,
          activeHospitalId: activeHospId,
          activeClinicId,
        }),
      setActiveHospital: (id) =>
        set({ activeHospitalId: id, activeClinicId: null }),
      setActiveClinic: (id) =>
        set({ activeClinicId: id, activeHospitalId: null }),
      clear: () =>
        set({
          activeHospitalId: null,
          activeClinicId: null,
          myHospitals: [],
          myClinics: [],
        }),
    }),
    {
      name: "healthcare-active-tenant",
      storage: createJSONStorage(() => secureStorage),
      version: 1,
    }
  )
);