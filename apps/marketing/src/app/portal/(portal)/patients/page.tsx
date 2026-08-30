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
  CalendarPlus,
  DoorOpen,
  HeartPulse,
  ExternalLink,
  X,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
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
    <div className="flex flex-col gap-6 pb-12">
      {/* ── 1. Signature Oceanic Doctor Patients Hero ──────────────────────── */}
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
                <Users size={12} className="text-sky-300" />
                Master Patient Index (MPI)
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Patient Registry &amp; Charts
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Search your clinical panel by name, National Identity Card (NIC), phone, or HealthHub ID. Access longitudinal health records, prescriptions, and lab panels.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/portal/schedule"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <CalendarPlus size={13} />
                <span>My Schedule</span>
              </Link>
              <Link
                href="/portal/walk-ins"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <DoorOpen size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>+ Check In Walk-In</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Users size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Panel Size
                </p>
                <p className="text-base font-extrabold text-white">
                  {stats.total} Patients
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <CalendarClock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active (30d)
                </p>
                <p className="text-base font-extrabold text-white">
                  {stats.recent} Visited
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <HeartPulse size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Blood Group
                </p>
                <p className="text-base font-extrabold text-white">
                  {stats.withBlood} Verified
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Stethoscope size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Demographics
                </p>
                <p className="text-base font-extrabold text-white">
                  {stats.female}F · {stats.total - stats.female}M
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Four Telemetry KPI Tiles ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <StatTile
          icon={<Users size={18} />}
          label="Total Clinical Panel"
          value={stats.total}
          tone="brand"
          sub="Registered under your care"
        />
        <StatTile
          icon={<CalendarClock size={18} />}
          label="Active Encounters (30d)"
          value={stats.recent}
          tone="success"
          sub={
            stats.total > 0
              ? `${Math.round((stats.recent / stats.total) * 100)}% of panel seen`
              : "No encounters"
          }
        />
        <StatTile
          icon={<HeartPulse size={18} />}
          label="Blood Group Recorded"
          value={stats.withBlood}
          tone="info"
          sub="ABO/Rh typing confirmed"
        />
        <StatTile
          icon={<Stethoscope size={18} />}
          label="Female / Male Patients"
          value={`${stats.female} / ${stats.total - stats.female}`}
          tone="violet"
          sub="Gender demographic split"
        />
      </div>

      {/* ── 3. Search & Patient Records Stage ───────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden flex flex-col">
        {/* Search Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Search size={13} className="text-sky-600" />
              <span>Find a Patient</span>
            </span>
            {isFetching && (
              <span className="text-[11px] font-semibold text-sky-700 inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-600 animate-ping" />
                Searching clinical registry…
              </span>
            )}
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by legal name, National Identity Card (NIC), phone number…"
              className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all shadow-2xs"
            />
            {q.length > 0 && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Hash size={11} className="text-slate-400" /> NIC e.g. 199012345678
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone size={11} className="text-slate-400" /> Phone e.g. 0771234567
            </span>
            <span className="inline-flex items-center gap-1">
              <Sparkles size={11} className="text-slate-400" /> Full or partial legal name
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              {isSearching ? `Search Results (${searchData?.count ?? rows.length})` : "Recent Patients"}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">{rows.length} shown</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort chips */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setSort("recent")}
                style={{
                  backgroundColor: sort === "recent" ? "#0284c7" : "transparent",
                  color: sort === "recent" ? "#ffffff" : "#475569",
                }}
                className="h-7 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
              >
                <ArrowUpDown size={11} />
                <span>Recent</span>
              </button>
              <button
                type="button"
                onClick={() => setSort("name")}
                style={{
                  backgroundColor: sort === "name" ? "#0284c7" : "transparent",
                  color: sort === "name" ? "#ffffff" : "#475569",
                }}
                className="h-7 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
              >
                <span>A → Z</span>
              </button>
            </div>

            {/* View chips */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                style={{
                  backgroundColor: view === "list" ? "#0c4a6e" : "transparent",
                  color: view === "list" ? "#ffffff" : "#64748b",
                }}
                className="h-7 w-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer"
                title="List View"
              >
                <ListIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                style={{
                  backgroundColor: view === "grid" ? "#0c4a6e" : "transparent",
                  color: view === "grid" ? "#ffffff" : "#64748b",
                }}
                className="h-7 w-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer"
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
          {loading ? (
            <div className="p-5 flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-2xl" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
                <Users size={26} />
              </div>
              <div className="max-w-md">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {isSearching ? `No patients match "${debounced}"` : "No Patients on Record"}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {isSearching
                    ? "Try adjusting your search by entering a different phone number, NIC, or partial name."
                    : "When patients are registered or checked in for appointments, they will appear here in your master patient index."}
                </p>
              </div>
            </div>
          ) : view === "list" ? (
            <ul className="divide-y divide-slate-100">
              {rows.map((p) => (
                <PatientListRow key={p.patient.id} row={p} />
              ))}
            </ul>
          ) : (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {rows.map((p) => (
                <PatientCard key={p.patient.id} row={p} />
              ))}
            </div>
          )}
        </div>
      </section>
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
  const cfg = {
    brand: {
      border: "border-sky-200 bg-sky-50/40",
      iconBg: "bg-sky-100 text-sky-700 border-sky-200",
      text: "text-slate-900",
    },
    success: {
      border: "border-emerald-200 bg-emerald-50/40",
      iconBg: "bg-emerald-100 text-emerald-700 border-emerald-200",
      text: "text-slate-900",
    },
    info: {
      border: "border-blue-200 bg-blue-50/40",
      iconBg: "bg-blue-100 text-blue-700 border-blue-200",
      text: "text-slate-900",
    },
    violet: {
      border: "border-purple-200 bg-purple-50/40",
      iconBg: "bg-purple-100 text-purple-700 border-purple-200",
      text: "text-slate-900",
    },
    neutral: {
      border: "border-slate-200 bg-slate-50/40",
      iconBg: "bg-slate-100 text-slate-700 border-slate-200",
      text: "text-slate-900",
    },
    warn: {
      border: "border-amber-200 bg-amber-50/40",
      iconBg: "bg-amber-100 text-amber-700 border-amber-200",
      text: "text-slate-900",
    },
    danger: {
      border: "border-rose-200 bg-rose-50/40",
      iconBg: "bg-rose-100 text-rose-700 border-rose-200",
      text: "text-slate-900",
    },
  }[tone];

  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5 sm:p-4 flex items-center gap-3.5 bg-white shadow-2xs transition-all",
        cfg.border,
      )}
    >
      <div
        className={cn(
          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs",
          cfg.iconBg,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-black tabular-nums leading-none text-slate-900">
          {value}
        </div>
        <div className="text-[11px] font-bold text-slate-600 mt-1 uppercase tracking-wide truncate">
          {label}
        </div>
        {sub && (
          <div className="text-[10px] text-slate-400 mt-0.5 truncate hidden sm:block">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function PatientListRow({ row }: { row: PatientRow }) {
  const p = row.patient;
  const u = row.user;
  const age = p.dob ? ageFrom(p.dob) : null;
  const lastVisit = row.lastVisitAt ? relativeTime(row.lastVisitAt) : null;

  return (
    <li>
      <Link
        href={`/portal/patients/${p.id}/overview`}
        className="flex items-center gap-4 px-5 py-4 hover:bg-sky-50/40 transition-colors group"
      >
        <Avatar name={u.name} src={p.photo ?? undefined} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
              {u.name}
            </span>
            {age != null && (
              <span className="text-xs text-slate-500 font-medium">
                {age}y · {p.sex ?? "—"}
              </span>
            )}
            {p.bloodGroup && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                {p.bloodGroup}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-3">
            {p.nic && (
              <span className="inline-flex items-center gap-1">
                <Hash size={11} className="text-slate-400" />
                {p.nic}
              </span>
            )}
            {u.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={11} className="text-slate-400" />
                {u.phone}
              </span>
            )}
            {u.email && !u.phone && (
              <span className="inline-flex items-center gap-1">
                <Mail size={11} className="text-slate-400" />
                {u.email}
              </span>
            )}
          </div>
        </div>

        {lastVisit && (
          <div className="hidden md:flex flex-col items-end shrink-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Last Encounter
            </span>
            <span className="text-xs text-slate-700 font-semibold mt-0.5">
              {lastVisit}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 text-sky-700 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Open Chart</span>
          <ChevronRight size={14} />
        </div>
      </Link>
    </li>
  );
}

function PatientCard({ row }: { row: PatientRow }) {
  const p = row.patient;
  const u = row.user;
  const age = p.dob ? ageFrom(p.dob) : null;
  const lastVisit = row.lastVisitAt ? relativeTime(row.lastVisitAt) : null;

  return (
    <Link href={`/portal/patients/${p.id}/overview`} className="block group">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 hover:border-sky-300 hover:shadow-xs transition-all h-full flex flex-col justify-between shadow-2xs">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={u.name} src={p.photo ?? undefined} size="md" />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-sky-700 transition-colors">
                  {u.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {age != null ? `${age} yrs · ${p.sex ?? "—"}` : p.sex ?? "—"}
                </p>
              </div>
            </div>
            {p.bloodGroup && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-50 text-sky-800 border border-sky-200 shrink-0">
                {p.bloodGroup}
              </span>
            )}
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-xs text-slate-500">
            {p.nic && (
              <div className="flex items-center gap-1.5 truncate">
                <Hash size={11} className="text-slate-400 shrink-0" />
                <span className="truncate">{p.nic}</span>
              </div>
            )}
            {u.phone && (
              <div className="flex items-center gap-1.5 truncate">
                <Phone size={11} className="text-slate-400 shrink-0" />
                <span className="truncate">{u.phone}</span>
              </div>
            )}
          </div>
        </div>

        {lastVisit && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
            <span>Last visit: {lastVisit}</span>
            <ExternalLink size={12} className="text-slate-400 group-hover:text-sky-600" />
          </div>
        )}
      </div>
    </Link>
  );
}
