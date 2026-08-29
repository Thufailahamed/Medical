"use client";

/**
 * Backward-compatible re-export. Family hooks now live in `./family`
 * so they share `@healthcare/shared/contracts` path builders.
 */
export {
  useActiveFamilyMember,
  useFamilyMembers,
  useSetActiveFamilyMember,
  useAddFamilyMember,
  useDeleteFamilyMember,
  useToggleFamilyLock,
  useFamilyLocks,
  useFamilyInvites,
  useCreateFamilyInvite,
  useRevokeFamilyInvite,
  type FamilyMember,
} from "./family";
