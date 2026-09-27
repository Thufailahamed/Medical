"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Pill,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";

import { usePrescriptions } from "@/patient/hooks/prescriptions";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { patientPaths } from "@healthcare/shared/contracts";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";

function cleanScheduleString(val: string | null | undefined): string {
  if (!val) return "";
  const cleaned = val.replace(/_/g, " ").trim();
  if (cleaned.toLowerCase() === "three times daily") return "3 times daily";
  if (cleaned.toLowerCase() === "twice daily") return "2 times daily";
  if (cleaned.toLowerCase() === "once daily") return "Once daily";
  if (cleaned.toLowerCase() === "as needed") return "As needed (PRN)";
  if (cleaned.toLowerCase() === "after food") return "After meals";
  if (cleaned.toLowerCase() === "before food") return "Before meals";
  return humanize(cleaned);
}

export default function PrescriptionsPage() {
  const query = usePrescriptions();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "past">("all");
  const [search, setSearch] = useState("");

  const rawPrescriptions = query.data?.prescriptions ?? [];

  const { activeList, pastList, totalMedicines } = useMemo(() => {
    const active = rawPrescriptions.filter(
      (p) => p.status === "active" || p.status === "draft"
    );
    const past = rawPrescriptions.filter((p) => p.status !== "active" && p.status !== "draft");
    const medCount = rawPrescriptions.reduce(
      (acc, p) => acc + (p.medicineCount || p.medicines?.length || 0),
      0
    );
    return { activeList: active, pastList: past, totalMedicines: medCount };
  }, [rawPrescriptions]);

  const filteredPrescriptions = useMemo(() => {
    let list = rawPrescriptions;
    if (activeTab === "active") list = activeList;
    if (activeTab === "past") list = pastList;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.diagnosis || "").toLowerCase().includes(q) ||
          (p.doctorName || "").toLowerCase().includes(q) ||
          (p.doctorSpecialization || "").toLowerCase().includes(q) ||
          p.medicines?.some((m) => m.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rawPrescriptions, activeTab, activeList, pastList, search]);

  async function downloadPdf(id: string) {
    setDownloading(id);
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
      setDownloading(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<ShieldCheck size={13} />}
        kicker="Verified e-Prescriptions · Secure patient record"
        title="Medical Prescriptions & Rx"
        description="A single, trusted place for signed prescriptions, dosage guidance, and official clinical documents."
        actions={
          <>
            <Link href="/patient/appointments/book" className={heroSecondaryAction}>
              <Stethoscope size={13} />
              <span>Consult Doctor</span>
            </Link>
            <Link href="/patient/medications" className={heroPrimaryAction}>
              <Pill size={14} />
              <span>Dose Schedule</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>{rawPrescriptions.length} total prescriptions</span>
            <span>{activeList.length} active treatments</span>
            <span>{pastList.length} in history</span>
            <span>{totalMedicines} prescribed medicines</span>
          </>
        }
      />

      {/* ── 2. Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-xl shadow-card">
        {/* Segmented Filter */}
        <SegmentedTabs
          ariaLabel="Prescription filters"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as "all" | "active" | "past")}
          tabs={[
            { id: "all", label: <>All ({rawPrescriptions.length})</> },
            { id: "active", label: <>Active ({activeList.length})</> },
            { id: "past", label: <>History ({pastList.length})</> },
          ]}
        />

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search diagnosis, doctor, or medicine..."
            className="pt-input pl-9 pr-8 !h-9 text-xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-soft"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 3. Prescriptions List ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {query.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl patient-shimmer"
              />
            ))}
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="rounded-xl border-border bg-surface p-10 text-center flex flex-col items-center gap-3 shadow-card">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-soft text-brand" aria-hidden>
              <FileText size={24} />
            </div>
            <div>
              <h3 className="t-card-title text-text">
                No prescriptions found
              </h3>
              <p className="text-xs text-text-soft max-w-sm mt-0.5">
                {search
                  ? `No prescriptions match "${search}". Try another keyword or clear search.`
                  : "When your doctor prescribes medications or treatment courses, the official script will appear here."}
              </p>
            </div>
            <Link
              href="/patient/appointments/book"
              className="pt-btn pt-btn-primary mt-1 h-9 px-4 text-xs"
            >
              <Stethoscope size={14} aria-hidden />
              Book Doctor Consultation
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredPrescriptions.map((rx) => {
              const isDownloading = downloading === rx.id;
              const isSigned = rx.status === "active" || Boolean(rx.signedAt);

              return (
                <article
                  key={rx.id}
                  className="group patient-card p-4 sm:p-5 hover:shadow-md transition-all flex flex-col gap-3.5"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-soft text-brand shrink-0 shadow-2xs transition-transform group-hover:scale-105" aria-hidden>
                        <FileText size={18} />
                      </div>

                      <div className="min-w-0">
                        <Link
                          href={`/patient/prescriptions/${rx.id}`}
                          className="t-card-title text-text group-hover:text-brand transition-colors truncate block"
                        >
                          {rx.diagnosis || "Medical Prescription"}
                        </Link>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-text-soft font-medium">
                          {rx.doctorName ? (
                            <span className="inline-flex items-center gap-1 text-text font-semibold">
                              <Stethoscope size={12} className="text-brand" aria-hidden />
                              {rx.doctorName}
                              {rx.doctorSpecialization ? (
                                <span className="text-text-muted font-normal">
                                  {" "}· {rx.doctorSpecialization}
                                </span>
                              ) : null}
                            </span>
                          ) : null}

                          <span>·</span>

                          <span className="inline-flex items-center gap-1 text-text-soft">
                            <Calendar size={12} className="text-text-muted" />
                            {formatDayLabel(rx.date)}
                          </span>

                          <span>·</span>

                          <span className="inline-flex items-center gap-1 text-text-soft font-medium">
                            <Pill size={12} className="text-success" aria-hidden />
                            {rx.medicineCount || rx.medicines?.length || 0} medicine
                            {(rx.medicineCount || rx.medicines?.length || 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold",
                          isSigned
                            ? "bg-success-soft text-success"
                            : "bg-surface-2 text-text-soft",
                        )}
                      >
                        <CheckCircle2 size={12} className={isSigned ? "text-success" : "text-text-muted"} aria-hidden />
                        <span>{isSigned ? "Doctor Signed" : humanize(rx.status)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Medicines List Section */}
                  {rx.medicines && rx.medicines.length > 0 ? (
                    <div className="bg-surface-2/70 rounded-xl p-3 border border-border flex flex-col gap-2">
                      <p className="text-[10.5px] uppercase font-bold tracking-wider text-text-muted">
                        Prescribed Medications
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {rx.medicines.map((med) => {
                          const freq = cleanScheduleString(med.frequency);
                          const timing = cleanScheduleString(med.timing);

                          return (
                            <div
                              key={med.id}
                              className="bg-surface rounded-lg p-2.5 border-border flex items-start gap-2.5 shadow-2xs"
                            >
                              <div className="grid h-7 w-7 place-items-center rounded-md bg-brand-soft text-brand shrink-0 mt-0.5" aria-hidden>
                                <Pill size={14} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="text-xs font-bold text-text truncate">
                                    {med.name}
                                  </h4>
                                  <span className="text-[11px] font-bold text-brand bg-brand-soft px-1.5 py-0.2 rounded">
                                    {med.dosage}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-text-soft font-medium">
                                  {freq ? <span>{freq}</span> : null}
                                  {freq && timing ? <span>·</span> : null}
                                  {timing ? <span className="text-text-soft">{timing}</span> : null}
                                </div>

                                {med.instructions ? (
                                  <p className="text-[10.5px] text-text-muted italic mt-0.5 truncate">
                                    {med.instructions}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Doctor's General Notes */}
                  {rx.notes ? (
                    <p className="text-xs text-text-soft bg-brand-soft/40 border border-brand/20 rounded-lg p-2.5 italic">
                      <span className="font-semibold text-brand not-italic mr-1">
                        Doctor&apos;s Advice:
                      </span>
                      {rx.notes}
                    </p>
                  ) : null}

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadPdf(rx.id)}
                        disabled={isDownloading}
                        className="pt-btn pt-btn-secondary h-8 px-3.5 text-xs disabled:opacity-60"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 size={13} className="animate-spin" aria-hidden />
                            Generating PDF…
                          </>
                        ) : (
                          <>
                            <Download size={13} aria-hidden />
                            Download Official PDF
                          </>
                        )}
                      </button>

                      <Link
                        href="/patient/medications"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-soft hover:bg-surface-2 transition-colors hidden sm:inline"
                      >
                        Track in Medications
                      </Link>
                    </div>

                    <Link
                      href={`/patient/prescriptions/${rx.id}`}
                      className="pt-btn pt-btn-secondary h-8 px-3.5 text-xs"
                    >
                      Full Details
                      <ChevronRight size={13} aria-hidden />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
