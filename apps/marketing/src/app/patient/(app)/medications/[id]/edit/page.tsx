"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, History, Pencil, Save, Trash2 } from "lucide-react";

import { useEditMedication, useStopMedication } from "@/patient/hooks/medicines";
import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import {
  MedicineFormPanel,
  MedicinePreview,
  type MedicineDraft,
} from "@/patient/components/medications/MedicineForm";
import {
  HERO_GHOST,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

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

  const [draft, setDraft] = useState<MedicineDraft>({
    name: "",
    dosage: "",
    frequency: "Once daily",
    timing: "After food",
    startDate: "",
    endDate: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const patch = (p: Partial<MedicineDraft>) => setDraft((d) => ({ ...d, ...p }));

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
      setDraft({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency ?? "Once daily",
        timing: m.timing ?? "After food",
        startDate: m.startDate,
        endDate: m.endDate ?? "",
        notes: m.notes ?? "",
      });
      setHydrated(true);
    }
  }, [medicine.data, hydrated]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await editMedication.mutateAsync({
        id,
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

  async function onStop() {
    if (!window.confirm("Stop tracking this medicine? You'll see it in history.")) return;
    try {
      await stopMedication.mutateAsync(id);
      router.push("/patient/medications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop medicine.");
    }
  }

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        kickerIcon={<Pencil size={13} aria-hidden />}
        kicker="Medications"
        kickerMeta="Edit"
        title={hydrated ? draft.name || "Edit medicine" : "Edit medicine"}
        description="Update the dose, schedule or notes. Doctor-issued prescriptions stay locked."
        actions={
          <>
            <Link href="/patient/medications" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              Back
            </Link>
            <Link href="/patient/medications/history" className={HERO_GHOST}>
              <History size={15} aria-hidden />
              History
            </Link>
          </>
        }
      />

      {medicine.isLoading ? (
        <section className={PANEL}>
          <PanelSkeleton rows={4} className="mt-0" />
        </section>
      ) : medicine.isError ? (
        <section className={PANEL}>
          <PanelError message="This medicine couldn't be loaded." onRetry={() => void medicine.refetch()} />
        </section>
      ) : (
        <form onSubmit={onSubmit} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8">
            <MedicineFormPanel
              title="Medicine details"
              caption="Changes apply to reminders from today"
              draft={draft}
              onChange={patch}
              error={error}
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
                disabled={editMedication.isPending}
                className="inline-flex h-10 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#07233a] px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 disabled:opacity-60"
              >
                <Save size={15} aria-hidden />
                {editMedication.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
            <section className={PANEL} aria-labelledby="med-stop">
              <PanelHeader
                id="med-stop"
                icon={<Trash2 size={16} />}
                tone="bg-rose-50 text-rose-600"
                title="Stop this medicine"
                caption="It moves to history — you can reactivate it"
              />
              <button
                type="button"
                onClick={onStop}
                disabled={stopMedication.isPending}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-rose-50 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 size={14} aria-hidden />
                {stopMedication.isPending ? "Stopping…" : "Stop medicine"}
              </button>
            </section>
          </aside>
        </form>
      )}
    </PatientPage>
  );
}
