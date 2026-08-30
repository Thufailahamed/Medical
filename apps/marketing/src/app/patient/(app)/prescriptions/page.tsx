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
  Search,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";

import { usePrescriptions } from "@/patient/hooks/prescriptions";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { patientPaths } from "@healthcare/shared/contracts";
import { cn } from "@/portal/lib/utils";

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
    <div className="flex flex-col gap-5 pb-16">
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Ambient Glows */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <ShieldCheck size={12} className="text-sky-300" />
                Verified e-Prescriptions
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Medical Prescriptions &amp; Rx
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Doctor-certified prescriptions, administration instructions, dosage schedules, and official downloadable PDFs.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/appointments/book"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Stethoscope size={13} />
                <span>Consult Doctor</span>
              </Link>
              <Link
                href="/patient/medications"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <Pill size={14} className="text-sky-700" />
                <span>Dose Schedule</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "all"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Total Prescriptions
                </p>
                <p className="text-base font-extrabold text-white">
                  {rawPrescriptions.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "active"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Treatments
                </p>
                <p className="text-base font-extrabold text-white">
                  {activeList.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("past")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "past"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  History
                </p>
                <p className="text-base font-extrabold text-white">
                  {pastList.length}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Pill size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Prescribed Medicines
                </p>
                <p className="text-base font-extrabold text-white">
                  {totalMedicines}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Segmented Filter */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            All ({rawPrescriptions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "active"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Active ({activeList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("past")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "past"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            History ({pastList.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search diagnosis, doctor, or medicine..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="h-32 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                No prescriptions found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                {search
                  ? `No prescriptions match "${search}". Try another keyword or clear search.`
                  : "When your doctor prescribes medications or treatment courses, the official script will appear here."}
              </p>
            </div>
            <Link
              href="/patient/appointments/book"
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <Stethoscope size={14} />
              <span>Book Doctor Consultation</span>
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
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col gap-3.5"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 shadow-2xs group-hover:bg-sky-100/70 transition-colors">
                        <FileText size={18} />
                      </div>

                      <div className="min-w-0">
                        <Link
                          href={`/patient/prescriptions/${rx.id}`}
                          className="text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate block"
                        >
                          {rx.diagnosis || "Medical Prescription"}
                        </Link>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-slate-500 font-medium">
                          {rx.doctorName ? (
                            <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                              <Stethoscope size={12} className="text-sky-600" />
                              {rx.doctorName}
                              {rx.doctorSpecialization ? (
                                <span className="text-slate-400 font-normal">
                                  {" "}· {rx.doctorSpecialization}
                                </span>
                              ) : null}
                            </span>
                          ) : null}

                          <span>·</span>

                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Calendar size={12} className="text-slate-400" />
                            {formatDayLabel(rx.date)}
                          </span>

                          <span>·</span>

                          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <Pill size={12} className="text-emerald-600" />
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
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border",
                          isSigned
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                            : "bg-slate-100 text-slate-600 border-slate-200",
                        )}
                      >
                        <CheckCircle2 size={12} className={isSigned ? "text-emerald-600" : "text-slate-400"} />
                        <span>{isSigned ? "Doctor Signed" : humanize(rx.status)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Medicines List Section */}
                  {rx.medicines && rx.medicines.length > 0 ? (
                    <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100 flex flex-col gap-2">
                      <p className="text-[10.5px] uppercase font-bold tracking-wider text-slate-400">
                        Prescribed Medications
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {rx.medicines.map((med) => {
                          const freq = cleanScheduleString(med.frequency);
                          const timing = cleanScheduleString(med.timing);

                          return (
                            <div
                              key={med.id}
                              className="bg-white rounded-lg p-2.5 border border-slate-200/80 flex items-start gap-2.5 shadow-2xs"
                            >
                              <div className="h-7 w-7 rounded-md bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                                <Pill size={14} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="text-xs font-bold text-slate-900 truncate">
                                    {med.name}
                                  </h4>
                                  <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded">
                                    {med.dosage}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-500 font-medium">
                                  {freq ? <span>{freq}</span> : null}
                                  {freq && timing ? <span>·</span> : null}
                                  {timing ? <span className="text-slate-600">{timing}</span> : null}
                                </div>

                                {med.instructions ? (
                                  <p className="text-[10.5px] text-slate-400 italic mt-0.5 truncate">
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
                    <p className="text-xs text-slate-600 bg-blue-50/50 border border-blue-100 rounded-lg p-2.5 italic">
                      <span className="font-semibold text-blue-900 not-italic mr-1">
                        Doctor&apos;s Advice:
                      </span>
                      {rx.notes}
                    </p>
                  ) : null}

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadPdf(rx.id)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-sky-700" />
                            <span>Generating PDF…</span>
                          </>
                        ) : (
                          <>
                            <Download size={13} />
                            <span>Download Official PDF</span>
                          </>
                        )}
                      </button>

                      <Link
                        href="/patient/medications"
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors hidden sm:inline"
                      >
                        Track in Medications
                      </Link>
                    </div>

                    <Link
                      href={`/patient/prescriptions/${rx.id}`}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1"
                    >
                      <span>Full Details</span>
                      <ChevronRight size={13} />
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
