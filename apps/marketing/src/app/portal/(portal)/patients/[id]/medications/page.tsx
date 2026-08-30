"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Pill as PillIcon, ArrowRight } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";
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
}

type MedFilter = "active" | "all";

export default function MedicationsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [filter, setFilter] = useState<MedFilter>("active");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${id}/summary`),
  });

  const meds = useMemo(() => {
    const all = data?.activeMedicines ?? [];
    return filter === "active" ? all.filter((m) => m.active !== false) : all;
  }, [data, filter]);

  const activeCount = (data?.activeMedicines ?? []).filter(
    (m) => m.active !== false,
  ).length;
  const totalCount = data?.activeMedicines?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<PillIcon size={18} />}
        title={t("tab.medications.title")}
        subtitle={t("tab.medications.subtitle", { count: activeCount })}
        badge={{ count: activeCount, tone: "brand" }}
        actions={
          <Link
            href={`/portal/patients/${id}/prescriptions`}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            <ArrowRight size={14} />
            <span>{t("tab.medications.new")}</span>
          </Link>
        }
      />

      <ChartList
        items={meds}
        isLoading={isLoading}
        isEmpty={!isLoading && meds.length === 0}
        toolbar={
          <FilterPills<MedFilter>
            value={filter}
            onChange={setFilter}
            options={[
              {
                value: "active",
                label: t("tab.medications.filterActive"),
                count: activeCount,
              },
              {
                value: "all",
                label: t("tab.medications.filterAll"),
                count: totalCount,
              },
            ]}
          />
        }
        emptyState={
          <ChartEmpty
            icon={<PillIcon size={22} />}
            title={t("tab.medications.empty")}
            description={t("tab.medications.emptyBody")}
            action={
              <Link
                href={`/portal/patients/${id}/prescriptions`}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <ArrowRight size={14} />
                <span>{t("tab.medications.new")}</span>
              </Link>
            }
          />
        }
        renderRow={(m) => (
          <ChartRow
            icon={<PillIcon size={16} />}
            iconTone="success"
            title={m.name}
            subtitle={
              [
                m.dosage,
                m.frequency ? m.frequency.replace(/_/g, " ") : null,
                m.instructions ? m.instructions.replace(/_/g, " ") : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
            pills={[
              m.active !== false ? (
                <Pill key="active" tone="success">
                  {t("meds.active")}
                </Pill>
              ) : null,
            ]}
            meta={
              m.startDate ? (
                <>
                  <div className="text-xs text-slate-500 font-medium">
                    {t("meds.started")} {formatDate(m.startDate)}
                  </div>
                  {m.endDate ? (
                    <div className="text-xs text-slate-400">
                      {t("meds.ends")} {formatDate(m.endDate)}
                    </div>
                  ) : null}
                </>
              ) : null
            }
          />
        )}
      />
    </div>
  );
}
