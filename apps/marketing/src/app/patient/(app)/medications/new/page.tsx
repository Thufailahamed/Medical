"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Pill, Save, History, Sparkles } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useAddMedication } from "@/patient/hooks/medicines";
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

interface MedicineSuggestion {
  name: string;
  commonDosages: string[];
  commonFrequencies: string[];
  commonTimings: string[];
  source: "history" | "popular";
}

export default function AddMedicinePage() {
  const router = useRouter();
  const addMedication = useAddMedication();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [timing, setTiming] = useState("After food");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Get suggestions based on name
  const suggestions = useQuery<{ suggestions: MedicineSuggestion[] }>({
    queryKey: ["patient", "medicine-suggestions", name],
    queryFn: () =>
      api<{ suggestions: MedicineSuggestion[] }>("/medicines/suggestions", {
        method: "POST",
        json: { name },
      }),
    enabled: name.length >= 3,
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await addMedication.mutateAsync({
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

  function applySuggestion(s: MedicineSuggestion) {
    setName(s.name);
    if (s.commonDosages[0]) setDosage(s.commonDosages[0]);
    if (s.commonFrequencies[0]) setFrequency(s.commonFrequencies[0]);
    if (s.commonTimings[0]) setTiming(s.commonTimings[0]);
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
        title="Add a medicine"
        description="Track medicines you take on your own. Doctor-issued prescriptions are added automatically when they're signed."
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="medicine-name"
                className="t-label block"
              >
                Medicine name
              </label>
              <input
                id="medicine-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Atorvastatin"
                required
                className="mt-2 h-12 w-full rounded-inner border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
              {suggestions.data?.suggestions &&
              suggestions.data.suggestions.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {suggestions.data.suggestions.slice(0, 3).map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => applySuggestion(s)}
                      className="flex items-center gap-2 rounded-inner bg-surface-2 p-2 text-left text-xs text-text-soft transition-colors hover:bg-surface-3"
                    >
                      {s.source === "history" ? (
                        <History size={12} aria-hidden />
                      ) : (
                        <Sparkles size={12} aria-hidden />
                      )}
                      <span className="font-semibold text-text">
                        {s.name}
                      </span>
                      {s.commonDosages[0] ? (
                        <span>· {s.commonDosages[0]}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="medicine-dosage"
                className="t-label block"
              >
                Dosage
              </label>
              <input
                id="medicine-dosage"
                type="text"
                value={dosage}
                onChange={(event) => setDosage(event.target.value)}
                placeholder="e.g. 10 mg, 1 tablet"
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
                placeholder="Any special instructions, side effects to watch for, etc."
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
            disabled={addMedication.isPending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={14} aria-hidden />
            {addMedication.isPending ? "Saving…" : "Add medicine"}
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
