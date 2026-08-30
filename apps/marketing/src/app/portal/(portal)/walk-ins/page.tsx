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
  { value: "in_consultation", label: "In Consult" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
  { value: "all", label: "All Walk-Ins" },
];

function WalkInCard({
  walkIn,
  onStatusChange,
  isPending,
}: {
  walkIn: WalkIn;
  onStatusChange: (id: string, status: string) => void;
  isPending: boolean;
}) {
  const meta = STATUS_META[walkIn.status] ?? STATUS_META.waiting;
  const StatusIcon = meta.icon;
  const isUrgent = walkIn.priority === "urgent";

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-4 sm:p-5 transition-all bg-white shadow-2xs hover:shadow-xs",
        isUrgent ? "border-rose-300" : "border-slate-200/90 hover:border-sky-300",
      )}
    >
      {isUrgent && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500 rounded-t-2xl" />
      )}

      <div className="flex flex-col gap-3.5">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <Avatar name={walkIn.patientName} size="md" />
              {isUrgent && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/portal/patients/${walkIn.patientId}/overview`}
                className="text-base font-bold text-slate-900 hover:text-sky-700 transition-colors truncate block"
              >
                {walkIn.patientName ?? "Walk-In Patient"}
              </Link>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {walkIn.patientPhone && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone size={11} className="text-slate-400" />
                    {walkIn.patientPhone}
                  </span>
                )}
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={11} className="text-slate-400" />
                  Arrived {relativeTime(walkIn.arrivedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isUrgent && (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                <AlertTriangle size={11} />
                Urgent Triage
              </span>
            )}
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1",
                walkIn.status === "waiting"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : walkIn.status === "in_consultation"
                  ? "bg-sky-50 text-sky-800 border-sky-200"
                  : walkIn.status === "completed"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-slate-50 text-slate-700 border-slate-200",
              )}
            >
              <StatusIcon size={11} />
              <span>{meta.label}</span>
            </span>
          </div>
        </div>

        {(walkIn.reason || walkIn.doctorName) && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex items-center justify-between gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">
              Reason: {walkIn.reason ?? "General clinical encounter"}
            </span>
            {walkIn.doctorName && (
              <span className="text-slate-500">Clinician: {walkIn.doctorName}</span>
            )}
          </div>
        )}

        {walkIn.notes && (
          <div className="text-xs text-slate-600 bg-amber-50/50 rounded-xl px-3 py-2 border border-amber-200/70">
            {walkIn.notes}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            {walkIn.status === "waiting" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onStatusChange(walkIn.id, "in_consultation")}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <Play size={13} fill="currentColor" />
                <span>Call to Consultation Room</span>
              </button>
            )}

            {walkIn.status === "in_consultation" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onStatusChange(walkIn.id, "completed")}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                }}
              >
                <Check size={14} strokeWidth={3} />
                <span>Complete Consultation</span>
              </button>
            )}

            {(walkIn.status === "waiting" || walkIn.status === "in_consultation") && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onStatusChange(walkIn.id, "no_show")}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>Mark No-Show</span>
              </button>
            )}
          </div>

          <Link
            href={`/portal/patients/${walkIn.patientId}/overview`}
            className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1"
          >
            <span>Open Medical Chart</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </div>
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["walk-ins", "queue", status],
    queryFn: () => api<{ walkIns: WalkIn[] }>(`/walk-ins?status=${status}&limit=200`),
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
  const waitingCount = status === "waiting" ? rows.length : null;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── 1. Signature Oceanic Walk-In Triage Hero ────────────────────────── */}
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
                <DoorOpen size={12} className="text-sky-300" />
                Live Reception &amp; Triage
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Walk-In Triage Queue
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Admit unscheduled patients, assign clinical triage priorities, monitor reception wait times, and call patients into consultation rooms.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/portal/queue"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ListOrdered size={13} />
                <span>Combined Queue</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02] cursor-pointer"
                style={{ color: "#0c4a6e" }}
              >
                <UserPlus size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>+ Check In Walk-In</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Waiting Lounge
                </p>
                <p className="text-base font-extrabold text-white">
                  {status === "waiting" ? rows.length : "Live Active"} Waiting
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Play size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  In Consultation
                </p>
                <p className="text-base font-extrabold text-white">
                  {status === "in_consultation" ? rows.length : "Room Session"} Active
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Discharged
                </p>
                <p className="text-base font-extrabold text-white">
                  {status === "completed" ? rows.length : "Completed"} Today
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <DoorOpen size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Triage Mode
                </p>
                <p className="text-base font-extrabold text-white">
                  Kiosk &amp; Desk Sync
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Unified Triage Stage & High-Contrast Filter Pills ───────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden flex flex-col">
        {/* Filter Controls Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_TABS.map((tab) => {
              const active = status === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                  style={{
                    backgroundColor: active ? "#0284c7" : "#ffffff",
                    borderColor: active ? "#0284c7" : "#cbd5e1",
                    color: active ? "#ffffff" : "#475569",
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs"
                >
                  <span>{tab.label}</span>
                  {tab.value === "waiting" && waitingCount != null && (
                    <span
                      style={{
                        backgroundColor: active ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                        color: active ? "#ffffff" : "#64748b",
                      }}
                      className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold"
                    >
                      {waitingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={13} strokeWidth={3} />
            <span>Admit Walk-In</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ) : rows.length === 0 ? (
            /* Rich Clinical Empty State */
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-xs">
                <DoorOpen size={26} />
              </div>
              <div className="max-w-md">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Waiting Room is Currently Clear
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  No walk-in patients match the current filter. When patients arrive without an appointment or check in at the front desk, their triage cards will appear here.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  }}
                >
                  <UserPlus size={14} />
                  <span>+ Check In Arriving Patient</span>
                </button>
                <Link
                  href="/portal/queue"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ListOrdered size={14} />
                  <span>View Combined Queue</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {rows.map((w) => (
                <WalkInCard
                  key={w.id}
                  walkIn={w}
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
