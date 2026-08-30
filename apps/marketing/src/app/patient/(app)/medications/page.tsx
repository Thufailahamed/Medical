"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Flame,
  Loader2,
  Pill,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  SkipForward,
  X,
} from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import {
  useAddMedication,
  useMarkDoseTaken,
  useMedications,
  useMedicationStats,
  usePatientProfile,
  useRefillDue,
  useSkipDose,
  useTodayDoses,
  useUntakeDose,
} from "@/patient/hooks";
import { api } from "@/portal/lib/api";
import { humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

function cleanScheduleString(val: string | null | undefined): string {
  if (!val) return "";
  const cleaned = val.replace(/_/g, " ").trim();
  if (cleaned.toLowerCase() === "three times daily") return "3 times daily";
  if (cleaned.toLowerCase() === "twice daily") return "2 times daily";
  if (cleaned.toLowerCase() === "once daily") return "Once daily";
  if (cleaned.toLowerCase() === "as needed") return "As needed (PRN)";
  if (cleaned.toLowerCase() === "after food") return "After meals";
  if (cleaned.toLowerCase() === "before food") return "Before meals";
  return humanize(cleaned);
}

export default function MedicationsPage() {
  const list = useMedications();
  const stats = useMedicationStats(7);
  const refills = useRefillDue(14);
  const doses = useTodayDoses();
  const markTaken = useMarkDoseTaken();
  const skipDose = useSkipDose();
  const untakeDose = useUntakeDose();

  const [refillOpen, setRefillOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [doseError, setDoseError] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "paused">("all");

  const profile = usePatientProfile();
  const addMedication = useAddMedication();

  const statData = stats.data;
  const medicines = list.data?.medicines ?? [];
  const todayDoses = doses.data?.doses ?? [];
  const refillCandidates = refills.data?.refills ?? [];
  const refillCount = refills.data?.count ?? refillCandidates.length;

  const busy = markTaken.isPending || skipDose.isPending || untakeDose.isPending;

  const filteredMedicines = useMemo(() => {
    if (filterActive === "active") return medicines.filter((m) => m.active);
    if (filterActive === "paused") return medicines.filter((m) => !m.active);
    return medicines;
  }, [medicines, filterActive]);

  return (
    <div className="flex flex-col gap-5 pb-16">
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
        {/* Ambient Glows */}
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
                <Pill size={12} className="text-sky-300" />
                Medication Adherence &amp; Rx
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Active Medications &amp; Daily Schedule
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Log today&apos;s dosage adherence, monitor pharmacy refill cycles, and follow your physician&apos;s administration instructions.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setRefillOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02] cursor-pointer"
              >
                <ShoppingBag size={13} />
                <span>Pharmacy Refills</span>
                {refillCount > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-amber-950">
                    {refillCount}
                  </span>
                ) : null}
              </button>
              <Link
                href="/patient/prescriptions"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ShieldCheck size={13} />
                <span>Prescriptions</span>
              </Link>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02] cursor-pointer"
                style={{ color: "#0c4a6e" }}
              >
                <Plus size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>Add Medication</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Pill size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Medicines
                </p>
                <p className="text-base font-extrabold text-white">
                  {statData?.activeCount ?? medicines.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Today&apos;s Doses
                </p>
                <p className="text-base font-extrabold text-white">
                  {statData?.todayTaken ?? 0} / {statData?.todayCount ?? medicines.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Flame size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Adherence Streak
                </p>
                <p className="text-base font-extrabold text-white">
                  {statData?.streakDays ?? 0} days
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRefillOpen(true)}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                refillCount > 0
                  ? "bg-amber-400/20 border-amber-300/40 hover:bg-amber-400/30"
                  : "bg-white/10 border-white/10",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <ShoppingBag size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Refills Due
                </p>
                <p className="text-base font-extrabold text-white">
                  {refillCount} medicines
                </p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Refill Warning Alert Banner ─────────────────────────────────── */}
      {refillCount > 0 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 shadow-2xs">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-amber-950">
                {refillCount} Prescription{refillCount === 1 ? "" : "s"} due for refill
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Supply for {refillCandidates.map((r) => r.name).join(", ") || "active medications"} is running low. Request your pharmacy refill to ensure continuous care.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRefillOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-amber-950 bg-amber-200/80 hover:bg-amber-300/90 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <span>Review &amp; Refill</span>
            <ArrowRight size={13} />
          </button>
        </div>
      ) : null}

      {/* ── 3. Medications Filter Bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterActive("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              filterActive === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            All ({medicines.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterActive("active")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              filterActive === "active"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Active ({medicines.filter((m) => m.active).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterActive("paused")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              filterActive === "paused"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Paused ({medicines.filter((m) => !m.active).length})
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
            {filteredMedicines.length} medications on plan
          </span>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Add Medication</span>
          </button>
        </div>
      </div>

      {/* ── 4. Medications List ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {doseError ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
            {doseError}
          </div>
        ) : null}

        {list.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Pill size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                No medications on this list
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                {filterActive === "paused"
                  ? "You have no paused medications. All prescribed treatments are currently active."
                  : "When your physician writes an e-prescription, medications will appear here with scheduling guidance."}
              </p>
            </div>
            <Link
              href="/patient/prescriptions"
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <ShieldCheck size={14} />
              <span>View Prescriptions</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredMedicines.map((m) => {
              const dose = todayDoses.find((item) => item.medicineId === m.id);
              const formattedFreq = cleanScheduleString(m.frequency);
              const formattedTiming = cleanScheduleString(m.timing);

              return (
                <article
                  key={m.id}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Left Column: Icon + Details */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 shadow-2xs group-hover:bg-sky-100/70 transition-colors">
                      <Pill size={20} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-800 transition-colors truncate">
                          {m.name}
                        </h3>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10.5px] font-bold border",
                            m.active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                              : "bg-slate-100 text-slate-600 border-slate-200",
                          )}
                        >
                          {m.active ? "Active" : "Paused"}
                        </span>
                      </div>

                      {/* Dosage, Frequency, Timing pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800">
                          {m.dosage}
                        </span>
                        {formattedFreq ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-100">
                            {formattedFreq}
                          </span>
                        ) : null}
                        {formattedTiming ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200/80">
                            {formattedTiming}
                          </span>
                        ) : null}
                      </div>

                      {m.notes ? (
                        <p className="text-xs text-slate-500 mt-1.5 italic line-clamp-1">
                          Note: {m.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Right Column: Dose Adherence Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    {dose ? (
                      <div className="flex items-center gap-2">
                        {dose.takenAt ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDoseError(null);
                              untakeDose.mutate(dose.id, {
                                onError: (err) =>
                                  setDoseError(
                                    err instanceof Error
                                      ? err.message
                                      : "Could not undo dose.",
                                  ),
                              });
                            }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer disabled:opacity-60"
                          >
                            <Check size={14} className="text-emerald-600" />
                            <span>Taken Today · Undo</span>
                          </button>
                        ) : dose.skipped ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDoseError(null);
                              untakeDose.mutate(dose.id, {
                                onError: (err) =>
                                  setDoseError(
                                    err instanceof Error
                                      ? err.message
                                      : "Could not reset dose.",
                                  ),
                              });
                            }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-60"
                          >
                            <RotateCcw size={13} />
                            <span>Skipped · Reset</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setDoseError(null);
                                markTaken.mutate(
                                  { id: dose.id },
                                  {
                                    onError: (err) =>
                                      setDoseError(
                                        err instanceof Error
                                          ? err.message
                                          : "Could not mark dose.",
                                      ),
                                  },
                                );
                              }}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60"
                              style={{
                                background:
                                  "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                              }}
                            >
                              <Check size={13} />
                              <span>Take Dose</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDoseError(null);
                                skipDose.mutate(
                                  { id: dose.id },
                                  {
                                    onError: (err) =>
                                      setDoseError(
                                        err instanceof Error
                                          ? err.message
                                          : "Could not skip dose.",
                                      ),
                                  },
                                );
                              }}
                              disabled={busy}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-60"
                            >
                              <SkipForward size={13} />
                              <span>Skip</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                        {m.frequency ? cleanScheduleString(m.frequency) : "As prescribed"}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 5. Pharmacy Refills Drawer ──────────────────────────────────────── */}
      <Sheet
        open={refillOpen}
        onClose={() => setRefillOpen(false)}
        ariaLabel="Refills due"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
              Pharmacy Service
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Prescription Refills
            </h2>
          </div>
          <button
            aria-label="Close"
            onClick={() => setRefillOpen(false)}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {refillCandidates.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center gap-2">
              <CheckCircle2 size={32} className="text-emerald-500" />
              <p className="font-bold text-slate-800 text-sm">
                All medications are well stocked
              </p>
              <p className="text-xs text-slate-500 max-w-xs">
                No active prescriptions are due for refill within the next 14 days.
              </p>
            </div>
          ) : (
            refillCandidates.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{m.name}</h3>
                    <p className="text-xs text-slate-500">{m.dosage}</p>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10.5px] font-bold",
                      m.daysRemaining <= 3
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200",
                    )}
                  >
                    {m.daysRemaining <= 0
                      ? "Past due"
                      : `Empty in ${m.daysRemaining}d`}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    Expected runout: {new Date(m.expectedEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>

                  <Link
                    href="/patient/prescriptions"
                    onClick={() => setRefillOpen(false)}
                    className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1"
                  >
                    <span>Order Refill</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </Sheet>

      {/* ── 6. Add Medication Slide-Over Sheet ──────────────────────────────── */}
      <AddMedicationSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        patientId={profile.data?.patient?.patients?.id || ""}
        onSubmit={async (data) => {
          await addMedication.mutateAsync(data);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function AddMedicationSheet({
  open,
  onClose,
  patientId,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  onSubmit: (input: any) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [timing, setTiming] = useState("After food");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState("");
  const [refillReminder, setRefillReminder] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const QUICK_SUGGESTIONS = [
    { name: "Paracetamol", dosage: "500mg", freq: "As needed (PRN)" },
    { name: "Amoxicillin", dosage: "500mg", freq: "3 times daily" },
    { name: "Omeprazole", dosage: "20mg", freq: "Once daily" },
    { name: "Metformin", dosage: "500mg", freq: "Twice daily" },
    { name: "Cetirizine", dosage: "10mg", freq: "Once daily" },
    { name: "Ibuprofen", dosage: "400mg", freq: "As needed (PRN)" },
  ];

  const handleQuickSelect = (item: (typeof QUICK_SUGGESTIONS)[0]) => {
    setName(item.name);
    setDosage(item.dosage);
    setFrequency(item.freq);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter the medication name");
      return;
    }
    if (!dosage.trim()) {
      setError("Please enter the dosage strength (e.g. 500mg or 1 tablet)");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let resolvedPid = patientId;
      if (!resolvedPid) {
        const res = await api<any>("/patients/me").catch(() => null);
        resolvedPid = res?.patient?.patients?.id || res?.patient?.id || "";
      }

      await onSubmit({
        patientId: resolvedPid,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        timing,
        startDate,
        endDate: endDate ? endDate : undefined,
        refillReminder,
        notes: notes.trim() || undefined,
      });
      setName("");
      setDosage("");
      setNotes("");
      setEndDate("");
      onClose();
    } catch (err: any) {
      setError(
        err?.message || "Failed to add medication. Please verify the details.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100 shadow-2xs">
            <Pill size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Add New Medication
            </h2>
            <p className="text-xs text-slate-500">
              Record a prescribed or over-the-counter medicine
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {/* Quick Suggestions as high-contrast pill chips */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Quick Auto-Fill Prescriptions
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((item) => {
              const isSelected = name === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleQuickSelect(item)}
                  style={{
                    backgroundColor: isSelected ? "#0284c7" : "#ffffff",
                    borderColor: isSelected ? "#0284c7" : "#cbd5e1",
                    color: isSelected ? "#ffffff" : "#334155",
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:scale-105",
                  )}
                >
                  <Pill size={11} className={isSelected ? "text-white" : "text-sky-600"} />
                  <span>
                    {item.name} <span className={isSelected ? "opacity-90" : "text-slate-400 font-normal"}>{item.dosage}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Medication Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Medication Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paracetamol, Amoxicillin, Atorvastatin…"
            className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
        </div>

        {/* Dosage */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Dosage &amp; Strength *
          </label>
          <input
            type="text"
            required
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g. 500mg, 10ml, 1 tablet, 2 puffs…"
            className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
        </div>

        {/* Frequency & Timing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Frequency *
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="Once daily">Once daily</option>
              <option value="Twice daily">Twice daily</option>
              <option value="3 times daily">3 times daily</option>
              <option value="4 times daily">4 times daily</option>
              <option value="As needed (PRN)">As needed (PRN)</option>
              <option value="Weekly">Weekly</option>
              <option value="Every 8 hours">Every 8 hours</option>
              <option value="Every 12 hours">Every 12 hours</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Meal Timing
            </label>
            <select
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="After food">After food / meals</option>
              <option value="Before food">Before food / meals</option>
              <option value="With food">With food</option>
              <option value="Any time">Any time</option>
              <option value="Morning">Morning</option>
              <option value="Night">Night</option>
            </select>
          </div>
        </div>

        {/* Start Date & End Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Start Date *
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Refill Reminder */}
        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={refillReminder}
            onChange={(e) => setRefillReminder(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              Enable Automated Refill Alerts
            </span>
            <span className="text-[11px] text-slate-500 block">
              Notify me 14 days before medication supplies run out
            </span>
          </div>
        </label>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Instructions / Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Take with water, avoid citrus juices…"
            className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 transition-all leading-relaxed"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertTriangle size={14} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 pb-3 border-t border-slate-200 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving Medication…</span>
              </>
            ) : (
              <>
                <Plus size={14} strokeWidth={3} />
                <span>Add to Schedule</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
