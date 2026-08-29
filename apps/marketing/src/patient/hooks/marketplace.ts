"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { CaretakerListing, CaretakerInquiry } from "@healthcare/shared/contracts";

export function useMarketplace(params: { search?: string; service?: string } = {}) {
  return useQuery<{ caretakers: CaretakerListing[] }>({
    queryKey: patientKeys.marketplace(params),
    queryFn: () =>
      api<{ caretakers: CaretakerListing[] }>(
        patientPaths.marketplace.caretakers({
          search: params.search,
          service: params.service,
        })
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useCaretaker(id: string) {
  return useQuery<{ caretaker: CaretakerListing }>({
    queryKey: patientKeys.marketplaceCaretaker(id),
    queryFn: () =>
      api<{ caretaker: CaretakerListing }>(
        patientPaths.marketplace.caretakerDetail(id)
      ),
    enabled: Boolean(id),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useCaretakerInquiries() {
  return useQuery<{ inquiries: CaretakerInquiry[] }>({
    queryKey: patientKeys.marketplaceInquiries(),
    queryFn: () =>
      api<{ inquiries: CaretakerInquiry[] }>(patientPaths.marketplace.inquiries()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useSendCaretakerInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      api<{ inquiry: CaretakerInquiry }>(patientPaths.marketplace.inquire(id), {
        method: "POST",
        json: { message },
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: patientKeys.marketplaceInquiries() }),
  });
}
