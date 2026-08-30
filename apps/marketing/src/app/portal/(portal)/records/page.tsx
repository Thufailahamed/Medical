"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search,
  FileText,
  Calendar,
  ChevronRight,
  Tag,
  ScanLine,
  X,
  Stethoscope,
  Pill as PillIcon,
  FlaskConical,
  Syringe,
  ShieldCheck,
  Activity,
  Layers,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { ChartEmpty } from "@/portal/components/chart/ChartEmpty";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface MedicalRecord {
  id: string;
  patientId: string;
  title: string;
  kind: string;
  recordType?: string | null;
  date: string | null;
  tags: string[] | null;
  createdAt: string;
  patient: { id: string; name: string } | null;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; tone: "info" | "success" | "warn" | "violet" | "neutral"; icon: typeof FileText }
> = {
  clinical_note: { label: "Clinical Note", tone: "violet", icon: Stethoscope },
  prescription: { label: "Prescription", tone: "success", icon: PillIcon },
  lab_report: { label: "Lab Report", tone: "info", icon: FlaskConical },
  vaccination: { label: "Vaccination", tone: "warn", icon: Syringe },
  imaging: { label: "Imaging Study", tone: "warn", icon: ScanLine },
  discharge_summary: { label: "Discharge Summary", tone: "violet", icon: FileText },
  consultation: { label: "Consultation", tone: "neutral", icon: Activity },
  other: { label: "Other Record", tone: "neutral", icon: FileText },
};

function humanizeRecordType(type: string): string {
  if (TYPE_CONFIG[type]) return TYPE_CONFIG[type].label;
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RecordsPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "records"],
    queryFn: () =>
      api<{ records: MedicalRecord[]; total: number }>(
        "/doctor-portal/records?limit=200"
      ),
  });

  const allRecords = data?.records ?? [];
  const typeOf = (r: MedicalRecord) => r.kind || r.recordType || "other";

  // Telemetry status counters
  const totalCount = allRecords.length;
  const labCount = useMemo(
    () => allRecords.filter((r) => typeOf(r) === "lab_report").length,
    [allRecords]
  );
  const rxCount = useMemo(
    () => allRecords.filter((r) => typeOf(r) === "prescription").length,
    [allRecords]
  );
  const notesCount = useMemo(
    () => allRecords.filter((r) => typeOf(r) === "clinical_note").length,
    [allRecords]
  );
  const vaccineCount = useMemo(
    () => allRecords.filter((r) => typeOf(r) === "vaccination").length,
    [allRecords]
  );

  // Available unique types
  const uniqueTypes = useMemo(() => {
    const set = new Set(allRecords.map(typeOf));
    return Array.from(set);
  }, [allRecords]);

  const filtered = allRecords.filter((record) => {
    const matchesSearch =
      !search.trim() ||
      [
        record.title,
        typeOf(record),
        humanizeRecordType(typeOf(record)),
        record.patient?.name,
        ...(record.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || typeOf(record) === typeFilter;

    return matchesSearch && matchesType;
  });

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
                Unified Longitudinal EMR
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-300/20 text-sky-100 border border-sky-300/30 flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>FHIR R4 & HL7 Compliant</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
              Electronic Health Records Repository
            </h1>
            <p className="text-sm text-sky-100/90 max-w-2xl mt-1 leading-relaxed">
              Search and review clinical progress notes, diagnostic laboratory reports, pharmacotherapy prescriptions, vaccinations, and imaging archives across all patient charts.
            </p>
          </div>
        </div>

        {/* 4 Telemetry Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Total Records</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{totalCount}</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">Clinical documents filed</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Prescriptions</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{rxCount}</span>
            <span className="text-[10.5px] text-emerald-200/80 mt-0.5">Issued e-prescriptions</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Diagnostic Labs</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{labCount}</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">Biomarkers & pathology</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Clinical Notes</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{notesCount}</span>
            <span className="text-[10.5px] text-amber-200/80 mt-0.5">SOAP encounter logs</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all flex-1 max-w-md">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records by title, patient, type, or tags…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <FilterPills<string>
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "All Types", count: totalCount },
            ...uniqueTypes.map((type) => ({
              value: type,
              label: humanizeRecordType(type),
              count: allRecords.filter((r) => typeOf(r) === type).length,
            })),
          ]}
        />
      </div>

      {/* ── Records Listing ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-5 flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <ChartEmpty
              icon={<FileText size={24} />}
              title="No medical records found"
              description={
                search || typeFilter !== "all"
                  ? `No records match "${search || typeFilter}". Try clearing your filters.`
                  : "No clinical documents have been uploaded to the EMR repository yet."
              }
              action={
                search || typeFilter !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
                  >
                    Reset Filters
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {filtered.map((record) => {
              const patientId = record.patient?.id ?? record.patientId;
              const type = typeOf(record);
              const config = TYPE_CONFIG[type] ?? {
                label: humanizeRecordType(type),
                tone: "neutral" as const,
                icon: FileText,
              };
              const TypeIcon = config.icon;

              const href = patientId
                ? `/portal/patients/${patientId}/records`
                : null;

              const rowContent = (
                <div className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-sky-50/40 transition-colors w-full">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border",
                        type === "prescription"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : type === "clinical_note"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : type === "lab_report"
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : type === "vaccination"
                          ? "bg-teal-50 text-teal-700 border-teal-200"
                          : type === "imaging"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      )}
                    >
                      <TypeIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-slate-900 truncate group-hover:text-sky-700 transition-colors">
                          {record.title}
                        </span>
                        <Pill tone={config.tone}>{config.label}</Pill>
                        {record.patient?.name && (
                          <span className="text-xs text-slate-500 font-semibold">
                            • {record.patient.name}
                          </span>
                        )}
                      </div>

                      {record.tags && record.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {record.tags.slice(0, 4).map((tag, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                            >
                              <Tag size={9} className="text-slate-400" />
                              {tag}
                            </span>
                          ))}
                          {record.tags.length > 4 && (
                            <span className="text-[10px] text-slate-400 font-bold">
                              +{record.tags.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {type === "imaging" && record.patient?.id ? (
                      <Link
                        href={`/portal/imaging?patientId=${record.patient.id}`}
                        aria-label={t("imaging.openViewer")}
                        title={t("imaging.openViewer")}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all flex items-center gap-1"
                      >
                        <ScanLine size={13} className="text-amber-600" />
                        <span>PACS</span>
                      </Link>
                    ) : null}

                    {record.date && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <Calendar size={13} />
                        <span className="text-xs font-medium tabular-nums text-slate-500">
                          {formatDate(record.date)}
                        </span>
                      </div>
                    )}

                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 group-hover:bg-sky-50 group-hover:text-sky-700 group-hover:border-sky-200 border border-slate-200 transition-all flex items-center gap-1">
                      <span>View Record</span>
                      <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              );

              return (
                <li key={record.id}>
                  {href ? (
                    <Link href={href} className="block w-full text-left cursor-pointer">
                      {rowContent}
                    </Link>
                  ) : (
                    <div>{rowContent}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
