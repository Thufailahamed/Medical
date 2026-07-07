"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Syringe, Plus } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatDate, relativeTime } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";

type Status = "all" | "given" | "due";

interface Vaccination {
  id: string;
  vaccine: string;
  shortName?: string | null;
  doseNumber: number;
  administeredAt?: string | null;
  nextDueAt?: string | null;
}

interface PatientOverviewShape {
  vaccinations?: Vaccination[];
}

const STATUS_VALUES: Status[] = ["all", "given", "due"];

export default function VaccinationsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [status, setStatus] = useState<Status>("all");

  // Vaccinations ship on the overview payload — same data the
  // sidebar widget uses. No dedicated endpoint needed for the read
  // path; a write endpoint can be added later behind the
  // disabled "Add vaccination" button.
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "overview"],
    queryFn: () =>
      api<PatientOverviewShape>(`/doctor-portal/patients/${id}/overview`),
  });

  const all = data?.vaccinations ?? [];
  const given = all.filter((v) => !!v.administeredAt);
  const due = all.filter((v) => !v.administeredAt || !!v.nextDueAt);

  const rows = status === "given" ? given : status === "due" ? due : all;

  const filterOptions: { value: Status; label: string; count?: number }[] =
    STATUS_VALUES.map((s) => ({
      value: s,
      label:
        s === "all"
          ? t("tab.vaccinations.filterAll")
          : t(`tab.vaccinations.filter${s[0].toUpperCase()}${s.slice(1)}`),
      count: s === "all" ? all.length : s === "given" ? given.length : due.length,
    }));

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<Syringe size={18} />}
        title={t("tab.vaccinations.title")}
        subtitle={t("tab.vaccinations.subtitle", { count: all.length })}
        badge={{ count: all.length, tone: "info" }}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() =>
              toast.info(t("tab.vaccinations.comingSoon"))
            }
          >
            {t("tab.vaccinations.new")}
          </Button>
        }
      />

      <ChartList
        items={rows}
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
        toolbar={
          <FilterPills<Status>
            value={status}
            onChange={setStatus}
            options={filterOptions}
          />
        }
        emptyState={
          <ChartEmpty
            icon={<Syringe size={20} />}
            title={t("tab.vaccinations.empty")}
            description={t("tab.vaccinations.emptyBody")}
          />
        }
        renderRow={(v) => (
          <ChartRow
            icon={<Syringe size={16} />}
            iconTone="info"
            title={v.vaccine}
            subtitle={
              <span className="text-[11px] text-text-muted">
                {v.shortName ? `${v.shortName} · ` : ""}
                {t("tab.vaccinations.dose", { n: v.doseNumber })}
              </span>
            }
            pills={[
              v.administeredAt ? (
                <Pill key="given" tone="success">
                  {t("tab.vaccinations.administered", {
                    date: formatDate(v.administeredAt),
                  })}
                </Pill>
              ) : null,
              v.nextDueAt ? (
                <Pill key="due" tone="info">
                  {t("tab.vaccinations.nextDue", {
                    date: relativeTime(v.nextDueAt),
                  })}
                </Pill>
              ) : null,
            ].filter(Boolean)}
          />
        )}
      />
    </div>
  );
}
