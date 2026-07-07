"use client";

import { useEffect, useMemo, useState } from "react";
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
  Sparkles,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  Stethoscope,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Input } from "@/portal/components/ui/Form";
import { Button } from "@/portal/components/ui/Button";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { ageFrom, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

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

export default function PatientsPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const [debounced, setDebounced] = useState(initialQ.trim());
  const [view, setView] = useState<ViewMode>("list");
  const [sort, setSort] = useState<SortMode>("recent");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // Search results — only when user has typed ≥2 chars
  const { data: searchData, isLoading: searchLoading, isFetching } = useQuery({
    queryKey: qk.patientSearch({ q: debounced }),
    queryFn: () =>
      api<SearchResponse>(
        `/doctor/search-patients?q=${encodeURIComponent(debounced)}&limit=30`,
      ),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  // Recent / full list — shown when no search query
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: [...qk.recentPatients, sort],
    queryFn: () =>
      api<SearchResponse>(`/doctor/search-patients?recent=1&limit=50`),
    staleTime: 60_000,
  });

  const isSearching = debounced.length >= 2;
  const rawRows = isSearching ? searchData?.patients ?? [] : recentData?.patients ?? [];
  const loading = isSearching ? searchLoading : recentLoading;

  const rows = useMemo(() => {
    const out = rawRows.slice();
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
  }, [rawRows, sort]);

  const stats = useMemo(() => {
    const total = rawRows.length;
    const withBlood = rawRows.filter((r) => r.patient.bloodGroup).length;
    const female = rawRows.filter(
      (r) => r.patient.sex?.toUpperCase() === "F",
    ).length;
    const recent = rawRows.filter((r) => {
      if (!r.lastVisitAt) return false;
      const days = (Date.now() - +new Date(r.lastVisitAt)) / 86_400_000;
      return days <= 30;
    }).length;
    return { total, withBlood, female, recent };
  }, [rawRows]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("patients.title")}
        subtitle={t("patients.subtitle")}
        icon={<Users size={18} className="text-brand" />}
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatTile
          icon={<Users size={14} />}
          label={t("patients.stat.total")}
          value={stats.total}
          tone="brand"
        />
        <StatTile
          icon={<CalendarClock size={14} />}
          label={t("patients.stat.thisMonth")}
          value={stats.recent}
          tone="success"
          sub={
            stats.total > 0
              ? t("patients.stat.percentOfTotal", {
                  pct: Math.round((stats.recent / stats.total) * 100),
                })
              : undefined
          }
        />
        <StatTile
          icon={<Hash size={14} />}
          label={t("patients.stat.withBlood")}
          value={stats.withBlood}
          tone="info"
        />
        <StatTile
          icon={<Stethoscope size={14} />}
          label={t("patients.stat.female")}
          value={stats.female}
          tone="violet"
        />
      </div>

      {/* Search header + controls */}
      <Card padding={false} className="overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-gradient-to-r from-brand-soft/30 to-transparent">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="h-7 w-7 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
              <Search size={13} />
            </div>
            <div className="text-xs font-semibold text-text uppercase tracking-wider">
              {t("patients.find")}
            </div>
            {isFetching ? (
              <span className="text-[10px] text-text-muted ml-auto inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                {t("patients.searching")}
              </span>
            ) : null}
          </div>
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("patients.searchPlaceholder")}
              className="pl-10 h-11 text-sm font-medium"
              aria-label="Search patients"
              autoComplete="off"
              spellCheck={false}
            />
            {q.length > 0 ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md text-text-muted hover:text-text hover:bg-surface-2 inline-flex items-center justify-center"
                aria-label={t("patients.clearSearch")}
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Hash size={10} /> {t("patients.searchHint.nic")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone size={10} /> {t("patients.searchHint.phone")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Sparkles size={10} /> {t("patients.searchHint.name")}
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-text">
              {isSearching
                ? t("patients.resultsTitle", {
                    count: searchData?.count ?? rows.length,
                  })
                : t("patients.recentTitle")}
            </span>
            <span className="text-xs text-text-muted">
              {rows.length} {t("patients.shown")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-surface-2/40 p-0.5">
              <SortChip
                active={sort === "recent"}
                onClick={() => setSort("recent")}
              >
                {t("patients.sort.recent")}
              </SortChip>
              <SortChip
                active={sort === "name"}
                onClick={() => setSort("name")}
              >
                A → Z
              </SortChip>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-surface-2/40 p-0.5">
              <ViewChip
                active={view === "list"}
                onClick={() => setView("list")}
                aria-label={t("patients.view.list")}
              >
                <ListIcon size={13} />
              </ViewChip>
              <ViewChip
                active={view === "grid"}
                onClick={() => setView("grid")}
                aria-label={t("patients.view.grid")}
              >
                <LayoutGrid size={13} />
              </ViewChip>
            </div>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon={
              isSearching ? (
                <Search size={22} />
              ) : (
                <Users size={22} />
              )
            }
            title={
              isSearching
                ? t("patients.noResults", { q: debounced })
                : t("patients.noRecent")
            }
            description={
              isSearching
                ? t("patients.noResultsBody")
                : t("patients.noRecentBody")
            }
            className="py-10"
          />
        ) : view === "list" ? (
          <ul className="divide-y divide-border/60">
            {rows.map((p) => (
              <PatientListRow key={p.patient.id} row={p} />
            ))}
          </ul>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((p) => (
              <PatientCard key={p.patient.id} row={p} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  tone?: "neutral" | "brand" | "success" | "warn" | "danger" | "info" | "violet";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-all",
        tone === "brand" && "border-brand/30 bg-brand-soft/40",
        tone === "success" && "border-emerald-200/70 bg-emerald-50/60",
        tone === "info" && "border-sky-200/70 bg-sky-50/60",
        tone === "violet" && "border-violet-200/70 bg-violet-50/60",
        tone === "neutral" && "border-border/60 bg-surface-2/30",
        tone === "warn" && "border-warn/30 bg-warn-soft/30",
        tone === "danger" && "border-danger/30 bg-danger-soft/40"
      )}
    >
      <div
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
          tone === "brand" && "bg-brand text-white",
          tone === "success" && "bg-emerald-500 text-white",
          tone === "info" && "bg-sky-500 text-white",
          tone === "violet" && "bg-violet-500 text-white",
          tone === "neutral" && "bg-surface text-text-soft",
          tone === "warn" && "bg-warn text-white",
          tone === "danger" && "bg-danger text-white"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            "text-xl font-bold tabular-nums leading-tight",
            tone === "brand" && "text-brand",
            tone === "success" && "text-emerald-700",
            tone === "info" && "text-sky-700",
            tone === "violet" && "text-violet-700",
            tone === "danger" && "text-danger",
            tone === "warn" && "text-amber-700",
            tone === "neutral" && "text-text"
          )}
        >
          {value}
        </div>
        <div className="text-[10px] uppercase font-bold tracking-wider text-text-soft">
          {label}
        </div>
        {sub ? (
          <div className="text-[10px] text-text-muted mt-0.5">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}

function SortChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center gap-1",
        active
          ? "bg-brand text-white shadow-sm"
          : "text-text-soft hover:text-text hover:bg-surface"
      )}
    >
      <ArrowUpDown size={10} />
      {children}
    </button>
  );
}

function ViewChip({
  children,
  active,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={cn(
        "h-7 w-7 rounded-md inline-flex items-center justify-center transition-colors",
        active
          ? "bg-brand text-white shadow-sm"
          : "text-text-soft hover:text-text hover:bg-surface"
      )}
    >
      {children}
    </button>
  );
}

function PatientListRow({ row }: { row: PatientRow }) {
  const t = useT();
  const p = row.patient;
  const u = row.user;
  const age = p.dob ? ageFrom(p.dob) : null;
  const lastVisit = row.lastVisitAt ? relativeTime(row.lastVisitAt) : null;
  return (
    <li>
      <Link
        href={`/portal/patients/${p.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors group"
      >
        <Avatar name={u.name} src={p.photo ?? undefined} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text truncate">
              {u.name}
            </span>
            {age != null ? (
              <span className="text-[11px] text-text-muted font-medium">
                {age}y · {p.sex ?? "—"}
              </span>
            ) : null}
            {p.bloodGroup ? (
              <Pill tone="neutral">{p.bloodGroup}</Pill>
            ) : null}
          </div>
          <div className="text-xs text-text-soft truncate mt-0.5">
            {p.nic ? (
              <span className="inline-flex items-center gap-1 mr-2">
                <Hash size={10} className="text-text-muted" />
                {p.nic}
              </span>
            ) : null}
            {u.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone size={10} className="text-text-muted" />
                {u.phone}
              </span>
            ) : u.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail size={10} className="text-text-muted" />
                {u.email}
              </span>
            ) : null}
          </div>
        </div>
        {lastVisit ? (
          <div className="hidden md:flex flex-col items-end shrink-0">
            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
              {t("patients.lastVisit")}
            </span>
            <span className="text-[11px] text-text-soft font-medium">
              {lastVisit}
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand opacity-0 group-hover:opacity-100 transition-opacity">
            {t("patients.openChart")}
            <ChevronRight size={11} />
          </span>
          <ChevronRight
            size={14}
            className="text-text-muted/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </Link>
    </li>
  );
}

function PatientCard({ row }: { row: PatientRow }) {
  const t = useT();
  const p = row.patient;
  const u = row.user;
  const age = p.dob ? ageFrom(p.dob) : null;
  const lastVisit = row.lastVisitAt ? relativeTime(row.lastVisitAt) : null;
  return (
    <Link href={`/portal/patients/${p.id}`} className="block group">
      <Card className="hover:border-brand/40 hover:shadow-md transition-all group-hover:-translate-y-0.5 h-full">
        <div className="flex items-start gap-3">
          <Avatar
            name={u.name}
            src={p.photo ?? undefined}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-text truncate">
                {u.name}
              </span>
              {p.bloodGroup ? (
                <Pill tone="neutral">{p.bloodGroup}</Pill>
              ) : null}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {age != null ? `${age}y · ${p.sex ?? "—"}` : p.sex ?? "—"}
            </div>
          </div>
          <ChevronRight
            size={14}
            className="text-text-muted/40 shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </div>
        <div className="mt-3 pt-3 border-t border-border/60 flex flex-col gap-1.5 text-[11px]">
          {p.nic ? (
            <div className="flex items-center gap-1.5 text-text-soft truncate">
              <Hash size={10} className="text-text-muted shrink-0" />
              <span className="truncate">{p.nic}</span>
            </div>
          ) : null}
          {u.phone ? (
            <div className="flex items-center gap-1.5 text-text-soft truncate">
              <Phone size={10} className="text-text-muted shrink-0" />
              <span className="truncate">{u.phone}</span>
            </div>
          ) : u.email ? (
            <div className="flex items-center gap-1.5 text-text-soft truncate">
              <Mail size={10} className="text-text-muted shrink-0" />
              <span className="truncate">{u.email}</span>
            </div>
          ) : null}
          {lastVisit ? (
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CalendarClock size={10} className="shrink-0" />
              <span className="font-medium">
                {t("patients.lastVisit")}: {lastVisit}
              </span>
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
