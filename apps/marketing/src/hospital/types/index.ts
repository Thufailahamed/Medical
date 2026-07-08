/**
 * Shared types for the hospital + clinic web portal.
 *
 * Mirrors the portal auth shape but scopes roles to the hospital/clinic
 * surface. Anything shared with the patient/doctor apps belongs in
 * `packages/shared` instead — this file is portal-internal only.
 */

import type { Locale } from "@/hospital/stores/auth";

export type HospitalRole =
  | "hospital_admin"
  | "hospital_staff"
  | "pharmacy"
  | "laboratory"
  | "super_admin";

export type TenantType = "hospital" | "clinic";

export interface TenantOption {
  id: string;
  name: string;
  type: TenantType;
  role?: string | null;
}

/** Phase HOS-0 — pending registration status values for the tenant flow. */
export type RegistrationStatus = "pending" | "active" | "suspended" | "rejected";

/** Used by <OnboardingWizard> + the first-login flow. */
export interface OnboardingState {
  completed: boolean;
  step?: "departments" | "wards" | "beds" | "staff" | "done";
}

export type Dict = Record<string, any>;

export type { Locale };
