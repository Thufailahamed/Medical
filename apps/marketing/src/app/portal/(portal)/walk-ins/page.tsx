"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  DoorOpen,
  ChevronRight,
  ListOrdered,
  Play,
  Phone,
  Plus,
  Stethoscope,
  Timer,
  RefreshCw,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Modal } from "@/portal/components/ui/Modal";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { toast } from "@/portal/components/ui/Toast";
import { useAuthStore } from "@/portal/stores/auth";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  SecondaryLink,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";

interface WalkIn {
  id: string;
  patientId: string;
  patientName: string | null;
  patientPhone?: string | null;
  doctorId: string;
  doctorName: string | null;
  arrivedAt: string;
  reason: string | null;
  priority: string;
  status: string;
  notes?: string | null;
  hospitalName?: string | null;
}

interface PatientSearchResult {
  id: string;
  name: string;
  phone: string | null;
  nic: string | null;
}

type StatusFilter = "waiting" | "in_consultation" | "completed" | "no_show" | "all";

const STATUS_META: Record<
  string,
  {
    tone: "brand" | "warn" | "success" | "danger" | "neutral";
    icon: typeof CheckCircle2;
    label: string;
  }
> = {
  waiting: { tone: "warn", icon: Clock, label: "Waiting" },
  in_consultation: { tone: "brand", icon: Play, label: "In Consultation" },
  completed: { tone: "success", icon: Check, label: "Completed" },
  no_show: { tone: "danger", icon: X, label: "No Show" },
};

const FILTER_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "waiting", label: "Waiting" },
  { value: "in_consultation", label: "In consult" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
  { value: "all", label: "All" },
];

const STATUS_CHIP: Record<string, string> = {
  waiting: "bg-amber-50 text-amber-700",
  in_consultation: "bg-sky-50 text-sky-700",
  completed: "bg-emerald-50 text-emerald-700",
  no_show: "bg-slate-100 text-slate-600",
};

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Minutes since arrival, for wait-time emphasis. */
function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

function formatWait(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function WalkInCard({
  walkIn,
  position,
  onStatusChange,
  isPending,
}: {
  walkIn: WalkIn;
  position: number | null;
  onStatusChange: (id: string, status: string) => void;
  isPending: boolean;
}) {
  const meta = STATUS_META[walkIn.status] ?? STATUS_META.waiting;
  const StatusIcon = meta.icon;
  const isUrgent = walkIn.priority === "urgent";
  const active = walkIn.status === "waiting" || walkIn.status === "in_consultation";
  const wait = minutesSince(walkIn.arrivedAt);
  const longWait = walkIn.status === "waiting" && wait >= 30;
  const chartHref = `/portal/patients/${walkIn.patientId}/overview`;

  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-shadow hover:shadow-[0_12px_32px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(15,23,42,0.07)] sm:p-5",
        walkIn.status === "in_consultation" && "shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1.5px_#38bdf8]",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isUrgent ? "bg-rose-500" : walkIn.status === "in_consultation" ? "bg-sky-500" : walkIn.status === "waiting" ? "bg-amber-400" : "bg-slate-200",
        )}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <Avatar name={walkIn.patientName} size="md" />
            {position != null ? (
              <span className="absolute -bottom-1 -right-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-[#07233a] px-1 font-mono text-[10px] font-semibold text-white ring-2 ring-white">
                {position}
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <Link
              href={chartHref}
              className="block truncate text-[15px] font-semibold text-slate-900 transition-colors hover:text-sky-700"
            >
              {walkIn.patientName ?? "Walk-in patient"}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              {walkIn.patientPhone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone size={11} className="text-slate-400" aria-hidden />
                  {walkIn.patientPhone}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Clock size={11} className="text-slate-400" aria-hidden />
                Arrived {relativeTime(walkIn.arrivedAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold", STATUS_CHIP[walkIn.status] ?? STATUS_CHIP.no_show)}>
            <StatusIcon size={11} aria-hidden />
            {meta.label}
          </span>
          {isUrgent ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-600">
              <AlertTriangle size={10} aria-hidden />
              Urgent
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-xs">
        <p className="font-medium text-slate-800">{walkIn.reason ?? "General consultation"}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
          {walkIn.status === "waiting" ? (
            <span className={cn("inline-flex items-center gap-1 font-semibold", longWait ? "text-rose-600" : "text-slate-600")}>
              <Timer size={12} aria-hidden />
              Waiting {formatWait(wait)}
            </span>
          ) : null}
          {walkIn.doctorName ? (
            <span className="inline-flex items-center gap-1">
              <Stethoscope size={12} aria-hidden />
              {walkIn.doctorName}
            </span>
          ) : null}
          {walkIn.hospitalName ? <span>{walkIn.hospitalName}</span> : null}
        </div>
        {walkIn.notes ? (
          <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-900">{walkIn.notes}</p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <div className="flex items-center gap-1.5">
          {walkIn.status === "waiting" ? (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Play size={12} fill="currentColor" />}
              disabled={isPending}
              onClick={() => onStatusChange(walkIn.id, "in_consultation")}
            >
              Call to room
            </Button>
          ) : null}
          {walkIn.status === "in_consultation" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onStatusChange(walkIn.id, "completed")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check size={13} strokeWidth={3} aria-hidden />
              Complete
            </button>
          ) : null}
          {active ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onStatusChange(walkIn.id, "no_show")}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <X size={13} aria-hidden />
              No-show
            </button>
          ) : null}
        </div>

        <Link
          href={chartHref}
          className="group/chart inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800"
        >
          Open chart
          <ChevronRight size={13} className="transition-transform group-hover/chart:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function WalkInForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [patientQuery, setPatientQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [doctorId] = useState(user?.id ?? "");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(patientQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [patientQuery]);

  const { data: patientData, isLoading: patientsLoading } = useQuery({
    queryKey: ["walk-ins", "search", debouncedQuery],
    queryFn: () =>
      api<{ patients: PatientSearchResult[] }>(
        `/walk-ins/search?q=${encodeURIComponent(debouncedQuery)}`,
      ),
    enabled: debouncedQuery.length >= 2 && !selectedPatient,
  });

  const patients = patientData?.patients ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      api<{ walkIn: WalkIn }>("/walk-ins", {
        method: "POST",
        json: {
          patientId: selectedPatient!.id,
          doctorId: doctorId || user?.id,
          reason: reason.trim() || undefined,
          priority,
        },
      }),
    onSuccess: () => {
      toast.success("Walk-in patient checked in successfully");
      qc.invalidateQueries({ queryKey: ["walk-ins"] });
      onCreated();
      onClose();
      setPatientQuery("");
      setDebouncedQuery("");
      setSelectedPatient(null);
      setReason("");
      setPriority("routine");
    },
    onError: (err: any) => toast.error("Error checking in walk-in", err?.message),
  });

  function handleClose() {
    onClose();
    setPatientQuery("");
    setDebouncedQuery("");
    setSelectedPatient(null);
    setReason("");
    setPriority("routine");
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Check In Arriving Walk-In Patient"
      subtitle="Register an arriving patient at reception or triage desk without a prior booking."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={!selectedPatient || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            <UserPlus size={14} />
            <span>Check In to Queue</span>
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
            Select Patient (Search by Name, Phone, or NIC)
          </label>
          {selectedPatient ? (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-sky-50 border border-sky-200">
              <Avatar name={selectedPatient.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {selectedPatient.name}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedPatient.phone ?? selectedPatient.nic ?? "Registered Patient"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="h-7 w-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Type patient name, phone number, or NIC…"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
                />
              </div>
              {debouncedQuery.length >= 2 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                  {patientsLoading ? (
                    <div className="p-3 flex flex-col gap-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : patients.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      No matching patients found.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {patients.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPatient(p);
                              setPatientQuery("");
                              setDebouncedQuery("");
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-sky-50/50 transition-colors cursor-pointer"
                          >
                            <Avatar name={p.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {p.phone ?? p.nic ?? "Patient Record"}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
            Reason for Visit / Chief Complaint
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Acute fever, headache, medication refill, dressing change…"
            rows={2}
            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
            Triage Priority
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPriority("routine")}
              style={{
                backgroundColor: priority === "routine" ? "#f0f9ff" : "#ffffff",
                borderColor: priority === "routine" ? "#0284c7" : "#e2e8f0",
                color: priority === "routine" ? "#0369a1" : "#475569",
              }}
              className="h-11 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <User size={15} />
              <span>Routine Encounter</span>
            </button>
            <button
              type="button"
              onClick={() => setPriority("urgent")}
              style={{
                backgroundColor: priority === "urgent" ? "#fff1f2" : "#ffffff",
                borderColor: priority === "urgent" ? "#e11d48" : "#e2e8f0",
                color: priority === "urgent" ? "#be123c" : "#475569",
              }}
              className="h-11 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <AlertTriangle size={15} />
              <span>Urgent Triage</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function WalkInsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("waiting");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["walk-ins", "queue", status],
    queryFn: () => api<{ walkIns: WalkIn[] }>(`/walk-ins?status=${status}&limit=200`),
    refetchInterval: 30_000,
  });

  // Same request the "All" tab makes — reused for real per-status counts.
  const { data: allData } = useQuery({
    queryKey: ["walk-ins", "queue", "all"],
    queryFn: () => api<{ walkIns: WalkIn[] }>(`/walk-ins?status=all&limit=200`),
    refetchInterval: 30_000,
  });

  const transitions = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      api(`/walk-ins/${vars.id}`, { method: "PATCH", json: { status: vars.status } }),
    onSuccess: (_d, vars) => {
      toast.success(`Walk-in updated: ${vars.status.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["walk-ins"] });
    },
    onError: (err: any) => toast.error("Update failed", err?.message),
  });

  const rows = data?.walkIns ?? [];

  const counts = (() => {
    const all = allData?.walkIns ?? [];
    let waiting = 0;
    let inConsult = 0;
    let completed = 0;
    let noShow = 0;
    let urgent = 0;
    let longestWait = 0;
    for (const w of all) {
      if (w.status === "waiting") {
        waiting++;
        if (w.priority === "urgent") urgent++;
        longestWait = Math.max(longestWait, minutesSince(w.arrivedAt));
      } else if (w.status === "in_consultation") inConsult++;
      else if (w.status === "completed" && isToday(w.arrivedAt)) completed++;
      else if (w.status === "no_show" && isToday(w.arrivedAt)) noShow++;
    }
    return { waiting, inConsult, completed, noShow, urgent, longestWait, ready: !!allData };
  })();

  const countFor: Record<StatusFilter, number | undefined> = {
    waiting: counts.ready ? counts.waiting : undefined,
    in_consultation: counts.ready ? counts.inConsult : undefined,
    completed: counts.ready ? counts.completed : undefined,
    no_show: counts.ready ? counts.noShow : undefined,
    all: undefined,
  };

  // Urgent first, then earliest arrival — the order reception calls people in.
  const ordered = [...rows].sort((a, b) => {
    const ua = a.priority === "urgent" ? 0 : 1;
    const ub = b.priority === "urgent" ? 0 : 1;
    if (ua !== ub) return ua - ub;
    return new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime();
  });

  const waitingPos = new Map<string, number>();
  ordered.filter((w) => w.status === "waiting").forEach((w, i) => waitingPos.set(w.id, i + 1));

  const emptyCopy: Record<StatusFilter, { title: string; body: string }> = {
    waiting: {
      title: "The waiting room is clear",
      body: "When a patient arrives without an appointment or scans their Health ID at the desk, their card appears here.",
    },
    in_consultation: { title: "No one is in the room", body: "Call the next waiting patient to start a consultation." },
    completed: { title: "No completed walk-ins yet", body: "Patients you discharge today will be listed here." },
    no_show: { title: "No no-shows", body: "Patients marked as no-show will be listed here." },
    all: { title: "No walk-ins yet", body: "Check in an arriving patient to start today's walk-in queue." },
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-10">
      <div>
        <DoctorHero
          kickerIcon={<DoorOpen size={13} aria-hidden />}
          kicker="Reception & triage"
          kickerMeta={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          title="Walk-ins"
          description={
            !counts.ready
              ? "Loading the waiting room…"
              : counts.waiting > 0
                ? `${counts.waiting} waiting${counts.urgent > 0 ? `, ${counts.urgent} urgent` : ""} — longest wait ${formatWait(counts.longestWait)}.`
                : "The waiting room is clear. Check in patients as they arrive at the desk."
          }
          chips={
            <span className={HERO_CHIP}>
              <span className={cn("h-2 w-2 rounded-full bg-emerald-400", isFetching ? "animate-ping" : "animate-pulse")} aria-hidden />
              Live · desk & kiosk synced
            </span>
          }
          actions={
            <>
              <Link href="/portal/queue" className={HERO_GHOST}>
                <ListOrdered size={15} aria-hidden />
                Combined queue
              </Link>
              <button type="button" onClick={() => setShowForm(true)} className={HERO_PRIMARY}>
                <UserPlus size={15} className="text-sky-600" aria-hidden />
                Check in walk-in
              </button>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Waiting"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={counts.ready ? String(counts.waiting) : "…"}
            unit={counts.waiting === 1 ? "patient" : "patients"}
            sub={counts.waiting > 0 ? `Longest wait ${formatWait(counts.longestWait)}` : "No one waiting"}
            badge={counts.urgent > 0 ? { text: `${counts.urgent} urgent`, tone: "bg-rose-50 text-rose-600" } : undefined}
            pulse={counts.waiting > 0}
            active={status === "waiting"}
            onClick={() => setStatus("waiting")}
          />
          <StatTile
            label="In consultation"
            icon={<Play size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={counts.ready ? String(counts.inConsult) : "…"}
            sub={counts.inConsult > 0 ? "Currently in the room" : "Room is free"}
            active={status === "in_consultation"}
            onClick={() => setStatus("in_consultation")}
          />
          <StatTile
            label="Completed today"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={counts.ready ? String(counts.completed) : "…"}
            sub="Discharged walk-ins"
            active={status === "completed"}
            onClick={() => setStatus("completed")}
          />
          <StatTile
            label="No-shows today"
            icon={<X size={16} />}
            tone="bg-rose-50 text-rose-500"
            value={counts.ready ? String(counts.noShow) : "…"}
            sub="Left before being seen"
            active={status === "no_show"}
            onClick={() => setStatus("no_show")}
          />
        </HeroOverlap>
      </div>

      <section className={cn(PANEL, "p-0 sm:p-0")} aria-label="Walk-in patients">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-6">
          <Segmented
            ariaLabel="Walk-in status"
            value={status}
            onChange={(v) => setStatus(v)}
            options={FILTER_TABS.map((tab) => ({ value: tab.value, label: tab.label, count: countFor[tab.value] }))}
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh"
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              <RefreshCw size={15} className={cn(isFetching && "animate-spin")} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
            >
              <Plus size={13} strokeWidth={2.5} aria-hidden />
              Admit walk-in
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
            </div>
          ) : ordered.length === 0 ? (
            <EmptyBlock
              className="mt-0 py-12"
              icon={<DoorOpen size={20} />}
              title={emptyCopy[status].title}
              body={emptyCopy[status].body}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <UserPlus size={13} aria-hidden />
                    Check in patient
                  </button>
                  <SecondaryLink href="/portal/queue" icon={<ListOrdered size={13} />}>
                    Combined queue
                  </SecondaryLink>
                </>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {ordered.map((w) => (
                <WalkInCard
                  key={w.id}
                  walkIn={w}
                  position={waitingPos.get(w.id) ?? null}
                  onStatusChange={(id, s) => transitions.mutate({ id, status: s })}
                  isPending={transitions.isPending && transitions.variables?.id === w.id}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <WalkInForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
