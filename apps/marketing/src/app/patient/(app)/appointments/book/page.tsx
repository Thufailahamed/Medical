"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Stethoscope,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  Video,
  User,
  Check,
  Star,
  Building2,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import {
  useBookAppointment,
  useDoctorAvailability,
  useDoctorSearch,
  useSpecialties,
} from "@/patient/hooks/doctors";
import { humanize } from "@/patient/lib/format";

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
  "ENT": "👂",
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
  const availability = useDoctorAvailability(
    doctorId,
    date || undefined
  );

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

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/appointments"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to appointments
      </Link>

      <SectionHeader
        label="Your calendar"
        title="Book an appointment"
        description="Find the right specialist, pick a time, and confirm. We'll add it to your calendar automatically."
      />

      <Stepper currentStep={step} onStep={setStep} />

      {/* Step: Specialty */}
      {step === "specialty" ? (
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Stethoscope size={18} aria-hidden className="text-brand" />
              <h2 className="text-sm font-bold text-text">Choose a specialty</h2>
            </div>
            <p className="text-xs text-text-soft">
              What kind of care do you need today?
            </p>
            <QueryBoundary
              query={specialties}
              loadingCount={6}
              emptyTitle="No specialties available"
            >
              {(data) => (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {(data.specialties ?? []).map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => {
                        setSpecialty(s.name);
                        setStep("doctor");
                      }}
                      className={`group flex flex-col items-center gap-2 rounded-inner border p-4 text-center transition-all ${
                        specialty === s.name
                          ? "border-brand bg-brand-soft"
                          : "border-[color:var(--color-border)] bg-surface-1 hover:border-brand hover:bg-brand-soft"
                      }`}
                    >
                      <span className="text-2xl" aria-hidden>
                        {SPECIALTY_ICONS[s.name] || "🩺"}
                      </span>
                      <span className="text-sm font-semibold text-text">
                        {s.name}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {s.count} doctor{s.count === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </QueryBoundary>
            <button
              type="button"
              onClick={() => {
                setSpecialty("");
                setStep("doctor");
              }}
              className="self-start text-xs font-semibold text-text-soft hover:text-brand"
            >
              Not sure — show me all doctors →
            </button>
          </div>
        </Card>
      ) : null}

      {/* Step: Doctor */}
      {step === "doctor" ? (
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={18} aria-hidden className="text-brand" />
                <h2 className="text-sm font-bold text-text">Find a doctor</h2>
              </div>
              {specialty ? (
                <button
                  type="button"
                  onClick={() => {
                    setSpecialty("");
                  }}
                  className="text-xs font-semibold text-text-soft hover:text-brand"
                >
                  Change specialty
                </button>
              ) : null}
            </div>

            {specialty ? (
              <p className="text-xs text-text-soft">
                Showing doctors specializing in{" "}
                <span className="font-semibold text-text">{specialty}</span>
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  size={14}
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-text-soft">
                <input
                  type="checkbox"
                  checked={telemedicine}
                  onChange={(e) => setTelemedicine(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand"
                />
                Video consultations
              </label>
            </div>

            <QueryBoundary
              query={doctors}
              loadingCount={3}
              emptyTitle="No doctors found"
              emptyDescription="Try changing your filters or specialty."
            >
              {(data) => (
                <ul className="flex flex-col gap-2">
                  {(data.doctors ?? []).map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setDoctorId(d.id);
                          setStep("schedule");
                        }}
                        className="group flex w-full items-center gap-4 rounded-inner border border-[color:var(--color-border)] bg-surface-1 p-4 text-left transition-all hover:border-brand hover:bg-brand-soft"
                      >
                        <div
                          className="grid h-12 w-12 shrink-0 place-items-center text-lg font-bold text-white"
                          style={{
                            borderRadius: "var(--radius-pill)",
                            background:
                              "linear-gradient(145deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)",
                          }}
                          aria-hidden
                        >
                          {d.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-text">
                              Dr. {d.name}
                            </h3>
                            {d.available ? (
                              <StatusPill tone="success">Available</StatusPill>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-text-soft">
                            {d.specialization}
                          </p>
                          {d.hospitalName ? (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-muted">
                              <MapPin size={10} aria-hidden /> {d.hospitalName}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {d.rating ? (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                              <Star size={11} aria-hidden /> {d.rating.toFixed(1)}
                            </span>
                          ) : null}
                          {d.consultationFee ? (
                            <span className="text-xs text-text-soft">
                              LKR {d.consultationFee.toLocaleString()}
                            </span>
                          ) : null}
                          <ChevronRight
                            size={14}
                            aria-hidden
                            className="text-text-muted group-hover:text-brand"
                          />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </QueryBoundary>
          </div>
        </Card>
      ) : null}

      {/* Step: Schedule */}
      {step === "schedule" ? (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} aria-hidden className="text-brand" />
                <h2 className="text-sm font-bold text-text">Pick a date & time</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="t-label block" htmlFor="date">
                    Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    required
                    className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="t-label block" htmlFor="mode">
                    Visit type
                  </label>
                  <select
                    id="mode"
                    value={mode}
                    onChange={(e) =>
                      setMode(e.target.value as "in_person" | "video")
                    }
                    className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                  >
                    <option value="in_person">In person</option>
                    <option value="video">Video</option>
                  </select>
                </div>
              </div>

              {date ? (
                <div>
                  <p className="t-label">Available times</p>
                  {availability.isLoading ? (
                    <p className="mt-2 text-sm text-text-soft">Loading slots…</p>
                  ) : availability.data?.slots?.length ? (
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {availability.data.slots
                        .filter((s) => s.available)
                        .map((s) => (
                          <button
                            key={s.time}
                            type="button"
                            onClick={() => setTime(s.time)}
                            className={`rounded-pill border px-3 py-2 text-sm font-semibold transition-colors ${
                              time === s.time
                                ? "border-brand bg-brand text-white"
                                : "border-border bg-surface-1 text-text hover:border-brand hover:bg-brand-soft"
                            }`}
                          >
                            {s.time}
                          </button>
                        ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-text-soft">
                      No available slots for this date. Try another day.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-bold text-text">Visit details</h2>
              <div>
                <label className="t-label block" htmlFor="reason">
                  Reason <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  id="reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Annual checkup, follow-up"
                  className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="t-label block" htmlFor="notes">
                  Notes <span className="text-text-muted">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything the doctor should know beforehand"
                  className="mt-2 w-full rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Step: Confirm */}
      {step === "confirm" ? (
        <Card accent="brand">
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-text">Confirm your visit</h2>
            <ul className="flex flex-col gap-2 rounded-inner bg-surface-2 p-3 text-sm">
              <li className="flex items-center gap-2">
                <User size={14} aria-hidden className="text-text-muted" />
                Doctor: {doctors.data?.doctors.find((d) => d.id === doctorId)?.name ?? "—"}
              </li>
              <li className="flex items-center gap-2">
                <Calendar size={14} aria-hidden className="text-text-muted" />
                {date} at {time}
              </li>
              <li className="flex items-center gap-2">
                {mode === "video" ? (
                  <Video size={14} aria-hidden className="text-text-muted" />
                ) : (
                  <Building2 size={14} aria-hidden className="text-text-muted" />
                )}
                {humanize(mode)}
              </li>
              {reason ? (
                <li className="flex items-center gap-2">
                  <Stethoscope size={14} aria-hidden className="text-text-muted" />
                  {reason}
                </li>
              ) : null}
            </ul>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === "doctor") setStep("specialty");
            else if (step === "schedule") setStep("doctor");
            else if (step === "confirm") setStep("schedule");
          }}
          disabled={step === "specialty"}
          className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-soft disabled:opacity-50"
        >
          <ChevronLeft size={14} aria-hidden /> Back
        </button>
        {step !== "confirm" ? (
          <button
            type="button"
            onClick={() => {
              if (step === "doctor") setStep("schedule");
              else if (step === "schedule" && date && time) setStep("confirm");
            }}
            disabled={
              (step === "doctor" && !doctorId) ||
              (step === "schedule" && (!date || !time))
            }
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Continue <ChevronRight size={14} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={confirm}
            disabled={book.isPending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Check size={14} aria-hidden />
            {book.isPending ? "Booking…" : "Confirm booking"}
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({
  currentStep,
  onStep,
}: {
  currentStep: Step;
  onStep: (step: Step) => void;
}) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: "specialty", label: "Specialty" },
    { key: "doctor", label: "Doctor" },
    { key: "schedule", label: "Schedule" },
    { key: "confirm", label: "Confirm" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStep(s.key)}
            className={`flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
              i === currentIndex
                ? "bg-brand text-white"
                : i < currentIndex
                  ? "bg-brand-soft text-brand"
                  : "bg-surface-2 text-text-muted"
            }`}
          >
            <span>{i + 1}</span>
            <span>{s.label}</span>
          </button>
          {i < steps.length - 1 ? (
            <ChevronRight size={12} aria-hidden className="text-text-muted" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
