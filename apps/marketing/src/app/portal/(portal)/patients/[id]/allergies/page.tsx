"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { useT } from "@/portal/i18n";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
} from "@/portal/components/chart";
import {
  allergySeverityRank,
  allergySeverityToTone,
} from "@/portal/lib/clinicalTones";

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

export default function AllergiesTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${id}/summary`),
  });

  const rows = (data?.allergies ?? [])
    .slice()
    .sort(
      (a, b) => allergySeverityRank(a.severity) - allergySeverityRank(b.severity),
    );

  const hasCritical = rows.some(
    (a) => a.severity === "life_threatening" || a.severity === "severe",
  );

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<ShieldAlert size={18} />}
        title={t("tab.allergies.title")}
        subtitle={t("tab.allergies.subtitle", { count: rows.length })}
        badge={{ count: rows.length, tone: hasCritical ? "danger" : "warn" }}
      />

      {hasCritical && !isLoading ? (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5">
          <AlertTriangle
            size={14}
            className="text-danger shrink-0 mt-0.5"
          />
          <div className="text-xs text-danger font-semibold leading-relaxed">
            {rows.length === 1
              ? t("allergies.singleCritical")
              : t("allergies.banner", { count: rows.length })}
          </div>
        </div>
      ) : null}

      <ChartList
        items={rows}
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
        emptyState={
          <ChartEmpty
            icon={<ShieldAlert size={20} />}
            title={t("tab.allergies.empty")}
            description={t("tab.allergies.emptyBody")}
          />
        }
        renderRow={(a) => (
          <ChartRow
            icon={<AlertTriangle size={16} />}
            iconTone={allergySeverityToTone(a.severity)}
            title={a.substance}
            subtitle={
              [a.reaction, a.notes].filter(Boolean).join(" · ") || undefined
            }
            pills={[
              <Pill key="sev" tone={allergySeverityToTone(a.severity)}>
                {a.severity}
              </Pill>,
            ]}
          />
        )}
      />
    </div>
  );
}
