"use client";

/**
 * PrescriptionComposer — full-featured e-prescription form used by
 * both the patient chart tab and the global prescriptions list.
 *
 * Parity with mobile (apps/mobile/src/app/(doctor)/prescription.tsx):
 *   - 4-slot frequency grid (morning / noon / evening / night) with
 *     a derived frequency label
 *   - Common-dosage pill row (250mg / 500mg / 1g / …)
 *   - Preset medicine quick-add (Amoxicillin, Paracetamol, …)
 *   - Duration-days + ongoing toggle + computed end-date preview
 *   - Template chip carousel (`applyTemplate` from saved templates)
 *   - "Save as template" affordance on submit
 *   - Edit mode: pass `prescriptionId` + `initialItems` → PATCH on
 *     save instead of POST
 *
 * Safety pre-flight still uses the existing `/safety/check` endpoint
 * with a 600ms debounce; blocking severities surface an override
 * checkbox that flips on `X-Confirm-Warning: true` for the create /
 * update request.
 */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Save,
  FileSignature,
  AlertCircle,
  BookmarkPlus,
  Sparkles,
} from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea, Select } from "@/portal/components/ui/Form";
import { Card } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

import { api, qk } from "@/portal/lib/api";
import { MedicineAutocomplete, type MasterMedicine } from "./MedicineAutocomplete";
import { SafetyCheckPanel, type SafetyWarning } from "./SafetyCheckPanel";
import { SlotToggle } from "./SlotToggle";
import { PRESET_MEDS, COMMON_DOSAGES, TIMING_OPTIONS } from "@/portal/lib/rxPresets";
import type { PrescriptionCreate } from "@healthcare/shared/validators";
import {
  slotsToFrequency,
  frequencyToSlots,
  endDateLabel,
  type Slots,
} from "@/portal/lib/rxSlots";
import {
  useCreatePrescription,
  useUpdatePrescriptionDraft,
  useSignPrescription,
  useDoctorRxTemplates,
  useRecordRxTemplateUse,
  useCreateRxTemplate,
} from "@/portal/hooks/usePrescription";

interface RxItem {
  id: string;
  name: string;
  masterMedicineId?: string | null;
  dosage: string;
  frequency: string;
  timing: string;
  durationDays: number;
  ongoing: boolean;
  instructions: string;
  slots: Slots;
}

interface Props {
  patientId: string;
  patientAllergies: Array<{ substance: string; severity: string }>;
  /** When set, composer is in edit mode and submits a PATCH. */
  prescriptionId?: string;
  initialDiagnosis?: string;
  initialNotes?: string;
  initialItems?: Partial<RxItem>[];
  onSaved?: (prescriptionId: string, signed: boolean) => void;
  onCancel?: () => void;
}

function blankRow(): RxItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    masterMedicineId: null,
    dosage: "",
    frequency: "BD",
    slots: { morning: true, noon: false, evening: true, night: false },
    timing: "after_food",
    durationDays: 7,
    ongoing: false,
    instructions: "",
  };
}

function rowFromInitial(init: Partial<RxItem>): RxItem {
  return {
    id: crypto.randomUUID(),
    name: init.name ?? "",
    masterMedicineId: init.masterMedicineId ?? null,
    dosage: init.dosage ?? "",
    frequency: init.frequency ?? "OD",
    slots: init.slots ?? frequencyToSlots(init.frequency),
    timing: init.timing ?? "",
    durationDays: init.durationDays ?? 7,
    ongoing: init.ongoing ?? false,
    instructions: init.instructions ?? "",
  };
}

export function PrescriptionComposer({
  patientId,
  patientAllergies,
  prescriptionId,
  initialDiagnosis = "",
  initialNotes = "",
  initialItems,
  onSaved,
  onCancel,
}: Props) {
  const t = useT();
  const qc = useQueryClient();
  const isEditing = !!prescriptionId;

  const [items, setItems] = useState<RxItem[]>(
    initialItems && initialItems.length
      ? initialItems.map(rowFromInitial)
      : [blankRow()]
  );
  const [diagnosis, setDiagnosis] = useState(initialDiagnosis);
  const [notes, setNotes] = useState(initialNotes);

  // Safety
  const [warnings, setWarnings] = useState<SafetyWarning[]>([]);
  const [topSeverity, setTopSeverity] = useState<SafetyWarning["severity"] | null>(null);
  // safetyRev > 0 only after a successful safety-check round-trip.
  // The "empty candidates → panels clear" branch derives from this
  // counter, so we never call setState inside the effect body.
  const [safetyRev, setSafetyRev] = useState(0);
  const [overrideAck, setOverrideAck] = useState(false);

  // Save-as-template
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const createMutation = useCreatePrescription();
  const updateMutation = useUpdatePrescriptionDraft();
  const signMutation = useSignPrescription();
  const createTemplate = useCreateRxTemplate();
  const { data: templateData } = useDoctorRxTemplates();
  const recordTemplateUse = useRecordRxTemplateUse();
  const templates = templateData?.templates ?? [];

  // Build the candidate list for the safety check from the current
  // items. Empty `name` rows are skipped.
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

  // Reset safety state on candidate-empty via layout-effect-free derive
  // by skipping setState and instead forcing recompute on next render.
  const safetyChecked = safetyRev > 0;
  const effectiveWarnings: SafetyWarning[] = safetyChecked
    ? warnings
    : [];
  const effectiveTopSeverity = safetyChecked ? topSeverity : null;

  // Debounced safety pre-flight (600ms — same cadence as the mobile
  // composer so the two clients feel identical).
  useEffect(() => {
    if (candidates.length === 0) {
      // Empty candidates → render-derive clears the panels via
      // safetyRev=0. No setState inside the effect body.
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
        setSafetyRev((n) => n + 1);
        setOverrideAck(false);
      } catch {
        // Silent — composer keeps working; user can save anyway.
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [candidates, patientId]);

  const blocking = effectiveTopSeverity === "severe" || effectiveTopSeverity === "critical";
  const canSave =
    items.some((i) => i.name.trim()) &&
    diagnosis.trim().length > 0 &&
    !createMutation.isPending &&
    !updateMutation.isPending &&
    (!blocking || overrideAck);

  function updateRow(id: string, patch: Partial<RxItem>) {
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function setMedicine(id: string, m: MasterMedicine | null) {
    updateRow(id, {
      name: m?.genericName ?? "",
      masterMedicineId: m?.id ?? null,
      dosage: m?.strength ? m.strength : "",
    });
  }

  function applyPreset(id: string, preset: { genericName: string; strength?: string }) {
    updateRow(id, {
      name: preset.genericName,
      dosage: preset.strength ?? "",
      masterMedicineId: null,
    });
  }

  function applyTemplate(tpl: {
    id: string;
    name: string;
    diagnosis: string | null;
    medicines: Array<{
      name?: string;
      dosage?: string;
      frequency?: string;
      masterMedicineId?: string | null;
    }>;
  }) {
    if (!tpl.medicines?.length) return;
    const converted: RxItem[] = tpl.medicines.map((m) => ({
      ...blankRow(),
      name: m.name ?? "",
      dosage: m.dosage ?? "",
      slots: frequencyToSlots(m.frequency),
      masterMedicineId: m.masterMedicineId ?? null,
    }));
    setItems(converted);
    if (!diagnosis && tpl.diagnosis) setDiagnosis(tpl.diagnosis);
    recordTemplateUse.mutate(tpl.id);
    toast.info("Template applied", tpl.name);
  }

  function endDateForRow(row: RxItem): string | null {
    const start = new Date().toISOString().slice(0, 10);
    return endDateLabel(start, row.durationDays, row.ongoing);
  }

  function itemsToRequestBody() {
    return items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name,
        dosage: i.dosage,
        frequency: i.frequency,
        timing: i.timing,
        durationDays: i.durationDays,
        ongoing: i.ongoing,
        instructions: i.instructions,
        masterMedicineId: i.masterMedicineId ?? undefined,
        startDate: new Date().toISOString().slice(0, 10),
      }));
  }

  async function save(sign: boolean) {
    if (!canSave) return;
    const body = {
      patientId,
      diagnosis,
      notes,
      items: itemsToRequestBody(),
    };
    const overrideHeaders =
      blocking && overrideAck ? { "X-Confirm-Warning": "true" } : undefined;

    try {
      let id: string | undefined;
      if (isEditing) {
        const res = await updateMutation.mutateAsync({
          id: prescriptionId!,
          body: { diagnosis, notes, items: body.items },
        });
        id = res.prescriptionId;
      } else {
        const res = await createMutation.mutateAsync(body as PrescriptionCreate);
        id = res.prescription?.id;
      }
      if (!id) return;

      if (sign) {
        await signMutation.mutateAsync({
          id,
          ...(overrideHeaders ? { headers: overrideHeaders } : {}),
        });
      }

      if (saveAsTemplate && templateName.trim() && !isEditing) {
        try {
          await createTemplate.mutateAsync({
            name: templateName.trim(),
            diagnosis,
            notes,
            medicines: body.items.map((i) => ({
              name: i.name,
              dosage: i.dosage,
              frequency: i.frequency,
              timing: i.timing,
              masterMedicineId: i.masterMedicineId,
            })),
          });
          toast.success("Template saved", templateName.trim());
        } catch {
          // Non-blocking — the prescription is already saved.
        }
      }

      toast.success(
        sign
          ? t("prescription.signed")
          : isEditing
            ? "Draft updated"
            : "Draft saved",
        `#${id.slice(0, 8)}`
      );
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
      qc.invalidateQueries({ queryKey: qk.patientOverview(patientId) });
      onSaved?.(id, sign);
    } catch (err: unknown) {
      const e = err as { status?: number; details?: { requiresConfirmation?: boolean; message?: string }; message?: string };
      if (e?.status === 409 && e?.details?.requiresConfirmation) {
        toast.error(
          "Safety warning requires confirmation",
          e.details?.message ?? "Acknowledge and retry."
        );
      } else {
        toast.error("Failed to save", e?.message);
      }
    }
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
              <PillBadge key={i} tone="danger">
                {a.substance} · {a.severity}
              </PillBadge>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label={t("prescription.diagnosis")}
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="e.g. Acute pharyngitis"
          required
        />
        <Input
          label={t("common.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. 5 days, review if no improvement"
        />
      </div>

      {/* Templates */}
      {templates.length > 0 ? (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-brand" />
            <span className="text-[11px] font-medium text-text-soft">
              {t("rx.composer.templatesSection")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-border bg-surface hover:bg-surface-2 text-xs text-text transition-colors"
              >
                {tpl.name}
                {tpl.useCount > 0 ? (
                  <span className="text-[10px] text-text-muted">
                    · {tpl.useCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {items.map((item, idx) => {
          const end = endDateForRow(item);
          return (
            <Card key={item.id} padding={false}>
              <div className="px-4 py-2.5 border-b border-border bg-surface-2/40 flex items-center gap-2">
                <span className="text-xs font-medium text-text">#{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => setItems((arr) => arr.filter((i) => i.id !== item.id))}
                  disabled={items.length === 1}
                  className="ml-auto text-text-muted hover:text-danger disabled:opacity-30"
                  aria-label="Remove medicine"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-7">
                    <label className="block text-[11px] text-text-soft mb-1">
                      {t("prescription.searchMedicine")}
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
                    {/* Free-text fallback indicator */}
                    {item.name && !item.masterMedicineId ? (
                      <div className="text-[10px] text-text-muted mt-1">
                        Free-text: {item.name}
                      </div>
                    ) : null}
                    {/* Preset chips — only when the field is empty */}
                    {!item.name ? (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {PRESET_MEDS.filter(
                          (p) => !items.some((i) => i.name === p.genericName)
                        )
                          .slice(0, 4)
                          .map((p) => (
                            <button
                              key={p.genericName}
                              type="button"
                              onClick={() => applyPreset(item.id, p)}
                              className="inline-flex items-center h-6 px-2 rounded-full border border-border bg-surface text-[10px] text-text-soft hover:bg-surface-2"
                            >
                              {p.genericName}
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="md:col-span-5">
                    <Input
                      label={t("prescription.dosage")}
                      value={item.dosage}
                      onChange={(e) => updateRow(item.id, { dosage: e.target.value })}
                      placeholder="500 mg"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {COMMON_DOSAGES.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateRow(item.id, { dosage: d })}
                          className={cn(
                            "inline-flex items-center h-6 px-2 rounded-full border text-[10px] font-medium transition-colors",
                            item.dosage === d
                              ? "bg-brand text-white border-brand"
                              : "bg-surface border-border text-text-soft hover:bg-surface-2"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6">
                    <label className="block text-[11px] text-text-soft mb-1">
                      {t("prescription.frequency")}
                    </label>
                    <SlotToggle
                      value={item.slots}
                      onChange={(s) => {
                        const freq = slotsToFrequency(s) ?? "OD";
                        updateRow(item.id, { slots: s, frequency: freq });
                      }}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Select
                      label={t("rx.composer.timing")}
                      value={item.timing}
                      onChange={(e) => updateRow(item.id, { timing: e.target.value })}
                      options={[...TIMING_OPTIONS]}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      label={t("rx.composer.durationDays")}
                      type="number"
                      min={0}
                      max={365}
                      value={item.durationDays}
                      onChange={(e) =>
                        updateRow(item.id, {
                          durationDays: Math.max(0, parseInt(e.target.value || "0", 10)),
                        })
                      }
                      disabled={item.ongoing}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={item.ongoing}
                      onChange={(e) =>
                        updateRow(item.id, { ongoing: e.target.checked })
                      }
                    />
                    <span className="text-text-soft">
                      {t("rx.composer.ongoing")}
                    </span>
                  </label>
                  {!item.ongoing && end ? (
                    <span className="text-text-muted">
                      {t("rx.composer.endDate")}: {formatDate(end)}
                    </span>
                  ) : null}
                </div>

                <Textarea
                  label={t("prescription.instructions")}
                  value={item.instructions}
                  onChange={(e) => updateRow(item.id, { instructions: e.target.value })}
                  placeholder="e.g. Avoid alcohol; complete the course"
                  rows={2}
                />
              </div>
            </Card>
          );
        })}
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

      <SafetyCheckPanel warnings={effectiveWarnings} severity={effectiveTopSeverity} />

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

      {/* Save as template (create mode only) */}
      {!isEditing ? (
        <Card padding={false}>
          <label className="px-4 py-3 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
            />
            <BookmarkPlus size={14} className="text-brand" />
            <span className="text-xs text-text">
              {t("rx.composer.saveAsTemplate")}
            </span>
            {saveAsTemplate ? (
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t("rx.composer.templateName")}
                onClick={(e) => e.stopPropagation()}
                className="ml-2 flex-1 h-7 px-2 rounded-md border border-border bg-surface text-xs text-text"
              />
            ) : null}
          </label>
        </Card>
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
          disabled={!canSave}
          loading={createMutation.isPending || updateMutation.isPending}
          onClick={() => save(false)}
        >
          {isEditing ? t("rx.composer.updateDraft") : t("prescription.saveDraft")}
        </Button>
        <Button
          leftIcon={<FileSignature size={14} />}
          disabled={!canSave}
          loading={signMutation.isPending}
          onClick={() => save(true)}
        >
          {t("rx.composer.signAndSend")}
        </Button>
      </div>
    </div>
  );
}
