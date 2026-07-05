"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Input } from "@/portal/components/ui/Form";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { ageFrom } from "@/portal/lib/format";

interface PatientRow {
  patient: {
    id: string;
    nic?: string | null;
    dob?: string | null;
    sex?: string | null;
    bloodGroup?: string | null;
    photo?: string | null;
  };
  user: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  lastVisitAt?: string | null;
  flags?: { allergies?: number; chronicConditions?: number };
}

interface SearchResponse {
  patients: PatientRow[];
  count: number;
}

export default function PatientsPage() {
  const t = useT();
  const [q, setQ] = useState("");

  // Debounced server search
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: qk.patientSearch({ q: debounced }),
    queryFn: () =>
      api<SearchResponse>(
        `/doctor/search-patients?q=${encodeURIComponent(debounced)}&limit=30`
      ),
    enabled: debounced.length > 0,
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: qk.recentPatients,
    queryFn: () =>
      api<SearchResponse>(`/doctor/search-patients?limit=10&recent=1`),
  });

  const rows = data?.patients ?? [];
  const recent = recentData?.patients ?? [];
  const showResults = debounced.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">{t("patients.title")}</h1>
        <p className="text-sm text-text-soft mt-1">{t("patients.subtitle")}</p>
      </div>

      <Card>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("patients.searchPlaceholder")}
            className="pl-9"
            aria-label="Search patients"
          />
        </div>
      </Card>

      {showResults ? (
        <Card padding={false}>
          <CardHeader title={t("patients.resultsTitle", { count: data?.count ?? rows.length })} />
          {isLoading ? (
            <div className="px-4 pb-4 flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <Empty title={t("patients.emptyResults")} className="m-4" />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((p) => (
                <PatientLi key={p.patient.id} row={p} />
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card padding={false}>
          <CardHeader
            title={t("patients.recentTitle")}
            right={
              <Link href="/portal/care-team">
                <Button size="sm" variant="ghost">
                  {t("patients.manageCareTeam")}
                </Button>
              </Link>
            }
          />
          {recentLoading ? (
            <div className="px-4 pb-4 flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : recent.length === 0 ? (
            <Empty title={t("patients.emptyRecent")} className="m-4" />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((p) => (
                <PatientLi key={p.patient.id} row={p} />
              ))}
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
  return (
    <li>
      <Link
        href={`/patients/${p.id}`}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
      >
        <Avatar name={u.name} src={p.photo ?? undefined} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text truncate">{u.name}</span>
            {age != null ? (
              <span className="text-[11px] text-text-muted">
                {age}y · {p.sex ?? "—"}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-text-soft truncate">
            {p.nic ? `NIC ${p.nic} · ` : ""}
            {u.phone ?? u.email ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {p.bloodGroup ? <Pill tone="neutral">{p.bloodGroup}</Pill> : null}
          {(flags.allergies ?? 0) > 0 ? (
            <Pill tone="danger">{flags.allergies} allergy</Pill>
          ) : null}
          {(flags.chronicConditions ?? 0) > 0 ? (
            <Pill tone="warn">{flags.chronicConditions} chronic</Pill>
          ) : null}
        </div>
      </Link>
    </li>
  );
}