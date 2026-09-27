"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Calendar,
  Clock,
  Command,
  FilePlus2,
  FileText,
  FlaskConical,
  FolderInput,
  ListFilter,
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
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

const KIND_CHIPS = [
  { id: "", label: "All records" },
  { id: "clinical_note", label: "Visit notes", icon: FileText },
  { id: "lab_report", label: "Lab reports", icon: FlaskConical },
  { id: "prescription", label: "Prescriptions", icon: PillIcon },
  { id: "imaging", label: "Imaging & scans", icon: ScanLine },
  { id: "vaccination", label: "Vaccinations", icon: Syringe },
  { id: "allergy", label: "Allergies", icon: Sparkles },
] as const;

type TimeFilter = "all" | "30d" | "year";
type SortMode = "newest" | "oldest";
type ArchiveFilter = "active" | "all" | "only";

function typeIcon(type: string | null | undefined, size = 18) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab")) return <FlaskConical size={size} />;
  if (key.includes("prescription") || key.includes("medication")) return <PillIcon size={size} />;
  if (key.includes("imaging") || key.includes("scan")) return <ScanLine size={size} />;
  if (key.includes("vaccin")) return <Syringe size={size} />;
  if (key.includes("allerg")) return <Sparkles size={size} />;
  return <FileText size={size} />;
}

function typeIconBg(type: string | null | undefined) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab")) return "bg-brand-soft text-brand ring-brand/20";
  if (key.includes("prescription") || key.includes("medication")) return "bg-emerald-50 text-emerald-600 ring-emerald-100";
  if (key.includes("imaging")) return "bg-violet-50 text-violet-600 ring-violet-100";
  if (key.includes("vaccin") || key.includes("allergy")) return "bg-amber-50 text-amber-700 ring-amber-100";
  return "bg-blue-50 text-blue-600 ring-blue-100";
}

function typeBadgeColor(type: string | null | undefined) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab")) return "bg-brand-soft text-brand ring-brand/25";
  if (key.includes("prescription") || key.includes("medication")) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (key.includes("imaging")) return "bg-violet-50 text-violet-700 ring-violet-200";
  if (key.includes("vaccin") || key.includes("allergy")) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

function statusLabel(status: RecordRow["status"]) {
  if (!status) return "Filed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function MetricButton({ label, value, icon, active, onClick }: { label: string; value: number; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all", active ? "bg-surface/16" : "hover:bg-surface/10")}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface/12 text-white ring-1 ring-surface/15 transition-transform group-hover:scale-105">{icon}</span>
      <span className="min-w-0"><span className="block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100/75">{label}</span><span className="mt-0.5 block text-xl font-extrabold tracking-tight text-white">{value}</span></span>
    </button>
  );
}

function RecordCard({ record, selectMode, checked, onToggle }: { record: RecordRow; selectMode: boolean; checked: boolean; onToggle: () => void }) {
  const rawTags = record.tags as unknown;
  const tags = (Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === "string")
    : typeof rawTags === "string"
      ? rawTags.split(",")
      : []
  ).map((tag) => tag.trim()).filter(Boolean).slice(0, 2);
  return (
    <li className="group relative">
      {selectMode ? <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select ${record.title}`} className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded border-border-strong text-brand focus:ring-brand" /> : null}
      <Link href={`/patient/records/${record.id}`} onClick={(event) => { if (selectMode) { event.preventDefault(); onToggle(); } }} className={cn("relative flex items-center gap-4 overflow-hidden rounded-[22px] border border-border bg-surface px-4 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_14px_30px_rgba(30,64,175,0.11)] sm:px-5", selectMode && "pl-11")}>
        <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-brand-strong opacity-0 transition-opacity group-hover:opacity-100" />
        <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1", typeIconBg(record.recordType))}>{typeIcon(record.recordType, 20)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><span className="truncate text-[15px] font-bold tracking-[-0.015em] text-text transition-colors group-hover:text-brand">{record.title}</span><span className={cn("hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 sm:inline-flex", typeBadgeColor(record.recordType))}>{formatRecordType(record.recordType)}</span></span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] font-medium text-text-soft"><span className="inline-flex items-center gap-1.5 text-text-soft"><Clock size={12} className="text-text-muted" />{formatDayLabel(record.date)}</span>{record.diagnosis ? <><span className="text-text-muted">•</span><span className="truncate font-semibold text-text">{record.diagnosis}</span></> : null}<span className="text-text-muted">•</span><span className="inline-flex items-center gap-1 text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{statusLabel(record.status)}</span></span>
          {record.summary ? <span className="mt-2 hidden max-w-2xl truncate text-xs leading-5 text-text-soft md:block">{record.summary}</span> : null}
          {tags?.length ? <span className="mt-2 hidden flex-wrap gap-1.5 md:flex">{tags.map((tag) => <span key={tag} className="rounded-md bg-surface-2 px-2 py-1 text-[10px] font-semibold text-text-soft ring-1 ring-border">#{tag}</span>)}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-2"><span className="hidden text-right sm:block"><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Open record</span><span className="mt-1 block text-xs font-semibold text-text-soft group-hover:text-brand">View details</span></span><span className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition-all group-hover:bg-brand-soft group-hover:text-brand"><ArrowUpRight size={17} /></span></span>
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

  useEffect(() => { if (searchParams.get("focus") === "search") searchInputRef.current?.focus(); }, [searchParams]);
  useEffect(() => { function onShortcut(event: KeyboardEvent) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInputRef.current?.focus(); } } window.addEventListener("keydown", onShortcut); return () => window.removeEventListener("keydown", onShortcut); }, []);

  const listParams = useMemo(() => { const params: { type?: string; search?: string; limit: number; sort: SortMode; archived?: "true" | "all" | "only" } = { limit: 100, sort, type: kind || undefined, search: search.trim().length >= 2 ? search.trim() : undefined }; if (archived === "all") params.archived = "all"; else if (archived === "only") params.archived = "only"; return params; }, [kind, search, sort, archived]);
  const query = useRecords(listParams);
  const fts = useRecordSearch(search, { limit: 50 });
  const stats = useRecordStats();
  const records = useMemo(() => { const base = search.trim().length >= 2 && fts.data?.records ? fts.data.records : (query.data?.records ?? []); if (time === "all") return base; const cutoff = new Date(); if (time === "30d") cutoff.setDate(cutoff.getDate() - 30); else cutoff.setFullYear(cutoff.getFullYear() - 1); return base.filter((record) => { const date = record.date ? new Date(record.date) : null; return date ? date >= cutoff : true; }); }, [query.data, fts.data, search, time]);
  const ids = Array.from(selected);
  const statData = stats.data;
  const totalCount = statData?.total ?? records.length;
  const labCount = statData?.byType?.lab_report ?? statData?.byType?.LAB_REPORT ?? 0;
  const rxCount = statData?.byType?.prescription ?? statData?.byType?.PRESCRIPTION ?? 0;
  const notesCount = statData?.byType?.clinical_note ?? statData?.byType?.CLINICAL_NOTE ?? 0;
  const activeFilterCount = Number(Boolean(kind)) + Number(time !== "all") + Number(sort !== "newest") + Number(archived !== "active");

  function toggle(id: string) { setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function clearSelection() { setSelected(new Set()); setSelectMode(false); setTagPrompt(false); setMoveOpen(false); setBulkError(null); }
  function clearFilters() { setKind(""); setTime("all"); setSort("newest"); setArchived("active"); }
  async function runBulk(action: () => Promise<unknown>, label: string) { setBulkError(null); try { await action(); clearSelection(); } catch (cause) { setBulkError(cause instanceof Error ? cause.message : `Could not ${label}.`); } }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <PageHero
        icon={<ShieldCheck size={13} />}
        kicker="Your care archive"
        title="Medical records, organized for you."
        description="One secure place for visit notes, lab results, prescriptions, scans, and the clinical details that help you stay in control."
        actions={
          <>
            <Link href="/patient/consents" className={heroSecondaryAction}>
              <Share2 size={14} />
              <span>Manage sharing</span>
            </Link>
            <Link href="/patient/records/new" className={heroPrimaryAction}>
              <FilePlus2 size={15} />
              <span>Add record</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>Storage · encrypted</span>
            <span>Last updated · just now</span>
            <span>Privacy · protected</span>
            <span>
              {totalCount} total · {labCount} lab · {rxCount} rx · {notesCount} notes
            </span>
          </>
        }
      />

      <section className="rounded-[24px] border border-border bg-surface p-3 shadow-[0_12px_35px_rgba(30,64,175,0.06)] md:p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative min-w-0 flex-1"><Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" /><input ref={searchInputRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, doctor, clinic, or diagnosis…" aria-label="Search medical records" className="h-12 w-full rounded-2xl border border-border bg-surface-2 pl-11 pr-24 text-sm font-semibold text-text outline-none transition placeholder:text-text-muted focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand-soft" />{search ? <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text" aria-label="Clear search"><X size={15} /></button> : <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-bold text-text-muted shadow-sm sm:inline-flex"><Command size={11} />K</span>}</div><div className="flex items-center gap-2"><button type="button" onClick={() => setFiltersOpen((open) => !open)} className={cn("inline-flex h-12 items-center gap-2 rounded-2xl border px-4 text-xs font-extrabold transition", filtersOpen || activeFilterCount ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-text-soft hover:border-border-strong hover:bg-surface-2")} aria-expanded={filtersOpen}><SlidersHorizontal size={16} />Filters{activeFilterCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] text-white">{activeFilterCount}</span> : null}</button><button type="button" onClick={() => { setSelectMode((value) => !value); if (selectMode) clearSelection(); }} className={cn("inline-flex h-12 items-center gap-2 rounded-2xl border px-4 text-xs font-extrabold transition", selectMode ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-soft hover:border-border-strong hover:bg-surface-2")}><ListFilter size={16} />{selectMode ? "Done" : "Select"}</button></div></div>
        {filtersOpen ? <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-surface-2/75 p-3 sm:grid-cols-3"><FilterSelect label="Date range" value={time} onChange={(value) => setTime(value as TimeFilter)} options={[["all", "All time"], ["30d", "Last 30 days"], ["year", "Last year"]]} /><FilterSelect label="Sort records" value={sort} onChange={(value) => setSort(value as SortMode)} options={[["newest", "Newest first"], ["oldest", "Oldest first"]]} /><FilterSelect label="Visibility" value={archived} onChange={(value) => setArchived(value as ArchiveFilter)} options={[["active", "Active only"], ["all", "Active + archived"], ["only", "Archived only"]]} />{activeFilterCount ? <button type="button" onClick={clearFilters} className="text-left text-xs font-bold text-brand hover:text-brand-strong sm:col-span-3">Clear all filters</button> : null}</div> : null}
          <div className="mt-4 flex items-center gap-2 overflow-x-auto border-t border-border pt-3 scrollbar-none" role="tablist" aria-label="Record categories">{KIND_CHIPS.map((chip) => { const active = kind === chip.id; const Icon = chip.id ? chip.icon : undefined; return <button key={chip.id || "all"} type="button" role="tab" aria-selected={active} onClick={() => setKind(chip.id)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition", active ? "bg-ink text-white" : "text-text-soft hover:bg-surface-2 hover:text-text")}>{Icon ? <Icon size={14} className={active ? "text-brand-soft" : "text-text-muted"} /> : null}{chip.label}</button>; })}</div>
      </section>

      {selectMode && ids.length > 0 ? <div className="flex flex-col gap-3 rounded-2xl border border-brand bg-brand-soft p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><p className="text-xs font-extrabold text-text">{ids.length} record{ids.length === 1 ? "" : "s"} selected</p><div className="flex flex-wrap gap-2"><BulkButton icon={<Archive size={14} />} label="Archive" disabled={bulkArchive.isPending} onClick={() => runBulk(() => bulkArchive.mutateAsync(ids), "archive")} /><BulkButton icon={<RotateCcw size={14} />} label="Restore" disabled={bulkRestore.isPending} onClick={() => runBulk(() => bulkRestore.mutateAsync(ids), "restore")} /><BulkButton icon={<Tag size={14} />} label="Tag" onClick={() => { setTagPrompt(true); setMoveOpen(false); }} /><BulkButton icon={<FolderInput size={14} />} label="Move" onClick={() => { setMoveOpen(true); setTagPrompt(false); }} /><BulkButton destructive icon={<Trash2 size={14} />} label="Delete" disabled={bulkDelete.isPending} onClick={() => { if (window.confirm(`Permanently delete ${ids.length} record(s)? This cannot be undone.`)) runBulk(() => bulkDelete.mutateAsync(ids), "delete"); }} /></div>{tagPrompt ? <form className="flex w-full gap-2 border-t border-border pt-3" onSubmit={(event) => { event.preventDefault(); const tag = tagValue.trim().toLowerCase(); if (!tag) return; runBulk(() => bulkTag.mutateAsync({ ids, add: [tag] }), "tag").then(() => setTagValue("")); }}><input value={tagValue} onChange={(event) => setTagValue(event.target.value)} placeholder="Enter a tag, e.g. Cardiology" className="h-9 min-w-0 flex-1 rounded-xl border-border bg-surface px-3 text-xs text-text outline-none focus:border-brand" /><button type="submit" className="rounded-xl bg-brand px-3 text-xs font-bold text-white hover:bg-brand-strong">Apply</button></form> : null}{moveOpen ? <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-3"><span className="text-xs font-bold text-text">Move to:</span><MoveButton label="My records" onClick={() => runBulk(() => bulkMove.mutateAsync({ ids, familyMemberId: null }), "move")} />{(family.data?.family ?? []).map((member) => <MoveButton key={member.id} label={member.name} onClick={() => runBulk(() => bulkMove.mutateAsync({ ids, familyMemberId: member.id }), "move")} />)}</div> : null}{bulkError ? <p role="alert" className="w-full text-xs font-semibold text-rose-600">{bulkError}</p> : null}</div> : null}

      <section className="flex flex-col gap-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-xl font-extrabold tracking-[-0.03em] text-text">Your records</h2><span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-soft">{records.length} shown</span></div><p className="mt-1 text-xs font-medium text-text-soft">A clear timeline of the documents behind your care.</p></div><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted"><ShieldCheck size={14} className="text-emerald-500" />Encrypted &amp; private</span></div>
        {(search.trim().length >= 2 ? fts.isLoading : query.isLoading) ? <div className="flex flex-col gap-3">{[1, 2, 3, 4].map((item) => <div key={item} className="h-[108px] animate-pulse rounded-[22px] border border-border bg-surface" />)}</div> : (search.trim().length >= 2 ? fts.isError : query.isError) ? <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-8 text-center text-xs font-semibold text-rose-700">Could not load medical records. Please refresh the page.</div> : records.length === 0 ? <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-border-strong bg-surface p-12 text-center shadow-sm"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-text-muted"><FileText size={26} /></div><div><h3 className="text-sm font-extrabold text-text">No medical records found</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-text-soft">{search ? `No documents match “${search}”. Try another keyword or clear your filters.` : "Prescriptions, lab results, and visit notes logged by your care team will appear here."}</p></div><div className="flex flex-wrap justify-center gap-2">{activeFilterCount || search ? <button type="button" onClick={() => { clearFilters(); setSearch(""); }} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-soft hover:bg-surface-2">Clear filters</button> : null}<Link href="/patient/records/new" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-strong"><FilePlus2 size={14} />Add first record</Link></div></div> : <ul className="flex flex-col gap-3">{records.map((record) => <RecordCard key={record.id} record={record} selectMode={selectMode} checked={selected.has(record.id)} onToggle={() => toggle(record.id)} />)}</ul>}
      </section>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"><span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-[150px] cursor-pointer bg-transparent text-right text-xs font-bold text-text outline-none">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function BulkButton({ icon, label, onClick, disabled, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; destructive?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50", destructive ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-border bg-surface text-brand hover:bg-brand-soft")}>{icon}{label}</button>;
}

function MoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border-border bg-surface px-3 py-2 text-xs font-semibold text-brand hover:bg-brand-soft">{label}</button>;
}
