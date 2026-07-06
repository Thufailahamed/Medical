"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Search, Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, UserPlus, CalendarPlus,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Input, Textarea } from "@/portal/components/ui/Form";
import { Button } from "@/portal/components/ui/Button";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { ageFrom } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface PatientRow {
  patient: { id: string; nic?: string | null; dob?: string | null; sex?: string | null; bloodGroup?: string | null; photo?: string | null };
  user: { id: string; name: string; phone?: string | null; email?: string | null };
}

interface SlotInfo { time: string; available: boolean; reason?: string; queueNumber?: number }
interface SlotsResponse { slots: SlotInfo[] }

const PERIODS = [
  { key: "morning", label: "Morning", start: "06:00", end: "12:00" },
  { key: "afternoon", label: "Afternoon", start: "12:00", end: "17:00" },
  { key: "evening", label: "Evening", start: "17:00", end: "22:00" },
] as const;

function StepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <div className={cn("h-px w-10", done ? "bg-brand" : "bg-border/60")} />}
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200",
                done ? "bg-brand text-white shadow-sm" : active ? "bg-brand text-white shadow-sm" : "bg-surface-2 text-text-muted border border-border/60"
              )}>{done ? "✓" : step}</div>
              <span className={cn("text-xs font-medium", active ? "text-text" : done ? "text-brand" : "text-text-muted")}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BookAppointmentPage() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => { const id = setTimeout(() => setDebouncedQuery(patientQuery.trim()), 300); return () => clearTimeout(id); }, [patientQuery]);

  const { data: patientData, isLoading: patientsLoading } = useQuery({
    queryKey: qk.portalPatientSearch(debouncedQuery),
    queryFn: () => api<{ patients: PatientRow[] }>(`/doctor-portal/search-patients?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: doctorMe } = useQuery({
    queryKey: qk.doctorMe,
    queryFn: () => api<{ id: string }>("/doctor/me"),
  });

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ["doctor", doctorMe?.id, "availability", date],
    queryFn: () => api<SlotsResponse>(`/doctor/${doctorMe!.id}/availability?date=${date}`),
    enabled: !!doctorMe?.id && step === 2,
  });

  const bookMutation = useMutation({
    mutationFn: () => api<{ appointment: any; queueNumber: number }>("/doctor-portal/appointments", {
      method: "POST",
      json: { patientId: selectedPatient!.patient.id, date, time: selectedTime, reason: reason.trim() || undefined },
    }),
    onSuccess: (res) => {
      toast.success(t("bookAppointment.booked"), `Queue #${res.queueNumber}`);
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      router.push("/portal/appointments");
    },
    onError: (err: any) => toast.error("Booking failed", err?.message),
  });

  const patients = patientData?.patients ?? [];
  const allSlots = slotsData?.slots ?? [];
  const availableSlots = allSlots.filter((s) => s.available);
  const filteredSlots = period ? availableSlots.filter((s) => { const p = PERIODS.find((pp) => pp.key === period); return p && s.time >= p.start && s.time < p.end; }) : availableSlots;
  const canNext = (step === 1 && selectedPatient) || (step === 2 && selectedTime) || step === 3;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <PageHeader
        title={t("bookAppointment.title")}
        subtitle={t("bookAppointment.subtitle")}
        icon={<CalendarPlus size={18} className="text-brand" />}
      />

      <StepIndicator current={step} labels={[t("bookAppointment.selectPatient"), t("bookAppointment.selectDate"), t("bookAppointment.confirm")]} />

      {/* Step 1: Select Patient */}
      {step === 1 && (
        <Card>
          <CardHeader title={t("bookAppointment.selectPatient")} />
          <div className="flex flex-col gap-3 mt-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder={t("bookAppointment.searchPatient")} className="pl-10" />
            </div>
            {debouncedQuery.length < 2 ? (
              <p className="text-xs text-text-muted text-center py-6">{t("bookAppointment.searchHint")}</p>
            ) : patientsLoading ? (
              <div className="flex flex-col gap-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : patients.length === 0 ? (
              <Empty title={t("bookAppointment.noPatientResults")} />
            ) : (
              <ul className="flex flex-col max-h-80 overflow-y-auto rounded-xl border border-border/60">
                {patients.map((p) => {
                  const isSelected = selectedPatient?.patient.id === p.patient.id;
                  const age = p.patient.dob ? ageFrom(p.patient.dob) : null;
                  return (
                    <li key={p.patient.id} className="border-b border-border/50 last:border-0">
                      <button type="button" onClick={() => setSelectedPatient(p)} className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                        isSelected ? "bg-brand-soft/40" : "hover:bg-surface-2/40"
                      )}>
                        <Avatar name={p.user.name} src={p.patient.photo ?? undefined} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-text truncate">{p.user.name}</span>
                            {age != null && <span className="text-[11px] text-text-muted font-medium">{age}y · {p.patient.sex ?? "—"}</span>}
                          </div>
                          <div className="text-xs text-text-muted truncate">{p.patient.nic ? `NIC ${p.patient.nic} · ` : ""}{p.user.phone ?? p.user.email ?? "—"}</div>
                        </div>
                        {p.patient.bloodGroup && <Pill tone="neutral">{p.patient.bloodGroup}</Pill>}
                        {isSelected && <CheckCircle size={18} className="text-brand shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      )}

      {/* Step 2: Select Date & Time */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={t("bookAppointment.selectDate")} />
            <div className="mt-3">
              <Input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setDate(e.target.value); setSelectedTime(null); }} />
            </div>
          </Card>
          <Card>
            <CardHeader title={t("bookAppointment.selectTime")} />
            <div className="flex flex-col gap-3 mt-3">
              <div className="flex gap-2">
                {PERIODS.map((p) => (
                  <button key={p.key} type="button" onClick={() => setPeriod(period === p.key ? null : p.key)} className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                    period === p.key ? "bg-brand text-white shadow-sm" : "bg-surface-2 text-text-soft hover:bg-surface border border-border/60"
                  )}>{t(`bookAppointment.${p.key}`)}</button>
                ))}
              </div>
              {slotsLoading ? (
                <div className="grid grid-cols-4 gap-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
              ) : filteredSlots.length === 0 ? (
                <Empty title={t("bookAppointment.noSlots")} icon={<Clock size={20} className="text-text-muted" />} />
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {filteredSlots.map((slot) => (
                    <button key={slot.time} type="button" onClick={() => setSelectedTime(slot.time)} className={cn(
                      "h-9 rounded-lg text-sm font-semibold transition-all duration-200 border",
                      selectedTime === slot.time ? "bg-brand text-white border-brand shadow-sm" : "bg-surface border-border/80 text-text hover:border-brand/40 hover:bg-brand-soft/20"
                    )}>{slot.time}</button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && selectedPatient && (
        <Card>
          <CardHeader title={t("bookAppointment.summary")} />
          <div className="flex flex-col gap-3 mt-3">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-2/50 border border-border/50">
              <Avatar name={selectedPatient.user.name} src={selectedPatient.patient.photo ?? undefined} />
              <div>
                <div className="text-sm font-bold text-text">{selectedPatient.user.name}</div>
                <div className="text-xs text-text-muted">{selectedPatient.patient.nic ? `NIC ${selectedPatient.patient.nic}` : selectedPatient.user.phone ?? "—"}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-sky-50/50 border border-sky-200/40">
                <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center"><Calendar size={16} className="text-sky-600" /></div>
                <div>
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">{t("bookAppointment.date")}</div>
                  <div className="text-sm font-bold text-text mt-0.5">{date}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/40">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center"><Clock size={16} className="text-emerald-600" /></div>
                <div>
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">{t("bookAppointment.time")}</div>
                  <div className="text-sm font-bold text-text mt-0.5">{selectedTime}</div>
                </div>
              </div>
            </div>
            <Textarea label={t("bookAppointment.reason")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("bookAppointment.reasonPlaceholder")} rows={3} />
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between sticky bottom-0 bg-bg py-3 border-t border-border/60">
        <Button variant="ghost" leftIcon={<ChevronLeft size={14} />} onClick={() => { if (step === 1) router.push("/portal/appointments"); else setStep(step - 1); }}>
          {step === 1 ? t("common.cancel") : t("bookAppointment.back")}
        </Button>
        {step < 3 ? (
          <Button rightIcon={<ChevronRight size={14} />} disabled={!canNext} onClick={() => setStep(step + 1)}>{t("bookAppointment.next")}</Button>
        ) : (
          <Button leftIcon={<UserPlus size={14} />} loading={bookMutation.isPending} disabled={bookMutation.isPending} onClick={() => bookMutation.mutate()}>{t("bookAppointment.confirmBooking")}</Button>
        )}
      </div>
    </div>
  );
}
