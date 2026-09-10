"use client";

import { useMutation } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";

export interface StructuredSummary {
  patientSummary: string;
  diagnoses?: string[];
  medicines?: string[];
  history?: string[];
  risks?: string[];
  recentTests?: string[];
}

export interface DrugInteractionItem {
  medicines: string[];
  severity: "minor" | "moderate" | "severe" | string;
  note?: string;
  recommendation?: string;
  source?: string;
}

export const DEFAULT_CLEAR_MESSAGE =
  "No known adverse interactions detected between the provided medications. Continue taking as directed by your physician.";

type SummaryResponse = { summary: string | StructuredSummary };

export function normalizeSummary(res: SummaryResponse): StructuredSummary {
  if (typeof res.summary === "string") {
    return { patientSummary: res.summary };
  }
  const s = (res.summary ?? {}) as Partial<StructuredSummary>;
  return {
    patientSummary:
      s.patientSummary || "Health record summary generated successfully.",
    diagnoses: Array.isArray(s.diagnoses) ? s.diagnoses : [],
    medicines: Array.isArray(s.medicines) ? s.medicines : [],
    history: Array.isArray(s.history) ? s.history : [],
    risks: Array.isArray(s.risks) ? s.risks : [],
    recentTests: Array.isArray(s.recentTests) ? s.recentTests : [],
  };
}

type InteractionResponse = {
  result?: string;
  interactions?: DrugInteractionItem[] | string;
};

export function normalizeInteractions(res: InteractionResponse): {
  items: DrugInteractionItem[];
  message: string | null;
} {
  let items: DrugInteractionItem[] = [];

  if (Array.isArray(res.interactions)) {
    items = res.interactions as DrugInteractionItem[];
  } else if (typeof res.interactions === "string") {
    try {
      const parsed = JSON.parse(res.interactions);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      /* malformed JSON — fall through */
    }
  }

  if (!items.length && typeof res.result === "string") {
    try {
      const parsed = JSON.parse(res.result);
      if (Array.isArray(parsed)) items = parsed;
      else if (parsed && Array.isArray(parsed.interactions)) {
        items = parsed.interactions;
      }
    } catch {
      /* plain text or malformed — fall through */
    }
  }

  if (items.length) return { items, message: null };

  const trimmed = typeof res.result === "string" ? res.result.trim() : "";
  const clean =
    trimmed && !trimmed.startsWith("[") && !trimmed.startsWith("{")
      ? res.result!
      : DEFAULT_CLEAR_MESSAGE;
  return { items: [], message: clean };
}

export function useGenerateSummary() {
  return useMutation({
    mutationFn: async (patientId: string) =>
      normalizeSummary(
        await api<SummaryResponse>("/ai/summary", {
          method: "POST",
          json: { patientId },
        }),
      ),
  });
}

export function useCheckDrugInteractions() {
  return useMutation({
    mutationFn: async (medicines: string[]) =>
      normalizeInteractions(
        await api<InteractionResponse>("/ai/drug-interaction", {
          method: "POST",
          json: { medicines },
        }),
      ),
  });
}
