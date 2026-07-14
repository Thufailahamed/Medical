// apps/mobile/src/hooks/useCaretakerVerification.ts
//
// Verified Caretaker Tier — mobile hook layer. Wraps the three
// caretaker-side endpoints + the request mutations.
//
//   GET    /caretaker/verification/me
//   POST   /caretaker/verification/request
//   DELETE /caretaker/verification/me
//
// The mutation hooks invalidate the read query so the (caretaker)/profile
// section flips from "not started" → "pending" → "approved" without a
// manual refetch.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type VerificationStatus = "pending" | "approved" | "rejected" | "superseded";

export type VerificationRow = {
  id: string;
  status: VerificationStatus;
  documentType: "nic" | "passport" | "drivers_license" | "other";
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type MyVerificationResponse = {
  verified: boolean;
  verification: VerificationRow | null;
};

export function useMyVerification() {
  return useQuery({
    queryKey: ["caretaker", "verification", "me"],
    queryFn: () => api<MyVerificationResponse>("/caretaker/verification/me"),
    staleTime: 30_000,
  });
}

export function useRequestVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      documentType: VerificationRow["documentType"];
      documentFileId: string;
    }) =>
      api<{ verification: VerificationRow }>("/caretaker/verification/request", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker", "verification"] });
    },
  });
}

export function useCancelVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>("/caretaker/verification/me", {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker", "verification"] });
    },
  });
}
