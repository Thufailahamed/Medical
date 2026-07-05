"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, FileSignature, AlertCircle } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea, Select } from "@/portal/components/ui/Form";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { toast } from "@/portal/components/ui/Toast";
import { MedicineAutocomplete, type MasterMedicine } from "./MedicineAutocomplete";
import { SafetyCheckPanel, type SafetyWarning } from "./SafetyCheckPanel";
import { useT } from "@/portal/i18n";

interface RxItem {
  id: string;
  name: string;
  masterMedicineId?: string | null;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
}

interface Props {
  patientId: string;
  patientAllergies: Array<{ substance: string; severity: string }>;
  onSaved?: (prescriptionId: string, signed: boolean) => void;
  onCancel?: () => void;
}

const FREQ_OPTIONS = [
  { value: "OD", label: "Once daily" },
  { value: "BD", label: "Twice daily" },
  { value: "TDS", label: "Three times daily" },
  { value: "QID", label: "Four times daily" },
  { value: "PRN", label: "As needed" },
  { value: "STAT", label: "Immediately (single dose)" },
];

const TIMING_OPTIONS = [
  { value: "", label: "—" },
  { value: "before_food", label: "Before food" },
  { value: "after_food", label: "After food" },
  { value: "with_food", label: "With food" },
  { value: "bedtime", label: "At bedtime" },
];

function blankRow(): RxItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    dosage: "",
    frequency: "BD",
    timing: "after_food",
    duration: "5 days",
    instructions: "",
  };
}

export function PrescriptionComposer({ patientId, patientAllergies, onSaved, onCancel }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [items, setItems] = useState<RxItem[]>([blankRow()]);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [warnings, setWarnings] = useState<SafetyWarning[]>([]);
  const [topSeverity, setTopSeverity] = useState<SafetyWarning["severity"] | null>(null);
  const [overrideAck, setOverrideAck] = useState(false);

  const candidates = useMemo(
    () =>
      items
        .filter((i) => i.name.trim().length > 0)
        .map((i) => ({
          name: i.name,
          dosage: i.dosage || undefined,
          masterMedicineId: i.masterMedicineId || undefined,
        })),
    [items]
  );

  // Debounced safety check
  useEffect(() => {
    if (candidates.length === 0) {
      setWarnings([]);
      setTopSeverity(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await api<{
          warnings: SafetyWarning[];
          severity: SafetyWarning["severity"] | null;
          hasWarnings: boolean;
        }>("/safety/check", {
          method: "POST",
          json: { patientId, candidate: candidates },
        });
        setWarnings(res.warnings ?? []);
        setTopSeverity(res.severity ?? null);
        setOverrideAck(false);
      } catch {
        // Silent — composer keeps working; user can save anyway.
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [candidates, patientId]);

  const blocking = topSeverity === "severe" || topSeverity === "critical";
  const canSave = items.some((i) => i.name.trim()) && diagnosis.trim().length > 0;

  const save = useMutation({
    mutationFn: async (sign: boolean) => {
      const body = {
        patientId,
        diagnosis,
        notes,
        medicines: items
          .filter((i) => i.name.trim())
          .map((i) => ({
            name: i.name,
            dosage: i.dosage,
            frequency: i.frequency,
            timing: i.timing,
            duration: i.duration,
            instructions: i.instructions,
            masterMedicineId: i.masterMedicineId ?? undefined,
            startDate: new Date().toISOString().slice(0, 10),
          })),
      };
      // First create draft; then sign if needed.
      const created = await api<{ prescription: { id: string } }>("/doctor/prescriptions", {
        method: "POST",
        json: body,
        headers: blocking && overrideAck ? { "X-Confirm-Warning": "true" } : undefined,
      });
      let signedId: string | undefined;
      if (sign && created.prescription?.id) {
        const signed = await api<{ prescription: { id: string } }>(
          `/doctor/prescriptions/${created.prescription.id}/sign`,
          { method: "POST", json: {} }
        );
        signedId = signed.prescription?.id;
      }
      return { draftId: created.prescription?.id, signedId };
    },
    onSuccess: (res, sign) => {
      toast.success(
        sign && res.signedId ? "Prescription signed" : "Draft saved",
        `#${res.draftId}`
      );
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
      onSaved?.(res.signedId ?? res.draftId, Boolean(res.signedId));
    },
    onError: (err: any) => {
      if (err?.status === 409 && err?.details?.requiresConfirmation) {
        toast.error(
          "Safety warning requires confirmation",
          err.details?.message ?? "Acknowledge and retry."
        );
      } else {
        toast.error("Failed to save", err?.message);
      }
    },
  });

  function updateRow(id: string, patch: Partial<RxItem>) {
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function setMedicine(id: string, m: MasterMedicine | null) {
    updateRow(id, {
      name: m?.genericName ?? "",
      masterMedicineId: m?.id ?? null,
      dosage: m?.strength ? `${m.strength}` : "",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {patientAllergies.length > 0 ? (
        <Card padding={false}>
          <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-danger-soft/30">
            <AlertCircle size={14} className="text-danger" />
            <span className="text-xs font-medium text-danger">
              {t("prescription.allergyWarning")}
            </span>
          </div>
          <div className="px-3 py-2 flex flex-wrap gap-1.5">
            {patientAllergies.map((a, i) => (
              <Pill key={i} tone="danger">
                {a.substance} · {a.severity}
              </Pill>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label={t("prescription.field.diagnosis")}
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="e.g. Acute pharyngitis"
          required
        />
        <Input
          label={t("prescription.field.duration")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. 5 days, review if no improvement"
        />
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, idx) => (
          <Card key={item.id} padding={false}>
            <div className="px-4 py-2.5 border-b border-border bg-surface-2/40 flex items-center gap-2">
              <span className="text-xs font-medium text-text">#{idx + 1}</span>
              <button
                type="button"
                onClick={() => setItems((arr) => arr.filter((i) => i.id !== item.id))}
                disabled={items.length === 1}
                className="ml-auto text-text-muted hover:text-danger disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="block text-[11px] text-text-soft mb-1">
                  {t("prescription.field.medicine")}
                </label>
                <MedicineAutocomplete
                  value={
                    item.masterMedicineId
                      ? {
                          id: item.masterMedicineId,
                          genericName: item.name,
                          strength: item.dosage || undefined,
                        }
                      : null
                  }
                  onChange={(m) => setMedicine(item.id, m)}
                />
                {item.name && !item.masterMedicineId ? (
                  <div className="text-[10px] text-text-muted mt-1">
                    Free-text: {item.name}
                  </div>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <Input
                  label={t("prescription.field.dosage")}
                  value={item.dosage}
                  onChange={(e) => updateRow(item.id, { dosage: e.target.value })}
                  placeholder="500 mg"
                />
              </div>
              <div className="md:col-span-2">
                <Select
                  label={t("prescription.field.frequency")}
                  value={item.frequency}
                  onChange={(e) => updateRow(item.id, { frequency: e.target.value })}
                  options={FREQ_OPTIONS}
                />
              </div>
              <div className="md:col-span-2">
                <Select
                  label={t("prescription.field.timing")}
                  value={item.timing}
                  onChange={(e) => updateRow(item.id, { timing: e.target.value })}
                  options={TIMING_OPTIONS}
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label={t("prescription.field.duration")}
                  value={item.duration}
                  onChange={(e) => updateRow(item.id, { duration: e.target.value })}
                  placeholder="5 days"
                />
              </div>
              <div className="md:col-span-12">
                <Textarea
                  label={t("prescription.field.instructions")}
                  value={item.instructions}
                  onChange={(e) => updateRow(item.id, { instructions: e.target.value })}
                  placeholder="e.g. Avoid alcohol; complete the course"
                  rows={2}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Plus size={14} />}
          onClick={() => setItems((arr) => [...arr, blankRow()])}
        >
          {t("prescription.addMedicine")}
        </Button>
      </div>

      <SafetyCheckPanel
        warnings={warnings}
        severity={topSeverity}
      />

      {blocking ? (
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={overrideAck}
            onChange={(e) => setOverrideAck(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-text-soft">
            {t("prescription.acknowledgeOverride")}
          </span>
        </label>
      ) : null}

      <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-bg py-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          leftIcon={<Save size={14} />}
          disabled={!canSave || save.isPending || (blocking && !overrideAck)}
          loading={save.isPending}
          onClick={() => save.mutate(false)}
        >
          {t("prescription.saveDraft")}
        </Button>
        <Button
          leftIcon={<FileSignature size={14} />}
          disabled={!canSave || save.isPending || (blocking && !overrideAck)}
          loading={save.isPending}
          onClick={() => save.mutate(true)}
        >
          {t("prescription.sign")}
        </Button>
      </div>
    </div>
  );
}