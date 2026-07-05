"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pill as PillIcon, Plus } from "lucide-react";
import Link from "next/link";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { PrescriptionComposer } from "@/portal/components/rx/PrescriptionComposer";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

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

export default function PrescriptionsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const [status, setStatus] = useState<Status>("all");
  const [composeOpen, setComposeOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "prescriptions", "all"],
    queryFn: () => api<RxList>(`/doctor/prescriptions?limit=200`),
  });

  const { data: summary } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${id}/summary`),
  });

  const rows = (data?.prescriptions ?? []).filter((r) => r.patientId === id);
  const allergies = summary?.allergies ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {(["all", "signed", "draft", "cancelled"] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "px-2.5 h-7 rounded-md text-xs border transition-colors",
                status === s
                  ? "bg-brand-soft text-brand border-brand/30"
                  : "bg-surface text-text-soft border-border hover:bg-surface-2"
              )}
            >
              {t(`prescription.status.${s}`)}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setComposeOpen(true)}
        >
          {t("prescription.new")}
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("prescription.empty")} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
              >
                <PillIcon size={14} className="text-brand shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">
                    {r.title ?? t("prescription.untitled")}
                  </div>
                  {r.diagnosis ? (
                    <div className="text-xs text-text-soft truncate">{r.diagnosis}</div>
                  ) : null}
                </div>
                <Pill tone="brand">{r.medicineCount} meds</Pill>
                {r.date ? (
                  <span className="text-xs text-text-muted shrink-0">
                    {formatDate(r.date)}
                  </span>
                ) : null}
                <Link
                  href={`/patients/${id}/prescriptions/${r.id}`}
                  className="text-xs text-brand hover:underline shrink-0"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

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