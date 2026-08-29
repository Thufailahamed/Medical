"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  Pill,
  Calendar,
  Stethoscope,
  Download,
  ShieldCheck,
  ChevronLeft,
  FileText,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { usePrescription } from "@/patient/hooks/prescriptions";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { patientPaths } from "@healthcare/shared/contracts";

export default function PrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = usePrescription(id);
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const url = patientPaths.prescriptions.pdf(id);
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("auth-token")
          : null;
      if (token) {
        const fullUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}${url}`;
        const response = await fetch(fullUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          window.open(objectUrl, "_blank");
        }
      }
    } catch (err) {
      console.error("Failed to download PDF", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/prescriptions"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to prescriptions
      </Link>

      <QueryBoundary
        query={query}
        loadingCount={2}
        emptyTitle="Prescription not found"
        emptyDescription="This prescription may have been removed or is not available to you."
      >
        {(data) => {
          const rx = data.prescription;
          return (
            <>
              <SectionHeader
                label="Prescription"
                title={rx.diagnosis || "Prescription details"}
                description={`Issued by ${rx.doctorName ?? "your doctor"}${rx.doctorSpecialization ? ` · ${rx.doctorSpecialization}` : ""}`}
                action={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={downloadPdf}
                      disabled={downloading}
                      className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <Download size={14} aria-hidden />
                      {downloading ? "Preparing…" : "Download PDF"}
                    </button>
                  </div>
                }
              />

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="flex flex-col gap-5 lg:col-span-8">
                  <Card>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={statusTone(rx.status)}>
                          {humanize(rx.status)}
                        </StatusPill>
                        {rx.signedAt ? (
                          <StatusPill
                            tone="success"
                            icon={<ShieldCheck size={11} aria-hidden />}
                          >
                            Signed
                          </StatusPill>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field
                          label="Issued on"
                          value={formatDayLabel(rx.date)}
                        />
                        <Field
                          label="Doctor"
                          value={
                            rx.doctorName
                              ? `${rx.doctorName}${rx.doctorSpecialization ? ` · ${rx.doctorSpecialization}` : ""}`
                              : "—"
                          }
                        />
                        {rx.signedAt ? (
                          <Field
                            label="Signed at"
                            value={formatDayLabel(rx.signedAt)}
                          />
                        ) : null}
                        <Field
                          label="Medicines"
                          value={`${rx.medicineCount} item${rx.medicineCount === 1 ? "" : "s"}`}
                        />
                      </div>

                      {rx.notes ? (
                        <div className="rounded-inner bg-surface-2 p-3">
                          <p className="t-label">Doctor's notes</p>
                          <p className="mt-1 text-sm text-text">{rx.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <Card>
                    <div className="flex flex-col gap-3">
                      <h2 className="text-sm font-bold text-text">
                        Medicines ({rx.medicines.length})
                      </h2>
                      {rx.medicines.length === 0 ? (
                        <p className="text-sm text-text-soft">
                          No medicines are attached to this prescription.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-3">
                          {rx.medicines.map((med: { id: string; name: string; dosage: string; frequency: string | null; timing: string | null; startDate: string | null; endDate: string | null; instructions: string | null }) => (
                            <li
                              key={med.id}
                              className="rounded-inner border border-[color:var(--color-border)] bg-surface-1 p-4"
                            >
                              <div className="flex flex-wrap items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-semibold text-text">
                                    {med.name}
                                  </h3>
                                  <p className="mt-0.5 text-xs text-text-soft">
                                    {med.dosage}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {med.frequency ? (
                                  <Field
                                    label="Frequency"
                                    value={med.frequency}
                                  />
                                ) : null}
                                {med.timing ? (
                                  <Field label="Timing" value={med.timing} />
                                ) : null}
                                {med.startDate ? (
                                  <Field
                                    label="Start"
                                    value={formatDayLabel(med.startDate)}
                                  />
                                ) : null}
                                {med.endDate ? (
                                  <Field
                                    label="End"
                                    value={formatDayLabel(med.endDate)}
                                  />
                                ) : null}
                              </div>
                              {med.instructions ? (
                                <div className="mt-3 rounded-inner bg-surface-2 p-2.5">
                                  <p className="text-xs font-semibold text-text-muted">
                                    Instructions
                                  </p>
                                  <p className="mt-1 text-sm text-text">
                                    {med.instructions}
                                  </p>
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="flex flex-col gap-5 lg:col-span-4">
                  <Card accent="brand">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-text">
                        Add to your plan
                      </h3>
                      <p className="text-xs text-text-soft">
                        Tap to copy medicines into your daily medication plan.
                        Each medicine can be scheduled with reminders and
                        tracked for adherence.
                      </p>
                      <Link
                        href="/patient/medications"
                        className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
                      >
                        <Pill size={14} aria-hidden /> Open medications
                      </Link>
                    </div>
                  </Card>

                  <Card accent="sky">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-text">
                        Verifiable record
                      </h3>
                      <p className="text-xs text-text-soft">
                        Every prescription carries a unique signature that can
                        be verified by any pharmacy.
                      </p>
                      <Link
                        href={`/portal/verify/${rx.id}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-soft"
                      >
                        <FileText size={14} aria-hidden /> Verify prescription
                      </Link>
                    </div>
                  </Card>
                </div>
              </div>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="t-label">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

function statusTone(
  status: string
): "success" | "warn" | "danger" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "completed") return "info";
  if (status === "cancelled") return "danger";
  return "neutral";
}
