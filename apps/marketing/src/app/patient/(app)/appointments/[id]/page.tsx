"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Hash,
  MessageSquare,
  RotateCcw,
  Star,
  Stethoscope,
  Video,
} from "lucide-react";

import {
  useAppointmentRecords,
  useCancelAppointment,
  useRescheduleAppointment,
} from "@/patient/hooks";
import { formatDayLabel, formatRecordType, formatTime, humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { teleconsultApi } from "@/portal/lib/api";
import {
  Badge,
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  InfoField,
  LiveDot,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PRIMARY_BTN,
  SECONDARY_BTN,
  type Tone,
} from "@/patient/components/workspace";

const STATUS_TONE: Record<string, Tone> = {
  scheduled: "sky",
  confirmed: "sky",
  in_progress: "violet",
  completed: "emerald",
  cancelled: "rose",
  no_show: "amber",
};
const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-sky-400",
  confirmed: "bg-sky-400",
  in_progress: "bg-violet-400",
  completed: "bg-emerald-400",
  cancelled: "bg-rose-400",
  no_show: "bg-amber-400",
};

export default function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const query = useAppointmentRecords(id);
  const cancel = useCancelAppointment();
  const reschedule = useRescheduleAppointment();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Live teleconsult session — when the doctor has opened the room for
  // this appointment, "Join video visit" goes straight to it. Fail
  // closed: without a real session there is no join link (no fake
  // "__pending__" room), just a waiting/disabled chip.
  const [activeSession, setActiveSession] = useState<{
    id: string;
    roomId: string;
    status: string;
    appointmentId: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await teleconsultApi.getActiveForMe();
        if (!cancelled) setActiveSession(res.session);
      } catch {}
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const appointment = query.data?.appointment ?? null;
  const records = query.data?.records ?? [];

  if (!appointment) {
    return (
      <PatientPage>
        <PatientHero
          overlap={false}
          kickerIcon={<CalendarDays size={13} aria-hidden />}
          kicker="Appointment"
          title={query.isLoading ? "Loading visit…" : "Appointment not found"}
          description={
            query.isLoading ? "Fetching the details of this visit." : "This appointment may have been cancelled or is no longer available."
          }
          actions={
            <Link href="/patient/appointments" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All appointments
            </Link>
          }
        />
        <section className={PANEL}>
          {query.isLoading ? (
            <PanelSkeleton rows={3} className="mt-0" />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : (
            <EmptyBlock
              className="mt-0"
              icon={<CalendarX2 size={19} />}
              title="Nothing to show"
              body="Head back to your appointments to pick another visit."
            />
          )}
        </section>
      </PatientPage>
    );
  }

  const status = appointment.status;
  const tone = STATUS_TONE[status] ?? "slate";
  const canManage = ["scheduled", "confirmed"].includes(status);
  const isVideo = appointment.mode === "video";
  const canJoinVideo = isVideo && ["scheduled", "confirmed", "in_progress"].includes(status);
  const hasLiveSession = activeSession?.appointmentId === id && !!activeSession?.roomId;
  const isDone = status === "completed";
  const d = new Date(appointment.date);
  const validDate = !Number.isNaN(d.getTime());
  const busy = reschedule.isPending || cancel.isPending;

  const onCancel = async () => {
    if (!window.confirm("Cancel this appointment?")) return;
    setActionError(null);
    try {
      await cancel.mutateAsync(id);
      router.replace("/patient/appointments");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not cancel appointment.");
    }
  };
  const onReschedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!date || !time) return;
    setActionError(null);
    try {
      await reschedule.mutateAsync({ id, date, time });
      setEditing(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not reschedule appointment.");
    }
  };
  const startEditing = () => {
    setDate(appointment.date);
    setTime(appointment.time);
    setEditing(true);
  };

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        leading={
          <span className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-[20px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_12px_32px_-8px_rgba(14,165,233,0.6)] ring-1 ring-inset ring-white/25">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100/80">
              {validDate ? d.toLocaleDateString("en-GB", { month: "short" }) : "—"}
            </span>
            <span className="text-[28px] font-bold leading-none tabular-nums">{validDate ? d.getDate() : "—"}</span>
          </span>
        }
        kickerIcon={<CalendarDays size={13} aria-hidden />}
        kicker="Appointment"
        kickerMeta={`${formatDayLabel(appointment.date)} · ${formatTime(appointment.time)}`}
        title={appointment.doctorName ?? "Doctor"}
        description={
          [appointment.doctorSpecialization ?? "Care team visit", appointment.hospitalName].filter(Boolean).join(" · ")
        }
        chips={
          <>
            <span className={HERO_CHIP}>
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status] ?? "bg-slate-400")} aria-hidden />
              {humanize(status)}
            </span>
            <span className={HERO_CHIP}>
              {isVideo ? <Video size={12} className="text-violet-300" aria-hidden /> : <Building2 size={12} className="text-sky-300" aria-hidden />}
              {isVideo ? "Video consultation" : "In-person"}
            </span>
            {appointment.queueNumber ? (
              <span className={HERO_CHIP}>
                <Hash size={12} className="text-teal-300" aria-hidden />
                Queue {appointment.queueNumber}
              </span>
            ) : null}
            {appointment.paymentStatus ? (
              <span className={HERO_CHIP}>
                <CreditCard size={12} className="text-emerald-300" aria-hidden />
                {humanize(appointment.paymentStatus)}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/patient/appointments" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All
            </Link>
            {canJoinVideo && hasLiveSession ? (
              <button
                type="button"
                onClick={() => router.push(`/patient/teleconsult/${activeSession!.roomId}`)}
                className={HERO_PRIMARY}
                data-testid="join-video-visit"
              >
                <Video size={15} className="text-violet-600" aria-hidden />
                Join video visit
              </button>
            ) : isDone ? (
              <Link href={`/patient/appointments/${id}/rate`} className={HERO_PRIMARY}>
                <Star size={15} className="text-amber-500" aria-hidden />
                Rate visit
              </Link>
            ) : canManage ? (
              <button type="button" onClick={startEditing} disabled={busy} className={HERO_PRIMARY}>
                <RotateCcw size={15} className="text-sky-600" aria-hidden />
                Reschedule
              </button>
            ) : (
              <Link href={`/patient/appointments/book?doctorId=${appointment.doctorId}`} className={HERO_PRIMARY}>
                <RotateCcw size={15} className="text-sky-600" aria-hidden />
                Book again
              </Link>
            )}
          </>
        }
      />

      {actionError ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-700">
          <AlertCircle size={15} className="shrink-0" aria-hidden />
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {editing ? (
            <section className={cn(PANEL, "shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1.5px_rgba(2,132,199,0.35)]")} aria-labelledby="apd-resched">
              <PanelHeader
                id="apd-resched"
                icon={<RotateCcw size={16} />}
                tone="bg-sky-50 text-sky-600"
                title="Pick a new time"
                caption="Your doctor is notified as soon as you save"
              />
              <form onSubmit={onReschedule} className="mt-5 grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label htmlFor="apd-date" className={FIELD_LABEL}>Date</label>
                  <input
                    id="apd-date"
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="apd-time" className={FIELD_LABEL}>Time</label>
                  <input id="apd-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={FIELD_INPUT} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(false)} className={cn(SECONDARY_BTN, "h-10")}>
                    Keep current
                  </button>
                  <button type="submit" disabled={reschedule.isPending} className={cn(PRIMARY_BTN, "h-10")}>
                    {reschedule.isPending ? "Saving…" : "Save time"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className={PANEL} aria-labelledby="apd-details">
            <PanelHeader
              id="apd-details"
              icon={<Stethoscope size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Visit details"
              caption={`${humanize(status)} · ${isVideo ? "video" : "in-person"}`}
            />
            <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoField icon={<CalendarDays size={14} />} label="Date">
                {formatDayLabel(appointment.date)}
              </InfoField>
              <InfoField icon={<Clock size={14} />} label="Time">
                {formatTime(appointment.time)}
              </InfoField>
              <InfoField icon={<Stethoscope size={14} />} label="Doctor">
                {appointment.doctorName ?? "—"}
                {appointment.doctorSpecialization ? ` · ${appointment.doctorSpecialization}` : ""}
              </InfoField>
              <InfoField icon={isVideo ? <Video size={14} /> : <Building2 size={14} />} label="Where">
                {isVideo ? "Online · secure video" : appointment.hospitalName ?? "Hospital"}
              </InfoField>
              <InfoField icon={<Hash size={14} />} label="Queue number">
                {appointment.queueNumber ?? "Assigned on arrival"}
              </InfoField>
              <InfoField icon={<CreditCard size={14} />} label="Payment">
                {appointment.paymentStatus ? humanize(appointment.paymentStatus) : "—"}
              </InfoField>
            </dl>
            {appointment.reason || appointment.notes ? (
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {appointment.reason ? (
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <p className="text-[11px] font-medium text-slate-400">Reason</p>
                    <p className="mt-0.5 text-sm text-slate-800">{appointment.reason}</p>
                  </div>
                ) : null}
                {appointment.notes ? (
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <p className="text-[11px] font-medium text-slate-400">Notes</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{appointment.notes}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className={PANEL} aria-labelledby="apd-records">
            <PanelHeader
              id="apd-records"
              icon={<FileText size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Related records"
              caption={records.length ? `${records.length} attached` : "Nothing attached yet"}
              href="/patient/records"
              linkLabel="All records"
            />
            {records.length ? (
              <ul className="mt-4 flex flex-col gap-2">
                {records.map((record) => (
                  <li key={record.id}>
                    <Link
                      href={`/patient/records/${record.id}`}
                      className="group flex items-center gap-3 rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-violet-50 text-violet-600" aria-hidden>
                        <FileText size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">{record.title}</span>
                        <span className="block truncate text-xs text-slate-400">{formatDayLabel(record.date)}</span>
                      </span>
                      <Badge tone="violet">{formatRecordType(record.recordType)}</Badge>
                      <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-sky-600" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyBlock
                icon={<FileText size={19} />}
                title="No records attached"
                body="Prescriptions, lab reports and notes from this visit show up here once your doctor adds them."
              />
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Manage visit">
          {isVideo ? (
            <section className={PANEL} aria-labelledby="apd-video">
              <PanelHeader
                id="apd-video"
                icon={<Video size={16} />}
                tone="bg-violet-50 text-violet-600"
                title="Video visit"
                caption={hasLiveSession ? "Your doctor is in the room" : canJoinVideo ? "Room opens when your doctor starts" : "Call has ended"}
              />
              {canJoinVideo && hasLiveSession ? (
                <button
                  type="button"
                  onClick={() => router.push(`/patient/teleconsult/${activeSession!.roomId}`)}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110"
                >
                  <Video size={16} aria-hidden />
                  Join now
                </button>
              ) : canJoinVideo ? (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-slate-50 p-3.5 text-xs font-medium text-slate-500" data-testid="join-waiting-chip">
                  <LiveDot tone="amber" />
                  Waiting for doctor to start
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={PANEL} aria-labelledby="apd-manage">
            <PanelHeader
              id="apd-manage"
              icon={<CalendarDays size={16} />}
              tone="bg-slate-100 text-slate-500"
              title="Manage"
              caption={canManage ? "Change or cancel this visit" : "This visit can't be changed"}
            />
            <div className="mt-4 flex flex-col gap-2">
              {canManage && !editing ? (
                <button type="button" onClick={startEditing} disabled={busy} className={cn(SECONDARY_BTN, "h-10 justify-center")}>
                  <RotateCcw size={14} aria-hidden />
                  Reschedule
                </button>
              ) : null}
              {isDone ? (
                <Link href={`/patient/appointments/${id}/rate`} className={cn(SECONDARY_BTN, "h-10 justify-center")}>
                  <Star size={14} className="text-amber-500" aria-hidden />
                  Rate this visit
                </Link>
              ) : null}
              <Link href={`/patient/appointments/book?doctorId=${appointment.doctorId}`} className={cn(SECONDARY_BTN, "h-10 justify-center")}>
                <CalendarDays size={14} aria-hidden />
                Book another visit
              </Link>
              <Link href="/patient/messages" className={cn(SECONDARY_BTN, "h-10 justify-center")}>
                <MessageSquare size={14} aria-hidden />
                Message care team
              </Link>
              {canManage ? (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                >
                  <CalendarX2 size={14} aria-hidden />
                  {cancel.isPending ? "Cancelling…" : "Cancel appointment"}
                </button>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </PatientPage>
  );
}
