"use client";

// Patient record list tab — surfaces the cross-patient records hub
// filtered to this patient (V4 doctor-portal scope). Same payload as
// `/portal/records` (the global doctor records page).

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Card } from "@/portal/components/ui/Card";
import { Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";

const TYPE_FILTERS = [
  { value: "all", labelKey: "recordTypes.all" },
  { value: "lab_report", labelKey: "recordTypes.lab_report" },
  { value: "imaging", labelKey: "recordTypes.imaging" },
  { value: "prescription", labelKey: "recordTypes.prescription" },
  { value: "discharge_summary", labelKey: "recordTypes.discharge_summary" },
  { value: "other", labelKey: "recordTypes.other" },
] as const;

const TYPE_TONE: Record<string, "info" | "success" | "warn" | "violet" | "neutral"> = {
  lab_report: "info",
  imaging: "warn",
  prescription: "success",
  discharge_summary: "violet",
  consultation: "neutral",
  other: "neutral",
};

interface MedicalRecord {
  id: string;
  title?: string | null;
  recordType: string;
  diagnosis?: string | null;
  date?: string | null;
  createdAt: string;
  hospitalName?: string | null;
  doctorName?: string | null;
}

export default function PatientRecordsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "records", { type, q: search }],
    queryFn: () => {
      const params = new URLSearchParams({
        patientId: id,
        limit: "100",
      });
      if (type !== "all") params.set("type", type);
      if (search.trim()) params.set("q", search.trim());
      return api<{ records: MedicalRecord[]; total: number }>(
        `/doctor-portal/records?${params.toString()}`
      );
    },
  });

  const records = data?.records ?? [];
  const total = data?.total ?? records.length;

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        title={t("chart.tab.records")}
        subtitle={t("chart.recordsSubtitle", { count: total })}
        icon={<FileText size={18} className="text-sky-600" />}
      />

      <Card padding={false} className="rounded-2xl border-border/50">
        <div className="px-3 py-2 flex items-center gap-2">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chart.recordsSearchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
      </Card>

      <FilterPills
        options={TYPE_FILTERS.map((f) => ({
          value: f.value,
          label: t(f.labelKey),
        }))}
        value={type}
        onChange={(v) => setType(v)}
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <ChartEmpty
          title={t("chart.recordsEmpty")}
          description={t("chart.recordsEmptyBody")}
          action={
            search ? (
              <Button variant="secondary" onClick={() => setSearch("")}>
                {t("common.clear")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card padding={false} className="rounded-2xl border-border/50">
          <ul className="flex flex-col">
            {records.map((r) => {
              const meta = [
                r.diagnosis,
                r.hospitalName,
                r.doctorName,
                r.date ? formatDate(r.date) : formatDate(r.createdAt),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={r.id}
                  className="flex items-start gap-3 p-4 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <ChartRow
                    icon={<FileText size={18} />}
                    iconTone={TYPE_TONE[r.recordType] ?? "neutral"}
                    title={r.title || t("chart.recordsUntitled")}
                    meta={meta}
                    actions={
                      <Pill tone="neutral">
                        {t(`recordTypes.${r.recordType}`) || r.recordType}
                      </Pill>
                    }
                    hideChevron
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}