"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pill as PillIcon, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { PrescriptionComposer } from "@/portal/components/rx/PrescriptionComposer";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";

interface RxRow {
  id: string;
  patientId: string;
  title: string | null;
  diagnosis: string | null;
  date: string | null;
  followUpDate: string | null;
  patient: { id: string; name: string } | null;
  medicineCount: number;
  status?: string;
}

interface RxList {
  prescriptions: RxRow[];
  count: number;
}

interface PatientSummary {
  allergies: Array<{ id: string; substance: string; severity: string }>;
}

type Status = "all" | "signed" | "draft" | "cancelled";

const STATUS_VALUES: Status[] = ["all", "signed", "draft", "cancelled"];

export default function PrescriptionsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [status, setStatus] = useState<Status>("all");
  const [composeOpen, setComposeOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "prescriptions", id, status],
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("patientId", id);
      q.set("limit", "100");
      if (status !== "all") q.set("status", status);
      return api<RxList>(`/doctor/prescriptions?${q.toString()}`);
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${id}/summary`),
  });

  const rows = data?.prescriptions ?? [];
  const allergies = summary?.allergies ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<PillIcon size={18} />}
        title={t("tab.prescriptions.title")}
        subtitle={t("tab.prescriptions.subtitle", { count: rows.length })}
        badge={{ count: rows.length, tone: "brand" }}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setComposeOpen(true)}
          >
            {t("tab.prescriptions.new")}
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
            options={STATUS_VALUES.map((s) => ({
              value: s,
              label: t(
                s === "all"
                  ? "tab.prescriptions.filterAll"
                  : `status.${s}`,
              ),
            }))}
          />
        }
        emptyState={
          <ChartEmpty
            icon={<PillIcon size={20} />}
            title={t("tab.prescriptions.empty")}
            description={t("tab.prescriptions.emptyBody")}
            action={
              <Button
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setComposeOpen(true)}
              >
                {t("tab.prescriptions.new")}
              </Button>
            }
          />
        }
        renderRow={(r) => (
          <ChartRow
            href={`/portal/patients/${id}/prescriptions/${r.id}`}
            icon={<PillIcon size={16} />}
            iconTone="brand"
            title={r.title ?? t("prescription.untitled")}
            subtitle={r.diagnosis ?? undefined}
            pills={[
              r.status ? (
                <Pill key="status" tone={rxStatusToTone(r.status)}>
                  {t(`status.${r.status}`)}
                </Pill>
              ) : null,
              <Pill key="count" tone="neutral">
                {t("tab.prescriptions.medicineCount", {
                  count: r.medicineCount,
                })}
              </Pill>,
            ]}
            meta={
              r.date ? (
                <span className="text-[11px] text-text-muted">
                  {formatDate(r.date)}
                </span>
              ) : null
            }
            actions={
              <Link
                href={`/portal/patients/${id}/prescriptions/${r.id}`}
                className="text-[11px] font-semibold text-brand hover:text-brand-strong inline-flex items-center gap-0.5"
              >
                {t("tab.prescriptions.view")}
                <ArrowRight size={11} />
              </Link>
            }
          />
        )}
      />

      <Drawer
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title={t("prescription.composerTitle")}
        size="xl"
      >
        <PrescriptionComposer
          patientId={id}
          patientAllergies={allergies}
          onSaved={() => setComposeOpen(false)}
          onCancel={() => setComposeOpen(false)}
        />
      </Drawer>
    </div>
  );
}
