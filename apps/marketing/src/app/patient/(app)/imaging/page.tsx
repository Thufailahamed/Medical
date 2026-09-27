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
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";

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
      bg: "bg-violet-50 text-violet-600",
    };
  }
  if (m.includes("CT")) {
    return {
      label: "CT Scan",
      bg: "bg-brand-soft text-brand",
    };
  }
  if (m.includes("US")) {
    return {
      label: "Ultrasound",
      bg: "bg-success-soft text-success",
    };
  }
  return {
    label: "X-Ray (DICOM)",
    bg: "bg-warn-soft text-warn",
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
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<ScanLine size={13} />}
        kicker="Radiology & PACS Imaging"
        title="Medical Imaging & DICOM Scans"
        description="Access high-resolution X-rays, MRI, CT scans, and ultrasound studies in a medical-grade web DICOM viewer."
        actions={
          <>
            <Link href="/patient/records" className={heroSecondaryAction}>
              <FileText size={13} />
              <span>All Records</span>
            </Link>
            <Link href="/patient/diagnostic-tests" className={heroPrimaryAction}>
              <FlaskConical size={14} />
              <span>Book Diagnostic Test</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>{rawStudies.length} studies available</span>
            <span>Viewer standard · 16-bit lossless</span>
            <span>Modalities · XR, MR, CT, US</span>
            <span>Viewer engine · web DICOM ready</span>
          </>
        }
      />

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-xl shadow-card">
        {/* Modality Tabs */}
        <SegmentedTabs
          ariaLabel="Modality filters"
          activeId={activeModality}
          onChange={(id) => setActiveModality(id)}
          tabs={MODALITY_FILTERS.map((f) => ({ id: f.id, label: <>{f.label}</> }))}
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
            placeholder="Search by study UID, organ, or modality..."
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

      {/* ── 3. Imaging Studies Feed ────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {profile.isLoading || studiesQ.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredStudies.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 sm:p-10 shadow-card flex flex-col items-center text-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-soft text-brand shadow-2xs" aria-hidden>
              <ScanLine size={28} />
            </div>

            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                {search ? "No scans match your search" : "No Radiology Imaging Studies On File"}
              </h3>
              <p className="text-xs sm:text-sm text-text-soft mt-1 leading-relaxed">
                {search
                  ? `No DICOM studies found for "${search}". Try clearing search or choosing another modality.`
                  : "When your hospital or radiology diagnostic center uploads your X-Ray, CT, or MRI scans, they will appear here with an interactive web DICOM viewer."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
              <Link
                href="/patient/diagnostic-tests"
                className="pt-btn pt-btn-primary h-9 px-4 text-xs"
              >
                <FlaskConical size={14} aria-hidden />
                Book Diagnostic Scan
              </Link>
              <Link
                href="/patient/records"
                className="pt-btn pt-btn-secondary h-9 px-4 text-xs"
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
                  className="group rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-card hover:shadow-md hover:border-border-strong transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-soft text-brand shrink-0 shadow-2xs transition-transform group-hover:scale-105" aria-hidden>
                      <ScanLine size={22} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-text text-sm sm:text-base group-hover:text-brand transition-colors truncate">
                          {title}
                        </h3>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                            badge.bg,
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-xs text-text-soft font-medium">
                        <span className="font-mono text-[11px] text-text-muted truncate max-w-xs">
                          UID: {study.studyInstanceUid.slice(0, 28)}…
                        </span>
                        <span>·</span>
                        <span className="text-text-soft">
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
                            <span className="inline-flex items-center gap-1 text-text-muted">
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
                    className="pt-btn pt-btn-primary h-9 px-4 text-xs shrink-0 self-start sm:self-auto"
                  >
                    <Eye size={14} aria-hidden />
                    Open DICOM Viewer
                    <ChevronRight size={13} aria-hidden />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Web DICOM Features & Capability Callout ───────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col gap-3">
        <h4 className="t-card-title text-text flex items-center gap-2">
          <Sparkles size={16} className="text-brand" aria-hidden />
          <span>Diagnostic DICOM Viewer Capabilities</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-text-soft">
          <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col gap-1">
            <p className="font-bold text-text">Window &amp; Level</p>
            <p className="text-[11px] text-text-soft">
              Interactive brightness and contrast adjustment across soft tissue, lung, and bone presets.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col gap-1">
            <p className="font-bold text-text">Stack Navigation</p>
            <p className="text-[11px] text-text-soft">
              Smooth scroll through sequential CT and MRI volumetric slice stacks.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col gap-1">
            <p className="font-bold text-text">Measurement Tools</p>
            <p className="text-[11px] text-text-soft">
              Caliper measurements, angle calculations, and region-of-interest density inspection.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col gap-1">
            <p className="font-bold text-text">No Installation</p>
            <p className="text-[11px] text-text-soft">
              Runs client-side in your browser with zero plugins or special desktop software needed.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}