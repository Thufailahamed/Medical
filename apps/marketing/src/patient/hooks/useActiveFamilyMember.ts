"use client";

// Phase 2.3: family-member hooks for the web patient portal.
//
// Mirrors mobile apps/mobile/src/hooks/useApi.ts:578 (useFamilyMembers)
// and adds the per-request store hydration + active-FM setter that the
// mobile pill uses (apps/mobile/src/components/ActiveMemberPill.tsx).
//
// The active FM is the request-level hint. The server column
// (users.activeFamilyMemberId) is the durable source of truth. The
// `useActiveFamilyMember` query is the bridge: on every mount it
// GETs /family/active and seeds the persisted store from the server.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import { useActiveFamilyMemberStore } from "@/patient/stores/activeFamilyMember";

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string | null;
}

/**
 * Hydrate the persisted store from the server's active-FM column and
 * expose the resolved member to the UI.
 *
 * Server column wins on mismatch — it is the cross-device durable
 * state, while the local store is best-effort for offline / first-load.
 */
export function useActiveFamilyMember() {
  const localId = useActiveFamilyMemberStore((s) => s.activeFamilyMemberId);
  const setActive = useActiveFamilyMemberStore((s) => s.setActiveFamilyMemberId);
  return useQuery<{ activeId: string | null; member: FamilyMember | null }>({
    queryKey: patientKeys.familyActive(),
    queryFn: async () => {
      const res = await api<{
        activeId: string | null;
        member: FamilyMember | null;
      }>("/family/active");
      if (res.activeId !== localId) setActive(res.activeId);
      return res;
    },
    ...PATIENT_QUERY_DEFAULTS,
    retry: 0,
  });
}

/** List every family member owned by the current user. */
export function useFamilyMembers() {
  return useQuery<{ family: FamilyMember[] }>({
    queryKey: patientKeys.family(),
    queryFn: () => api<{ family: FamilyMember[] }>("/patients/me/family"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

/**
 * Switch the active FM (or clear with `null`).
 *
 * Optimistically updates the store first so the very next outgoing
 * request carries the new header. Then PATCHes the server column so
 * the choice survives a reload / another device.
 */
export function useSetActiveFamilyMember() {
  const qc = useQueryClient();
  const setActive = useActiveFamilyMemberStore((s) => s.setActiveFamilyMemberId);
  const clear = useActiveFamilyMemberStore((s) => s.clear);
  return useMutation({
    mutationFn: (memberId: string | null) =>
      api<{ activeId: string | null }>("/family/active", {
        method: "PATCH",
        json: { memberId },
      }),
    onMutate: (memberId) => {
      const previousId = useActiveFamilyMemberStore.getState().activeFamilyMemberId;
      if (memberId) setActive(memberId);
      else clear();
      return { previousId };
    },
    onError: (_error, _memberId, context) => {
      if (context?.previousId) setActive(context.previousId);
      else clear();
    },
    onSuccess: (response) => {
      if (response.activeId) setActive(response.activeId);
      else clear();
      qc.invalidateQueries({ queryKey: ["patient"] });
    },
  });
}
