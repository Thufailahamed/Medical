"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  User,
  Video,
  X,
  Zap,
} from "lucide-react";

import {
  useBookAppointment,
  useDoctorAvailability,
  useDoctorSearch,
  useSpecialties,
} from "@/patient/hooks/doctors";
import { humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { DoctorBadge } from "@/portal/components/doctor/DoctorBadge";

type Step = "specialty" | "doctor" | "schedule" | "confirm";

const SPECIALTY_ICONS: Record<string, string> = {
  Cardiology: "❤️",
  Neurology: "🧠",
  Pediatrics: "👶",
  Orthopedics: "🦴",
  Dermatology: "✨",
  General: "🩺",
  "General Practice": "🩺",
  Gynecology: "🌸",
  Psychiatry: "💭",
  Ophthalmology: "👁️",
  Dentistry: "🦷",
  ENT: "👂",
};

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

  const stepsOrder: Step[] = ["specialty", "doctor", "schedule", "confirm"];
  const currentStepIndex = stepsOrder.indexOf(step);

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<Calendar size={13} />}
        kicker="Live Appointment Scheduler"
        title="Book a Clinical Appointment"
        description="Connect with board-certified physicians for hospital consultations and encrypted HD video teleconsultations."
        actions={
          <>
            <Link href="/patient/appointments" className={heroSecondaryAction}>
              <ChevronLeft size={13} />
              <span>My Appointments</span>
            </Link>
            <Link href="/patient/care-team" className={heroPrimaryAction}>
              <User size={14} />
              <span>My Doctors</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>Queue system · instant e-queue</span>
            <span>Telemedicine · encrypted HD</span>
            <span>Booking mode · direct confirm</span>
            <span>Calendar sync · iCal & Google</span>
          </>
        }
      />

      {/* ── 2. Modern Interactive Multi-Step Stepper Bar ────────────────────── */}
      <nav aria-label="Booking Progress" className="bg-surface p-2.5 rounded-2xl shadow-card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: "specialty" as const, index: 1, label: "1. Medical Specialty" },
            { key: "doctor" as const, index: 2, label: "2. Choose Doctor" },
            { key: "schedule" as const, index: 3, label: "3. Schedule & Mode" },
            { key: "confirm" as const, index: 4, label: "4. Review & Confirm" },
          ].map((s, idx) => {
            const isCurrent = step === s.key;
            const isDone = currentStepIndex > idx;
            const isClickable = isDone || isCurrent;

            return (
              <button
                key={s.key}
                type="button"
                disabled={!isClickable}
                onClick={() => {
                  if (isClickable) setStep(s.key);
                }}
                className={cn(
                  "p-3 rounded-xl text-left transition-all flex items-center gap-2.5 cursor-pointer disabled:cursor-not-allowed",
                  isCurrent
                    ? "bg-sky-50 text-sky-950 font-bold border border-sky-300 ring-2 ring-sky-500/20 shadow-2xs"
                    : isDone
                      ? "bg-emerald-50/60 text-emerald-800 font-semibold border border-emerald-200 hover:bg-emerald-50"
                      : "bg-surface-2 text-text-muted font-medium border border-border",
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold",
                    isCurrent
                      ? "bg-sky-600 text-white shadow-2xs"
                      : isDone
                        ? "bg-emerald-600 text-white"
                        : "bg-surface-3 text-text-soft",
                  )}
                >
                  {isDone ? <Check size={13} strokeWidth={3} /> : s.index}
                </div>
                <span className="text-xs truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── 3. Step 1: Medical Specialty ───────────────────────────────────── */}
      {step === "specialty" && (
        <section className="rounded-2xl border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                <Stethoscope size={18} className="text-sky-600" />
                <span>Select Medical Specialty</span>
              </h2>
              <p className="text-xs text-text-soft mt-0.5">
                What clinical condition or specialty care do you require?
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSpecialty("");
                setStep("doctor");
              }}
              className="text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Browse All Physicians</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {specialties.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-surface-2 animate-pulse border border-border"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(specialties.data?.specialties ?? []).map((s, idx) => {
                const isSelected = specialty === s.name;
                const emoji = SPECIALTY_ICONS[s.name] || "🩺";

                return (
                  <button
                    key={s.name ? `${s.name}-${idx}` : `spec-${idx}`}
                    type="button"
                    onClick={() => {
                      setSpecialty(s.name);
                      setStep("doctor");
                    }}
                    className={cn(
                      "p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-2.5 cursor-pointer group hover:scale-[1.02]",
                      isSelected
                        ? "bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 shadow-xs"
                        : "bg-surface border-border hover:border-border-strong hover:bg-surface-2/80 shadow-xs",
                    )}
                  >
                    <span className="text-3xl filter drop-shadow-sm group-hover:scale-110 transition-transform">
                      {emoji}
                    </span>

                    <div>
                      <h3 className="text-sm font-bold text-text group-hover:text-sky-700 transition-colors">
                        {s.name}
                      </h3>
                      <p className="text-[11px] font-semibold text-text-muted mt-0.5">
                        {s.count} Specialist{s.count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── 4. Step 2: Choose Doctor ───────────────────────────────────────── */}
      {step === "doctor" && (
        <section className="rounded-2xl border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                <User size={18} className="text-sky-600" />
                <span>Choose an Attending Specialist</span>
              </h2>
              {specialty ? (
                <p className="text-xs text-text-soft mt-0.5">
                  Filtering for specialists in{" "}
                  <span className="font-bold text-text">{specialty}</span>
                </p>
              ) : (
                <p className="text-xs text-text-soft mt-0.5">
                  Showing all certified hospital physicians and medical consultants.
                </p>
              )}
            </div>

            {specialty && (
              <button
                type="button"
                onClick={() => setStep("specialty")}
                className="text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 transition-colors cursor-pointer"
              >
                Change Specialty
              </button>
            )}
          </div>

          {/* Search & Telemedicine Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-2 p-3 rounded-xl border border-border">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search physician by name, hospital, or sub-specialty…"
                className="w-full h-9 pl-9 pr-8 text-xs bg-surface border border-border rounded-lg font-medium text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-soft"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-text cursor-pointer bg-surface px-3 py-2 rounded-lg border-border shrink-0">
              <input
                type="checkbox"
                checked={telemedicine}
                onChange={(e) => setTelemedicine(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-brand focus:ring-brand"
              />
              <Video size={13} className="text-sky-600" />
              <span>Video Consultations Only</span>
            </label>
          </div>

          {/* Doctors List */}
          {doctors.isLoading ? (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl bg-surface-2 animate-pulse border border-border"
                />
              ))}
            </div>
          ) : (doctors.data?.doctors ?? []).length === 0 ? (
            <div className="p-8 rounded-2xl bg-surface-2 border border-border text-center flex flex-col items-center gap-2.5">
              <Stethoscope size={28} className="text-text-muted" />
              <h3 className="font-bold text-text text-sm">No Physicians Found</h3>
              <p className="text-xs text-text-soft max-w-sm">
                No doctors matched your criteria. Try loosening filters or choosing another specialty.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSpecialty("");
                  setTelemedicine(false);
                }}
                className="mt-2 text-xs font-bold text-brand bg-surface px-3 py-1.5 rounded-lg border-border"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(doctors.data?.doctors ?? []).map((d, idx) => {
                const isSelected = doctorId === d.id;

                return (
                  <button
                    key={d.id ? `${d.id}-${idx}` : `doc-${idx}`}
                    type="button"
                    onClick={() => {
                      setDoctorId(d.id);
                      setStep("schedule");
                    }}
                    className={cn(
                      "p-4 sm:p-5 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer group",
                      isSelected
                        ? "bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 shadow-xs"
                        : "bg-surface border-border hover:border-border-strong hover:bg-surface-2 shadow-xs",
                    )}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-800 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
                        {d.name?.[0]?.toUpperCase() ?? "D"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-text text-sm sm:text-base group-hover:text-sky-700 transition-colors truncate">
                            Dr. {d.name}
                          </h3>
                          {d.available && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Available
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-text-soft mt-0.5">
                          {d.specialization}
                        </p>

                        {d.hospitalName && (
                          <p className="text-xs text-text-muted mt-1 flex items-center gap-1 truncate">
                            <MapPin size={11} className="text-text-muted shrink-0" />
                            <span>{d.hospitalName}</span>
                          </p>
                        )}
                      </div>
                    </div>

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

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {d.rating ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <Star size={11} className="fill-amber-500 text-amber-500" />
                          <span>{d.rating.toFixed(1)}</span>
                        </span>
                      ) : null}

                      {d.consultationFee ? (
                        <span className="text-xs font-bold text-text">
                          LKR {d.consultationFee.toLocaleString()}
                        </span>
                      ) : null}

                      <div className="h-7 w-7 rounded-xl bg-surface-2 text-text-soft flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors mt-1">
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── 5. Step 3: Schedule Date, Mode & Slot ───────────────────────────── */}
      {step === "schedule" && (
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-5">
            <div className="border-b border-border pb-4">
              <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                <Calendar size={18} className="text-sky-600" />
                <span>Select Appointment Date &amp; Consultation Mode</span>
              </h2>
              <p className="text-xs text-text-soft mt-0.5">
                Appointments are automatically confirmed and synced to your calendar.
              </p>
            </div>

            {/* Visit Mode Cards (In-person vs Video) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("in_person")}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 cursor-pointer",
                  mode === "in_person"
                    ? "bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 shadow-xs"
                    : "bg-surface border-border hover:bg-surface-2",
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                    mode === "in_person"
                      ? "bg-sky-600 text-white border-sky-600"
                      : "bg-surface-2 text-text-soft border-border",
                  )}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text">Hospital Consultation</h4>
                  <p className="text-xs text-text-soft mt-0.5">In-person physical clinical exam</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("video")}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 cursor-pointer",
                  mode === "video"
                    ? "bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 shadow-xs"
                    : "bg-surface border-border hover:bg-surface-2",
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                    mode === "video"
                      ? "bg-sky-600 text-white border-sky-600"
                      : "bg-surface-2 text-text-soft border-border",
                  )}
                >
                  <Video size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text">Video Teleconsultation</h4>
                  <p className="text-xs text-text-soft mt-0.5">Encrypted remote call via portal</p>
                </div>
              </button>
            </div>

            {/* Date Input */}
            <div className="flex flex-col gap-1.5 max-w-sm">
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Select Appointment Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                required
                className="w-full h-11 px-3.5 text-xs sm:text-sm bg-surface-2 border border-border rounded-xl font-medium text-text focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all cursor-pointer"
              />
            </div>

            {/* Available Time Slots */}
            {date ? (
              <div className="flex flex-col gap-2.5 pt-2 border-t border-border">
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Select Available Time Slot
                </label>

                {availability.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-text-soft p-4 bg-surface-2 rounded-xl">
                    <Loader2 size={14} className="animate-spin text-sky-600" />
                    <span>Loading available physician slots for {date}…</span>
                  </div>
                ) : availability.data?.slots?.length ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {availability.data.slots
                      .filter((s) => s.available)
                      .map((s, idx) => (
                        <button
                          key={s.time ? `${s.time}-${idx}` : `slot-${idx}`}
                          type="button"
                          onClick={() => setTime(s.time)}
                          className={cn(
                            "py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer text-center",
                            time === s.time
                              ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                              : "bg-surface border-border text-text hover:border-border-strong hover:bg-surface-2",
                          )}
                        >
                          {s.time}
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    No available consultation slots for this date. Please select another calendar day.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Reason & Medical Context Card */}
          <div className="rounded-2xl border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text">
              Reason &amp; Clinical Background (Optional)
            </h3>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Primary Reason for Visit
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Chest discomfort, post-op follow up, routine checkup…"
                  className="w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-2 border border-border rounded-xl font-medium text-text focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Notes for Attending Physician
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Share any current symptoms, recent medication changes, or questions beforehand…"
                  className="w-full p-3 text-xs sm:text-sm bg-surface-2 border border-border rounded-xl font-medium text-text focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all leading-relaxed"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. Step 4: Review & Confirm ────────────────────────────────────── */}
      {step === "confirm" && (
        <section className="rounded-2xl border-border bg-surface p-6 sm:p-7 shadow-card flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <span>Review Appointment Summary</span>
            </h2>
            <p className="text-xs text-text-soft mt-0.5">
              Please verify your appointment details before finalizing your clinical booking.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-1">
              <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
                <User size={12} className="text-text-soft" />
                Attending Physician
              </span>
              <p className="text-sm font-bold text-text">
                Dr. {selectedDoctor?.name || "Consultant Specialist"}
              </p>
              <p className="text-xs text-text-soft">{selectedDoctor?.specialization}</p>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-1">
              <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
                <Calendar size={12} className="text-text-soft" />
                Date &amp; Time
              </span>
              <p className="text-sm font-bold text-text">{date}</p>
              <p className="text-xs font-semibold text-sky-700">{time} IST</p>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-1">
              <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
                {mode === "video" ? (
                  <Video size={12} className="text-sky-600" />
                ) : (
                  <Building2 size={12} className="text-text-soft" />
                )}
                Consultation Format
              </span>
              <p className="text-sm font-bold text-text capitalize">
                {humanize(mode)}
              </p>
              <p className="text-xs text-text-soft">
                {mode === "video" ? "Secure Portal Video Call" : "Physical Hospital Visit"}
              </p>
            </div>

            {reason && (
              <div className="sm:col-span-2 md:col-span-3 p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-1">
                <span className="text-[10.5px] uppercase font-bold text-text-muted">
                  Reason for Visit
                </span>
                <p className="text-xs font-medium text-text">{reason}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>
      )}

      {/* ── 7. Global Navigation Bar ───────────────────────────────────────── */}
      <footer className="flex items-center justify-between gap-3 bg-surface p-3.5 rounded-2xl shadow-card">
        <button
          type="button"
          onClick={() => {
            if (step === "doctor") setStep("specialty");
            else if (step === "schedule") setStep("doctor");
            else if (step === "confirm") setStep("schedule");
          }}
          disabled={step === "specialty"}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-text bg-surface-2 hover:bg-surface-3 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          <span>Back Step</span>
        </button>

        {step !== "confirm" ? (
          <button
            type="button"
            onClick={() => {
              if (step === "specialty" && specialty) setStep("doctor");
              else if (step === "doctor" && doctorId) setStep("schedule");
              else if (step === "schedule" && date && time) setStep("confirm");
            }}
            disabled={
              (step === "doctor" && !doctorId) ||
              (step === "schedule" && (!date || !time))
            }
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            <span>Proceed to Next Step</span>
            <ChevronRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={confirm}
            disabled={book.isPending}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
            }}
          >
            {book.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Finalizing Booking…</span>
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={3} />
                <span>Confirm &amp; Book Appointment</span>
              </>
            )}
          </button>
        )}
      </footer>
    </div>
  );
}
