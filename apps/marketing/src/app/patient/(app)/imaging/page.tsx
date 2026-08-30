"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronRight,
  Eye,
  FileText,
  FlaskConical,
  Layers,
  Maximize2,
  Scan,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface ImagingInstance {
  sopInstanceUid: string;
  fileId: string;
  fileName: string;
  fileSize: number;
}

interface ImagingSeries {
  seriesInstanceUid: string;
  modality: string;
  bodyPart: string;
  seriesDescription?: string;
  instances: ImagingInstance[];
}

interface ImagingStudy {
  studyInstanceUid: string;
  patientId: string;
  studyDate?: string;
  studyDescription?: string;
  series: ImagingSeries[];
  modality?: string;
  bodyPart?: string;
}

const MODALITY_FILTERS = [
  { id: "all", label: "All Scans" },
  { id: "xr", label: "X-Ray", codes: ["XR", "CR", "DX"] },
  { id: "mr", label: "MRI", codes: ["MR"] },
  { id: "ct", label: "CT Scan", codes: ["CT"] },
  { id: "us", label: "Ultrasound", codes: ["US"] },
];

function getModalityBadge(modality?: string) {
  const m = (modality || "XR").toUpperCase();
  if (m.includes("MR")) {
    return {
      label: "MRI Scan",
      bg: "bg-purple-50 text-purple-700 border-purple-200/80",
    };
  }
  if (m.includes("CT")) {
    return {
      label: "CT Scan",
      bg: "bg-sky-50 text-sky-700 border-sky-200/80",
    };
  }
  if (m.includes("US")) {
    return {
      label: "Ultrasound",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    };
  }
  return {
    label: "X-Ray (DICOM)",
    bg: "bg-amber-50 text-amber-800 border-amber-200/80",
  };
}

export default function PatientImagingPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";

  const [activeModality, setActiveModality] = useState("all");
  const [search, setSearch] = useState("");

  const studiesQ = useQuery({
    queryKey: ["patient", "imaging", "studies", patientId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (patientId) searchParams.set("patientId", patientId);
      const res = await api<{ studies: ImagingStudy[] }>(
        `/imaging/studies?${searchParams.toString()}`,
      );
      return res.studies ?? [];
    },
    enabled: Boolean(patientId),
  });

  const rawStudies = studiesQ.data ?? [];

  const filteredStudies = useMemo(() => {
    let list = rawStudies;

    if (activeModality !== "all") {
      const filterDef = MODALITY_FILTERS.find((f) => f.id === activeModality);
      if (filterDef?.codes) {
        list = list.filter((s) => {
          const mod = (s.modality || s.series?.[0]?.modality || "").toUpperCase();
          return filterDef.codes.some((c) => mod.includes(c));
        });
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.studyInstanceUid.toLowerCase().includes(q) ||
          (s.studyDescription || "").toLowerCase().includes(q) ||
          (s.bodyPart || s.series?.[0]?.bodyPart || "").toLowerCase().includes(q) ||
          (s.modality || s.series?.[0]?.modality || "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [rawStudies, activeModality, search]);

  return (
    <div className="flex flex-col gap-6 pb-16">
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
        {/* Glow Orbs */}
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
                <ScanLine size={12} className="text-sky-300" />
                Radiology &amp; PACS Imaging
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Medical Imaging &amp; DICOM Scans
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Access high-resolution X-rays, MRI, CT scans, and ultrasound studies in a medical-grade web DICOM viewer.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/records"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <FileText size={13} />
                <span>All Records</span>
              </Link>
              <Link
                href="/patient/diagnostic-tests"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <FlaskConical size={14} className="text-sky-700" />
                <span>Book Diagnostic Test</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <Scan size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Available Scans
                </p>
                <p className="text-base font-extrabold text-white">
                  {rawStudies.length} Studies
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Maximize2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Viewer Standard
                </p>
                <p className="text-base font-extrabold text-white">16-Bit Lossless</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Layers size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Supported Modalities
                </p>
                <p className="text-base font-extrabold text-white">XR, MR, CT, US</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Viewer Engine
                </p>
                <p className="text-base font-extrabold text-white">Web DICOM Ready</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Modality Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 overflow-x-auto scrollbar-none">
          {MODALITY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveModality(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
                activeModality === f.id
                  ? "bg-white text-sky-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {f.label}
            </button>
          ))}
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
            placeholder="Search by study UID, organ, or modality..."
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

      {/* ── 3. Imaging Studies Feed ────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {profile.isLoading || studiesQ.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredStudies.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-10 shadow-xs flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-2xs">
              <ScanLine size={28} />
            </div>

            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                {search ? "No scans match your search" : "No Radiology Imaging Studies On File"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                {search
                  ? `No DICOM studies found for "${search}". Try clearing search or choosing another modality.`
                  : "When your hospital or radiology diagnostic center uploads your X-Ray, CT, or MRI scans, they will appear here with an interactive web DICOM viewer."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
              <Link
                href="/patient/diagnostic-tests"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <FlaskConical size={14} />
                <span>Book Diagnostic Scan</span>
              </Link>
              <Link
                href="/patient/records"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                View General Records
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredStudies.map((study) => {
              const modality = study.modality || study.series?.[0]?.modality || "XR";
              const badge = getModalityBadge(modality);
              const totalInstances = (study.series || []).reduce(
                (acc, s) => acc + (s.instances?.length || 0),
                0,
              );
              const bodyPart = study.bodyPart || study.series?.[0]?.bodyPart || "General Anatomy";
              const title = study.studyDescription || `${badge.label} · ${bodyPart}`;

              return (
                <article
                  key={study.studyInstanceUid}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="h-12 w-12 rounded-2xl bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      <ScanLine size={22} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-sky-700 transition-colors truncate">
                          {title}
                        </h3>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                            badge.bg,
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-xs text-slate-500 font-medium">
                        <span className="font-mono text-[11px] text-slate-400 truncate max-w-xs">
                          UID: {study.studyInstanceUid.slice(0, 28)}…
                        </span>
                        <span>·</span>
                        <span className="text-slate-600">
                          {study.series?.length || 1} Series
                        </span>
                        {totalInstances > 0 ? (
                          <>
                            <span>·</span>
                            <span>{totalInstances} Image Slices</span>
                          </>
                        ) : null}
                        {study.studyDate ? (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Calendar size={11} />
                              {formatDate(study.studyDate)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Open Viewer CTA Button */}
                  <Link
                    href={`/patient/imaging/${encodeURIComponent(study.studyInstanceUid)}`}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all shrink-0 self-start sm:self-auto"
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    }}
                  >
                    <Eye size={14} />
                    <span>Open DICOM Viewer</span>
                    <ChevronRight size={13} />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Web DICOM Features & Capability Callout ───────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col gap-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sparkles size={16} className="text-sky-600" />
          <span>Diagnostic DICOM Viewer Capabilities</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
            <p className="font-bold text-slate-800">Window &amp; Level</p>
            <p className="text-[11px] text-slate-500">
              Interactive brightness and contrast adjustment across soft tissue, lung, and bone presets.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
            <p className="font-bold text-slate-800">Stack Navigation</p>
            <p className="text-[11px] text-slate-500">
              Smooth scroll through sequential CT and MRI volumetric slice stacks.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
            <p className="font-bold text-slate-800">Measurement Tools</p>
            <p className="text-[11px] text-slate-500">
              Caliper measurements, angle calculations, and region-of-interest density inspection.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
            <p className="font-bold text-slate-800">No Installation</p>
            <p className="text-[11px] text-slate-500">
              Runs client-side in your browser with zero plugins or special desktop software needed.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}