"use client";

import { useState } from "react";

import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { useAddAllergy, useAllergies, useDeleteAllergy } from "@/patient/hooks";

import { AllergyRowItem } from "./AllergyRow";
import { AllergyFormSheet } from "./AllergyFormSheet";

export function AllergyList() {
  const allergies = useAllergies();
  const add = useAddAllergy();
  const del = useDeleteAllergy();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Allergies"
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            Add
          </button>
        }
      />
      <QueryBoundary
        query={allergies}
        emptyTitle="No allergies recorded"
        isEmpty={(d) => d.allergies.length === 0}
      >
        {(data) => (
          <div className="space-y-2">
            {data.allergies.map((row) => (
              <AllergyRowItem
                key={row.id}
                row={row}
                onDelete={(id) => del.mutate(id)}
              />
            ))}
          </div>
        )}
      </QueryBoundary>
      <AllergyFormSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
