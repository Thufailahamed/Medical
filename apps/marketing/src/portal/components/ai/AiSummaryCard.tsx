"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, RefreshCw, AlertTriangle, Wand2, Copy, Check } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface SummaryResponse {
  summary: string;
  cached?: boolean;
}

interface Props {
  patientId: string;
}

type Mode = "idle" | "loading" | "success" | "error";

export function AiSummaryCard({ patientId }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isFetching, isError } = useQuery({
    queryKey: qk.aiSummary(patientId),
    queryFn: async () => {
      setError(null);
      try {
        return await api<SummaryResponse>("/ai/summary", {
          method: "POST",
          json: { patientId },
        });
      } catch (e: any) {
        setError(e?.message ?? t("ai.summary.error"));
        throw e;
      }
    },
    enabled,
    staleTime: 5 * 60_000,
  });

  let mode: Mode = "idle";
  if (enabled && isFetching && !data) mode = "loading";
  else if (data?.summary) mode = "success";
  else if (enabled && (isError || error)) mode = "error";

  function generate() {
    setEnabled(true);
    qc.invalidateQueries({ queryKey: qk.aiSummary(patientId) });
  }

  function handleCopy() {
    if (data?.summary) {
      navigator.clipboard.writeText(data.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-sky-50/50 via-purple-50/30 to-transparent flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                AI Longitudinal Summary
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                EHR Synthesis
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Synthesised from electronic medical records, vitals telemetry, lab orders, and active medications.
            </p>
          </div>
        </div>

        {mode === "success" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: qk.aiSummary(patientId) })}
              disabled={isFetching}
              className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} className={cn(isFetching && "animate-spin")} />
              <span>Regenerate</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {mode === "idle" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Generate Instant Pre-Consultation Synthesis
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                Run an automated clinical distillation across all recorded encounter notes, recent vitals deviations, and diagnostic pathology panels for this patient.
              </p>
            </div>
            <button
              type="button"
              onClick={generate}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <Wand2 size={13} />
              <span>Generate AI Summary</span>
            </button>
          </div>
        )}

        {mode === "loading" && (
          <div className="flex flex-col gap-2.5 py-2">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-700 mb-1">
              <span className="h-2 w-2 rounded-full bg-sky-600 animate-ping" />
              <span>Distilling medical chart records…</span>
            </div>
            <Skeleton className="h-3.5 w-full rounded-md" />
            <Skeleton className="h-3.5 w-11/12 rounded-md" />
            <Skeleton className="h-3.5 w-4/5 rounded-md" />
          </div>
        )}

        {mode === "error" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-600 shrink-0" />
              <span>{error ?? "Failed to synthesize clinical summary"}</span>
            </div>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: qk.aiSummary(patientId) })}
              className="text-xs font-bold text-rose-900 underline hover:no-underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {mode === "success" && data?.summary && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
            {data.summary}
          </div>
        )}
      </div>
    </div>
  );
}