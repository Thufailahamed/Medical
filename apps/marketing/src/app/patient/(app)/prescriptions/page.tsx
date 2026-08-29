"use client";

import Link from "next/link";
import { Pill, FileText, Calendar, Stethoscope, Download } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { usePrescriptions } from "@/patient/hooks/prescriptions";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { api } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";
import { useState } from "react";

export default function PrescriptionsPage() {
  const query = usePrescriptions();
  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadPdf(id: string) {
    setDownloading(id);
    try {
      // Get a download URL and open in new tab
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
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Treatments"
        title="Prescriptions"
        description="Active and past prescriptions from your care team, with linked medicines and dosage guidance."
      />

      <Card>
        <QueryBoundary
          query={query}
          loadingCount={4}
          emptyTitle="No prescriptions yet"
          emptyDescription="When your doctor issues a prescription, it will appear here with full medicine details."
        >
          {(data) => {
            const list = data?.prescriptions ?? [];
            if (list.length === 0) {
              return (
                <p className="text-sm text-text-soft">No prescriptions yet</p>
              );
            }

            const active = list.filter((p) => p.status === "active");
            const past = list.filter((p) => p.status !== "active");

            return (
              <div className="flex flex-col gap-6">
                {active.length > 0 ? (
                  <section>
                    <p className="t-label">Active</p>
                    <ul className="mt-3 flex flex-col gap-3">
                      {active.map((rx) => (
                        <PrescriptionCard
                          key={rx.id}
                          rx={rx}
                          onDownload={() => downloadPdf(rx.id)}
                          downloading={downloading === rx.id}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}

                {past.length > 0 ? (
                  <section>
                    <p className="t-label">History</p>
                    <ul className="mt-3 flex flex-col gap-3">
                      {past.map((rx) => (
                        <PrescriptionCard
                          key={rx.id}
                          rx={rx}
                          onDownload={() => downloadPdf(rx.id)}
                          downloading={downloading === rx.id}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}

function PrescriptionCard({
  rx,
  onDownload,
  downloading,
}: {
  rx: import("@healthcare/shared/contracts").PrescriptionRow;
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <li
      className="rounded-inner border border-[color:var(--color-border)] bg-surface-1 p-4 transition-colors hover:bg-surface-2"
    >
      <Link
        href={`/patient/prescriptions/${rx.id}`}
        className="flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="flex-1 text-sm font-semibold text-text">
            {rx.diagnosis || "Prescription"}
          </h3>
          <StatusPill tone={statusTone(rx.status)}>{humanize(rx.status)}</StatusPill>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-soft">
          {rx.doctorName ? (
            <span className="inline-flex items-center gap-1">
              <Stethoscope size={11} aria-hidden />
              {rx.doctorName}
              {rx.doctorSpecialization ? ` · ${rx.doctorSpecialization}` : ""}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} aria-hidden />
            {formatDayLabel(rx.date)}
          </span>
          {rx.medicineCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Pill size={11} aria-hidden />
              {rx.medicineCount} medicine
              {rx.medicineCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </Link>
      {rx.medicines.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-surface-3 pt-3">
          {rx.medicines.slice(0, 3).map((med) => (
            <li
              key={med.id}
              className="flex items-center gap-2 text-xs text-text-soft"
            >
              <Pill size={11} aria-hidden className="shrink-0 text-text-muted" />
              <span className="font-semibold text-text">{med.name}</span>
              <span>· {med.dosage}</span>
              {med.frequency ? <span>· {med.frequency}</span> : null}
            </li>
          ))}
          {rx.medicines.length > 3 ? (
            <li className="text-xs text-text-muted">
              +{rx.medicines.length - 3} more
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-surface-3 pt-3">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onDownload();
          }}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand disabled:opacity-60"
        >
          <Download size={12} aria-hidden />
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>
    </li>
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
