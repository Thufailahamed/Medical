"use client";

import { useState } from "react";

import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { EmptyState } from "@/patient/components/primitives/EmptyState";

import { VaccinationList } from "@/patient/components/vaccinations/VaccinationList";
import { DueList } from "@/patient/components/vaccinations/DueList";
import { VaccinationFormSheet } from "@/patient/components/vaccinations/VaccinationFormSheet";
import {
  useAddVaccination,
  useVaccinations,
  useVaccinationsDue,
} from "@/patient/hooks";

export default function VaccinationsPage() {
  const administered = useVaccinations();
  const due = useVaccinationsDue();
  const add = useAddVaccination();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Vaccinations"
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            Record
          </button>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-text-muted">Administered</h2>
        <QueryBoundary
          query={administered}
          emptyTitle="No administered vaccinations"
          isEmpty={(d) => d.administered.length === 0}
        >
          {(d) => <VaccinationList rows={d.administered} />}
        </QueryBoundary>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-text-muted">Due / overdue</h2>
        <QueryBoundary
          query={due}
          emptyTitle="Nothing due right now"
          isEmpty={(d) =>
            d.due.length === 0 &&
            d.overdue.length === 0 &&
            d.upcoming.length === 0
          }
        >
          {(d) => (
            <DueList rows={[...d.overdue, ...d.due, ...d.upcoming]} />
          )}
        </QueryBoundary>
      </section>

      <VaccinationFormSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
