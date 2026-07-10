"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound } from "lucide-react";

import { Card } from "@/portal/components/ui/Card";
import { useT } from "@/portal/i18n";
import { formatDate, formatDateTime } from "@/portal/lib/format";
import {
  parseSoapNotes,
  type ClinicalNoteRecord,
} from "@/portal/lib/clinicalNote";

function SoapBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </h3>
      <p className="mt-1.5 text-sm text-text whitespace-pre-wrap leading-relaxed">
        {value}
      </p>
    </div>
  );
}

export function ClinicalNoteDetail({ note }: { note: ClinicalNoteRecord }) {
  const t = useT();
  const soap = parseSoapNotes(note.notes);
  const when = note.date ? formatDate(note.date) : formatDateTime(note.createdAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="inline-flex items-center gap-1.5 text-text-muted">
          <UserRound size={14} />
          <span className="font-medium text-text">
            {note.patient?.name ?? t("clinicalNotes.unknownPatient")}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-text-muted">
          <CalendarDays size={14} />
          <span>{when}</span>
        </div>
      </div>

      {note.diagnosis ? (
        <Card className="bg-surface-2/40">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {t("clinicalNotes.detail.diagnosis")}
          </h3>
          <p className="mt-1.5 text-sm text-text">{note.diagnosis}</p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        {soap.subjective ? (
          <SoapBlock label={t("notes.subjective")} value={soap.subjective} />
        ) : null}
        {soap.objective ? (
          <SoapBlock label={t("notes.objective")} value={soap.objective} />
        ) : null}
        {soap.assessment ? (
          <SoapBlock label={t("notes.assessment")} value={soap.assessment} />
        ) : null}
        {soap.plan ? <SoapBlock label={t("notes.plan")} value={soap.plan} /> : null}
        {soap.raw ? (
          <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
            {soap.raw}
          </p>
        ) : null}
        {!soap.subjective &&
        !soap.objective &&
        !soap.assessment &&
        !soap.plan &&
        !soap.raw ? (
          <p className="text-sm text-text-muted">{t("clinicalNotes.detail.noBody")}</p>
        ) : null}
      </Card>

      <div className="flex justify-end">
        <Link
          href={`/portal/patients/${note.patientId}/clinical-notes`}
          className="portal-btn portal-btn-secondary portal-btn-sm"
        >
          {t("clinicalNotes.detail.openChart")}
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
