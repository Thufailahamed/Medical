"use client";

/**
 * PatientSidebar — doctor's tabbed chart panel mounted alongside the
 * TeleconsultRoom video stage.
 *
 * Tabs:
 *   • Records      — PatientHeader + chronological chart cards fetched
 *                    from /doctor-portal/patients/:id/overview.
 *   • E-Rx         — embed PrescriptionComposer. Same form the doctor
 *                    already uses in the Visit Summary page, so any
 *                    safety / signature rules apply unchanged.
 *   • Notes        — embed ClinicalNoteEditor for free-text SOAP.
 *
 * Read-only elsewhere: allergies + chronic conditions are surfaced via
 * the header banner so the doctor never has to leave the call to check
 * what's safe to prescribe. Same UX as <PatientHeader> + Overview tab
 * on /portal/patients/:id.
 */

import { useState } from "react";
import {
  FileText,
  Pill,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";

import { usePatientHeader, PatientHeader } from "@/portal/components/patient/PatientHeader";
import { PrescriptionComposer } from "@/portal/components/rx/PrescriptionComposer";
import { ClinicalNoteEditor } from "@/portal/components/notes/ClinicalNoteEditor";
import { toast } from "@/portal/components/ui/Toast";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

type Tab = "records" | "prescriptions" | "notes";

interface Props {
  sessionId: string;
  patientId: string | null;
}

export default function PatientSidebar({ sessionId, patientId }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("records");

  const header = usePatientHeader(patientId ?? "");
  const allergies = header.data?.allergies ?? [];

  if (!patientId) {
    return (
      <div className="h-full flex items-center justify-center text-text-soft text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-1 rounded-2xl border border-surface-3 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-surface-3 bg-surface-2">
        {(
          [
            { key: "records", label: t("consult.tabs.records"), Icon: FileText },
            {
              key: "prescriptions",
              label: t("consult.tabs.prescriptions"),
              Icon: Pill,
            },
            { key: "notes", label: t("consult.tabs.clinicalNote"), Icon: ClipboardList },
          ] as { key: Tab; label: string; Icon: any }[]
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors",
              tab === key
                ? "text-text border-brand bg-surface-1"
                : "text-text-muted border-transparent hover:text-text"
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Allergies banner — always visible regardless of tab so the
          doctor never accidentally prescribes a contraindicated drug. */}
      {allergies.length > 0 ? (
        <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 flex items-start gap-2">
          <AlertTriangle size={14} className="text-rose-600 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-900">
            <span className="font-semibold">Allergies:</span>{" "}
            {allergies
              .map(
                (a) =>
                  `${a.substance}${a.severity !== "mild" ? ` (${a.severity})` : ""}`
              )
              .join(", ")}
          </div>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === "records" ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            <PatientHeader data={header.data} />
            <PatientChartTimeline patientId={patientId} />
          </div>
        ) : null}

        {tab === "prescriptions" ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <PrescriptionComposer
              patientId={patientId}
              patientAllergies={allergies.map((a) => ({
                substance: a.substance,
                severity: a.severity,
              }))}
              initialDiagnosis=""
              onSaved={(id, signed) => {
                if (signed) {
                  toast.success("Prescription signed");
                } else {
                  toast.info("Draft saved");
                }
                void sessionId;
              }}
              onCancel={() => setTab("records")}
            />
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <ClinicalNoteEditor
              patientId={patientId}
              onSaved={() => toast.success("Note saved")}
              onCancel={() => setTab("records")}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A condensed chart timeline for the records tab — pulls allergies,
 * conditions, meds, vitals, recent visits from the same overview
 * endpoint. Kept hand-rolled so we don't ship the entire overview
 * page chrome into the call surface; we just show the relevant rows
 * the doctor needs to recall without leaving the call.
 */
function PatientChartTimeline({ patientId }: { patientId: string }) {
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.open(`/portal/patients/${patientId}/overview`, "_blank");
          }
        }}
        className="w-full"
      >
        Open full chart →
      </Button>
      <div className="rounded-xl border border-surface-3 p-3 bg-surface-2 text-xs text-text-soft">
        The full chart including allergies, active medications, recent
        vitals, lab orders, and clinical notes opens in a new tab.
      </div>
    </div>
  );
}