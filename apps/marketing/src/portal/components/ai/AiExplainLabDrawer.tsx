"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  FlaskConical,
  AlertTriangle,
  ListChecks,
  Wand2,
  X,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Drawer } from "@/portal/components/ui/Modal";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Textarea } from "@/portal/components/ui/Form";
import { Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

interface LabOrderLite {
  id: string;
  patientId: string;
  tests: string[];
  notes?: string | null;
  resultUrl?: string | null;
  resultSummary?: string | null;
  patientName?: string | null;
}

interface LabExplainResponse {
  explanation: {
    explanation: string;
    recommendations: string[];
    abnormalValues: string[];
  };
  cached?: boolean;
}

interface Props {
  labOrder: LabOrderLite;
  onClose: () => void;
}

/**
 * AI explain-this-lab drawer.
 *
 * If the lab order has a `resultUrl` already attached (R2 key), POST
 * `/ai/explain/lab-report` directly. Otherwise show a textarea where
 * the doctor can paste report text and we POST with `textHint`.
 *
 * Cached responses render instantly with a "cached" badge; errors
 * surface in the same drawer so the doctor can retry without losing
 * the report context.
 */
export function AiExplainLabDrawer({ labOrder, onClose }: Props) {
  const t = useT();
  const [textHint, setTextHint] = useState(labOrder.resultSummary ?? "");
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
    return () => setOpen(false);
  }, []);

  const explain = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        fileUrl: labOrder.resultUrl || "manual",
        patientId: labOrder.patientId,
      };
      if (!labOrder.resultUrl) body.textHint = textHint;
      // reportId only matters if we have it — omit when unknown to
      // avoid server-side "report not found" errors.
      const res = await api<LabExplainResponse>("/ai/explain/lab-report", {
        method: "POST",
        json: body,
      });
      return res;
    },
  });

  const data = explain.data?.explanation;

  function handleClose() {
    setOpen(false);
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          {t("ai.labExplain.title")}
        </span>
      }
      subtitle={labOrder.patientName || labOrder.tests.join(", ")}
      size="lg"
      footer={
        !labOrder.resultUrl ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Wand2 size={13} />}
              onClick={() => explain.mutate()}
              loading={explain.isPending}
              disabled={textHint.trim().length < 5}
            >
              {t("ai.labExplain.run")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {explain.data?.cached ? (
              <Pill tone="neutral">{t("ai.labExplain.cached")}</Pill>
            ) : (
              <span />
            )}
            <Button variant="secondary" size="sm" onClick={handleClose}>
              {t("common.close")}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {/* Report header */}
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface-2/30 p-3">
          <div className="h-9 w-9 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
            <FlaskConical size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text truncate">
              {labOrder.tests.length > 0
                ? labOrder.tests.join(", ")
                : t("labs.untitled")}
            </div>
            {labOrder.notes ? (
              <div className="text-[11px] text-text-muted line-clamp-2 mt-0.5">
                {labOrder.notes}
              </div>
            ) : null}
          </div>
        </div>

        {/* Paste-text path */}
        {!labOrder.resultUrl ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-text-soft">
              {t("ai.labExplain.placeholder")}
            </label>
            <Textarea
              value={textHint}
              onChange={(e) => setTextHint(e.target.value)}
              rows={6}
              placeholder={t("ai.labExplain.placeholder")}
              className="font-mono text-xs"
            />
          </div>
        ) : null}

        {/* Explain result */}
        {explain.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-12 w-full mt-2" />
          </div>
        ) : explain.isError ? (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-xs text-danger">
            {t("ai.labExplain.error")}
          </div>
        ) : data ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text leading-relaxed">
              {data.explanation}
            </p>

            {data.abnormalValues.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted inline-flex items-center gap-1">
                  <AlertTriangle size={11} className="text-amber-500" />
                  {t("ai.labExplain.abnormal")}
                </div>
                <ul className="flex flex-col gap-1">
                  {data.abnormalValues.map((a, i) => (
                    <li
                      key={i}
                      className="text-xs text-text-soft px-2.5 py-1.5 rounded-md bg-amber-50/60 border border-amber-100/80"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.recommendations.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted inline-flex items-center gap-1">
                  <ListChecks size={11} />
                  {t("ai.labExplain.recommendations")}
                </div>
                <ul className="flex flex-col gap-1">
                  {data.recommendations.map((r, i) => (
                    <li
                      key={i}
                      className="text-xs text-text-soft px-2.5 py-1.5 rounded-md bg-surface-2/60 border border-border/60 inline-flex items-start gap-1.5"
                    >
                      <span className="text-text-muted shrink-0">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : labOrder.resultUrl ? (
          // No mutation fired yet for file-URL path — explain on first open.
          <ExplainOnOpen onFire={() => explain.mutate()} />
        ) : null}
      </div>
    </Drawer>
  );
}

function ExplainOnOpen({ onFire }: { onFire: () => void }) {
  useEffect(() => {
    onFire();
  }, [onFire]);
  return null;
}