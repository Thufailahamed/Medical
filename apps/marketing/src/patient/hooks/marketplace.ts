"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type {
  CaretakerListing,
  CaretakerInquiry,
  CaretakerInquiryStatus,
} from "@healthcare/shared/contracts";

export type MarketplaceFilters = {
  district?: string;
  role?: string;
  language?: string;
};

export function useMarketplace(params: MarketplaceFilters = {}) {
  return useQuery<{ caretakers: CaretakerListing[] }>({
    queryKey: patientKeys.marketplace(params),
    queryFn: () =>
      api<{ caretakers: CaretakerListing[] }>(
        patientPaths.marketplace.caretakers({
          district: params.district,
          role: params.role,
          language: params.language,
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

export function useCaretakerInquiries(status?: CaretakerInquiryStatus) {
  return useQuery<{ inquiries: CaretakerInquiry[] }>({
    queryKey: patientKeys.marketplaceInquiries(status),
    queryFn: () =>
      api<{ inquiries: CaretakerInquiry[] }>(
        patientPaths.marketplace.inquiries(status)
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useSendCaretakerInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patientMessage }: { id: string; patientMessage: string }) =>
      api<{
        inquiry: {
          id: string;
          caretakerUserId: string;
          status: CaretakerInquiryStatus;
          createdAt: string;
        };
      }>(patientPaths.marketplace.inquire(id), {
        method: "POST",
        json: { patientMessage },
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: patientKeys.marketplaceInquiries() }),
  });
}

export function useWithdrawCaretakerInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(patientPaths.marketplace.withdrawInquiry(id), {
        method: "POST",
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: patientKeys.marketplaceInquiries() }),
  });
}
