// Caretaker Profiles: hooks for invites / links / principals.
// Mirrors apps/mobile/src/hooks/useApi.ts:2782-2846 (family invites).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type CareRole =
  | "parent"
  | "guardian"
  | "spouse_caregiver"
  | "child_caregiver"
  | "sibling_caregiver"
  | "other";

export type CaretakerInvite = {
  id: string;
  token: string;
  principalPatientId: string;
  invitedByUserId: string;
  caretakerName: string;
  careRole: CareRole;
  channel: "mobile" | "email";
  contactTarget: string;
  expiresAt: string;
  revoked: boolean;
  consumedAt: string | null;
  redeemedByUserId: string | null;
  createdAt: string;
};

export type CaretakerInviteView = {
  inviterName: string;
  inviterPhoto: string | null;
  caretakerName: string;
  careRole: CareRole;
  channelHint: string; // e.g. "+94 ••• 4567" — non-PII
  expiresAt: string;
  consumed: boolean;
  locked: boolean;
};

export type CaretakerLink = {
  linkId: string;
  principalPatientId: string;
  careRole: CareRole;
  status: "active" | "paused" | "revoked";
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  caretakerUserId: string;
  caretakerName: string | null;
  caretakerPhone: string | null;
  caretakerEmail: string | null;
  caretakerPhoto: string | null;
};

export type PrincipalSummary = {
  patientId: string;
  principalUserId: string;
  principalName: string;
  principalPhoto: string | null;
  principalPhone: string | null;
  linkId: string;
  careRole: CareRole;
  linkedAt: string;
};

// ─── Principal-side: invites ─────────────────────────────

export function useCaretakerInvites() {
  return useQuery({
    queryKey: ["caretaker", "invites"],
    queryFn: () =>
      api<{ invites: CaretakerInvite[] }>("/caretaker/invites"),
    staleTime: 30_000,
  });
}

export function useCreateCaretakerInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      caretakerName: string;
      careRole: CareRole;
      channel: "mobile" | "email";
      contact: string;
    }) =>
      api<{
        invite: CaretakerInvite;
        token: string;
        url: string;
        expiresAt: string;
      }>("/caretaker/invites", { method: "POST", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker", "invites"] });
    },
  });
}

export function useRevokeCaretakerInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/caretaker/invites/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker", "invites"] });
    },
  });
}

export function useAcceptCaretakerInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { token: string; otp: string }) =>
      api<{ user: any; patientLink: CaretakerLink; alreadyAccepted?: boolean }>(
        `/caretaker/invites/${payload.token}/accept`,
        { method: "POST", body: { otp: payload.otp } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker"] });
    },
  });
}

// Public preview — no auth header. Used by the deep-link route before
// login. `silent401: true` so the app doesn't error before the user types
// the OTP.
export function useCaretakerInvitePreview(token: string | null) {
  return useQuery({
    queryKey: ["caretaker", "invites", "preview", token],
    queryFn: () =>
      api<CaretakerInviteView>(`/caretaker/invites/${token}`, {
        silent401: true,
      }),
    enabled: !!token,
    retry: false,
  });
}

// ─── Principal-side: link management ─────────────────────

export function useCaretakerLinks() {
  return useQuery({
    queryKey: ["caretaker", "links"],
    queryFn: () => api<{ links: CaretakerLink[] }>("/caretaker/links"),
    staleTime: 30_000,
  });
}

export function usePatchCaretakerLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { linkId: string; status: "active" | "paused" }) =>
      api<{ link: CaretakerLink }>(`/caretaker/links/${payload.linkId}`, {
        method: "PATCH",
        body: { status: payload.status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker", "links"] });
    },
  });
}

export function useRevokeCaretakerLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      api<{ ok: boolean }>(`/caretaker/links/${linkId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker", "links"] });
      qc.invalidateQueries({ queryKey: ["caretaker", "me", "principals"] });
    },
  });
}

// ─── Caretaker-side: principals + active switch ───────────

export function useMyPrincipals() {
  return useQuery({
    queryKey: ["caretaker", "me", "principals"],
    queryFn: () =>
      api<{ principals: PrincipalSummary[] }>("/caretaker/me/principals"),
    staleTime: 30_000,
  });
}

export function useActivePrincipal() {
  return useQuery({
    queryKey: ["caretaker", "me", "active-principal"],
    queryFn: () =>
      api<{
        principal: { patientId: string; name: string; photo: string | null } | null;
      }>("/caretaker/me/active-principal"),
    staleTime: 60_000,
  });
}

export function useSetActivePrincipal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string | null) =>
      api<{ ok: boolean }>("/caretaker/me/active-principal", {
        method: "PATCH",
        body: { patientId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker"] });
    },
  });
}
