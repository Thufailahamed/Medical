"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, UserPlus, Users, ChevronRight, AlertCircle } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Input } from "@/portal/components/ui/Form";
import { Button } from "@/portal/components/ui/Button";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { ageFrom } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface PatientRow {
  patient: { id: string; nic?: string | null; dob?: string | null; sex?: string | null; bloodGroup?: string | null; photo?: string | null };
  user: { id: string; name: string; phone?: string | null; email?: string | null };
  lastVisitAt?: string | null;
  flags?: { allergies?: number; chronicConditions?: number };
}

interface SearchResponse { patients: PatientRow[]; count: number }

export default function PatientsPage() {
  const t = useT();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => { const id = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(id); }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: qk.patientSearch({ q: debounced }),
    queryFn: () => api<SearchResponse>(`/doctor/search-patients?q=${encodeURIComponent(debounced)}&limit=30`),
    enabled: debounced.length > 0,
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: qk.recentPatients,
    queryFn: () => api<SearchResponse>(`/doctor/search-patients?limit=10&recent=1`),
  });

  const rows = data?.patients ?? [];
  const recent = recentData?.patients ?? [];
  const showResults = debounced.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("patients.title")}
        subtitle={t("patients.subtitle")}
        icon={<Users size={18} className="text-brand" />}
      />

      {/* Search */}
      <Card>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("patients.searchPlaceholder")} className="pl-10" aria-label="Search patients" />
        </div>
      </Card>

      {showResults ? (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <span className="text-sm font-bold text-text">{t("patients.resultsTitle", { count: data?.count ?? rows.length })}</span>
            <span className="text-xs text-text-muted">{rows.length} shown</span>
          </div>
          {isLoading ? (
            <div className="p-4 flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <Empty title={t("patients.emptyResults")} className="py-12" />
          ) : (
            <ul className="flex flex-col">
              {rows.map((p) => <PatientLi key={p.patient.id} row={p} />)}
            </ul>
          )}
        </Card>
      ) : (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <span className="text-sm font-bold text-text">{t("patients.recentTitle")}</span>
            <Link href="/portal/care-team"><Button size="sm" variant="ghost">{t("patients.manageCareTeam")}</Button></Link>
          </div>
          {recentLoading ? (
            <div className="p-4 flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : recent.length === 0 ? (
            <Empty title={t("patients.emptyRecent")} className="py-12" />
          ) : (
            <ul className="flex flex-col">
              {recent.map((p) => <PatientLi key={p.patient.id} row={p} />)}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function PatientLi({ row }: { row: PatientRow }) {
  const p = row.patient;
  const u = row.user;
  const age = p.dob ? ageFrom(p.dob) : null;
  const flags = row.flags ?? {};
  const hasFlags = (flags.allergies ?? 0) > 0 || (flags.chronicConditions ?? 0) > 0;
  return (
    <li>
      <Link href={`/patients/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors group">
        <Avatar name={u.name} src={p.photo ?? undefined} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text truncate">{u.name}</span>
            {age != null && <span className="text-[11px] text-text-muted font-medium">{age}y · {p.sex ?? "—"}</span>}
          </div>
          <div className="text-xs text-text-muted truncate mt-0.5">
            {p.nic ? `NIC ${p.nic} · ` : ""}{u.phone ?? u.email ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {p.bloodGroup && <Pill tone="neutral">{p.bloodGroup}</Pill>}
          {(flags.allergies ?? 0) > 0 && <Pill tone="danger"><AlertCircle size={10} />{flags.allergies}</Pill>}
          {(flags.chronicConditions ?? 0) > 0 && <Pill tone="warn">{flags.chronicConditions} chronic</Pill>}
        </div>
        <ChevronRight size={14} className="text-text-muted/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </li>
  );
}
