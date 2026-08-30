"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FilePlus2,
  FileText,
  FlaskConical,
  FolderInput,
  Pill as PillIcon,
  RotateCcw,
  ScanLine,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Syringe,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { Pill } from "@/patient/components/primitives/Pill";
import {
  useBulkArchiveRecords,
  useBulkDeleteRecords,
  useBulkMoveRecords,
  useBulkRestoreRecords,
  useBulkTagRecords,
  useFamilyMembers,
  useRecordSearch,
  useRecords,
  useRecordStats,
} from "@/patient/hooks";
import { formatDayLabel, formatRecordType } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

const KIND_CHIPS = [
  { id: "", label: "All Records" },
  { id: "clinical_note", label: "Visit Notes", icon: FileText },
  { id: "lab_report", label: "Lab Reports", icon: FlaskConical },
  { id: "prescription", label: "Prescriptions", icon: PillIcon },
  { id: "imaging", label: "Imaging & Scans", icon: ScanLine },
  { id: "vaccination", label: "Vaccinations", icon: Syringe },
  { id: "allergy", label: "Allergies", icon: Sparkles },
] as const;

type TimeFilter = "all" | "30d" | "year";
type SortMode = "newest" | "oldest";
type ArchiveFilter = "active" | "all" | "only";

function typeIcon(type: string | null | undefined) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab")) return <FlaskConical size={18} />;
  if (key.includes("prescription") || key.includes("medication"))
    return <PillIcon size={18} />;
  if (key.includes("imaging") || key.includes("scan"))
    return <ScanLine size={18} />;
  if (key.includes("vaccin")) return <Syringe size={18} />;
  return <FileText size={18} />;
}

function typeBadgeColor(type: string | null | undefined) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab"))
    return "bg-sky-50 text-sky-700 border-sky-200/70";
  if (key.includes("prescription") || key.includes("medication"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200/70";
  if (key.includes("imaging"))
    return "bg-violet-50 text-violet-700 border-violet-200/70";
  if (key.includes("vaccin") || key.includes("allergy"))
    return "bg-amber-50 text-amber-800 border-amber-200/70";
  return "bg-blue-50 text-blue-700 border-blue-200/70";
}

function typeIconBg(type: string | null | undefined) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab"))
    return "bg-sky-50 text-sky-600 border border-sky-100";
  if (key.includes("prescription") || key.includes("medication"))
    return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  if (key.includes("imaging"))
    return "bg-violet-50 text-violet-600 border border-violet-100";
  if (key.includes("vaccin") || key.includes("allergy"))
    return "bg-amber-50 text-amber-700 border border-amber-100";
  return "bg-blue-50 text-blue-600 border border-blue-100";
}

export default function RecordsListPage() {
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [kind, setKind] = useState(searchParams.get("type") ?? "");
  const [time, setTime] = useState<TimeFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [archived, setArchived] = useState<ArchiveFilter>("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [tagPrompt, setTagPrompt] = useState(false);
  const [tagValue, setTagValue] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);

  const family = useFamilyMembers();
  const bulkArchive = useBulkArchiveRecords();
  const bulkRestore = useBulkRestoreRecords();
  const bulkDelete = useBulkDeleteRecords();
  const bulkTag = useBulkTagRecords();
  const bulkMove = useBulkMoveRecords();

  useEffect(() => {
    if (searchParams.get("focus") === "search") {
      searchInputRef.current?.focus();
    }
  }, [searchParams]);

  const listParams = useMemo(() => {
    const params: {
      type?: string;
      search?: string;
      limit: number;
      sort: SortMode;
      archived?: "true" | "all" | "only";
    } = {
      limit: 100,
      sort,
      type: kind || undefined,
      search: search.trim().length >= 2 ? search.trim() : undefined,
    };
    if (archived === "all") params.archived = "all";
    else if (archived === "only") params.archived = "only";
    return params;
  }, [kind, search, sort, archived]);

  const query = useRecords(listParams);
  const fts = useRecordSearch(search, { limit: 50 });
  const stats = useRecordStats();

  const records = useMemo(() => {
    const base =
      search.trim().length >= 2 && fts.data?.records
        ? fts.data.records
        : (query.data?.records ?? []);
    if (time === "all") return base;
    const cutoff = new Date();
    if (time === "30d") cutoff.setDate(cutoff.getDate() - 30);
    else cutoff.setFullYear(cutoff.getFullYear() - 1);
    return base.filter((r) => {
      const d = r.date ? new Date(r.date) : null;
      return d ? d >= cutoff : true;
    });
  }, [query.data?.records, fts.data?.records, search, time]);

  const ids = Array.from(selected);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectMode(false);
    setTagPrompt(false);
    setMoveOpen(false);
    setBulkError(null);
  }

  async function runBulk(action: () => Promise<unknown>, label: string) {
    setBulkError(null);
    try {
      await action();
      clearSelection();
    } catch (cause) {
      setBulkError(
        cause instanceof Error ? cause.message : `Could not ${label}.`,
      );
    }
  }

  const statData = stats.data;
  const totalCount = statData?.total ?? records.length;
  const labCount = statData?.byType?.lab_report ?? statData?.byType?.LAB_REPORT ?? 0;
  const rxCount = statData?.byType?.prescription ?? statData?.byType?.PRESCRIPTION ?? 0;
  const notesCount = statData?.byType?.clinical_note ?? statData?.byType?.CLINICAL_NOTE ?? 0;

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
                <ShieldCheck size={12} className="text-sky-300" />
                Electronic Health Records
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Medical Records &amp; Diagnostic History
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Secure, longitudinal archive of your doctor visit notes, verified lab reports, electronic prescriptions, and diagnostic imaging.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/consents"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Share2 size={13} />
                <span>Sharing Access</span>
              </Link>
              <Link
                href="/patient/records/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <FilePlus2 size={14} className="text-sky-700" />
                <span>Add Record</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <button
              type="button"
              onClick={() => setKind("")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                !kind
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Total Records
                </p>
                <p className="text-base font-extrabold text-white">{totalCount}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setKind("lab_report")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                kind === "lab_report"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <FlaskConical size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Lab Reports
                </p>
                <p className="text-base font-extrabold text-white">{labCount}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setKind("prescription")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                kind === "prescription"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <PillIcon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Prescriptions
                </p>
                <p className="text-base font-extrabold text-white">{rxCount}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setKind("clinical_note")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                kind === "clinical_note"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Visit Notes
                </p>
                <p className="text-base font-extrabold text-white">{notesCount}</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Unified Search & Filter Toolbar ─────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        {/* Search & Select Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records by title, doctor, clinic, or diagnosis..."
              className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Quick Dropdowns Strip */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={time}
              onChange={(e) => setTime(e.target.value as TimeFilter)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="all">All time</option>
              <option value="30d">Last 30 days</option>
              <option value="year">Last year</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>

            <select
              value={archived}
              onChange={(e) => setArchived(e.target.value as ArchiveFilter)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="all">Active + archived</option>
              <option value="only">Archived only</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSelectMode((v) => !v);
                if (selectMode) clearSelection();
              }}
              className={cn(
                "h-9 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer",
                selectMode
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {KIND_CHIPS.map((chip) => {
            const active = kind === chip.id;
            const Icon = chip.icon;
            return (
              <button
                key={chip.id || "all"}
                type="button"
                onClick={() => setKind(chip.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                  active
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {Icon ? <Icon size={12} className={active ? "text-white" : "text-slate-400"} /> : null}
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Bulk Action Bar (When in Multi-Select) ──────────────────────── */}
      {selectMode && ids.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-sky-50 border border-sky-200 shadow-xs animate-in fade-in">
          <p className="text-xs font-bold text-sky-900">
            {ids.length} record{ids.length === 1 ? "" : "s"} selected
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={bulkArchive.isPending}
              onClick={() => runBulk(() => bulkArchive.mutateAsync(ids), "archive")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-xs font-bold text-sky-800 hover:bg-sky-100 cursor-pointer"
            >
              <Archive size={13} />
              Archive
            </button>
            <button
              type="button"
              disabled={bulkRestore.isPending}
              onClick={() => runBulk(() => bulkRestore.mutateAsync(ids), "restore")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-xs font-bold text-sky-800 hover:bg-sky-100 cursor-pointer"
            >
              <RotateCcw size={13} />
              Restore
            </button>
            <button
              type="button"
              onClick={() => {
                setTagPrompt(true);
                setMoveOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-xs font-bold text-sky-800 hover:bg-sky-100 cursor-pointer"
            >
              <Tag size={13} />
              Tag
            </button>
            <button
              type="button"
              onClick={() => {
                setMoveOpen(true);
                setTagPrompt(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-xs font-bold text-sky-800 hover:bg-sky-100 cursor-pointer"
            >
              <FolderInput size={13} />
              Move
            </button>
            <button
              type="button"
              disabled={bulkDelete.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Permanently delete ${ids.length} record(s)? This cannot be undone.`,
                  )
                ) {
                  return;
                }
                runBulk(() => bulkDelete.mutateAsync(ids), "delete");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>

          {tagPrompt ? (
            <form
              className="flex items-center gap-2 w-full pt-2 border-t border-sky-200"
              onSubmit={(e) => {
                e.preventDefault();
                const tag = tagValue.trim().toLowerCase();
                if (!tag) return;
                runBulk(
                  () => bulkTag.mutateAsync({ ids, add: [tag] }),
                  "tag",
                ).then(() => setTagValue(""));
              }}
            >
              <input
                value={tagValue}
                onChange={(e) => setTagValue(e.target.value)}
                placeholder="Enter tag name (e.g. Cardiology, Dental)..."
                className="h-8 flex-1 rounded-lg border border-sky-300 bg-white px-2.5 text-xs text-slate-900"
              />
              <button
                type="submit"
                className="h-8 px-3 rounded-lg bg-sky-700 text-xs font-bold text-white hover:bg-sky-800 cursor-pointer"
              >
                Apply Tag
              </button>
            </form>
          ) : null}

          {moveOpen ? (
            <div className="flex flex-wrap items-center gap-1.5 w-full pt-2 border-t border-sky-200">
              <span className="text-xs font-semibold text-sky-900 mr-1">Move to:</span>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-white border border-sky-300 text-xs font-semibold text-sky-800 hover:bg-sky-100 cursor-pointer"
                onClick={() =>
                  runBulk(
                    () => bulkMove.mutateAsync({ ids, familyMemberId: null }),
                    "move",
                  )
                }
              >
                Myself
              </button>
              {(family.data?.family ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="px-2.5 py-1 rounded-lg bg-white border border-sky-300 text-xs font-semibold text-sky-800 hover:bg-sky-100 cursor-pointer"
                  onClick={() =>
                    runBulk(
                      () =>
                        bulkMove.mutateAsync({
                          ids,
                          familyMemberId: m.id,
                        }),
                      "move",
                    )
                  }
                >
                  {m.name}
                </button>
              ))}
            </div>
          ) : null}

          {bulkError ? (
            <p role="alert" className="text-xs text-rose-600 font-medium">
              {bulkError}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── 4. Records List Cards ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Documents &amp; Clinical Reports</span>
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">
              {records.length} Records
            </span>
          </h2>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Encrypted &amp; HIPAA-compliant storage
          </span>
        </div>

        {(search.trim().length >= 2 ? fts.isLoading : query.isLoading) ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        ) : (search.trim().length >= 2 ? fts.isError : query.isError) ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-xs font-semibold text-rose-700">
            Could not load medical records. Please refresh the page.
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                No medical records found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                {search
                  ? `No documents match "${search}". Try searching another keyword or clear filters.`
                  : "Prescriptions, lab results, and visit notes logged by your care team will appear here."}
              </p>
            </div>
            <Link
              href="/patient/records/new"
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <FilePlus2 size={14} />
              <span>Add First Record</span>
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {records.map((r) => {
              const checked = selected.has(r.id);

              return (
                <li key={r.id} className="flex items-center gap-2.5">
                  {selectMode ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.title}`}
                      className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                  ) : null}

                  <Link
                    href={`/patient/records/${r.id}`}
                    onClick={(e) => {
                      if (selectMode) {
                        e.preventDefault();
                        toggle(r.id);
                      }
                    }}
                    className="group flex-1 flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-sky-300 hover:shadow-xs transition-all"
                  >
                    {/* Left: Icon & Details */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs",
                          typeIconBg(r.recordType),
                        )}
                      >
                        {typeIcon(r.recordType)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                            {r.title}
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11.5px] text-slate-500 font-medium">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Clock size={11} className="text-slate-400" />
                            {formatDayLabel(r.date)}
                          </span>

                          {r.diagnosis ? (
                            <>
                              <span>·</span>
                              <span className="text-slate-700 font-semibold truncate max-w-[200px]">
                                {r.diagnosis}
                              </span>
                            </>
                          ) : null}

                          {r.facilityName ? (
                            <>
                              <span>·</span>
                              <span className="text-slate-500 truncate max-w-[180px]">
                                {r.facilityName}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Right: Badge & Chevron */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                          typeBadgeColor(r.recordType),
                        )}
                      >
                        {formatRecordType(r.recordType)}
                      </span>

                      <div className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-sky-600 group-hover:bg-sky-50 transition-colors">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
