"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, Trash2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  useEditMedication,
  useStopMedication,
} from "@/patient/hooks/medicines";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/portal/lib/api";

const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "As needed",
];

const TIMING_OPTIONS = [
  "Before food",
  "After food",
  "With food",
  "Any time",
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
];

export default function EditMedicinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const editMedication = useEditMedication();
  const stopMedication = useStopMedication();

  const medicine = useQuery<{ medicine: Record<string, unknown> }>({
    queryKey: ["patient", "medicine", id],
    queryFn: () => api<{ medicine: Record<string, unknown> }>(`/medicines/${id}`),
    enabled: Boolean(id),
  });

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [timing, setTiming] = useState("After food");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (medicine.data && !hydrated) {
      const m = medicine.data.medicine as {
        name: string;
        dosage: string;
        frequency: string | null;
        timing: string | null;
        startDate: string;
        endDate: string | null;
        notes: string | null;
      };
      setName(m.name);
      setDosage(m.dosage);
      setFrequency(m.frequency ?? "Once daily");
      setTiming(m.timing ?? "After food");
      setStartDate(m.startDate);
      setEndDate(m.endDate ?? "");
      setNotes(m.notes ?? "");
      setHydrated(true);
    }
  }, [medicine.data, hydrated]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await editMedication.mutateAsync({
        id,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        timing,
        startDate,
        endDate: endDate || null,
        notes: notes.trim() || null,
      });
      router.push("/patient/medications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save medicine.");
    }
  }

  async function onStop() {
    if (!window.confirm("Stop tracking this medicine? You'll see it in history."))
      return;
    try {
      await stopMedication.mutateAsync(id);
      router.push("/patient/medications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop medicine.");
    }
  }

  if (medicine.isLoading) {
    return (
      <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
        <p className="text-sm text-text-soft">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/medications"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to medications
      </Link>

      <SectionHeader
        label="Daily plan"
        title="Edit medicine"
        description="Update dosage, schedule, or notes. Doctor-issued prescriptions stay locked."
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="medicine-name" className="t-label block">
                Medicine name
              </label>
              <input
                id="medicine-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="mt-2 h-12 w-full rounded-inner border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="medicine-dosage" className="t-label block">
                Dosage
              </label>
              <input
                id="medicine-dosage"
                type="text"
                value={dosage}
                onChange={(event) => setDosage(event.target.value)}
                required
                className="mt-2 h-12 w-full rounded-inner border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="frequency" className="t-label block">
                  Frequency
                </label>
                <select
                  id="frequency"
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value)}
                  className="mt-2 h-12 w-full rounded-inner border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="timing" className="t-label block">
                  Timing
                </label>
                <select
                  id="timing"
                  value={timing}
                  onChange={(event) => setTiming(event.target.value)}
                  className="mt-2 h-12 w-full rounded-inner border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                >
                  {TIMING_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="start-date" className="t-label block">
                  Start date
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                  className="mt-2 h-12 w-full rounded-inner border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="end-date" className="t-label block">
                  End date <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-2 h-12 w-full rounded-inner border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="t-label block">
                Notes <span className="text-text-muted">(optional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-inner border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-brand"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={editMedication.isPending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={14} aria-hidden />
            {editMedication.isPending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={stopMedication.isPending}
            className="inline-flex items-center gap-1.5 rounded-pill border border-danger bg-danger-soft px-5 py-2.5 text-sm font-semibold text-danger disabled:opacity-60"
          >
            <Trash2 size={14} aria-hidden />
            {stopMedication.isPending ? "Stopping…" : "Stop medicine"}
          </button>
          <Link
            href="/patient/medications"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border px-5 py-2.5 text-sm font-semibold text-text-soft"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
