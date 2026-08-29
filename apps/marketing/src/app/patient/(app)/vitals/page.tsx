"use client";

import { useState } from "react";

import { SectionHeader } from "@/patient/components/primitives/SectionHeader";

import { VitalsSparkCard } from "@/patient/components/vitals/VitalsSparkCard";
import { AddVitalSheet } from "@/patient/components/vitals/AddVitalSheet";
import { SymptomDiary } from "@/patient/components/vitals/SymptomDiary";
import { AlertsList } from "@/patient/components/vitals/AlertsList";

import {
  useAddVital,
  useVitalsAlerts,
  useVitalsSeries,
} from "@/patient/hooks";

export default function VitalsPage() {
  const series = useVitalsSeries("heart_rate", "week");
  const bpSeries = useVitalsSeries("blood_pressure", "week");
  const spo2Series = useVitalsSeries("spo2", "week");
  const alerts = useVitalsAlerts(30);
  const add = useAddVital();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Vitals"
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            Add reading
          </button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <VitalsSparkCard type="heart_rate" query={series} />
        <VitalsSparkCard type="blood_pressure" query={bpSeries} />
        <VitalsSparkCard type="spo2" query={spo2Series} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-text-muted">
          Alerts (last 30 days)
        </h2>
        <AlertsList alerts={alerts.data?.items} isLoading={alerts.isLoading} />
      </section>

      <SymptomDiary />

      <AddVitalSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
