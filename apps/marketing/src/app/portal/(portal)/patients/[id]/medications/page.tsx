"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pill as PillIcon } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

interface ActiveMedicine {
  id: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string | null;
  active?: boolean;
}

interface PatientSummary {
  patient: { id: string; user: { name: string } };
  activeMedicines: ActiveMedicine[];
  allergies: Array<{ id: string; substance: string; severity: string }>;
}

export default function MedicationsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${id}/summary`),
  });

  const meds = data?.activeMedicines ?? [];

  return (
    <Card>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : meds.length === 0 ? (
        <Empty title={t("meds.empty")} />
      ) : (
        <ul className="flex flex-col">
          {meds.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 py-2.5 border-b border-border last:border-0"
            >
              <PillIcon size={14} className="text-brand mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">{m.name}</span>
                  {m.active ? <Pill tone="success">{t("meds.active")}</Pill> : null}
                </div>
                <div className="text-xs text-text-soft mt-0.5">
                  {[m.dosage, m.frequency].filter(Boolean).join(" · ") || "—"}
                </div>
                {m.instructions ? (
                  <div className="text-xs text-text-muted mt-0.5">{m.instructions}</div>
                ) : null}
              </div>
              <div className="text-right shrink-0">
                {m.startDate ? (
                  <div className="text-[11px] text-text-muted">
                    {t("meds.started")} {formatDate(m.startDate)}
                  </div>
                ) : null}
                {m.endDate ? (
                  <div className="text-[11px] text-text-muted">
                    {t("meds.ends")} {formatDate(m.endDate)}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}