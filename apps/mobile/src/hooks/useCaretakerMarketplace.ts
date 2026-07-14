// Caretaker Profiles: Caretaker Marketplace hooks.
//
// Wraps the 8 marketplace endpoints. Mirrors the useCaretaker.ts
// pattern: each hook is a thin query/mutation over the api() helper
// with the right query key prefix so a mutation invalidates the
// matching reads in one place.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type CareRole =
  | "parent"
  | "guardian"
  | "spouse_caregiver"
  | "child_caregiver"
  | "sibling_caregiver"
  | "other"
  | "nurse"
  | "caregiver"
  | "home_aide"
  | "companion";

export type MarketplaceProfile = {
  id: string; // caretaker user id
  caretakerUserId: string;
  name: string;
  photo: string | null;
  bio: string;
  district: string;
  careRolesOffered: CareRole[];
  languages: string[];
  hourlyRateLkr: number | null;
  experienceYears: number;
  verified: boolean;
  createdAt?: string;
  isAvailable?: boolean;
};

export type MarketplaceInquiryStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired";

export type MarketplaceInquiry = {
  id: string;
  caretakerUserId: string;
  patientUserId?: string;
  caretakerName?: string;
  caretakerPhoto?: string | null;
  patientName?: string;
  patientPhoto?: string | null;
  patientMessage: string;
  status: MarketplaceInquiryStatus;
  createdAt: string;
  decidedAt: string | null;
  linkId: string | null;
};

export type MyMarketplaceProfileResponse = {
  verified: boolean;
  profile: {
    id: string;
    bio: string;
    languages: string[];
    careRolesOffered: CareRole[];
    district: string;
    hourlyRateLkr: number | null;
    experienceYears: number;
    isAvailable: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type UpsertMarketplaceProfileInput = {
  bio: string;
  languages: string[];
  careRolesOffered: CareRole[];
  district: string;
  hourlyRateLkr?: number | null;
  experienceYears: number;
  isAvailable: boolean;
};

// ─── Caretaker-side: own listing ──────────────────────────

export function useMyMarketplaceProfile() {
  return useQuery({
    queryKey: ["marketplace", "me"],
    queryFn: () => api<MyMarketplaceProfileResponse>("/caretaker/marketplace/me"),
    staleTime: 30_000,
  });
}

export function useUpsertMarketplaceProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertMarketplaceProfileInput) =>
      api<{ ok: boolean }>("/caretaker/marketplace/me", {
        method: "PUT",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}

// ─── Caretaker-side: incoming inquiries ───────────────────

export function useMyMarketplaceInquiries(status?: MarketplaceInquiryStatus) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["marketplace", "inquiries", status ?? "all"],
    queryFn: () =>
      api<{ inquiries: MarketplaceInquiry[] }>(
        `/caretaker/marketplace/inquiries${qs}`
      ),
    staleTime: 15_000,
  });
}

export function useAcceptMarketplaceInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean; linkId: string }>(
        `/caretaker/marketplace/inquiries/${id}/accept`,
        { method: "POST" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      qc.invalidateQueries({ queryKey: ["caretaker"] }); // links list changes
    },
  });
}

export function useDeclineMarketplaceInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(
        `/caretaker/marketplace/inquiries/${id}/decline`,
        { method: "POST" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}

// ─── Patient-side: search + detail ────────────────────────

export type MarketplaceSearchFilters = {
  district?: string;
  role?: CareRole;
  language?: string;
};

export function useMarketplaceSearch(filters: MarketplaceSearchFilters = {}) {
  const params = new URLSearchParams();
  if (filters.district) params.set("district", filters.district);
  if (filters.role) params.set("role", filters.role);
  if (filters.language) params.set("language", filters.language);
  const qs = params.toString();
  return useQuery({
    queryKey: ["marketplace", "search", filters],
    queryFn: () =>
      api<{ caretakers: MarketplaceProfile[] }>(
        `/marketplace/caretakers${qs ? `?${qs}` : ""}`
      ),
    staleTime: 30_000,
  });
}

export function useMarketplaceCaretaker(userId: string | undefined) {
  return useQuery({
    queryKey: ["marketplace", "caretaker", userId],
    queryFn: () =>
      api<{ caretaker: MarketplaceProfile }>(
        `/marketplace/caretakers/${userId}`
      ),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useSendMarketplaceInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { caretakerUserId: string; patientMessage: string }) =>
      api<{ inquiry: { id: string; status: MarketplaceInquiryStatus } }>(
        `/marketplace/caretakers/${input.caretakerUserId}/inquire`,
        { method: "POST", body: { patientMessage: input.patientMessage } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}

// ─── Patient-side: own sent inquiries ─────────────────────

export function useMyMarketplaceInquiriesSent(
  status?: MarketplaceInquiryStatus
) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["marketplace", "inquiriesMine", status ?? "all"],
    queryFn: () =>
      api<{ inquiries: MarketplaceInquiry[] }>(
        `/marketplace/inquiries/mine${qs}`
      ),
    staleTime: 15_000,
  });
}