"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  Eye,
  Lock,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  BreakdownBar,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PrimaryLink,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

interface CareTeamMember {
  id: string;
  doctorId?: string;
  doctorName: string;
  doctorSpecialization: string;
  role: string;
  scope: string;
  status: "active" | "paused" | "revoked";
}

type Filter = "all" | "active" | "paused" | "revoked";

function formatRole(role: string): string {
  const r = role.toLowerCase().replace(/_/g, " ");
  if (r.includes("primary")) return "Primary care";
  if (r.includes("specialist")) return "Specialist";
  if (r.includes("pharmacist")) return "Pharmacist";
  if (r.includes("nurse")) return "Nurse";
  return humanize(r);
}

function formatScope(scope: string): string {
  const s = scope.toLowerCase().replace(/_/g, " ");
  if (s.includes("full")) return "Full record";
  if (s.includes("read")) return "Read-only";
  if (s.includes("summary")) return "Summary only";
  return humanize(s);
}

function initialsOf(name: string): string {
  const parts = name.replace(/^Dr\.?\s*/i, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.replace(/^Dr\.?\s*/i, "").slice(0, 2).toUpperCase();
}

const ROLE_COLOR: Record<string, string> = {
  "Primary care": "bg-sky-500",
  Specialist: "bg-violet-500",
  Pharmacist: "bg-emerald-500",
  Nurse: "bg-amber-500",
};

export default function CareTeamPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const qc = useQueryClient();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const team = useQuery({
    queryKey: ["patient", "care-team", patientId],
    queryFn: () => api<{ members: CareTeamMember[] }>(`/care-team?patientId=${encodeURIComponent(patientId)}`),
    enabled: Boolean(patientId),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" | "revoked" }) =>
      api(`/care-team/${id}`, { method: "PATCH", json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "care-team", patientId] }),
  });

  const rawMembers = team.data?.members ?? [];
  const loading = profile.isLoading || team.isLoading;

  const { active, paused, revoked, roles } = useMemo(() => {
    const tally = new Map<string, number>();
    for (const m of rawMembers) {
      if (m.status === "revoked") continue;
      const r = formatRole(m.role);
      tally.set(r, (tally.get(r) ?? 0) + 1);
    }
    return {
      active: rawMembers.filter((m) => m.status === "active"),
      paused: rawMembers.filter((m) => m.status === "paused"),
      revoked: rawMembers.filter((m) => m.status === "revoked"),
      roles: [...tally.entries()].map(([label, count]) => ({ key: label, label, count, color: ROLE_COLOR[label] ?? "bg-slate-400" })).sort((a, b) => b.count - a.count),
    };
  }, [rawMembers]);

  const filteredMembers = useMemo(() => {
    let list = rawMembers;
    if (filter !== "all") list = list.filter((m) => m.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.doctorName.toLowerCase().includes(q) ||
          (m.doctorSpecialization ?? "").toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q),
      );
    }
    const rank = { active: 0, paused: 1, revoked: 2 } as const;
    return [...list].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [rawMembers, filter, search]);

  const withAccess = active.length + paused.length;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<Users size={13} aria-hidden />}
          kicker="Care team"
          kickerMeta={`${active.length} with access`}
          title={
            <>
              Who can see <HeroAccent>your record</HeroAccent>
            </>
          }
          description="Doctors you add can read your record, prescribe and write notes. Pause access anytime, or revoke it for good."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Every access is logged
              </span>
              {paused.length > 0 ? (
                <button type="button" onClick={() => setFilter("paused")} className={cn(HERO_CHIP, "transition-colors hover:bg-white/10")}>
                  <Pause size={12} className="text-amber-300" aria-hidden />
                  {paused.length} paused
                </button>
              ) : null}
            </>
          }
          actions={
            <>
              <Link href="/patient/appointments/book" className={HERO_GHOST}>
                <CalendarPlus size={15} aria-hidden />
                Book visit
              </Link>
              <Link href="/patient/care-team/add" className={HERO_PRIMARY}>
                <UserPlus size={15} className="text-sky-600" aria-hidden />
                Add clinician
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Clinicians"
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={loading ? "…" : String(rawMembers.length)}
            sub={`${roles.length} role${roles.length === 1 ? "" : "s"}`}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <StatTile
            label="Active access"
            icon={<UserCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(active.length)}
            sub="Can open your record"
            progress={rawMembers.length ? Math.round((active.length / rawMembers.length) * 100) : null}
            active={filter === "active"}
            onClick={() => setFilter(filter === "active" ? "all" : "active")}
          />
          <StatTile
            label="Paused"
            icon={<Pause size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(paused.length)}
            sub="Temporarily blocked"
            active={filter === "paused"}
            onClick={() => setFilter(filter === "paused" ? "all" : "paused")}
          />
          <StatTile
            label="Revoked"
            icon={<Ban size={16} />}
            tone="bg-rose-50 text-rose-600"
            value={String(revoked.length)}
            sub="Access removed"
            active={filter === "revoked"}
            onClick={() => setFilter(filter === "revoked" ? "all" : "revoked")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="ct-list">
          <PanelHeader
            id="ct-list"
            icon={<Stethoscope size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={filter === "all" ? "Your clinicians" : `${humanize(filter)} clinicians`}
            caption={loading ? "Loading…" : `${filteredMembers.length} of ${rawMembers.length} shown`}
            action={
              filter !== "all" || search ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <RotateCcw size={12} aria-hidden />
                  Reset
                </button>
              ) : null
            }
          />
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PanelSearch value={search} onChange={setSearch} placeholder="Search name, specialty or role…" ariaLabel="Search care team" />
            <Segmented<Filter>
              ariaLabel="Care team filters"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: rawMembers.length },
                { value: "active", label: "Active", count: active.length },
                { value: "paused", label: "Paused", count: paused.length },
              ]}
            />
          </div>

          {update.isError ? (
            <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {update.error instanceof Error ? update.error.message : "Could not update access."}
            </p>
          ) : null}

          {loading ? (
            <PanelSkeleton rows={3} />
          ) : team.isError ? (
            <PanelError onRetry={() => void team.refetch()} />
          ) : filteredMembers.length === 0 ? (
            <EmptyBlock
              icon={<Users size={19} />}
              title="No clinicians found"
              body={
                search
                  ? `No clinicians match "${search}".`
                  : "Add your family doctor or specialists so they can see your records and treatment plan."
              }
              actions={
                <PrimaryLink href="/patient/care-team/add" icon={<UserPlus size={13} />}>
                  Add clinician
                </PrimaryLink>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filteredMembers.map((m) => {
                const isActive = m.status === "active";
                const isPaused = m.status === "paused";
                const name = m.doctorName.startsWith("Dr") ? m.doctorName : `Dr. ${m.doctorName}`;
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "group relative flex flex-col gap-3 rounded-xl p-3.5 transition-all sm:flex-row sm:items-center",
                      isActive
                        ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                        : "bg-slate-50/70",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-y-3 left-0 w-[3px] rounded-r-full",
                        isActive ? "bg-emerald-500" : isPaused ? "bg-amber-400" : "bg-rose-400",
                      )}
                      aria-hidden
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <span
                        className={cn(
                          "relative ml-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-sm font-semibold text-white",
                          isActive ? "bg-gradient-to-br from-sky-400 to-blue-600 shadow-md shadow-sky-500/25" : "bg-slate-300",
                        )}
                        aria-hidden
                      >
                        {initialsOf(m.doctorName)}
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                            isActive ? "bg-emerald-500" : isPaused ? "bg-amber-400" : "bg-rose-400",
                          )}
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className={cn("truncate text-sm font-semibold", isActive ? "text-slate-900" : "text-slate-500")}>{name}</h3>
                          <Badge tone={isActive ? "emerald" : isPaused ? "amber" : "rose"}>
                            {isActive ? "Active" : isPaused ? "Paused" : "Revoked"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-400">
                          {m.doctorSpecialization ? (
                            <span className="inline-flex items-center gap-1">
                              <Stethoscope size={12} aria-hidden />
                              {m.doctorSpecialization}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                            <UserCheck size={12} aria-hidden />
                            {formatRole(m.role)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Eye size={12} aria-hidden />
                            {formatScope(m.scope)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {m.status !== "revoked" ? (
                      <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => update.mutate({ id: m.id, status: isActive ? "paused" : "active" })}
                          disabled={update.isPending}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-slate-900 disabled:opacity-50"
                        >
                          {isActive ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}
                          {isActive ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Revoke record access for ${m.doctorName}? They will no longer be able to view your clinical data.`)) {
                              update.mutate({ id: m.id, status: "revoked" });
                            }
                          }}
                          disabled={update.isPending}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                        >
                          <Ban size={12} aria-hidden />
                          Revoke
                        </button>
                        {m.doctorId ? (
                          <Link
                            href={`/patient/appointments/book?doctorId=${m.doctorId}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#07233a] px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                          >
                            <CalendarPlus size={12} aria-hidden />
                            Book
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Access overview">
          <section className={PANEL} aria-labelledby="ct-roles">
            <PanelHeader
              id="ct-roles"
              icon={<Users size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Team by role"
              caption={`${withAccess} with access`}
            />
            {withAccess === 0 ? (
              <EmptyBlock icon={<Users size={19} />} title="No one yet" body="Roles appear here as you add clinicians." />
            ) : (
              <BreakdownBar items={roles} total={withAccess} />
            )}
          </section>

          <section className={PANEL} aria-labelledby="ct-how">
            <PanelHeader id="ct-how" icon={<Lock size={16} />} tone="bg-emerald-50 text-emerald-600" title="How access works" caption="You're always in control" />
            <ul className="mt-4 flex flex-col gap-3">
              {[
                { icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", title: "Active", body: "Can view your record and add notes or prescriptions." },
                { icon: Pause, tone: "bg-amber-50 text-amber-600", title: "Paused", body: "Access is blocked until you resume it — nothing is deleted." },
                { icon: Ban, tone: "bg-rose-50 text-rose-600", title: "Revoked", body: "Permanently removed. Add them again if you change your mind." },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <li key={r.title} className="flex items-start gap-3">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", r.tone)} aria-hidden>
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-slate-900">{r.title}</span>
                      <span className="block text-xs leading-relaxed text-slate-500">{r.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link href="/patient/audit" className="mt-4 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50">
              <Eye size={12} aria-hidden />
              See who opened your record
            </Link>
          </section>
        </aside>
      </div>
    </PatientPage>
  );
}
