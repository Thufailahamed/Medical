"use client";

/**
 * Doctor-side "Record reading" form. Sends `POST /doctor-portal/vitals`.
 *
 * Kept compact so it fits inside a Drawer. Validates blood_pressure
 * requires a diastolic value, mirrors the mobile composer.
 */

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea } from "@/portal/components/ui/Form";
import { Pill } from "@/portal/components/ui/Pill";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import {
  VITAL_TYPES,
  VITAL_CONTEXTS,
  defaultUnit,
  type VitalType,
  type VitalContext,
} from "@healthcare/shared/vitals";
import { vitalLabel } from "@/portal/lib/clinicalTones";

interface Props {
  patientId: string;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

function usefulContextsFor(type: VitalType): VitalContext[] {
  switch (type) {
    case "blood_sugar":
      return ["fasting", "post_meal", "pre_meal", "random"];
    case "heart_rate":
      return ["resting", "exercise", "standing"];
    case "blood_pressure":
      return ["resting", "standing", "supine", "exercise"];
    case "temperature":
      return ["resting", "random"];
    case "pain_scale":
      return ["resting", "exercise", "post_medication"];
    default:
      return ["resting", "random"];
  }
}

export function RecordVitalsForm({ patientId, onSaved, onCancel }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [type, setType] = useState<VitalType>("blood_pressure");
  const [value, setValue] = useState("");
  const [secondary, setSecondary] = useState("");
  const [context, setContext] = useState<VitalContext | null>(null);
  const [notes, setNotes] = useState("");

  const unit = useMemo(() => defaultUnit(type), [type]);
  const ctxOptions = useMemo(() => usefulContextsFor(type), [type]);

  const numeric = parseFloat(value);
  const isBP = type === "blood_pressure";
  const diastolic = parseFloat(secondary);

  const valid =
    !!patientId &&
    Number.isFinite(numeric) &&
    (!isBP || Number.isFinite(diastolic));

  async function save() {
    if (!valid) return;
    try {
      const res = await api<{ vital: { id: string } }>(
        "/doctor-portal/vitals",
        {
          method: "POST",
          json: {
            patientId,
            type,
            value: numeric,
            secondaryValue: isBP ? diastolic : null,
            unit,
            context: context ?? null,
            notes: notes.trim() || null,
          },
        }
      );
      toast.success(
        t("vitals.recordedToast", { label: vitalLabel(type) }),
        `#${res.vital?.id ?? ""}`
      );
      // best-effort cache invalidation; mirrors mobile hook.
      qc.invalidateQueries({ queryKey: qk.patientSummary(patientId) });
      qc.invalidateQueries({ queryKey: qk.patientOverview(patientId) });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "vitals"] });
      onSaved?.(res.vital?.id ?? "");
    } catch (err: any) {
      toast.error(t("vitals.recordError"), err?.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Type chips */}
      <div>
        <div className="block text-[11px] text-text-soft mb-1.5 font-semibold tracking-wide uppercase">
          {t("vitals.typeLabel")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VITAL_TYPES.map((vt) => (
            <button
              key={vt}
              type="button"
              onClick={() => {
                setType(vt);
                setContext(null);
              }}
              className="cursor-pointer"
              aria-pressed={type === vt}
            >
              <Pill tone={type === vt ? "brand" : "neutral"}>
                {vitalLabel(vt)}
              </Pill>
            </button>
          ))}
        </div>
      </div>

      <Input
        type="number"
        label={t("vitals.valueLabel", { unit })}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isBP ? "120" : "72"}
        required
        inputMode="decimal"
      />

      {isBP ? (
        <Input
          type="number"
          label={t("vitals.diastolicLabel")}
          value={secondary}
          onChange={(e) => setSecondary(e.target.value)}
          placeholder="80"
          required
          inputMode="decimal"
        />
      ) : null}

      {/* Context chips */}
      <div>
        <div className="block text-[11px] text-text-soft mb-1.5 font-semibold tracking-wide uppercase">
          {t("vitals.contextLabel")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ctxOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setContext(context === c ? null : c)}
              className="cursor-pointer"
              aria-pressed={context === c}
            >
              <Pill tone={context === c ? "info" : "neutral"}>
                {t(`vitals.context.${c}`)}
              </Pill>
            </button>
          ))}
        </div>
      </div>

      <Textarea
        label={t("vitals.notesLabel")}
        hint={t("vitals.notesHelper")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder={t("vitals.notesPlaceholder")}
      />

      <div className="flex justify-end gap-2 sticky bottom-0 bg-bg py-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button
          leftIcon={<Save size={14} />}
          disabled={!valid}
          onClick={save}
        >
          {t("vitals.saveAction")}
        </Button>
      </div>
    </div>
  );
}