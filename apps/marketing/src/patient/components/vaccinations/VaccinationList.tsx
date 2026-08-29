"use client";

import { Card } from "@/patient/components/primitives/Card";
import type {
  VaccinationAdministeredRow,
  VaccinationSlot,
} from "@/patient/types/patient";

import { StatusPill, type VaccinationStatus } from "./StatusPill";

function statusFor(
  row: VaccinationAdministeredRow | VaccinationSlot
): VaccinationStatus {
  if ("status" in row) return row.status as VaccinationStatus;
  return "administered";
}

function nameOf(
  row: VaccinationAdministeredRow | VaccinationSlot
): string {
  return "vaccineName" in row ? row.vaccineName : "";
}

function dateOf(
  row: VaccinationAdministeredRow | VaccinationSlot
): string {
  return "administeredAt" in row ? row.administeredAt : row.dueAt;
}

function doseOf(
  row: VaccinationAdministeredRow | VaccinationSlot
): string | null {
  if ("dose" in row) return row.dose;
  if ("doseNumber" in row) return row.doseNumber != null ? `Dose ${row.doseNumber}` : null;
  return null;
}

export function VaccinationList({
  rows,
}: {
  rows: Array<VaccinationAdministeredRow | VaccinationSlot>;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-text-muted">Nothing to show.</p>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Card key={row.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium">{nameOf(row)}</p>
              {doseOf(row) && (
                <p className="text-sm text-text-muted">{doseOf(row)}</p>
              )}
              <p className="text-xs text-text-muted">
                {dateOf(row).slice(0, 10)}
              </p>
            </div>
            <StatusPill status={statusFor(row)} />
          </div>
        </Card>
      ))}
    </div>
  );
}
