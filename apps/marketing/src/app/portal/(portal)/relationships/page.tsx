"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { UserCheck, UserX, ChevronRight, Shield, Clock, Link as LinkIcon, Users, History } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Pill } from "@/portal/components/ui/Pill";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  ROW_LINK,
  RowAccent,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";

interface Relationship {
  id: string;
  patientId: string;
  doctorId: string;
  context: string;
  status: string;
  startDate: string;
  endDate: string | null;
  patient: { id: string; name: string } | null;
}

type Filter = "active" | "inactive" | "all";

const QUERY_KEY = ["doctor-patient-relationships"];

function humanize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RelationshipsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      api<{ relationships: Relationship[]; count: number }>(
        "/doctor-patient-relationships"
      ),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api(`/doctor-patient-relationships/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success(t("toast.deleted"), "");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err: unknown) => {
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined);
    },
  });

  const relationships = data?.relationships ?? [];
  const active = relationships.filter((r) => r.status === "active");
  const inactive = relationships.filter((r) => r.status !== "active");
  const contexts = new Map<string, number>();
  for (const r of active) contexts.set(r.context, (contexts.get(r.context) ?? 0) + 1);
  const topContext = [...contexts.entries()].sort((a, b) => b[1] - a[1])[0];

  const term = q.trim().toLowerCase();
  const shown = (filter === "active" ? active : filter === "inactive" ? inactive : relationships).filter(
    (r) => !term || (r.patient?.name ?? "").toLowerCase().includes(term) || r.context.toLowerCase().includes(term),
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <div>
        <DoctorHero
          kickerIcon={<LinkIcon size={13} aria-hidden />}
          kicker="Treating relationships"
          kickerMeta={`${active.length} active`}
          title={
            <>
              Doctor–patient{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                relationships
              </span>
            </>
          }
          description={t("relationships.subtitle")}
          chips={
            <span className={HERO_CHIP}>
              <Shield size={12} className="text-emerald-300" aria-hidden />
              Access to a chart follows an active relationship
            </span>
          }
          actions={
            <Link href="/portal/care-team" className={HERO_GHOST}>
              <Users size={15} aria-hidden />
              Care team
            </Link>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label={t("relationships.active")}
            icon={<UserCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={isLoading ? "…" : String(active.length)}
            sub="Patients you're treating"
            progress={relationships.length ? Math.round((active.length / relationships.length) * 100) : null}
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <StatTile
            label={t("relationships.inactive")}
            icon={<History size={16} />}
            tone="bg-slate-100 text-slate-600"
            value={String(inactive.length)}
            sub="Ended or revoked"
            active={filter === "inactive"}
            onClick={() => setFilter("inactive")}
          />
          <StatTile
            label="Top context"
            icon={<Shield size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={topContext ? String(topContext[1]) : "—"}
            sub={topContext ? humanize(topContext[0]) : "No active relationships"}
          />
          <StatTile
            label="All relationships"
            icon={<LinkIcon size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(relationships.length)}
            sub="Full history"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </HeroOverlap>
      </div>

      <section className={PANEL} aria-labelledby="rel-list">
        <PanelHeader
          id="rel-list"
          icon={<LinkIcon size={16} />}
          tone="bg-sky-50 text-sky-600"
          title={t("relationships.title")}
          caption={isLoading ? "Loading…" : `${shown.length} shown`}
        />
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch value={q} onChange={setQ} placeholder="Search patient or context…" ariaLabel="Search relationships" />
          <Segmented<Filter>
            ariaLabel="Filter relationships"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "active", label: t("relationships.active"), count: active.length },
              { value: "inactive", label: t("relationships.inactive"), count: inactive.length },
              { value: "all", label: "All", count: relationships.length },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyBlock
            icon={<UserCheck size={19} />}
            title={filter === "active" && !term ? t("relationships.noActive") : "No matching relationships"}
            body="A relationship is created when you see a patient — by appointment, walk-in or referral."
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {shown.map((r) => {
              const isActive = r.status === "active";
              const name = r.patient?.name || t("relationships.unknownPatient");
              const revoking = revokeMutation.isPending && revokeMutation.variables === r.id;
              return (
                <li key={r.id} className={LIST_ROW}>
                  <RowAccent className={isActive ? "bg-emerald-500" : "bg-slate-300"} />
                  <Link href={`/portal/patients/${r.patientId}`} className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5">
                    <Avatar name={name} size="md" className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                          {name}
                        </span>
                        <Pill tone={isActive ? "success" : "neutral"}>{humanize(r.status)}</Pill>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">
                          <Shield size={10} />
                          {humanize(r.context)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} />
                          {formatDate(r.startDate)}
                          {r.endDate ? ` – ${formatDate(r.endDate)}` : ""}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                    {isActive ? (
                      <button
                        type="button"
                        disabled={revoking}
                        onClick={() => {
                          if (confirm(`${t("relationships.revoke")} — ${name}?`)) revokeMutation.mutate(r.id);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <UserX size={13} />
                        {revoking ? "Revoking…" : t("relationships.revoke")}
                      </button>
                    ) : null}
                    <Link href={`/portal/patients/${r.patientId}`} className={ROW_LINK}>
                      {t("patients.openChart")}
                      <ChevronRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
