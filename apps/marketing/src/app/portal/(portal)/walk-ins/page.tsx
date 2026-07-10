"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Search, Check, X, Clock, Bell, CheckCircle2, AlertTriangle, User, DoorOpen, ChevronRight,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Modal } from "@/portal/components/ui/Modal";
import { Input, Textarea } from "@/portal/components/ui/Form";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface WalkIn {
  id: string; patientId: string; patientName: string | null; patientPhone?: string | null;
  doctorId: string; doctorName: string | null; arrivedAt: string;
  reason: string | null; priority: string; status: string; notes?: string | null; hospitalName?: string | null;
}

interface PatientSearchResult { id: string; name: string; phone: string | null; nic: string | null }

type StatusFilter = "all" | "waiting" | "in_consultation" | "completed" | "no_show";

const STATUS_META: Record<string, { tone: "brand" | "warn" | "success" | "danger" | "neutral"; label: string; icon: typeof CheckCircle2 }> = {
  waiting:          { tone: "warn",    label: "Waiting",     icon: Clock },
  in_consultation:  { tone: "brand",   label: "In consult",  icon: CheckCircle2 },
  completed:        { tone: "success", label: "Completed",   icon: Check },
  no_show:          { tone: "danger",  label: "No show",     icon: X },
};

const FILTER_TABS: StatusFilter[] = ["waiting", "in_consultation", "completed", "no_show", "all"];

function WalkInCard({ walkIn, onStatusChange, isPending }: { walkIn: WalkIn; onStatusChange: (id: string, status: string) => void; isPending: boolean }) {
  const t = useT();
  const meta = STATUS_META[walkIn.status] ?? STATUS_META.waiting;
  const StatusIcon = meta.icon;
  const isUrgent = walkIn.priority === "urgent";

  return (
    <Card className={cn("relative overflow-hidden", isUrgent && "border-red-200/60")}>
      {isUrgent && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 to-amber-500" />}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar name={walkIn.patientName} size="md" />
            {isUrgent && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-white animate-pulse" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-text truncate leading-tight">{walkIn.patientName ?? t("walkins.unknownPatient")}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {walkIn.patientPhone && <span className="text-[11px] text-text-muted">{walkIn.patientPhone}</span>}
              <span className="text-[11px] text-text-muted flex items-center gap-1"><Clock size={10} />{relativeTime(walkIn.arrivedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUrgent && <Pill tone="danger"><AlertTriangle size={10} /> Urgent</Pill>}
            <Pill tone={meta.tone}><StatusIcon size={10} /> {meta.label}</Pill>
          </div>
        </div>

        {(walkIn.reason || walkIn.doctorName) && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {walkIn.reason && <span>{walkIn.reason}</span>}
            {walkIn.reason && walkIn.doctorName && <span>·</span>}
            {walkIn.doctorName && <span>{walkIn.doctorName}</span>}
          </div>
        )}

        {walkIn.notes && (
          <div className="text-xs text-text-muted bg-surface-2/60 rounded-xl px-3 py-2 border border-border/40">{walkIn.notes}</div>
        )}

        {walkIn.status === "waiting" && (
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" loading={isPending} leftIcon={<CheckCircle2 size={14} />} onClick={() => onStatusChange(walkIn.id, "in_consultation")}>{t("walkins.startConsult")}</Button>
            <Button size="sm" variant="ghost" onClick={() => onStatusChange(walkIn.id, "no_show")}><X size={14} /> {t("walkins.noShow")}</Button>
          </div>
        )}
        {walkIn.status === "in_consultation" && (
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" loading={isPending} leftIcon={<Check size={14} />} onClick={() => onStatusChange(walkIn.id, "completed")}>{t("walkins.complete")}</Button>
            <Button size="sm" variant="ghost" onClick={() => onStatusChange(walkIn.id, "no_show")}><X size={14} /> {t("walkins.noShow")}</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function WalkInForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [patientQuery, setPatientQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [doctorId, setDoctorId] = useState(user?.id ?? "");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");

  useEffect(() => { const id = setTimeout(() => setDebouncedQuery(patientQuery.trim()), 300); return () => clearTimeout(id); }, [patientQuery]);

  const { data: patientData, isLoading: patientsLoading } = useQuery({
    queryKey: ["walk-ins", "search", debouncedQuery],
    queryFn: () => api<{ patients: PatientSearchResult[] }>(`/walk-ins/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2 && !selectedPatient,
  });

  const patients = patientData?.patients ?? [];

  const createMutation = useMutation({
    mutationFn: () => api<{ walkIn: WalkIn }>("/walk-ins", {
      method: "POST",
      json: { patientId: selectedPatient!.id, doctorId: doctorId || user?.id, reason: reason.trim() || undefined, priority },
    }),
    onSuccess: () => {
      toast.success(t("walkins.created"));
      qc.invalidateQueries({ queryKey: ["walk-ins"] });
      onCreated(); onClose();
      setPatientQuery(""); setDebouncedQuery(""); setSelectedPatient(null); setReason(""); setPriority("routine");
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  function handleClose() {
    onClose();
    setPatientQuery(""); setDebouncedQuery(""); setSelectedPatient(null); setReason(""); setPriority("routine");
  }

  return (
    <Modal open={open} onClose={handleClose} title={t("walkins.checkIn")} subtitle={t("walkins.checkInSubtitle")} size="md"
      footer={<>
        <Button variant="ghost" onClick={handleClose}>{t("common.cancel")}</Button>
        <Button loading={createMutation.isPending} disabled={!selectedPatient} leftIcon={<UserPlus size={14} />} onClick={() => createMutation.mutate()}>{t("walkins.checkInButton")}</Button>
      </>}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-text-soft mb-1.5 block">{t("walkins.patient")}</label>
          {selectedPatient ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-soft/40 border border-brand/20">
              <Avatar name={selectedPatient.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text truncate">{selectedPatient.name}</div>
                <div className="text-[11px] text-text-muted">{selectedPatient.phone ?? selectedPatient.nic ?? "—"}</div>
              </div>
              <button type="button" onClick={() => setSelectedPatient(null)} className="h-6 w-6 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-text"><X size={12} /></button>
            </div>
          ) : (
            <>
              <div className="portal-input-search-wrap">
                <Search size={14} className="portal-input-search-icon" aria-hidden="true" />
                <Input
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder={t("walkins.searchPatient")}
                  className="portal-input-icon-left"
                />
              </div>
              {debouncedQuery.length >= 2 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border/70 bg-surface">
                  {patientsLoading ? (
                    <div className="p-3 flex flex-col gap-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                  ) : patients.length === 0 ? (
                    <div className="p-3 text-xs text-text-muted text-center">{t("walkins.noPatients")}</div>
                  ) : (
                    <ul>{patients.map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => { setSelectedPatient(p); setPatientQuery(""); setDebouncedQuery(""); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2/60 transition-colors">
                          <Avatar name={p.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-text truncate">{p.name}</div>
                            <div className="text-[11px] text-text-muted">{p.phone ?? p.nic ?? "—"}</div>
                          </div>
                        </button>
                      </li>
                    ))}</ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <Textarea label={t("walkins.reason")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("walkins.reasonPlaceholder")} rows={2} />
        <div>
          <label className="text-xs font-semibold text-text-soft mb-1.5 block">{t("walkins.priority")}</label>
          <div className="grid grid-cols-2 gap-2">
            <div
              role="button"
              tabIndex={0}
              data-active={priority === "routine" ? "true" : "false"}
              className="portal-filter-pill h-10 px-3 text-sm justify-center"
              onClick={() => setPriority("routine")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPriority("routine");
                }
              }}
            >
              <User size={16} /> {t("walkins.routine")}
            </div>
            <div
              role="button"
              tabIndex={0}
              data-active={priority === "urgent" ? "true" : "false"}
              className="portal-filter-pill h-10 px-3 text-sm justify-center"
              onClick={() => setPriority("urgent")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPriority("urgent");
                }
              }}
            >
              <AlertTriangle size={16} /> {t("walkins.urgent")}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function WalkInsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("waiting");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["walk-ins", "queue", status],
    queryFn: () => api<{ walkIns: WalkIn[] }>(`/walk-ins?status=${status}&limit=200`),
    refetchInterval: 30_000,
  });

  const transitions = useMutation({
    mutationFn: (vars: { id: string; status: string }) => api(`/walk-ins/${vars.id}`, { method: "PATCH", json: { status: vars.status } }),
    onSuccess: (_d, vars) => { toast.success(`Marked ${vars.status.replace("_", " ")}`); qc.invalidateQueries({ queryKey: ["walk-ins"] }); },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const rows = data?.walkIns ?? [];
  const waitingCount = status === "waiting" ? rows.length : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("walkins.title")}
        subtitle={t("walkins.subtitle")}
        icon={<DoorOpen size={18} className="text-brand" />}
        badge={waitingCount != null && waitingCount > 0 ? <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-[11px] font-bold text-white flex items-center justify-center">{waitingCount}</span> : undefined}
        actions={<Button leftIcon={<UserPlus size={14} />} onClick={() => setShowForm(true)}>{t("walkins.checkIn")}</Button>}
      />

      {/* Filter tabs */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-3 py-3 border-b border-border/50 bg-surface-2/30">
          <FilterPills
            size="md"
            value={status}
            onChange={setStatus}
            options={FILTER_TABS.map((s) => ({
              value: s,
              label: t(`walkins.status.${s}`),
              count: s === "waiting" && waitingCount != null ? waitingCount : undefined,
            }))}
          />
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
          ) : rows.length === 0 ? (
            <Empty
              icon={<DoorOpen size={20} className="text-text-muted" />}
              title={t("walkins.emptyTitle")}
              description={t("walkins.emptyDescription")}
              className="py-12"
            />
          ) : (
            <div className="flex flex-col gap-3">
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
      </Card>

      <WalkInForm open={showForm} onClose={() => setShowForm(false)} onCreated={() => refetch()} />
    </div>
  );
}
