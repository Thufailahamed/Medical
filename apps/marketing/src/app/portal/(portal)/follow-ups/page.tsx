"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  Clock4,
  XCircle,
  RotateCcw,
  ChevronRight,
  Plus,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Drawer } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PRIMARY_BTN,
  ROW_LINK,
  RowAccent,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { FollowUpForm } from "@/portal/components/followups/FollowUpForm";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface FollowUp {
  id: string;
  patientId: string;
  title: string;
  notes: string | null;
  followUpDate: string | null;
  status: string;
  createdAt: string;
  patient: { id: string; name: string } | null;
}

type Tab = "upcoming" | "overdue" | "completed" | "all";

export default function FollowUpsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [pickedPatient, setPickedPatient] = useState<{ id: string; name: string } | null>(null);

  function closeDrawer() {
    setCreating(false);
    setPickedPatient(null);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "follow-ups"],
    queryFn: () =>
      api<{ followUps: FollowUp[]; count: number }>(
        "/doctor-portal/follow-ups?limit=200"
      ),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api(`/doctor-portal/follow-ups/${id}/status`, {
        method: "PATCH",
        json: { status },
      });
    },
    onSuccess: () => {
      toast.success(t("toast.saved"), "");
      qc.invalidateQueries({ queryKey: ["doctor-portal", "follow-ups"] });
    },
    onError: (err: any) => {
      toast.error(t("toast.error"), err?.message);
    },
  });

  const allFollowUps = data?.followUps ?? [];
  const today = new Date().toISOString().split("T")[0];

  // Status telemetry counters
  const totalCount = allFollowUps.length;
  const upcomingCount = useMemo(
    () =>
      allFollowUps.filter((f) => {
        const isFuture = (f.followUpDate || "") >= today;
        return isFuture && f.status !== "cancelled" && f.status !== "completed";
      }).length,
    [allFollowUps, today]
  );
  const completedCount = useMemo(
    () => allFollowUps.filter((f) => f.status === "completed").length,
    [allFollowUps]
  );
  const overdueCount = useMemo(
    () =>
      allFollowUps.filter((f) => {
        const isPast = Boolean(f.followUpDate) && (f.followUpDate || "") < today;
        return isPast && f.status === "pending";
      }).length,
    [allFollowUps, today]
  );

  const filtered = allFollowUps.filter((f) => {
    // Tab filter
    if (tab === "completed" && f.status !== "completed") return false;
    if (tab === "overdue" && !isOverdueRow(f)) return false;
    if (tab === "upcoming") {
      const isFuture = (f.followUpDate || "") >= today;
      if (!isFuture || f.status === "cancelled" || f.status === "completed") return false;
    }
    // Search query filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      (f.patient?.name && f.patient.name.toLowerCase().includes(q)) ||
      (f.notes && f.notes.toLowerCase().includes(q))
    );
  });

  function isOverdueRow(f: FollowUp) {
    return Boolean(f.followUpDate) && (f.followUpDate || "") < today && f.status === "pending";
  }

  const dueThisWeek = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    const weekOut = d.toISOString().split("T")[0];
    return allFollowUps.filter(
      (f) =>
        f.status === "pending" && !!f.followUpDate && f.followUpDate >= today && f.followUpDate <= weekOut,
    ).length;
  }, [allFollowUps, today]);

  const closedCount = completedCount + allFollowUps.filter((f) => f.status === "cancelled").length;
  const completionPct = closedCount > 0 ? Math.round((completedCount / closedCount) * 100) : 0;

  function getStatusMeta(status: string, followUpDate: string | null) {
    if (status === "completed") {
      return { label: t("followUps.status.completed"), tone: "success" as const, accent: "bg-emerald-500" };
    }
    if (status === "cancelled") {
      return { label: t("followUps.status.cancelled"), tone: "neutral" as const, accent: "bg-slate-300" };
    }
    if (followUpDate && followUpDate < today) {
      return { label: "Overdue", tone: "danger" as const, accent: "bg-red-500" };
    }
    return { label: t("followUps.status.scheduled"), tone: "warn" as const, accent: "bg-amber-400" };
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<CalendarClock size={13} aria-hidden />}
          kicker="Continuity of care"
          kickerMeta={`${dueThisWeek} due this week`}
          title={
            <>
              Follow-ups &amp;{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                recalls
              </span>
            </>
          }
          description="Track post-consultation reviews, schedule proactive check-ins and close care gaps before a patient is lost to follow-up."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                SMS recall enabled
              </span>
              {overdueCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setTab("overdue")}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-400/15 px-3 py-1.5 text-xs font-semibold text-red-100 transition-colors hover:bg-red-400/25"
                >
                  <AlertTriangle size={12} aria-hidden />
                  {overdueCount} overdue
                </button>
              ) : null}
            </>
          }
          actions={
            <button type="button" onClick={() => setCreating(true)} className={HERO_PRIMARY}>
              <Plus size={15} strokeWidth={2.5} className="text-sky-600" aria-hidden />
              Schedule follow-up
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Upcoming"
            icon={<CalendarClock size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(upcomingCount)}
            sub={dueThisWeek > 0 ? `${dueThisWeek} due in 7 days` : "Active recall queue"}
            active={tab === "upcoming"}
            onClick={() => setTab("upcoming")}
          />
          <StatTile
            label="Overdue"
            icon={<AlertTriangle size={16} />}
            tone="bg-red-50 text-red-600"
            value={String(overdueCount)}
            sub={overdueCount > 0 ? "Missed review date" : "No missed reviews"}
            badge={overdueCount > 0 ? { text: "Action", tone: "bg-red-50 text-red-600" } : undefined}
            pulse={overdueCount > 0}
            active={tab === "overdue"}
            onClick={() => setTab("overdue")}
          />
          <StatTile
            label="Completed"
            icon={<Check size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(completedCount)}
            sub={closedCount > 0 ? `${completionPct}% of closed recalls` : "Successfully seen"}
            progress={closedCount > 0 ? completionPct : null}
            active={tab === "completed"}
            onClick={() => setTab("completed")}
          />
          <StatTile
            label="All recalls"
            icon={<Clock4 size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(totalCount)}
            sub="Every scheduled check-in"
            active={tab === "all"}
            onClick={() => setTab("all")}
          />
        </HeroOverlap>
      </div>

      {/* ── Recall list ────────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="fu-list">
        <PanelHeader
          id="fu-list"
          icon={<CalendarClock size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Recall queue"
          caption={
            isLoading
              ? "Loading follow-ups…"
              : `${filtered.length} shown${search ? ` · matching “${search}”` : ""}`
          }
        />

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch
            value={search}
            onChange={setSearch}
            placeholder="Search patient, reason or notes…"
            ariaLabel="Search follow-ups"
          />
          <Segmented<Tab>
            ariaLabel="Filter follow-ups"
            value={tab}
            onChange={setTab}
            options={[
              { value: "upcoming", label: "Upcoming", count: upcomingCount },
              { value: "overdue", label: "Overdue", count: overdueCount },
              { value: "completed", label: "Completed", count: completedCount },
              { value: "all", label: "All", count: totalCount },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[88px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<CalendarClock size={19} />}
            title={
              search
                ? "No matching follow-ups"
                : tab === "upcoming"
                  ? "No upcoming follow-ups"
                  : tab === "overdue"
                    ? "Nothing overdue"
                    : tab === "completed"
                      ? "No completed reviews yet"
                      : "No follow-ups yet"
            }
            body={
              search
                ? `Nothing matches “${search}”. Try a patient name or reason.`
                : tab === "overdue"
                  ? "Every pending recall is still on schedule."
                  : "Keep care on track by scheduling a review after a consultation or new treatment."
            }
            actions={
              search ? (
                <button type="button" onClick={() => setSearch("")} className={SECONDARY_BTN}>
                  Clear search
                </button>
              ) : (
                <button type="button" onClick={() => setCreating(true)} className={PRIMARY_BTN}>
                  <Plus size={13} strokeWidth={2.5} />
                  Schedule follow-up
                </button>
              )
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {filtered.map((f) => {
              const meta = getStatusMeta(f.status, f.followUpDate);
              const isDone = f.status === "completed";
              const isCancelled = f.status === "cancelled";
              const isPending = f.status === "pending";
              const isOverdue = isOverdueRow(f);
              const date = f.followUpDate ? new Date(`${f.followUpDate}T00:00:00`) : null;
              const days = date ? Math.round((+date - +new Date(`${today}T00:00:00`)) / 86_400_000) : null;

              return (
                <li key={f.id} className={cn(LIST_ROW, isOverdue && "bg-red-50/30")}>
                  <RowAccent className={meta.accent} />
                  <div className="flex min-w-0 flex-1 items-start gap-3.5 pl-1.5">
                    {/* Calendar chip */}
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl",
                        isOverdue
                          ? "bg-red-50 text-red-700"
                          : isDone
                            ? "bg-emerald-50 text-emerald-700"
                            : isCancelled
                              ? "bg-slate-100 text-slate-400"
                              : "bg-sky-50 text-sky-700",
                      )}
                      aria-hidden
                    >
                      {date ? (
                        <>
                          <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-80">
                            {date.toLocaleDateString("en", { month: "short" })}
                          </span>
                          <span className="text-lg font-semibold leading-none tabular-nums">{date.getDate()}</span>
                        </>
                      ) : (
                        <CalendarClock size={18} />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-semibold text-slate-900",
                            isCancelled && "text-slate-400 line-through",
                          )}
                        >
                          {f.title}
                        </span>
                        <Pill tone={meta.tone}>{meta.label}</Pill>
                        {isPending && days != null ? (
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold",
                              days < 0
                                ? "bg-red-50 text-red-600"
                                : days <= 2
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {days < 0
                              ? `${-days}d late`
                              : days === 0
                                ? "Today"
                                : days === 1
                                  ? "Tomorrow"
                                  : `in ${days}d`}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
                        <Link
                          href={`/portal/patients/${f.patientId}/follow-ups`}
                          className="truncate font-medium text-slate-600 hover:text-sky-700"
                        >
                          {f.patient?.name || t("followUps.unknownPatient")}
                        </Link>
                        <span className="text-slate-300">·</span>
                        <span className="shrink-0">Created {formatDate(f.createdAt)}</span>
                      </div>
                      {f.notes ? (
                        <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                          {f.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-1.5 sm:pl-0">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => updateStatus.mutate({ id: f.id, status: "completed" })}
                          disabled={updateStatus.isPending}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check size={13} strokeWidth={2.5} />
                          {t("followUps.markCompleted")}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus.mutate({ id: f.id, status: "cancelled" })}
                          disabled={updateStatus.isPending}
                          title={t("followUps.cancel")}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          {t("followUps.cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: f.id, status: "pending" })}
                        disabled={updateStatus.isPending}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700 disabled:opacity-50"
                      >
                        <RotateCcw size={12} />
                        Reopen
                      </button>
                    )}
                    <Link href={`/portal/patients/${f.patientId}/follow-ups`} className={ROW_LINK}>
                      Chart
                      <ChevronRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Create Follow-Up Drawer ────────────────────────────────────── */}
      <Drawer
        open={creating}
        onClose={closeDrawer}
        title={t("followUps.newTitle")}
        subtitle={pickedPatient?.name ?? t("followUps.newSubtitle")}
        size="md"
      >
        {!pickedPatient ? (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("followUps.fields.patient")}
            </label>
            <PatientCombobox value={null} onChange={(p) => p && setPickedPatient(p)} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
              <div>
                <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">
                  {t("followUps.fields.patient")}
                </span>
                <span className="text-sm font-extrabold text-slate-900 truncate">
                  {pickedPatient.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPickedPatient(null)}
                className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
              >
                {t("common.change")}
              </button>
            </div>
            <FollowUpForm
              patientId={pickedPatient.id}
              onSaved={closeDrawer}
              onCancel={closeDrawer}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
