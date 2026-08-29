"use client";

import { useState } from "react";

import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { useAddSymptom, useDeleteSymptom, useSymptoms } from "@/patient/hooks";

import { AddSymptomSheet } from "./AddSymptomSheet";
import { SymptomRowItem } from "./SymptomRow";

export function SymptomDiary() {
  const symptoms = useSymptoms();
  const add = useAddSymptom();
  const del = useDeleteSymptom();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Symptom diary"
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            Log symptom
          </button>
        }
      />
      <QueryBoundary
        query={symptoms}
        emptyTitle="No symptoms logged"
        isEmpty={(d) => d.symptoms.length === 0}
      >
        {(data) => (
          <div className="space-y-2">
            {data.symptoms.map((row) => (
              <SymptomRowItem
                key={row.id}
                row={row}
                onDelete={(id) => del.mutate(id)}
              />
            ))}
          </div>
        )}
      </QueryBoundary>
      <AddSymptomSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
