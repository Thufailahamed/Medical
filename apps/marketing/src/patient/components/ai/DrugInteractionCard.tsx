"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Pill as PillIcon,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import {
  useCheckDrugInteractions,
  type DrugInteractionItem,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

export interface DrugInteractionHandle {
  checkAll: () => void;
}

type Tone = "danger" | "warn" | "brand";

function severityTone(severity: string): Tone {
  const s = (severity || "moderate").toLowerCase();
  if (s === "severe" || s === "high" || s === "major") return "danger";
  if (s === "moderate" || s === "medium") return "warn";
  return "brand";
}

const TONE_STYLES: Record<
  Tone,
  { card: string; pill: string; dot: string }
> = {
  danger: {
    card: "border-danger/30 bg-danger-soft/60",
    pill: "bg-danger-soft text-danger",
    dot: "bg-danger",
  },
  warn: {
    card: "border-warn/30 bg-warn-soft/60",
    pill: "bg-warn-soft text-warn",
    dot: "bg-warn",
  },
  brand: {
    card: "border-brand/30 bg-brand-soft/60",
    pill: "bg-brand-soft text-brand",
    dot: "bg-brand",
  },
};

export const DrugInteractionCard = forwardRef<
  DrugInteractionHandle,
  { activeMedNames: string[] }
>(function DrugInteractionCard({ activeMedNames }, ref) {
  const check = useCheckDrugInteractions();
  const [medicines, setMedicines] = useState("");
  const [result, setResult] = useState<{
    items: DrugInteractionItem[];
    message: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(names?: string) {
    const raw = names ?? medicines;
    const list = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!list.length) {
      setError("Enter at least one medication name to check.");
      return;
    }
    setError(null);
    setResult(null);
    try {
      setResult(await check.mutateAsync(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Interaction check failed.");
    }
  }

  function checkAll() {
    if (!activeMedNames.length) {
      setError("No active medications on file. Add meds or type names manually.");
      return;
    }
    const joined = activeMedNames.join(", ");
    setMedicines(joined);
    void run(joined);
  }

  useImperativeHandle(ref, () => ({ checkAll }));

  return (
    <Card accent="amber" className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn"
        >
          <PillIcon size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="t-card-title text-text">Medication safety</h2>
            <Pill tone="warn">Rx</Pill>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-text-soft">
            Cross-check drug interactions and contraindications against a
            verified pharmacopeia.
          </p>
        </div>
      </div>

      {activeMedNames.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-border bg-surface-2/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="t-label">Active Rx ({activeMedNames.length})</span>
            <button
              type="button"
              onClick={checkAll}
              className="inline-flex items-center gap-1 rounded-pill border border-brand/30 bg-brand-soft px-2 py-1 text-[11px] font-bold text-brand transition-colors hover:bg-brand/15"
            >
              <Zap size={11} aria-hidden />
              Check all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeMedNames.map((name) => (
              <Pill key={name} tone="neutral" className="normal-case">
                {name}
              </Pill>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs text-text-soft">
          No active medications on file — type names below to check.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="drug-check-input" className="t-label">
          Medications
        </label>
        <input
          id="drug-check-input"
          type="text"
          value={medicines}
          onChange={(e) => setMedicines(e.target.value)}
          placeholder="Paracetamol, Metformin, Atorvastatin…"
          className="h-10 w-full rounded-xl border border-border bg-white px-3 text-[13px] font-medium text-text placeholder:text-text-muted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>

      <div className="mt-4 flex-1" aria-live="polite" aria-busy={check.isPending}>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs font-medium text-danger"
          >
            <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : check.isPending ? (
          <div className="flex flex-col gap-2">
            <div className="patient-shimmer h-16 rounded-xl" aria-hidden />
            <div className="patient-shimmer h-16 rounded-xl" aria-hidden />
          </div>
        ) : result?.items.length ? (
          <div className="flex flex-col gap-2">
            <span className="t-label">
              {result.items.length}{" "}
              {result.items.length === 1
                ? "interaction detected"
                : "interactions detected"}
            </span>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {result.items.map((item, idx) => {
                const tone = severityTone(item.severity);
                const styles = TONE_STYLES[tone];
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border p-3",
                      styles.card,
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {item.medicines?.map((med, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-text">
                              {med}
                            </span>
                            {i < item.medicines.length - 1 ? (
                              <span
                                aria-hidden
                                className="text-[11px] font-bold text-text-muted"
                              >
                                +
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider",
                          styles.pill,
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn("h-1.5 w-1.5 rounded-full", styles.dot)}
                        />
                        {item.severity}
                      </span>
                    </div>
                    {item.note ? (
                      <p className="text-xs leading-relaxed text-text">
                        {item.note}
                      </p>
                    ) : null}
                    {item.recommendation ? (
                      <div className="border-t border-border/60 pt-1.5 text-[11.5px] text-text-soft">
                        <span className="font-bold text-text">Guidance · </span>
                        {item.recommendation}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : result ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft/70 p-3.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
              <ShieldCheck size={14} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-text">
                No adverse interactions detected
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-text-soft">
                {result.message}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[11.5px] text-text-muted">
            Results appear here after a check. This is decision support, not a
            prescription.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
          <ShieldCheck size={12} aria-hidden className="text-success" />
          Pharmacopeia verified
        </span>
        <button
          type="button"
          onClick={() => void run()}
          disabled={!medicines.trim() || check.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-warn px-3.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(224,138,0,0.28)] transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-muted disabled:shadow-none"
        >
          {check.isPending ? (
            <>
              <Loader2 size={13} aria-hidden className="animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <ShieldCheck size={13} aria-hidden />
              Check interactions
            </>
          )}
        </button>
      </div>
    </Card>
  );
});
