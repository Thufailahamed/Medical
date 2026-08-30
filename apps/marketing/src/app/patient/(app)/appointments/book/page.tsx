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
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
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
                <Calendar size={12} className="text-sky-300" />
                Live Appointment Scheduler
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Book a Clinical Appointment
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Connect with board-certified physicians for hospital consultations and encrypted HD video teleconsultations.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/appointments"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ChevronLeft size={13} />
                <span>My Appointments</span>
              </Link>
              <Link
                href="/patient/care-team"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <User size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>My Doctors</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Queue System
                </p>
                <p className="text-base font-extrabold text-white">Instant E-Queue</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <Video size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Telemedicine
                </p>
                <p className="text-base font-extrabold text-white">Encrypted HD</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Booking Mode
                </p>
                <p className="text-base font-extrabold text-white">Direct Confirm</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Calendar Sync
                </p>
                <p className="text-base font-extrabold text-white">iCal &amp; Google</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Modern Interactive Multi-Step Stepper Bar ────────────────────── */}
      <nav aria-label="Booking Progress" className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
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
                      : "bg-slate-50 text-slate-400 font-medium border border-slate-200/70",
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold",
                    isCurrent
                      ? "bg-sky-600 text-white shadow-2xs"
                      : isDone
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-500",
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
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Stethoscope size={18} className="text-sky-600" />
                <span>Select Medical Specialty</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
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
                  className="h-28 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
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
                        : "bg-white border-slate-200/90 hover:border-sky-300 hover:bg-slate-50/80 shadow-xs",
                    )}
                  >
                    <span className="text-3xl filter drop-shadow-sm group-hover:scale-110 transition-transform">
                      {emoji}
                    </span>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                        {s.name}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
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
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <User size={18} className="text-sky-600" />
                <span>Choose an Attending Specialist</span>
              </h2>
              {specialty ? (
                <p className="text-xs text-slate-500 mt-0.5">
                  Filtering for specialists in{" "}
                  <span className="font-bold text-slate-800">{specialty}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search physician by name, hospital, or sub-specialty…"
                className="w-full h-9 pl-9 pr-8 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shrink-0">
              <input
                type="checkbox"
                checked={telemedicine}
                onChange={(e) => setTelemedicine(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
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
                  className="h-24 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
                />
              ))}
            </div>
          ) : (doctors.data?.doctors ?? []).length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-2.5">
              <Stethoscope size={28} className="text-slate-400" />
              <h3 className="font-bold text-slate-800 text-sm">No Physicians Found</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                No doctors matched your criteria. Try loosening filters or choosing another specialty.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSpecialty("");
                  setTelemedicine(false);
                }}
                className="mt-2 text-xs font-bold text-sky-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
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
                        : "bg-white border-slate-200/90 hover:border-sky-300 hover:bg-slate-50 shadow-xs",
                    )}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-800 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
                        {d.name?.[0]?.toUpperCase() ?? "D"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-sky-700 transition-colors truncate">
                            Dr. {d.name}
                          </h3>
                          {d.available && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Available
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-slate-600 mt-0.5">
                          {d.specialization}
                        </p>

                        {d.hospitalName && (
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 truncate">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
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
                        <span className="text-xs font-bold text-slate-900">
                          LKR {d.consultationFee.toLocaleString()}
                        </span>
                      ) : null}

                      <div className="h-7 w-7 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors mt-1">
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
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={18} className="text-sky-600" />
                <span>Select Appointment Date &amp; Consultation Mode</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
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
                    : "bg-white border-slate-200 hover:bg-slate-50",
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                    mode === "in_person"
                      ? "bg-sky-600 text-white border-sky-600"
                      : "bg-slate-100 text-slate-600 border-slate-200",
                  )}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Hospital Consultation</h4>
                  <p className="text-xs text-slate-500 mt-0.5">In-person physical clinical exam</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("video")}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 cursor-pointer",
                  mode === "video"
                    ? "bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 shadow-xs"
                    : "bg-white border-slate-200 hover:bg-slate-50",
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                    mode === "video"
                      ? "bg-sky-600 text-white border-sky-600"
                      : "bg-slate-100 text-slate-600 border-slate-200",
                  )}
                >
                  <Video size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Video Teleconsultation</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Encrypted remote call via portal</p>
                </div>
              </button>
            </div>

            {/* Date Input */}
            <div className="flex flex-col gap-1.5 max-w-sm">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Select Appointment Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                required
                className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
              />
            </div>

            {/* Available Time Slots */}
            {date ? (
              <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Available Time Slot
                </label>

                {availability.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 p-4 bg-slate-50 rounded-xl">
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
                              : "bg-white border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-slate-50",
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
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Reason &amp; Clinical Background (Optional)
            </h3>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Primary Reason for Visit
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Chest discomfort, post-op follow up, routine checkup…"
                  className="w-full h-10 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Notes for Attending Physician
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Share any current symptoms, recent medication changes, or questions beforehand…"
                  className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. Step 4: Review & Confirm ────────────────────────────────────── */}
      {step === "confirm" && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <span>Review Appointment Summary</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Please verify your appointment details before finalizing your clinical booking.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
              <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <User size={12} className="text-slate-500" />
                Attending Physician
              </span>
              <p className="text-sm font-bold text-slate-900">
                Dr. {selectedDoctor?.name || "Consultant Specialist"}
              </p>
              <p className="text-xs text-slate-500">{selectedDoctor?.specialization}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
              <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Calendar size={12} className="text-slate-500" />
                Date &amp; Time
              </span>
              <p className="text-sm font-bold text-slate-900">{date}</p>
              <p className="text-xs font-semibold text-sky-700">{time} IST</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
              <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center gap-1">
                {mode === "video" ? (
                  <Video size={12} className="text-sky-600" />
                ) : (
                  <Building2 size={12} className="text-slate-500" />
                )}
                Consultation Format
              </span>
              <p className="text-sm font-bold text-slate-900 capitalize">
                {humanize(mode)}
              </p>
              <p className="text-xs text-slate-500">
                {mode === "video" ? "Secure Portal Video Call" : "Physical Hospital Visit"}
              </p>
            </div>

            {reason && (
              <div className="sm:col-span-2 md:col-span-3 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10.5px] uppercase font-bold text-slate-400">
                  Reason for Visit
                </span>
                <p className="text-xs font-medium text-slate-800">{reason}</p>
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
      <footer className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={() => {
            if (step === "doctor") setStep("specialty");
            else if (step === "schedule") setStep("doctor");
            else if (step === "confirm") setStep("schedule");
          }}
          disabled={step === "specialty"}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
