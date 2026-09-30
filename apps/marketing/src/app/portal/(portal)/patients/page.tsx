"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Users,
  ChevronRight,
  Hash,
  Phone,
  Mail,
  CalendarClock,
  LayoutGrid,
  List as ListIcon,
  CalendarPlus,
  DoorOpen,
  HeartPulse,
  Droplet,
  X,
  Loader2,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { ageFrom, formatDate, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  StatTile,
} from "@/portal/components/doctor/Workspace";

interface PatientRow {
  patient: {
    id: string;
    nic?: string | null;
    dob?: string | null;
    sex?: string | null;
    bloodGroup?: string | null;
    photo?: string | null;
  };
  user: { id: string; name: string; phone?: string | null; email?: string | null };
  lastVisitAt?: string | null;
}

interface SearchResponse {
  patients: PatientRow[];
  count?: number;
}

type ViewMode = "list" | "grid";
type SortMode = "recent" | "name";
type Filter = "all" | "active" | "female" | "male";

const ACTIVE_WINDOW_DAYS = 30;

function sexOf(sex?: string | null): "F" | "M" | null {
  const s = sex?.trim().toLowerCase();
  if (s === "f" || s === "female") return "F";
  if (s === "m" || s === "male") return "M";
  return null;
}

function sexLabel(sex?: string | null) {
  const s = sexOf(sex);
  return s === "F" ? "Female" : s === "M" ? "Male" : sex || null;
}

function isActive(row: PatientRow) {
  if (!row.lastVisitAt) return false;
  return (Date.now() - +new Date(row.lastVisitAt)) / 86_400_000 <= ACTIVE_WINDOW_DAYS;
}

export default function PatientsPage() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const [debounced, setDebounced] = useState(initialQ.trim());
  const [view, setView] = useState<ViewMode>("list");
  const [sort, setSort] = useState<SortMode>("recent");
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // "/" focuses the registry search (unless already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: searchData, isLoading: searchLoading, isFetching } = useQuery({
    queryKey: qk.patientSearch({ q: debounced }),
    queryFn: () =>
      api<SearchResponse>(
        `/doctor/search-patients?q=${encodeURIComponent(debounced)}&limit=30`,
      ),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: qk.recentPatients,
    queryFn: () =>
      api<SearchResponse>(`/doctor/search-patients?recent=1&limit=50`),
    staleTime: 60_000,
  });

  const isSearching = debounced.length >= 2;
  const rawRows = isSearching ? searchData?.patients ?? [] : recentData?.patients ?? [];
  const loading = isSearching ? searchLoading : recentLoading;

  // Panel stats always describe the recent panel, not the search results.
  const stats = useMemo(() => {
    const panel = recentData?.patients ?? [];
    const total = panel.length;
    const female = panel.filter((r) => sexOf(r.patient.sex) === "F").length;
    const male = panel.filter((r) => sexOf(r.patient.sex) === "M").length;
    return {
      total,
      female,
      male,
      withBlood: panel.filter((r) => r.patient.bloodGroup).length,
      recent: panel.filter(isActive).length,
    };
  }, [recentData]);

  const rows = useMemo(() => {
    const out = rawRows.filter((r) => {
      if (filter === "active") return isActive(r);
      if (filter === "female") return sexOf(r.patient.sex) === "F";
      if (filter === "male") return sexOf(r.patient.sex) === "M";
      return true;
    });
    if (sort === "name") {
      out.sort((a, b) => a.user.name.localeCompare(b.user.name));
    } else {
      out.sort((a, b) => {
        const av = a.lastVisitAt ? +new Date(a.lastVisitAt) : 0;
        const bv = b.lastVisitAt ? +new Date(b.lastVisitAt) : 0;
        return bv - av;
      });
    }
    return out;
  }, [rawRows, sort, filter]);

  const filterCounts: Record<Filter, number> = {
    all: rawRows.length,
    active: rawRows.filter(isActive).length,
    female: rawRows.filter((r) => sexOf(r.patient.sex) === "F").length,
    male: rawRows.filter((r) => sexOf(r.patient.sex) === "M").length,
  };

  const pct = (n: number) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-6 pb-10">
      {/* ── 1. Hero + floating stat strip ─────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Users size={13} aria-hidden />}
          kicker="Master patient index"
          kickerMeta={recentLoading ? "Loading panel…" : `${stats.total} on your panel`}
          title={
            <>
              Patient{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                registry
              </span>
            </>
          }
          description="Find anyone on your panel by name, NIC or phone and jump straight into their chart."
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {stats.recent} seen in {ACTIVE_WINDOW_DAYS} days
              </span>
              <span className={HERO_CHIP}>
                <kbd className="rounded border border-white/20 px-1 font-mono text-[10px] text-white/70">/</kbd>
                to search
              </span>
            </>
          }
          actions={
            <>
              <Link href="/portal/schedule" className={HERO_GHOST}>
                <CalendarPlus size={15} aria-hidden />
                My schedule
              </Link>
              <Link href="/portal/walk-ins" className={HERO_PRIMARY}>
                <DoorOpen size={15} className="text-sky-600" aria-hidden />
                Check in walk-in
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Panel size"
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={recentLoading ? "…" : String(stats.total)}
            sub="Patients under your care"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <StatTile
            label={`Seen in ${ACTIVE_WINDOW_DAYS} days`}
            icon={<CalendarClock size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={recentLoading ? "…" : String(stats.recent)}
            sub={`${pct(stats.recent)}% of panel`}
            progress={stats.total > 0 ? pct(stats.recent) : null}
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <StatTile
            label="Blood group on file"
            icon={<HeartPulse size={16} />}
            tone="bg-rose-50 text-rose-600"
            value={recentLoading ? "…" : String(stats.withBlood)}
            sub={`${pct(stats.withBlood)}% typed`}
            progress={stats.total > 0 ? pct(stats.withBlood) : null}
          />
          <StatTile
            label="Female · Male"
            icon={<Users size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={recentLoading ? "…" : `${stats.female} · ${stats.male}`}
            sub={
              stats.total - stats.female - stats.male > 0
                ? `${stats.total - stats.female - stats.male} unspecified`
                : "Demographic split"
            }
          />
        </HeroOverlap>
      </div>

      {/* ── 2. Directory ─────────────────────────────────────────────── */}
      <section className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)]">
        {/* Search */}
        <div className="p-4 sm:p-5 flex flex-col gap-3.5 border-b border-slate-100">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQ("");
              }}
              placeholder="Search by name, NIC (e.g. 199012345678) or phone (e.g. 0771234567)…"
              aria-label="Search patients"
              className="w-full h-12 pl-11 pr-20 rounded-xl border border-slate-200 bg-slate-50/60 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {isFetching && isSearching ? (
                <Loader2 size={15} className="text-sky-600 animate-spin" />
              ) : null}
              {q.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="h-7 w-7 rounded-lg bg-slate-200/70 hover:bg-slate-300/70 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-400">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Filters + view controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ["all", "All"],
                  ["active", `Seen ≤${ACTIVE_WINDOW_DAYS}d`],
                  ["female", "Female"],
                  ["male", "Male"],
                ] as const
              ).map(([key, label]) => {
                const on = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={on}
                    style={on ? { backgroundColor: "#07233a", color: "#ffffff", borderColor: "#07233a" } : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition-colors cursor-pointer",
                      !on && "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        "tabular-nums text-[11px] font-bold",
                        on ? "text-white/70" : "text-slate-400",
                      )}
                    >
                      {filterCounts[key]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Segmented
                value={sort}
                onChange={setSort}
                options={[
                  { value: "recent", label: "Recent" },
                  { value: "name", label: "A–Z" },
                ]}
              />
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: "list", label: <ListIcon size={15} />, title: "List view" },
                  { value: "grid", label: <LayoutGrid size={15} />, title: "Grid view" },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Results caption */}
        <div className="px-5 pt-3.5 pb-2 flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-900">
            {isSearching ? `Results for "${debounced}"` : "Recent patients"}
          </span>
          <span className="text-slate-400">
            {rows.length} {rows.length === 1 ? "patient" : "patients"}
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="px-5 pb-5 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-3 w-20 hidden md:block" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-14 px-4 flex flex-col items-center justify-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center ring-1 ring-sky-100">
              <Search size={24} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                {isSearching
                  ? `No patients match "${debounced}"`
                  : filter !== "all"
                    ? "No patients match this filter"
                    : "No patients on record yet"}
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                {isSearching
                  ? "Check the spelling, or try a full NIC or phone number instead."
                  : filter !== "all"
                    ? "Try a different filter to see more of your panel."
                    : "Patients appear here once they're registered or checked in for a visit."}
              </p>
            </div>
            {isSearching || filter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setFilter("all");
                }}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <X size={13} />
                Clear search &amp; filters
              </button>
            ) : (
              <Link
                href="/portal/walk-ins"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700"
              >
                <DoorOpen size={14} />
                Check in a walk-in
              </Link>
            )}
          </div>
        ) : view === "list" ? (
          <div>
            <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_90px_minmax(0,1fr)_32px] gap-4 px-5 py-2 border-y border-slate-100 bg-slate-50/70 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              <span>Patient</span>
              <span>Contact</span>
              <span>Blood</span>
              <span>Last encounter</span>
              <span />
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((p) => (
                <PatientListRow key={p.patient.id} row={p} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {rows.map((p) => (
              <PatientCard key={p.patient.id} row={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-100 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            title={o.title}
            aria-label={o.title}
            aria-pressed={on}
            className={cn(
              "h-7 min-w-7 px-2.5 rounded-[10px] text-xs font-semibold inline-flex items-center justify-center transition-all cursor-pointer",
              on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function BloodBadge({ group }: { group?: string | null }) {
  if (!group) return <span className="text-xs text-slate-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100">
      <Droplet size={10} fill="currentColor" />
      {group}
    </span>
  );
}

function PatientListRow({ row }: { row: PatientRow }) {
  const p = row.patient;
  const u = row.user;
  const age = p.dob ? ageFrom(p.dob) : null;
  const sex = sexLabel(p.sex);
  const demo = [age != null ? `${age} yrs` : null, sex].filter(Boolean).join(" · ");
  const recent = isActive(row);

  return (
    <li>
      <Link
        href={`/portal/patients/${p.id}/overview`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_90px_minmax(0,1fr)_32px] items-center gap-4 px-5 py-3.5 hover:bg-sky-50/50 transition-colors"
      >
        {/* Patient */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={u.name} src={p.photo ?? undefined} size="md" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
              {u.name}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {demo || "Demographics not recorded"}
              <span className="md:hidden">{u.phone ? ` · ${u.phone}` : ""}</span>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="hidden md:flex flex-col gap-0.5 min-w-0 text-xs text-slate-600">
          {u.phone ? (
            <span className="inline-flex items-center gap-1.5 truncate">
              <Phone size={11} className="text-slate-400 shrink-0" />
              {u.phone}
            </span>
          ) : null}
          {p.nic ? (
            <span className="inline-flex items-center gap-1.5 truncate font-mono text-[11px] text-slate-500">
              <Hash size={11} className="text-slate-400 shrink-0" />
              {p.nic}
            </span>
          ) : null}
          {!u.phone && !p.nic && u.email ? (
            <span className="inline-flex items-center gap-1.5 truncate">
              <Mail size={11} className="text-slate-400 shrink-0" />
              {u.email}
            </span>
          ) : null}
          {!u.phone && !p.nic && !u.email ? <span className="text-slate-300">—</span> : null}
        </div>

        {/* Blood */}
        <div className="hidden md:block">
          <BloodBadge group={p.bloodGroup} />
        </div>

        {/* Last encounter */}
        <div className="flex flex-col items-end md:items-start min-w-0">
          {row.lastVisitAt ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                {recent ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /> : null}
                {relativeTime(row.lastVisitAt)}
              </span>
              <span className="text-[11px] text-slate-400 hidden md:inline">
                {formatDate(row.lastVisitAt)}
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-400">No visits yet</span>
          )}
        </div>

        <ChevronRight
          size={16}
          className="hidden md:block text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all justify-self-end"
        />
      </Link>
    </li>
  );
}

function PatientCard({ row }: { row: PatientRow }) {
  const p = row.patient;
  const u = row.user;
  const age = p.dob ? ageFrom(p.dob) : null;
  const sex = sexLabel(p.sex);
  const recent = isActive(row);

  return (
    <Link href={`/portal/patients/${p.id}/overview`} className="block group h-full">
      <div className="h-full flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-sky-300 hover:shadow-md hover:-translate-y-0.5 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={u.name} src={p.photo ?? undefined} size="md" />
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-sky-700 transition-colors">
                {u.name}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {[age != null ? `${age} yrs` : null, sex].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>
          {p.bloodGroup ? <BloodBadge group={p.bloodGroup} /> : null}
        </div>

        <div className="mt-4 flex flex-col gap-1.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2 truncate">
            <Phone size={12} className="text-slate-400 shrink-0" />
            {u.phone || <span className="text-slate-300">No phone</span>}
          </span>
          <span className="inline-flex items-center gap-2 truncate font-mono text-[11px] text-slate-500">
            <Hash size={12} className="text-slate-400 shrink-0" />
            {p.nic || <span className="font-sans text-slate-300">No NIC</span>}
          </span>
        </div>

        <div className="mt-auto pt-3.5">
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              {recent ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
              {row.lastVisitAt ? `Seen ${relativeTime(row.lastVisitAt)}` : "No visits yet"}
            </span>
            <span className="inline-flex items-center gap-0.5 font-semibold text-sky-700 opacity-0 group-hover:opacity-100 transition-opacity">
              Open chart
              <ChevronRight size={13} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
