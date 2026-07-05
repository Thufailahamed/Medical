"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";

interface Allergy {
  id: string;
  substance: string;
  severity: string;
  reaction?: string | null;
  notes?: string | null;
  recordedAt?: string | null;
}

interface PatientSummary {
  allergies: Allergy[];
}

const SEVERITY_TONE: Record<string, "neutral" | "warn" | "danger" | "brand"> = {
  mild: "warn",
  moderate: "warn",
  severe: "danger",
  life_threatening: "danger",
};

export default function AllergiesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${id}/summary`),
  });

  const rows = data?.allergies ?? [];

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 0 ? (
        <Card>
          <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 mb-3">
            <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
            <div className="text-xs text-danger font-semibold">
              {t("allergies.banner", { count: rows.length })}
            </div>
          </div>
          <ul className="flex flex-col">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 py-2.5 border-b border-border last:border-0"
              >
                <Pill tone={SEVERITY_TONE[a.severity] ?? "warn"}>{a.severity}</Pill>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text">{a.substance}</div>
                  {a.reaction ? (
                    <div className="text-xs text-text-soft">{a.reaction}</div>
                  ) : null}
                  {a.notes ? (
                    <div className="text-xs text-text-muted mt-0.5">{a.notes}</div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : isLoading ? (
        <Card>
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <Card>
          <Empty title={t("allergies.empty")} />
        </Card>
      )}
    </div>
  );
}