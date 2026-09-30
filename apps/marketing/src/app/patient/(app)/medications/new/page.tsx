"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, History, Plus, Save, ScanLine, ShieldCheck, Sparkles } from "lucide-react";

import { useAddMedication } from "@/patient/hooks/medicines";
import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import {
  MedicineFormPanel,
  MedicinePreview,
  type MedicineDraft,
} from "@/patient/components/medications/MedicineForm";
import {
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  PatientHero,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

interface MedicineSuggestion {
  name: string;
  commonDosages: string[];
  commonFrequencies: string[];
  commonTimings: string[];
  source: "history" | "popular";
}

export default function AddMedicinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addMedication = useAddMedication();
  // Prefilled by the prescription scanner (/patient/ai/ocr → med[0][name]…).
  const [draft, setDraft] = useState<MedicineDraft>({
    name: searchParams.get("med[0][name]") ?? "",
    dosage: searchParams.get("med[0][dosage]") ?? "",
    frequency: searchParams.get("med[0][frequency]") ?? "Once daily",
    timing: "After food",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const patch = (p: Partial<MedicineDraft>) => setDraft((d) => ({ ...d, ...p }));

  const suggestions = useQuery<{ suggestions: MedicineSuggestion[] }>({
    queryKey: ["patient", "medicine-suggestions", draft.name],
    queryFn: () =>
      api<{ suggestions: MedicineSuggestion[] }>("/medicines/suggestions", {
        method: "POST",
        json: { name: draft.name },
      }),
    enabled: draft.name.length >= 3,
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addMedication.mutateAsync({
        name: draft.name.trim(),
        dosage: draft.dosage.trim(),
        frequency: draft.frequency,
        timing: draft.timing,
        startDate: draft.startDate,
        endDate: draft.endDate || null,
        notes: draft.notes.trim() || null,
      });
      router.push("/patient/medications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save medicine.");
    }
  }

  function applySuggestion(s: MedicineSuggestion) {
    patch({
      name: s.name,
      ...(s.commonDosages[0] ? { dosage: s.commonDosages[0] } : {}),
      ...(s.commonFrequencies[0] ? { frequency: s.commonFrequencies[0] } : {}),
      ...(s.commonTimings[0] ? { timing: s.commonTimings[0] } : {}),
    });
  }

  const list = suggestions.data?.suggestions ?? [];

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        kickerIcon={<Plus size={13} aria-hidden />}
        kicker="Medications"
        kickerMeta="New medicine"
        title={
          <>
            Add a <HeroAccent>medicine</HeroAccent>
          </>
        }
        description="Track medicines you take on your own. Doctor-issued prescriptions are added automatically when they're signed."
        chips={
          <span className={HERO_CHIP}>
            <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
            Only you and your care team can see this
          </span>
        }
        actions={
          <>
            <Link href="/patient/medications" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              Back
            </Link>
            <Link href="/patient/ai/ocr" className={HERO_GHOST}>
              <ScanLine size={15} aria-hidden />
              Scan instead
            </Link>
          </>
        }
      />

      <form onSubmit={onSubmit} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <MedicineFormPanel
            title="Medicine details"
            caption="Name and dose first — the schedule sets your reminders"
            draft={draft}
            onChange={patch}
            error={error}
            nameSlot={
              list.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {list.slice(0, 4).map((s, i) => (
                    <button
                      type="button"
                      key={`${s.name}-${i}`}
                      onClick={() => applySuggestion(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100"
                    >
                      {s.source === "history" ? <History size={12} aria-hidden /> : <Sparkles size={12} aria-hidden />}
                      <span className="font-semibold">{s.name}</span>
                      {s.commonDosages[0] ? <span className="text-sky-600">· {s.commonDosages[0]}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null
            }
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:col-span-4">
          <MedicinePreview draft={draft} />
          <div className="flex items-center gap-2">
            <Link href="/patient/medications" className={cn(SECONDARY_BTN, "h-10 flex-1 justify-center")}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={addMedication.isPending}
              className="inline-flex h-10 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#07233a] px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 disabled:opacity-60"
            >
              <Save size={15} aria-hidden />
              {addMedication.isPending ? "Saving…" : "Add medicine"}
            </button>
          </div>
        </aside>
      </form>
    </PatientPage>
  );
}
