"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
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
  Users,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  ROW_LINK,
  RowAccent,
  SECONDARY_BTN,
  StatTile,
} from "@/portal/components/doctor/Workspace";
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

/** Icon tile + rail colours per record type. */
const TYPE_TILE: Record<string, string> = {
  clinical_note: "bg-amber-50 text-amber-600",
  prescription: "bg-emerald-50 text-emerald-600",
  lab_report: "bg-violet-50 text-violet-600",
  vaccination: "bg-teal-50 text-teal-600",
  imaging: "bg-indigo-50 text-indigo-600",
  discharge_summary: "bg-rose-50 text-rose-600",
  consultation: "bg-sky-50 text-sky-600",
};

const TYPE_ACCENT: Record<string, string> = {
  clinical_note: "bg-amber-400",
  prescription: "bg-emerald-500",
  lab_report: "bg-violet-500",
  vaccination: "bg-teal-500",
  imaging: "bg-indigo-500",
  discharge_summary: "bg-rose-500",
  consultation: "bg-sky-500",
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

  const typeBreakdown = useMemo(
    () =>
      uniqueTypes
        .map((type) => ({ type, count: allRecords.filter((r) => typeOf(r) === type).length }))
        .sort((a, b) => b.count - a.count),
    [uniqueTypes, allRecords],
  );
  const patientCount = useMemo(
    () => new Set(allRecords.map((r) => r.patient?.id ?? r.patientId).filter(Boolean)).size,
    [allRecords],
  );
  const filtersOn = search.trim() !== "" || typeFilter !== "all";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Layers size={13} aria-hidden />}
          kicker="Longitudinal EMR"
          kickerMeta={`${patientCount} chart${patientCount === 1 ? "" : "s"}`}
          title={
            <>
              Health{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                records
              </span>
            </>
          }
          description="Every note, lab report, prescription, vaccination and imaging study across your patients' charts — in one searchable archive."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                FHIR R4 &amp; HL7
              </span>
              <span className={HERO_CHIP}>
                <Layers size={12} className="text-sky-300" aria-hidden />
                {uniqueTypes.length} record type{uniqueTypes.length === 1 ? "" : "s"}
              </span>
            </>
          }
          actions={
            <>
              <Link href="/portal/imaging" className={HERO_GHOST}>
                <ScanLine size={15} aria-hidden />
                Imaging
              </Link>
              <Link href="/portal/patients" className={HERO_PRIMARY}>
                <Users size={15} className="text-sky-600" aria-hidden />
                Open a chart
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="All records"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(totalCount)}
            sub={`${patientCount} patient${patientCount === 1 ? "" : "s"}`}
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
          />
          <StatTile
            label="Prescriptions"
            icon={<PillIcon size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(rxCount)}
            sub="Issued e-prescriptions"
            active={typeFilter === "prescription"}
            onClick={() => setTypeFilter("prescription")}
          />
          <StatTile
            label="Lab reports"
            icon={<FlaskConical size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(labCount)}
            sub="Biomarkers & pathology"
            active={typeFilter === "lab_report"}
            onClick={() => setTypeFilter("lab_report")}
          />
          <StatTile
            label="Clinical notes"
            icon={<Stethoscope size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(notesCount)}
            sub={vaccineCount > 0 ? `+ ${vaccineCount} vaccination${vaccineCount === 1 ? "" : "s"}` : "SOAP encounter logs"}
            active={typeFilter === "clinical_note"}
            onClick={() => setTypeFilter("clinical_note")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Archive ──────────────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="rec-archive">
          <PanelHeader
            id="rec-archive"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={typeFilter === "all" ? "Record archive" : humanizeRecordType(typeFilter)}
            caption={
              isLoading
                ? "Loading records…"
                : `${filtered.length} of ${totalCount} shown${search ? ` · matching “${search}”` : ""}`
            }
            action={
              filtersOn ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={12} />
                  Reset
                </button>
              ) : undefined
            }
          />

          <PanelSearch
            className="mt-5 lg:max-w-none"
            value={search}
            onChange={setSearch}
            placeholder="Search title, patient, type or tags…"
            ariaLabel="Search records"
          />

          {isLoading ? (
            <div className="mt-5 space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyBlock
              icon={<FileText size={19} />}
              title={filtersOn ? "No matching records" : "No records yet"}
              body={
                filtersOn
                  ? "Nothing matches these filters. Try another keyword or record type."
                  : "Documents appear here as you write notes, issue prescriptions, order labs or receive imaging."
              }
              actions={
                filtersOn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                    }}
                    className={SECONDARY_BTN}
                  >
                    Reset filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filtered.map((record) => {
                const patientId = record.patient?.id ?? record.patientId;
                const type = typeOf(record);
                const config = TYPE_CONFIG[type] ?? {
                  label: humanizeRecordType(type),
                  tone: "neutral" as const,
                  icon: FileText,
                };
                const TypeIcon = config.icon;
                const href = patientId ? `/portal/patients/${patientId}/records` : null;

                const main = (
                  <>
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                        TYPE_TILE[type] ?? "bg-slate-100 text-slate-600",
                      )}
                    >
                      <TypeIcon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                          {record.title}
                        </span>
                        <Pill tone={config.tone}>{config.label}</Pill>
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        {record.patient?.name ? (
                          <span className="font-medium text-slate-600">{record.patient.name}</span>
                        ) : null}
                        {record.date ? (
                          <>
                            {record.patient?.name ? <span className="text-slate-300">·</span> : null}
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Calendar size={11} />
                              {formatDate(record.date)}
                            </span>
                          </>
                        ) : null}
                        {record.tags?.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500"
                          >
                            <Tag size={9} />
                            {tag}
                          </span>
                        ))}
                        {record.tags && record.tags.length > 3 ? (
                          <span className="text-[10.5px] font-semibold text-slate-400">+{record.tags.length - 3}</span>
                        ) : null}
                      </div>
                    </div>
                  </>
                );

                return (
                  <li key={record.id} className={LIST_ROW}>
                    <RowAccent className={TYPE_ACCENT[type]} />
                    {href ? (
                      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5">
                        {main}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5">{main}</div>
                    )}
                    <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                      {type === "imaging" && record.patient?.id ? (
                        <Link
                          href={`/portal/imaging?patientId=${record.patient.id}`}
                          aria-label={t("imaging.openViewer")}
                          title={t("imaging.openViewer")}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                        >
                          <ScanLine size={13} />
                          PACS
                        </Link>
                      ) : null}
                      {href ? (
                        <Link href={href} className={ROW_LINK}>
                          View
                          <ChevronRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Record mix ───────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Record breakdown">
          <section className={PANEL} aria-labelledby="rec-mix">
            <PanelHeader
              id="rec-mix"
              icon={<Layers size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Record mix"
              caption="Filter the archive by type"
            />

            {totalCount > 0 ? (
              <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                {typeBreakdown.map(({ type, count }) => (
                  <span
                    key={type}
                    className={cn("h-full", TYPE_ACCENT[type] ?? "bg-slate-300")}
                    style={{ width: `${(count / totalCount) * 100}%` }}
                  />
                ))}
              </div>
            ) : null}

            <ul className="mt-4 flex flex-col gap-0.5">
              <li>
                <MixRow
                  label="All types"
                  count={totalCount}
                  pct={100}
                  dot="bg-slate-900"
                  active={typeFilter === "all"}
                  onClick={() => setTypeFilter("all")}
                />
              </li>
              {typeBreakdown.map(({ type, count }) => (
                <li key={type}>
                  <MixRow
                    label={humanizeRecordType(type)}
                    count={count}
                    pct={totalCount > 0 ? Math.round((count / totalCount) * 100) : 0}
                    dot={TYPE_ACCENT[type] ?? "bg-slate-300"}
                    active={typeFilter === type}
                    onClick={() => setTypeFilter(type)}
                  />
                </li>
              ))}
            </ul>
            {isLoading ? <div className="mt-2 h-24 animate-pulse rounded-xl bg-slate-100" /> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function MixRow({
  label,
  count,
  pct,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  pct: number;
  dot: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
        active ? "bg-sky-50" : "hover:bg-slate-50",
      )}
    >
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} aria-hidden />
      <span className={cn("min-w-0 flex-1 truncate text-[13px]", active ? "font-semibold text-sky-800" : "font-medium text-slate-700")}>
        {label}
      </span>
      <span className="text-[11px] tabular-nums text-slate-400">{pct}%</span>
      <span
        className={cn(
          "min-w-[28px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
          active ? "bg-white text-sky-700" : "bg-slate-100 text-slate-600",
        )}
      >
        {count}
      </span>
    </button>
  );
}
