"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ChevronRight,
  Clock,
  Clock3,
  Command,
  FilePlus2,
  FileText,
  FlaskConical,
  FolderInput,
  FolderOpen,
  ListChecks,
  Lock,
  Pill as PillIcon,
  RotateCcw,
  ScanLine,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Syringe,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import type { RecordRow } from "@/patient/types/patient";
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
import { RecordTypeIcon, recordTone } from "@/patient/components/records/recordType";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  BreakdownBar,
  EmptyBlock,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  HeroPulse,
  LiveDot,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PrimaryLink,
  PromoCard,
  QuickToolsPanel,
  SECONDARY_BTN,
  Segmented,
  StatTile,
  TONE_RAIL,
  TONE_TILE,
} from "@/patient/components/workspace";

const KINDS = [
  { id: "", label: "All" },
  { id: "clinical_note", label: "Visit notes", icon: FileText },
  { id: "lab_report", label: "Labs", icon: FlaskConical },
  { id: "prescription", label: "Prescriptions", icon: PillIcon },
  { id: "imaging", label: "Imaging", icon: ScanLine },
  { id: "vaccination", label: "Vaccines", icon: Syringe },
  { id: "allergy", label: "Allergies", icon: Sparkles },
] as const;

const KIND_COLOR: Record<string, string> = {
  clinical_note: "bg-sky-500",
  lab_report: "bg-teal-500",
  prescription: "bg-emerald-500",
  imaging: "bg-violet-500",
  vaccination: "bg-amber-400",
  allergy: "bg-rose-500",
};

type TimeFilter = "all" | "30d" | "year";
type SortMode = "newest" | "oldest";
type ArchiveFilter = "active" | "all" | "only";

function statusLabel(status: RecordRow["status"]) {
  if (!status) return "Filed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function countFor(byType: Record<string, number> | undefined, key: string) {
  if (!byType) return 0;
  return (byType[key] ?? 0) + (byType[key.toUpperCase()] ?? 0);
}

function RecordItem({
  record,
  selectMode,
  checked,
  onToggle,
}: {
  record: RecordRow;
  selectMode: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const rawTags = record.tags as unknown;
  const tags = (
    Array.isArray(rawTags)
      ? rawTags.filter((tag): tag is string => typeof tag === "string")
      : typeof rawTags === "string"
        ? rawTags.split(",")
        : []
  )
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 2);
  const tone = recordTone(record.recordType);

  return (
    <li className="relative">
      {selectMode ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${record.title}`}
          className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        />
      ) : null}
      <Link
        href={`/patient/records/${record.id}`}
        onClick={(event) => {
          if (selectMode) {
            event.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          "group relative flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]",
          selectMode && "pl-10",
          checked && "shadow-[inset_0_0_0_2px_#0284c7]",
        )}
      >
        <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", TONE_RAIL[tone])} aria-hidden />
        <span className={cn("ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", TONE_TILE[tone])} aria-hidden>
          <RecordTypeIcon type={record.recordType} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
              {record.title}
            </span>
            <Badge tone={tone} className="hidden sm:inline-flex">
              {formatRecordType(record.recordType)}
            </Badge>
          </span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} aria-hidden />
              {formatDayLabel(record.date)}
            </span>
            {record.diagnosis ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate font-medium text-slate-600">{record.diagnosis}</span>
              </>
            ) : null}
            {tags.map((tag) => (
              <span key={tag} className="hidden rounded bg-slate-100 px-1.5 py-px text-[10.5px] font-medium text-slate-500 md:inline">
                #{tag}
              </span>
            ))}
          </span>
          {record.summary ? (
            <span className="mt-1 hidden max-w-2xl truncate text-xs text-slate-500 md:block">{record.summary}</span>
          ) : null}
        </span>
        <Badge tone={record.status === "cancelled" ? "rose" : record.status === "pending" ? "amber" : "emerald"} className="hidden sm:inline-flex">
          {statusLabel(record.status)}
        </Badge>
        <ChevronRight
          size={16}
          className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600"
          aria-hidden
        />
      </Link>
    </li>
  );
}

export default function RecordsListPage() {
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [kind, setKind] = useState(searchParams.get("type") ?? "");
  const [time, setTime] = useState<TimeFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [archived, setArchived] = useState<ArchiveFilter>("active");
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    if (searchParams.get("focus") === "search") searchInputRef.current?.focus();
  }, [searchParams]);
  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const listParams = useMemo(() => {
    const params: { type?: string; search?: string; limit: number; sort: SortMode; archived?: "true" | "all" | "only" } = {
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
  const searching = search.trim().length >= 2;

  const records = useMemo(() => {
    const base = searching && fts.data?.records ? fts.data.records : (query.data?.records ?? []);
    if (time === "all") return base;
    const cutoff = new Date();
    if (time === "30d") cutoff.setDate(cutoff.getDate() - 30);
    else cutoff.setFullYear(cutoff.getFullYear() - 1);
    return base.filter((record) => {
      const date = record.date ? new Date(record.date) : null;
      return date ? date >= cutoff : true;
    });
  }, [query.data, fts.data, searching, time]);

  const ids = Array.from(selected);
  const byType = stats.data?.byType;
  const totalCount = stats.data?.total ?? records.length;
  const labCount = countFor(byType, "lab_report");
  const rxCount = countFor(byType, "prescription");
  const notesCount = countFor(byType, "clinical_note");
  const imagingCount = countFor(byType, "imaging");
  const activeFilterCount =
    Number(time !== "all") + Number(sort !== "newest") + Number(archived !== "active");
  const latest = records[0];
  const loading = searching ? fts.isLoading : query.isLoading;
  const errored = searching ? fts.isError : query.isError;

  const breakdown = KINDS.filter((k) => k.id).map((k) => ({
    key: k.id,
    label: k.label,
    count: countFor(byType, k.id),
    color: KIND_COLOR[k.id] ?? "bg-slate-300",
  }));
  const breakdownKnown = breakdown.reduce((s, b) => s + b.count, 0);
  if (totalCount > breakdownKnown) {
    breakdown.push({ key: "other", label: "Other", count: totalCount - breakdownKnown, color: "bg-slate-300" });
  }

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
  function clearFilters() {
    setKind("");
    setTime("all");
    setSort("newest");
    setArchived("active");
  }
  async function runBulk(action: () => Promise<unknown>, label: string) {
    setBulkError(null);
    try {
      await action();
      clearSelection();
    } catch (cause) {
      setBulkError(cause instanceof Error ? cause.message : `Could not ${label}.`);
    }
  }
  const toggleKind = (k: string) => setKind(kind === k ? "" : k);

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<FolderOpen size={13} aria-hidden />}
          kicker="Medical records"
          kickerMeta={`${totalCount} on file`}
          title={
            <>
              Your care <HeroAccent>archive</HeroAccent>
            </>
          }
          description="Visit notes, lab results, prescriptions and scans — one encrypted place that keeps you in control of your history."
          chips={
            <>
              <span className={HERO_CHIP}>
                <LiveDot />
                Encrypted &amp; private
              </span>
              {latest ? (
                <span className={HERO_CHIP}>
                  <Clock3 size={12} className="text-sky-300" aria-hidden />
                  Latest · {formatDayLabel(latest.date)}
                </span>
              ) : null}
              <Link href="/patient/share" className={HERO_CHIP + " transition-colors hover:bg-white/[0.12]"}>
                <Share2 size={12} className="text-sky-300" aria-hidden />
                Share with a doctor
              </Link>
            </>
          }
          aside={
            <HeroPulse
              icon={<ShieldCheck size={20} strokeWidth={2.3} aria-hidden />}
              label="Records on file"
              value={stats.data ? totalCount.toLocaleString() : "—"}
              sub={`${labCount} labs · ${rxCount} rx · ${notesCount} notes`}
            />
          }
          actions={
            <>
              <Link href="/patient/records/scan" className={HERO_GHOST}>
                <ScanLine size={15} aria-hidden />
                Scan
              </Link>
              <Link href="/patient/records/new" className={HERO_PRIMARY}>
                <FilePlus2 size={15} className="text-sky-600" aria-hidden />
                Add record
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Visit notes"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(notesCount)}
            sub="From your consultations"
            active={kind === "clinical_note"}
            onClick={() => toggleKind("clinical_note")}
          />
          <StatTile
            label="Lab reports"
            icon={<FlaskConical size={16} />}
            tone="bg-teal-50 text-teal-600"
            value={String(labCount)}
            sub="Results & panels"
            active={kind === "lab_report"}
            onClick={() => toggleKind("lab_report")}
          />
          <StatTile
            label="Prescriptions"
            icon={<PillIcon size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(rxCount)}
            sub="Signed by your doctors"
            active={kind === "prescription"}
            onClick={() => toggleKind("prescription")}
          />
          <StatTile
            label="Imaging"
            icon={<ScanLine size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(imagingCount)}
            sub="Scans & reports"
            active={kind === "imaging"}
            onClick={() => toggleKind("imaging")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Record list ───────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="rec-list">
          <PanelHeader
            id="rec-list"
            icon={<FolderOpen size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Your records"
            caption={loading ? "Loading…" : `${records.length} shown${kind ? ` · ${formatRecordType(kind)}` : ""}`}
            action={
              <>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  className={cn(SECONDARY_BTN, (filtersOpen || activeFilterCount > 0) && "text-sky-700 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.4)]")}
                >
                  <SlidersHorizontal size={13} aria-hidden />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount ? (
                    <span className="grid h-4 min-w-4 place-items-center rounded bg-sky-600 px-1 text-[10px] text-white">{activeFilterCount}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectMode) clearSelection();
                    else setSelectMode(true);
                  }}
                  className={cn(SECONDARY_BTN, selectMode && "bg-[#07233a] text-white shadow-none hover:bg-sky-700 hover:text-white")}
                >
                  <ListChecks size={13} aria-hidden />
                  <span className="hidden sm:inline">{selectMode ? "Done" : "Select"}</span>
                </button>
              </>
            }
          />

          <div className="mt-5 flex flex-col gap-3">
            <div className="relative w-full">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearch("");
                }}
                placeholder="Search by title, doctor, clinic, or diagnosis…"
                aria-label="Search medical records"
                className="h-10 w-full rounded-xl bg-slate-50 pl-10 pr-16 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7,0_0_0_4px_rgba(14,165,233,0.12)]"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
                >
                  <X size={13} />
                </button>
              ) : (
                <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] sm:inline-flex">
                  <Command size={10} aria-hidden />K
                </span>
              )}
            </div>

            <Segmented<string>
              ariaLabel="Record categories"
              value={kind}
              onChange={setKind}
              options={KINDS.map((k) => ({
                value: k.id,
                label: k.label,
                count: k.id ? countFor(byType, k.id) : totalCount,
              }))}
            />

            {filtersOpen ? (
              <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
                <FilterSelect
                  label="Date range"
                  value={time}
                  onChange={(value) => setTime(value as TimeFilter)}
                  options={[["all", "All time"], ["30d", "Last 30 days"], ["year", "Last year"]]}
                />
                <FilterSelect
                  label="Sort"
                  value={sort}
                  onChange={(value) => setSort(value as SortMode)}
                  options={[["newest", "Newest first"], ["oldest", "Oldest first"]]}
                />
                <FilterSelect
                  label="Visibility"
                  value={archived}
                  onChange={(value) => setArchived(value as ArchiveFilter)}
                  options={[["active", "Active only"], ["all", "Active + archived"], ["only", "Archived only"]]}
                />
                {activeFilterCount || kind ? (
                  <button type="button" onClick={clearFilters} className="text-left text-xs font-semibold text-sky-700 hover:text-sky-800 sm:col-span-3">
                    Clear all filters
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {selectMode ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-sky-50/70 p-3.5 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.2)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  {ids.length ? `${ids.length} record${ids.length === 1 ? "" : "s"} selected` : "Tap records to select them"}
                </p>
                {ids.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    <BulkButton icon={<Archive size={13} />} label="Archive" disabled={bulkArchive.isPending} onClick={() => runBulk(() => bulkArchive.mutateAsync(ids), "archive")} />
                    <BulkButton icon={<RotateCcw size={13} />} label="Restore" disabled={bulkRestore.isPending} onClick={() => runBulk(() => bulkRestore.mutateAsync(ids), "restore")} />
                    <BulkButton
                      icon={<Tag size={13} />}
                      label="Tag"
                      onClick={() => {
                        setTagPrompt(true);
                        setMoveOpen(false);
                      }}
                    />
                    <BulkButton
                      icon={<FolderInput size={13} />}
                      label="Move"
                      onClick={() => {
                        setMoveOpen(true);
                        setTagPrompt(false);
                      }}
                    />
                    <BulkButton
                      destructive
                      icon={<Trash2 size={13} />}
                      label="Delete"
                      disabled={bulkDelete.isPending}
                      onClick={() => {
                        if (window.confirm(`Permanently delete ${ids.length} record(s)? This cannot be undone.`))
                          runBulk(() => bulkDelete.mutateAsync(ids), "delete");
                      }}
                    />
                  </div>
                ) : null}
              </div>
              {tagPrompt && ids.length ? (
                <form
                  className="flex gap-2 border-t border-sky-100 pt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const tag = tagValue.trim().toLowerCase();
                    if (!tag) return;
                    runBulk(() => bulkTag.mutateAsync({ ids, add: [tag] }), "tag").then(() => setTagValue(""));
                  }}
                >
                  <input
                    value={tagValue}
                    onChange={(event) => setTagValue(event.target.value)}
                    placeholder="Enter a tag, e.g. Cardiology"
                    className="h-9 min-w-0 flex-1 rounded-lg bg-white px-3 text-xs text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0284c7]"
                  />
                  <button type="submit" className="h-9 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white hover:bg-sky-700">
                    Apply
                  </button>
                </form>
              ) : null}
              {moveOpen && ids.length ? (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-sky-100 pt-3">
                  <span className={GROUP_LABEL}>Move to</span>
                  <BulkButton label="My records" onClick={() => runBulk(() => bulkMove.mutateAsync({ ids, familyMemberId: null }), "move")} />
                  {(family.data?.family ?? []).map((member) => (
                    <BulkButton
                      key={member.id}
                      label={member.name}
                      onClick={() => runBulk(() => bulkMove.mutateAsync({ ids, familyMemberId: member.id }), "move")}
                    />
                  ))}
                </div>
              ) : null}
              {bulkError ? (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {bulkError}
                </p>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <PanelSkeleton rows={5} />
          ) : errored ? (
            <PanelError message="Could not load medical records." onRetry={() => void (searching ? fts.refetch() : query.refetch())} />
          ) : records.length === 0 ? (
            <EmptyBlock
              icon={<FileText size={19} />}
              title="No medical records found"
              body={
                search
                  ? `No documents match “${search}”. Try another keyword or clear your filters.`
                  : "Prescriptions, lab results, and visit notes logged by your care team will appear here."
              }
              actions={
                <>
                  {activeFilterCount || kind || search ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearFilters();
                        setSearch("");
                      }}
                      className={SECONDARY_BTN}
                    >
                      Clear filters
                    </button>
                  ) : null}
                  <PrimaryLink href="/patient/records/new" icon={<FilePlus2 size={13} />}>
                    Add first record
                  </PrimaryLink>
                </>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {records.map((record) => (
                <RecordItem
                  key={record.id}
                  record={record}
                  selectMode={selectMode}
                  checked={selected.has(record.id)}
                  onToggle={() => toggle(record.id)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ── Rail ──────────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Records overview">
          <QuickToolsPanel
            id="rec-tools"
            tools={[
              { href: "/patient/records/new", label: "Add", hint: "New record", icon: FilePlus2, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/records/scan", label: "Scan", hint: "Paper report", icon: ScanLine, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { href: "/patient/timeline", label: "Timeline", hint: "Your history", icon: Clock3, tone: "from-slate-600 to-slate-800 shadow-slate-500/30" },
              { href: "/patient/diagnostic-tests", label: "Lab tests", hint: "Book a test", icon: FlaskConical, tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { href: "/patient/vaccinations", label: "Vaccines", hint: "Immunisations", icon: Syringe, tone: "from-amber-500 to-orange-500 shadow-amber-500/30" },
              { href: "/patient/share", label: "Share", hint: "With a doctor", icon: Share2, tone: "from-rose-500 to-pink-600 shadow-rose-500/30" },
            ]}
          />

          <section className={PANEL} aria-labelledby="rec-mix">
            <PanelHeader
              id="rec-mix"
              icon={<FolderOpen size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="By type"
              caption={`${totalCount.toLocaleString()} total · tap to filter`}
            />
            {stats.isLoading ? (
              <div className="mt-5 h-32 animate-pulse rounded-xl bg-slate-100" />
            ) : totalCount === 0 ? (
              <EmptyBlock icon={<FolderOpen size={19} />} title="Nothing filed yet" body="Your breakdown appears as records are added." />
            ) : (
              <BreakdownBar
                items={breakdown}
                total={totalCount}
                activeKey={kind}
                onSelect={(key) => key !== "other" && toggleKind(key)}
              />
            )}
          </section>

          <PromoCard
            href="/patient/consents"
            kicker="Privacy"
            icon={<Lock size={21} aria-hidden />}
            title="You control who sees this"
            body="Review consents and every doctor with access"
          />
        </aside>
      </div>
    </PatientPage>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
      <span className={GROUP_LABEL}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[150px] cursor-pointer bg-transparent text-right text-xs font-semibold text-slate-900 outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function BulkButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        destructive
          ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] hover:text-sky-700",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
