"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { useActiveFamilyMemberStore } from "@/patient/stores/activeFamilyMember";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
  type FamilyInvite,
  type FamilyMemberRow,
} from "@healthcare/shared/contracts";

export type FamilyMember = FamilyMemberRow;

/**
 * Hydrate the persisted store from the server's active-FM column and
 * expose the resolved member to the UI.
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
      }>(patientPaths.family.active());
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
    queryFn: () =>
      api<{ family: FamilyMember[] }>(patientPaths.family.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

/**
 * Switch the active FM (or clear with `null`).
 */
export function useSetActiveFamilyMember() {
  const qc = useQueryClient();
  const setActive = useActiveFamilyMemberStore((s) => s.setActiveFamilyMemberId);
  const clear = useActiveFamilyMemberStore((s) => s.clear);
  return useMutation({
    mutationFn: (memberId: string | null) =>
      api<{ activeId: string | null }>(patientPaths.family.active(), {
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
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useAddFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      relationship: string;
      phone?: string;
      dateOfBirth?: string;
    }) =>
      api<{ member: FamilyMember }>(patientPaths.family.create(), {
        method: "POST",
        json: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.family() });
    },
  });
}

export function useDeleteFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(patientPaths.family.detail(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.family() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useToggleFamilyLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      api<{ ok: boolean; memberId: string; locked: boolean; changed: boolean }>(
        patientPaths.family.lock(id),
        { method: "PATCH", json: { locked } },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.family() });
      qc.invalidateQueries({ queryKey: patientKeys.familyLocks() });
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
    },
  });
}

export function useFamilyLocks() {
  return useQuery<{
    locks: Array<{ id: string; name: string; lockedAt: string }>;
  }>({
    queryKey: patientKeys.familyLocks(),
    queryFn: () =>
      api<{ locks: Array<{ id: string; name: string; lockedAt: string }> }>(
        patientPaths.family.locks(),
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useFamilyInvites() {
  return useQuery<{ invites: FamilyInvite[] }>({
    queryKey: patientKeys.familyInvites(),
    queryFn: () =>
      api<{ invites: FamilyInvite[] }>(patientPaths.family.invites()),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      relationship: string;
      expiresInHours?: number;
    }) =>
      api<{
        invite: FamilyInvite;
        token: string;
        url: string;
        expiresAt: string;
      }>(patientPaths.family.invites(), { method: "POST", json: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.familyInvites() });
    },
  });
}

export function useRevokeFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{ ok: boolean }>(patientPaths.family.invite(token), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.familyInvites() });
    },
  });
}
