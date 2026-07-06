"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Pill as PillIcon, FileText, ArrowRight, Plus } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";
import { cn } from "@/portal/lib/utils";
import { RxActions } from "@/portal/components/rx/RxActions";

interface RxRow {
  id: string;
  patientId: string;
  title: string | null;
  diagnosis: string | null;
  date: string | null;
  status: string;
  patient: { id: string; name: string } | null;
  medicineCount: number;
}

type Status = "all" | "signed" | "draft" | "cancelled" | "dispensed";

const STATUS_VALUES: Status[] = ["all", "signed", "draft", "cancelled", "dispensed"];

export default function PrescriptionsListPage() {
  const t = useT();
  const [status, setStatus] = useState<Status>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "prescriptions", "global", status],
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("limit", "200");
      if (status !== "all") q.set("status", status);
      return api<{ prescriptions: RxRow[]; count: number }>(
        `/doctor/prescriptions?${q.toString()}`
      );
    },
  });

  const rows = data?.prescriptions ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("prescription.title")}
        subtitle={t("prescription.subtitle")}
        icon={<FileText size={18} className="text-emerald-600" />}
        actions={
          <Link
            href="/portal/patients"
            className="text-xs text-text-soft hover:text-text inline-flex items-center gap-1"
          >
            <Plus size={12} />
            {t("prescription.new")}
          </Link>
        }
      />

      <Card padding={false} className="rounded-2xl border-border/50">
        <div className="px-4 py-3 flex flex-wrap items-center gap-1.5">
          {STATUS_VALUES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "px-2.5 h-7 rounded-xl text-xs border transition-colors",
                status === s
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                  : "bg-surface text-text-soft border-border/60 hover:bg-surface-2/40"
              )}
            >
              {t(
                s === "all"
                  ? "tab.prescriptions.filterAll"
                  : `rx.status.${s}`
              )}
            </button>
          ))}
        </div>
      </Card>

      <Card padding={false} className="rounded-2xl border-border/50">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={t("prescription.emptyGlobal")}
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => (
              <li
                key={r.id}
                className="group flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <Link
                  href={`/portal/prescriptions/${r.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <PillIcon size={18} />
                  </div>
                  <Avatar name={r.patient?.name ?? ""} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-text truncate">
                        {r.patient?.name ?? "—"}
                      </span>
                      <Pill tone={rxStatusToTone(r.status)}>
                        {t(`rx.status.${r.status}`)}
                      </Pill>
                    </div>
                    <div className="text-xs text-text-soft truncate">
                      {r.diagnosis ?? r.title ?? t("prescription.untitled")} ·{" "}
                      {r.medicineCount} meds
                    </div>
                  </div>
                  {r.date ? (
                    <span className="text-xs text-text-muted shrink-0">
                      {formatDate(r.date)}
                    </span>
                  ) : null}
                  <span className="text-xs text-brand font-medium opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5 shrink-0">
                    {t("rx.actions.view")}
                    <ArrowRight size={12} />
                  </span>
                </Link>
                <RxActions id={r.id} status={r.status} hideEdit compact />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
