"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ScanLine,
  Search,
  ShieldCheck,
  X,
  User,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Activity,
  Layers,
  Cpu,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { StudyList } from "@/portal/components/imaging/StudyList";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { usePatientHeader } from "@/portal/components/patient/PatientHeader";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";
import { ageFrom } from "@/portal/lib/format";

const MODALITIES = ["", "CT", "MR", "XR", "US", "PT"];
const DATE_RANGES = ["all", "7d", "30d", "90d", "1y"];

function dateFromRange(range: string): string | undefined {
  if (range === "all") return undefined;
  const days =
    range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function ImagingHubInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const patientId = params?.get("patientId") ?? "";
  const initialModality = params?.get("modality") ?? "";
  const initialFrom = params?.get("from") ?? "";
  const initialTo = params?.get("to") ?? "";
  const initialQ = params?.get("q") ?? "";

  const [modality, setModality] = useState(initialModality);
  const [dateRange, setDateRange] = useState(
    DATE_RANGES.find((r) => (r === "all" ? !initialFrom : true)) ?? "all"
  );
  const [q, setQ] = useState(initialQ);

  const computedFrom =
    initialFrom || (dateRange === "all" ? "" : dateFromRange(dateRange) ?? "");

  // Load patient header info if patientId is present
  const { data: patientData } = usePatientHeader(patientId);

  // Search mode kicks in when there's no patientId but the doctor has
  // typed a StudyInstanceUID pattern or a body part keyword.
  const isSearchMode = !patientId && q.trim().length > 0;

  const { data: accessiblePatients } = useQuery({
    queryKey: ["imaging", "landing-search", q],
    queryFn: () =>
      api<{ patients: Array<{ id: string; name: string }> }>(
        `/doctor/search-patients?q=${encodeURIComponent(q)}&limit=10`
      ),
    enabled: isSearchMode && q.trim().length >= 2,
  });

  // Recent patients for quick-selection on empty landing view
  const { data: recentPatientsData } = useQuery({
    queryKey: ["imaging", "recent-patients-quick"],
    queryFn: () =>
      api<{
        patients: Array<{
          patient: { id: string; nic?: string | null; dob?: string | null; sex?: string | null; photo?: string | null };
          user: { id: string; name: string };
        }>;
      }>("/doctor/search-patients?q=&limit=6"),
    enabled: !patientId && !isSearchMode,
  });

  const recentList = recentPatientsData?.patients ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Oceanic Hero Header ────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col gap-6"
        style={{
          background:
            "radial-gradient(134.49% 134.49% at 94.63% 0%, #0284C7 0%, #0369A1 42.6%, #075985 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/20">
                Diagnostic PACS & DICOM Imaging Hub
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-300/20 text-sky-100 border border-sky-300/30 flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>Cornerstone3D & DICOMweb Integrated</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
              Radiology & PACS Imaging Archive
            </h1>
            <p className="text-sm text-sky-100/90 max-w-2xl mt-1 leading-relaxed">
              Search across radiological studies, review multi-modality DICOM series (CT, MRI, X-Ray, Ultrasound), and launch cloud diagnostic imaging viewers.
            </p>
          </div>
        </div>

        {/* 4 Telemetry Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">PACS Engine</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1">Online & Active</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">WADO-RS / DICOMweb</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Modalities</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1">CT · MR · XR · US</span>
            <span className="text-[10.5px] text-amber-200/80 mt-0.5">Multi-planar MPR</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Renderer Core</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1">Cornerstone3D</span>
            <span className="text-[10.5px] text-emerald-200/80 mt-0.5">Hardware accelerated</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-teal-200 uppercase tracking-wider">Image Quality</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1">Lossless 16-bit</span>
            <span className="text-[10.5px] text-teal-200/80 mt-0.5">ISO 12052 Compliant</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by Study UID, patient, body part (e.g. Chest, Brain, Knee), or modality…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                router.replace("/portal/imaging");
              }}
              className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1.5">
              Modality:
            </span>
            {MODALITIES.map((m) => (
              <button
                key={m || "all"}
                type="button"
                onClick={() => setModality(m)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                  modality === m
                    ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100"
                )}
              >
                {m ? m : t("common.all")}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1.5">
              Timeframe:
            </span>
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                  dateRange === r
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100"
                )}
              >
                {t(`imaging.dateRange.${r}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Patient Active Context Banner ──────────────────────────────── */}
      {patientId && patientData && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <Avatar
              name={patientData.user?.name ?? "?"}
              src={patientData.patient?.photo ?? undefined}
              size="md"
              className="ring-2 ring-white shadow-2xs shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-slate-900">
                  {patientData.user?.name}
                </span>
                {patientData.patient?.sex && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                    {patientData.patient.sex}
                  </span>
                )}
                {patientData.patient?.dob && (
                  <span className="text-xs text-slate-500 font-medium">
                    {ageFrom(patientData.patient.dob)}
                  </span>
                )}
                {patientData.patient?.nic && (
                  <span className="text-xs text-slate-500 font-medium">
                    • NIC: {patientData.patient.nic}
                  </span>
                )}
              </div>
              <p className="text-xs text-sky-800 font-medium mt-0.5">
                Viewing filtered DICOM study series and radiological history for this patient.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => router.replace("/portal/imaging")}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              Clear / Switch Patient
            </button>
            <Link
              href={`/portal/patients/${patientId}/imaging`}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-white hover:bg-sky-50 border border-sky-200 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Patient Chart</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* ── Main Content Area ──────────────────────────────────────────── */}
      {patientId ? (
        <StudyList
          patientId={patientId}
          mode="patientChart"
          modality={modality || undefined}
          from={computedFrom || undefined}
          to={initialTo || undefined}
          q={q || undefined}
          detailHrefBase="/portal/imaging"
        />
      ) : isSearchMode ? (
        accessiblePatients?.patients?.length ? (
          <div className="flex flex-col gap-4">
            {accessiblePatients.patients.map((p) => (
              <div key={p.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                    <User size={13} className="text-sky-600" />
                    <span>{p.name}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => router.push(`/portal/imaging?patientId=${p.id}`)}
                    className="text-xs font-bold text-sky-700 hover:underline"
                  >
                    View All Studies →
                  </button>
                </div>
                <StudyList
                  patientId={p.id}
                  mode="patientChart"
                  modality={modality || undefined}
                  from={computedFrom || undefined}
                  to={initialTo || undefined}
                  q={q || undefined}
                  detailHrefBase="/portal/imaging"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-2xs">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-3">
              <ScanLine size={22} />
            </div>
            <h3 className="text-base font-bold text-slate-900">No DICOM studies found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No matching radiological studies found for "{q}". Try searching by patient name, modality, or body part.
            </p>
          </div>
        )
      ) : (
        /* Interactive Patient Selector & Quick Access Card */
        <div className="rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-10 shadow-2xs text-center flex flex-col items-center">
          <div className="h-16 w-16 rounded-3xl bg-sky-50 text-sky-600 border border-sky-200/80 shadow-xs flex items-center justify-center mb-4">
            <ScanLine size={28} />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Select a Patient to Inspect DICOM Studies
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mt-2 leading-relaxed">
            Choose a patient from your clinical panel to launch their imaging timeline, inspect multi-frame CT/MRI slices, and perform 3D volume rendering in Cornerstone3D.
          </p>

          {/* Embedded Patient Combobox */}
          <div className="w-full max-w-md mt-6 text-left">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Search & Select Patient
            </label>
            <PatientCombobox
              value={null}
              onChange={(p) => {
                if (p) {
                  router.push(`/portal/imaging?patientId=${p.id}`);
                }
              }}
            />
          </div>

          {/* Quick-Access Recent Patients */}
          {recentList.length > 0 && (
            <div className="w-full max-w-xl mt-8 pt-6 border-t border-slate-100 flex flex-col items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Quick Select Registered Patient:
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {recentList.map((item) => (
                  <button
                    key={item.patient.id}
                    type="button"
                    onClick={() => router.push(`/portal/imaging?patientId=${item.patient.id}`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200/80 text-xs font-bold text-slate-700 hover:text-sky-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Avatar name={item.user.name} size="xs" />
                    <span>{item.user.name}</span>
                    {item.patient.nic && (
                      <span className="text-[10.5px] text-slate-400 font-normal">
                        ({item.patient.nic})
                      </span>
                    )}
                    <ChevronRight size={12} className="text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImagingHubPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <ImagingHubInner />
    </Suspense>
  );
}