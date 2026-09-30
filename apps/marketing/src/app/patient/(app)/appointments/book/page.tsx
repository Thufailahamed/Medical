"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Baby,
  Bone,
  Brain,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Ear,
  Eye,
  FileText,
  Flower2,
  HeartPulse,
  Loader2,
  MapPin,
  MessageCircle,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
  Users,
  Video,
} from "lucide-react";

import {
  useBookAppointment,
  useDoctorAvailability,
  useDoctorSearch,
  useSpecialties,
} from "@/patient/hooks/doctors";
import { formatDayLabel } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { DoctorBadge } from "@/portal/components/doctor/DoctorBadge";
import {
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  HeroOverlap,
  InfoField,
  PANEL,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

type Step = "specialty" | "doctor" | "schedule" | "confirm";

const STEPS: Array<{ key: Step; label: string; hint: string; icon: typeof Stethoscope }> = [
  { key: "specialty", label: "Specialty", hint: "What you need", icon: Stethoscope },
  { key: "doctor", label: "Doctor", hint: "Who you'll see", icon: UserRound },
  { key: "schedule", label: "Schedule", hint: "When & how", icon: CalendarDays },
  { key: "confirm", label: "Confirm", hint: "Review & book", icon: Check },
];

const SPECIALTY_META: Record<string, { icon: typeof Stethoscope; tone: string }> = {
  Cardiology: { icon: HeartPulse, tone: "from-rose-500 to-pink-600 shadow-rose-500/30" },
  Neurology: { icon: Brain, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
  Pediatrics: { icon: Baby, tone: "from-amber-500 to-orange-500 shadow-amber-500/30" },
  Orthopedics: { icon: Bone, tone: "from-slate-500 to-slate-700 shadow-slate-500/30" },
  Dermatology: { icon: Sparkles, tone: "from-fuchsia-500 to-pink-500 shadow-fuchsia-500/30" },
  General: { icon: Stethoscope, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
  "General Practice": { icon: Stethoscope, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
  Gynecology: { icon: Flower2, tone: "from-pink-500 to-rose-500 shadow-pink-500/30" },
  Psychiatry: { icon: MessageCircle, tone: "from-indigo-500 to-violet-600 shadow-indigo-500/30" },
  Ophthalmology: { icon: Eye, tone: "from-cyan-500 to-teal-600 shadow-cyan-500/30" },
  Dentistry: { icon: Smile, tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
  ENT: { icon: Ear, tone: "from-orange-500 to-amber-600 shadow-orange-500/30" },
};
const DEFAULT_SPECIALTY = { icon: Stethoscope, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" };

export default function BookAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSpecialty = searchParams.get("specialty") || "";
  const initialDoctor = searchParams.get("doctorId") || "";

  const [step, setStep] = useState<Step>(initialDoctor ? "schedule" : "specialty");
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [telemedicine, setTelemedicine] = useState(false);
  const [doctorId, setDoctorId] = useState(initialDoctor);
  const [mode, setMode] = useState<"in_person" | "video">("in_person");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const book = useBookAppointment();

  const specialties = useSpecialties();
  const doctors = useDoctorSearch({
    search,
    specialization: specialty || undefined,
    telemedicine,
    enabled: step === "doctor",
  });
  const availability = useDoctorAvailability(doctorId, date || undefined);

  const selectedDoctor = useMemo(() => {
    return doctors.data?.doctors?.find((d) => d.id === doctorId);
  }, [doctors.data?.doctors, doctorId]);

  async function confirm() {
    setError(null);
    try {
      await book.mutateAsync({
        doctorId,
        date,
        time,
        mode,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      });
      router.push("/patient/appointments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book appointment.");
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const canAdvance =
    (step === "specialty" && !!specialty) ||
    (step === "doctor" && !!doctorId) ||
    (step === "schedule" && !!date && !!time);

  function goNext() {
    if (step === "specialty" && specialty) setStep("doctor");
    else if (step === "doctor" && doctorId) setStep("schedule");
    else if (step === "schedule" && date && time) setStep("confirm");
  }
  function goBack() {
    if (step === "doctor") setStep("specialty");
    else if (step === "schedule") setStep(initialDoctor && !specialty ? "specialty" : "doctor");
    else if (step === "confirm") setStep("schedule");
  }

  const slots = (availability.data?.slots ?? []).filter((s) => s.available);
  const doctorList = doctors.data?.doctors ?? [];

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<CalendarPlus size={13} aria-hidden />}
          kicker="Book a visit"
          kickerMeta={`Step ${currentStepIndex + 1} of ${STEPS.length}`}
          title={
            <>
              See the <HeroAccent>right doctor</HeroAccent>, fast
            </>
          }
          description="Pick a specialty, choose a doctor, then a time that suits you — in-person at the hospital or over a secure video call."
          chips={
            <>
              <span className={HERO_CHIP}>
                <Building2 size={12} className="text-sky-300" aria-hidden />
                In-person visits
              </span>
              <span className={HERO_CHIP}>
                <Video size={12} className="text-violet-300" aria-hidden />
                Video consultations
              </span>
            </>
          }
          actions={
            <>
              <Link href="/patient/appointments" className={HERO_GHOST}>
                <ChevronLeft size={15} aria-hidden />
                My appointments
              </Link>
              <Link href="/patient/care-team" className={HERO_GHOST}>
                <Users size={15} aria-hidden />
                My doctors
              </Link>
            </>
          }
        />

        {/* Stepper floats over the hero edge, like the stat strip. */}
        <HeroOverlap>
          <nav aria-label="Booking progress" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {STEPS.map((s, idx) => {
              const isCurrent = step === s.key;
              const isDone = currentStepIndex > idx;
              const clickable = isDone || isCurrent;
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={!clickable}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => clickable && setStep(s.key)}
                  className={cn(
                    "group flex min-h-[84px] items-center gap-3 rounded-2xl bg-white p-4 text-left transition-all duration-200 disabled:cursor-not-allowed",
                    isCurrent
                      ? "shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22),inset_0_0_0_2px_#0284c7]"
                      : "shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22),inset_0_0_0_1px_rgba(15,23,42,0.07)]",
                    isDone && "hover:-translate-y-0.5",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-sm font-bold",
                      isCurrent
                        ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30"
                        : isDone
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-400",
                    )}
                    aria-hidden
                  >
                    {isDone ? <Check size={17} strokeWidth={2.75} /> : <Icon size={17} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Step {idx + 1}
                    </span>
                    <span className={cn("block truncate text-sm font-semibold", isCurrent || isDone ? "text-slate-900" : "text-slate-400")}>
                      {s.label}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">{s.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* ── Step 1: Specialty ───────────────────────────────────── */}
          {step === "specialty" && (
            <section className={PANEL} aria-labelledby="bk-specialty">
              <PanelHeader
                id="bk-specialty"
                icon={<Stethoscope size={16} />}
                tone="bg-sky-50 text-sky-600"
                title="Choose a specialty"
                caption="What kind of care do you need?"
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setSpecialty("");
                      setStep("doctor");
                    }}
                    className={cn(SECONDARY_BTN, "h-8 px-3")}
                  >
                    Browse all doctors
                    <ArrowRight size={12} aria-hidden />
                  </button>
                }
              />
              {specialties.isLoading ? (
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : (specialties.data?.specialties ?? []).length === 0 ? (
                <EmptyBlock icon={<Stethoscope size={19} />} title="No specialties listed" body="Browse all doctors instead." />
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {(specialties.data?.specialties ?? []).map((s, idx) => {
                    const on = specialty === s.name;
                    const meta = SPECIALTY_META[s.name] ?? DEFAULT_SPECIALTY;
                    const Icon = meta.icon;
                    return (
                      <button
                        key={s.name ? `${s.name}-${idx}` : `spec-${idx}`}
                        type="button"
                        onClick={() => {
                          setSpecialty(s.name);
                          setStep("doctor");
                        }}
                        className={cn(
                          "group flex flex-col items-center gap-2.5 rounded-xl px-2 py-4 text-center transition-all hover:-translate-y-0.5",
                          on
                            ? "bg-sky-50/60 shadow-[inset_0_0_0_1.5px_rgba(2,132,199,0.4)]"
                            : "hover:bg-slate-50",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-12 w-12 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105",
                            meta.tone,
                          )}
                        >
                          <Icon size={20} aria-hidden />
                        </span>
                        <span className="w-full min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-slate-900">{s.name}</span>
                          <span className="block text-[11px] text-slate-400">
                            {s.count} doctor{s.count === 1 ? "" : "s"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ── Step 2: Doctor ──────────────────────────────────────── */}
          {step === "doctor" && (
            <section className={PANEL} aria-labelledby="bk-doctor">
              <PanelHeader
                id="bk-doctor"
                icon={<UserRound size={16} />}
                tone="bg-violet-50 text-violet-600"
                title="Choose a doctor"
                caption={
                  doctors.isLoading
                    ? "Searching…"
                    : `${doctorList.length} doctor${doctorList.length === 1 ? "" : "s"}${specialty ? ` in ${specialty}` : ""}`
                }
                action={
                  specialty ? (
                    <button type="button" onClick={() => setStep("specialty")} className={cn(SECONDARY_BTN, "h-8 px-3")}>
                      Change specialty
                    </button>
                  ) : null
                }
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PanelSearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by name, hospital or sub-specialty…"
                  ariaLabel="Search doctors"
                  className="lg:max-w-none"
                />
                <button
                  type="button"
                  aria-pressed={telemedicine}
                  onClick={() => setTelemedicine((v) => !v)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition-all",
                    telemedicine
                      ? "bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1.5px_rgba(124,58,237,0.35)]"
                      : "bg-slate-50 text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:text-slate-900",
                  )}
                >
                  <Video size={14} aria-hidden />
                  Video only
                </button>
              </div>

              {doctors.isLoading ? (
                <PanelSkeleton rows={3} />
              ) : doctorList.length === 0 ? (
                <EmptyBlock
                  icon={<Stethoscope size={19} />}
                  title="No doctors found"
                  body="No doctors matched your filters. Try another name or specialty."
                  actions={
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSpecialty("");
                        setTelemedicine(false);
                      }}
                      className={SECONDARY_BTN}
                    >
                      Reset filters
                    </button>
                  }
                />
              ) : (
                <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {doctorList.map((d, idx) => {
                    const on = doctorId === d.id;
                    return (
                      <li key={d.id ? `${d.id}-${idx}` : `doc-${idx}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setDoctorId(d.id);
                            setStep("schedule");
                          }}
                          className={cn(
                            "group relative flex h-full w-full items-start gap-3.5 rounded-xl bg-white p-3.5 text-left transition-all hover:-translate-y-px",
                            on
                              ? "shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1.5px_#0284c7]"
                              : "shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]",
                          )}
                        >
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-sky-400 to-blue-600 text-base font-semibold text-white shadow-md shadow-sky-500/25" aria-hidden>
                            {d.name?.[0]?.toUpperCase() ?? "D"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">Dr. {d.name}</span>
                              {d.available ? (
                                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">Available</span>
                              ) : null}
                            </span>
                            <span className="block truncate text-xs text-slate-500">{d.specialization}</span>
                            {d.hospitalName ? (
                              <span className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400">
                                <MapPin size={11} className="shrink-0" aria-hidden />
                                {d.hospitalName}
                              </span>
                            ) : null}
                            <span className="mt-2 flex flex-wrap items-center gap-1.5">
                              {d.rating ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                                  <Star size={10} className="fill-amber-400 text-amber-400" aria-hidden />
                                  {d.rating.toFixed(1)}
                                </span>
                              ) : null}
                              {d.consultationFee ? (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
                                  LKR {d.consultationFee.toLocaleString()}
                                </span>
                              ) : null}
                              <DoctorBadge
                                d={{
                                  userId: (d as any).userId ?? d.id,
                                  name: d.name,
                                  specialty: d.specialization ?? "",
                                  yearsExperience: (d as any).experience ?? 0,
                                  feeLkr: d.consultationFee ?? 0,
                                  verifiedSlmc: !!(d as any).slmcVerifiedAt,
                                  hospitalName: d.hospitalName ?? undefined,
                                }}
                              />
                            </span>
                          </span>
                          <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* ── Step 3: Schedule ────────────────────────────────────── */}
          {step === "schedule" && (
            <>
              <section className={PANEL} aria-labelledby="bk-schedule">
                <PanelHeader
                  id="bk-schedule"
                  icon={<CalendarDays size={16} />}
                  tone="bg-amber-50 text-amber-600"
                  title="Pick how and when"
                  caption="Choose a visit type, a date and an open slot"
                />

                <p className={cn(GROUP_LABEL, "mt-5")}>Visit type</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { key: "in_person" as const, title: "Hospital visit", body: "In-person examination", icon: Building2, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
                    { key: "video" as const, title: "Video consultation", body: "Secure call from the portal", icon: Video, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
                  ].map((m) => {
                    const on = mode === m.key;
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setMode(m.key)}
                        className={cn(
                          "flex items-center gap-3.5 rounded-xl p-3.5 text-left transition-all",
                          on
                            ? "bg-white shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1.5px_#0284c7]"
                            : "bg-slate-50 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-[12px]",
                            on ? cn("bg-gradient-to-br text-white shadow-lg", m.tone) : "bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
                          )}
                        >
                          <Icon size={18} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">{m.title}</span>
                          <span className="block text-xs text-slate-400">{m.body}</span>
                        </span>
                        {on ? (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-sky-600 text-white" aria-hidden>
                            <Check size={12} strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 max-w-xs">
                  <label htmlFor="bk-date" className={FIELD_LABEL}>Date</label>
                  <input
                    id="bk-date"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setTime("");
                    }}
                    min={new Date().toISOString().slice(0, 10)}
                    required
                    className={FIELD_INPUT}
                  />
                </div>

                {date ? (
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <p className={GROUP_LABEL}>Open slots · {formatDayLabel(date)}</p>
                    {availability.isLoading ? (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                        <Loader2 size={14} className="animate-spin text-sky-600" aria-hidden />
                        Checking the doctor&apos;s calendar…
                      </div>
                    ) : slots.length > 0 ? (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                        {slots.map((s, idx) => (
                          <button
                            key={s.time ? `${s.time}-${idx}` : `slot-${idx}`}
                            type="button"
                            aria-pressed={time === s.time}
                            onClick={() => setTime(s.time)}
                            className={cn(
                              "h-10 rounded-lg text-xs font-semibold tabular-nums transition-all",
                              time === s.time
                                ? "bg-[#07233a] text-white shadow-lg shadow-slate-900/20"
                                : "bg-slate-50 text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:bg-white hover:text-sky-700",
                            )}
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-xs font-medium text-amber-800">
                        <AlertCircle size={14} className="shrink-0" aria-hidden />
                        No open slots on this day — try another date.
                      </div>
                    )}
                  </div>
                ) : null}
              </section>

              <section className={PANEL} aria-labelledby="bk-reason">
                <PanelHeader
                  id="bk-reason"
                  icon={<FileText size={16} />}
                  tone="bg-slate-100 text-slate-500"
                  title="Reason for visit"
                  caption="Optional · helps your doctor prepare"
                />
                <div className="mt-5 flex flex-col gap-4">
                  <div>
                    <label htmlFor="bk-reason-input" className={FIELD_LABEL}>Main reason</label>
                    <input
                      id="bk-reason-input"
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Chest discomfort, follow-up, routine check-up…"
                      className={FIELD_INPUT}
                    />
                  </div>
                  <div>
                    <label htmlFor="bk-notes" className={FIELD_LABEL}>Notes for the doctor</label>
                    <textarea
                      id="bk-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Symptoms, recent medication changes, questions…"
                      className={FIELD_TEXTAREA}
                    />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── Step 4: Confirm ─────────────────────────────────────── */}
          {step === "confirm" && (
            <section className={PANEL} aria-labelledby="bk-confirm">
              <PanelHeader
                id="bk-confirm"
                icon={<Check size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="Review & confirm"
                caption="Check the details before you book"
              />
              <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <InfoField icon={<UserRound size={14} />} label="Doctor">
                  {selectedDoctor ? `Dr. ${selectedDoctor.name}` : "Selected doctor"}
                </InfoField>
                <InfoField icon={<Stethoscope size={14} />} label="Specialty">
                  {selectedDoctor?.specialization ?? (specialty || "—")}
                </InfoField>
                <InfoField icon={<CalendarDays size={14} />} label="Date">
                  {date ? formatDayLabel(date) : "—"}
                </InfoField>
                <InfoField icon={<Clock size={14} />} label="Time">
                  {time || "—"}
                </InfoField>
                <InfoField icon={mode === "video" ? <Video size={14} /> : <Building2 size={14} />} label="Visit type">
                  {mode === "video" ? "Video consultation" : "Hospital visit"}
                </InfoField>
                <InfoField icon={<MapPin size={14} />} label="Location">
                  {mode === "video" ? "Online · join from Appointments" : selectedDoctor?.hospitalName ?? "Doctor's hospital"}
                </InfoField>
                {reason ? (
                  <div className="sm:col-span-2">
                    <InfoField icon={<FileText size={14} />} label="Reason">
                      {reason}
                    </InfoField>
                  </div>
                ) : null}
              </dl>
              {error ? (
                <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  <AlertCircle size={14} className="shrink-0" aria-hidden />
                  {error}
                </div>
              ) : null}
            </section>
          )}
        </div>

        {/* ── Rail: live summary + navigation ────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:col-span-4" aria-label="Your booking">
          <section className={PANEL} aria-labelledby="bk-summary">
            <PanelHeader
              id="bk-summary"
              icon={<CalendarPlus size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Your booking"
              caption={canAdvance || step === "confirm" ? "Looking good" : "Fill in each step"}
            />
            <ul className="mt-4 flex flex-col gap-0.5 text-[13px]">
              {[
                { label: "Specialty", value: specialty || (step !== "specialty" ? "Any" : null), icon: Stethoscope },
                { label: "Doctor", value: selectedDoctor ? `Dr. ${selectedDoctor.name}` : doctorId ? "Selected" : null, icon: UserRound },
                { label: "Visit", value: step === "schedule" || step === "confirm" ? (mode === "video" ? "Video" : "In-person") : null, icon: mode === "video" ? Video : Building2 },
                { label: "Date", value: date ? formatDayLabel(date) : null, icon: CalendarDays },
                { label: "Time", value: time || null, icon: Clock },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <li key={r.label} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                        r.value ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400",
                      )}
                      aria-hidden
                    >
                      {r.value ? <Check size={13} strokeWidth={2.75} /> : <Icon size={13} />}
                    </span>
                    <span className="min-w-0 flex-1 text-slate-500">{r.label}</span>
                    <span className={cn("truncate text-right font-semibold", r.value ? "text-slate-900" : "text-slate-300")}>
                      {r.value ?? "—"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={goBack}
                disabled={step === "specialty"}
                className="inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700 disabled:opacity-40"
              >
                <ChevronLeft size={15} aria-hidden />
                Back
              </button>
              {step !== "confirm" ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canAdvance}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#07233a] px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 disabled:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
                >
                  Continue
                  <ChevronRight size={15} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={book.isPending}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-px hover:bg-emerald-700 disabled:opacity-60"
                >
                  {book.isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Booking…
                    </>
                  ) : (
                    <>
                      <Check size={15} strokeWidth={2.75} aria-hidden />
                      Confirm booking
                    </>
                  )}
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </PatientPage>
  );
}
