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
          <Link href={`/portal/patients/${id}/prescriptions`}>
            <Button size="sm" leftIcon={<ArrowRight size={14} />}>
              {t("tab.medications.new")}
            </Button>
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
            icon={<PillIcon size={20} />}
            title={t("tab.medications.empty")}
            description={t("tab.medications.emptyBody")}
            action={
              <Link href={`/portal/patients/${id}/prescriptions`}>
                <Button size="sm" leftIcon={<ArrowRight size={14} />}>
                  {t("tab.medications.new")}
                </Button>
              </Link>
            }
          />
        }
        renderRow={(m) => (
          <ChartRow
            icon={<PillIcon size={16} />}
            iconTone="brand"
            title={m.name}
            subtitle={
              [m.dosage, m.frequency].filter(Boolean).join(" · ") || undefined
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
                  <div className="text-[11px] text-text-muted">
                    {t("meds.started")} {formatDate(m.startDate)}
                  </div>
                  {m.endDate ? (
                    <div className="text-[11px] text-text-muted">
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
