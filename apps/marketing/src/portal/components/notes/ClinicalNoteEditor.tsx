"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

interface Props {
  patientId: string;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

const SOAP_FIELDS = [
  { key: "s", badge: "S", labelKey: "notes.subjective", placeholderKey: "clinicalNotes.fields.subjectivePlaceholder", rows: 4 },
  { key: "o", badge: "O", labelKey: "notes.objective", placeholderKey: "clinicalNotes.fields.objectivePlaceholder", rows: 4 },
  { key: "a", badge: "A", labelKey: "notes.assessment", placeholderKey: "clinicalNotes.fields.assessmentPlaceholder", rows: 3 },
  { key: "p", badge: "P", labelKey: "notes.plan", placeholderKey: "clinicalNotes.fields.planPlaceholder", rows: 4 },
] as const;

function SoapField({
  badge,
  label,
  hint,
  value,
  onChange,
  rows,
}: {
  badge: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <div className="portal-soap-field">
      <div className="portal-soap-field-head">
        <span className="portal-soap-badge" aria-hidden>
          {badge}
        </span>
        <div className="portal-soap-field-copy">
          <div className="portal-soap-label">{label}</div>
          <div className="portal-soap-hint">{hint}</div>
        </div>
      </div>
      <textarea
        className="portal-input portal-soap-textarea focus-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={hint}
      />
    </div>
  );
}

export function ClinicalNoteEditor({ patientId, onSaved, onCancel }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [title, setTitle] = useState(() => `Visit — ${formatDate(new Date())}`);
  const [diagnosis, setDiagnosis] = useState("");
  const [soap, setSoap] = useState({ s: "", o: "", a: "", p: "" });

  const save = useMutation({
    mutationFn: () => {
      const combined = [
        soap.s && `S: ${soap.s}`,
        soap.o && `O: ${soap.o}`,
        soap.a && `A: ${soap.a}`,
        soap.p && `P: ${soap.p}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      return api<{ record: { id: string } }>("/doctor-portal/clinical-notes", {
        method: "POST",
        json: {
          patientId,
          title: title.trim(),
          diagnosis: diagnosis.trim() || undefined,
          notes: combined || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(t("clinicalNotes.savedToast"), `#${res.record?.id?.slice(0, 8)}`);
      qc.invalidateQueries({ queryKey: ["doctor-portal", "clinical-notes"] });
      qc.invalidateQueries({ queryKey: qk.patientOverview(patientId) });
      onSaved?.(res.record?.id);
    },
    onError: (err: any) => toast.error(t("toast.error"), err?.message),
  });

  return (
    <div className="portal-note-editor">
      <section className="portal-note-meta">
        <div className="portal-note-meta-grid">
          <Input
            label={t("clinicalNotes.fields.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("clinicalNotes.fields.titlePlaceholder")}
            required
          />
          <Input
            label={t("clinicalNotes.fields.diagnosis")}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder={t("clinicalNotes.fields.diagnosisPlaceholder")}
          />
        </div>
      </section>

      <section className="portal-note-soap">
        <div className="portal-note-soap-intro">
          <h3 className="portal-note-soap-title">{t("clinicalNotes.soapSection")}</h3>
          <p className="portal-note-soap-subtitle">{t("clinicalNotes.soapHint")}</p>
        </div>
        <div className="portal-note-soap-fields">
          {SOAP_FIELDS.map((field) => (
            <SoapField
              key={field.key}
              badge={field.badge}
              label={t(field.labelKey)}
              hint={t(field.placeholderKey)}
              value={soap[field.key]}
              onChange={(value) => setSoap((prev) => ({ ...prev, [field.key]: value }))}
              rows={field.rows}
            />
          ))}
        </div>
      </section>

      <div className="portal-note-editor-footer">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button
          leftIcon={<Save size={14} />}
          disabled={save.isPending || title.trim().length === 0}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          {t("clinicalNotes.save")}
        </Button>
      </div>
    </div>
  );
}
