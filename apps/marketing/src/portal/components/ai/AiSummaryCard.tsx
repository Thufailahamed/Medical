"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, RefreshCw, AlertTriangle, Wand2 } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
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

/**
 * AI summary card for the patient overview tab.
 *
 * Idle (default): shows a button that triggers a single fetch via
 * React Query. After success, the response is cached and rendered
 * immediately on remount. Regenerate forces a refetch (backend still
 * returns its own cache layer).
 *
 * Errors render inline so the doctor can retry without losing the
 * patient context.
 */
export function AiSummaryCard({ patientId }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card padding={false} className="dashboard-card overflow-hidden">
      <div className="p-5 pb-3">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={15} className="text-amber-500" />
              {t("ai.summary.title")}
            </span>
          }
          subtitle={t("ai.summary.subtitle")}
          right={
            mode === "success" ? (
              <div className="flex items-center gap-2">
                {data?.cached ? (
                  <span className="text-[10px] text-text-muted">
                    {relativeTime(new Date().toISOString())}
                  </span>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<RefreshCw size={12} />}
                  onClick={() => qc.invalidateQueries({ queryKey: qk.aiSummary(patientId) })}
                  loading={isFetching}
                >
                  {t("ai.summary.regenerate")}
                </Button>
              </div>
            ) : null
          }
        />

        {mode === "idle" ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-text-soft">
              {t("ai.summary.empty")}
            </p>
            <div>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Wand2 size={13} />}
                onClick={generate}
              >
                {t("ai.summary.generate")}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "loading" ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-10/12" />
            <Skeleton className="h-3 w-9/12" />
          </div>
        ) : null}

        {mode === "error" ? (
          <div className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-xs text-danger inline-flex items-center gap-2">
            <AlertTriangle size={13} />
            <span>{error ?? t("ai.summary.error")}</span>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: qk.aiSummary(patientId) })}
              className="ml-auto underline underline-offset-2 hover:opacity-80"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : null}

        {mode === "success" && data?.summary ? (
          <div
            className={cn(
              "mt-3 text-sm text-text leading-relaxed whitespace-pre-line",
            )}
          >
            {data.summary}
          </div>
        ) : null}
      </div>
    </Card>
  );
}