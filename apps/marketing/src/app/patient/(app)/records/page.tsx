"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, FolderInput, RotateCcw, Tag, Trash2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
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
import { formatDayLabel } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

const KIND_CHIPS = [
  { id: "", label: "All" },
  { id: "lab_report", label: "Labs" },
  { id: "prescription", label: "Rx" },
  { id: "imaging", label: "Imaging" },
  { id: "vaccination", label: "Vaccination" },
  { id: "allergy", label: "Allergy" },
] as const;

type TimeFilter = "all" | "30d" | "year";
type SortMode = "newest" | "oldest";
type ArchiveFilter = "active" | "all" | "only";

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
        : query.data?.records ?? [];
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

  async function runBulk(
    action: () => Promise<unknown>,
    label: string,
  ) {
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

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Your file"
        title="Medical records"
        description="Labs, visit notes, and documents from your care team."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/patient/consents"
              className="rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-text-soft"
            >
              Sharing
            </Link>
            <Link
              href="/patient/records/new"
              className="rounded-pill bg-brand px-3 py-1.5 text-xs font-semibold text-white"
            >
              Add record
            </Link>
          </div>
        }
      />

      <Card>
        <QueryBoundary query={stats} emptyTitle="" loadingCount={3}>
          {(data) => (
            <div className="flex flex-wrap gap-2">
              <Pill tone="brand">{data.total} total</Pill>
              {Object.entries(data.byType ?? {})
                .slice(0, 6)
                .map(([k, v]) => (
                  <Pill key={k} tone="info">
                    {k} · {v as number}
                  </Pill>
                ))}
            </div>
          )}
        </QueryBoundary>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
            className="h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text"
            aria-label="Search records"
          />

          <div className="flex flex-wrap gap-1.5">
            {KIND_CHIPS.map((chip) => (
              <button
                key={chip.id || "all"}
                type="button"
                aria-pressed={kind === chip.id}
                onClick={() => setKind(chip.id)}
                className={cn(
                  "rounded-pill border px-3 py-1 text-xs font-semibold",
                  kind === chip.id
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-surface-2 text-text-soft",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={time}
              onChange={(e) => setTime(e.target.value as TimeFilter)}
              className="rounded-inner border border-border bg-surface-2 px-2 py-1.5 text-text"
              aria-label="Time filter"
            >
              <option value="all">All time</option>
              <option value="30d">Last 30 days</option>
              <option value="year">Last year</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="rounded-inner border border-border bg-surface-2 px-2 py-1.5 text-text"
              aria-label="Sort"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <select
              value={archived}
              onChange={(e) => setArchived(e.target.value as ArchiveFilter)}
              className="rounded-inner border border-border bg-surface-2 px-2 py-1.5 text-text"
              aria-label="Archive filter"
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
              className="ml-auto rounded-pill border border-border px-3 py-1.5 font-semibold text-text-soft"
            >
              {selectMode ? "Cancel select" : "Select"}
            </button>
          </div>
        </div>
      </Card>

      {selectMode && ids.length > 0 ? (
        <Card>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-text">
              {ids.length} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={bulkArchive.isPending}
                onClick={() =>
                  runBulk(
                    () => bulkArchive.mutateAsync(ids),
                    "archive",
                  )
                }
                className="inline-flex items-center gap-1 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden />
                Archive
              </button>
              <button
                type="button"
                disabled={bulkRestore.isPending}
                onClick={() =>
                  runBulk(
                    () => bulkRestore.mutateAsync(ids),
                    "restore",
                  )
                }
                className="inline-flex items-center gap-1 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Restore
              </button>
              <button
                type="button"
                onClick={() => {
                  setTagPrompt(true);
                  setMoveOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold"
              >
                <Tag className="h-3.5 w-3.5" aria-hidden />
                Tag
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoveOpen(true);
                  setTagPrompt(false);
                }}
                className="inline-flex items-center gap-1 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold"
              >
                <FolderInput className="h-3.5 w-3.5" aria-hidden />
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
                className="inline-flex items-center gap-1 rounded-pill bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </button>
            </div>
            {tagPrompt ? (
              <form
                className="flex flex-wrap gap-2"
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
                  placeholder="tag name"
                  className="h-9 flex-1 rounded-inner border border-border bg-surface-2 px-3 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-pill bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Apply tag
                </button>
              </form>
            ) : null}
            {moveOpen ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-pill border border-border px-3 py-1.5 text-xs font-semibold"
                  onClick={() =>
                    runBulk(
                      () =>
                        bulkMove.mutateAsync({
                          ids,
                          familyMemberId: null,
                        }),
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
                    className="rounded-pill border border-border px-3 py-1.5 text-xs font-semibold"
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
              <p role="alert" className="text-sm text-danger">
                {bulkError}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        {(search.trim().length >= 2 ? fts.isLoading : query.isLoading) ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-inner bg-surface-2" />
            ))}
          </div>
        ) : (search.trim().length >= 2 ? fts.isError : query.isError) ? (
          <p role="alert" className="text-sm text-danger">
            Could not load records. Retry the page.
          </p>
        ) : records.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-soft">
            No records on file. Your lab results, prescriptions and visit notes will land here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {records.map((r) => {
              const checked = selected.has(r.id);
              return (
                <li key={r.id} className="flex items-center gap-2">
                  {selectMode ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.title}`}
                      className="h-4 w-4"
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
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-inner bg-surface-2 px-4 py-3 hover:bg-surface-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">
                        {r.title}
                      </p>
                      <p className="t-micro">
                        {formatDayLabel(r.date)}
                        {r.diagnosis ? ` · ${r.diagnosis}` : ""}
                      </p>
                    </div>
                    <Pill tone="info">{r.recordType}</Pill>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
