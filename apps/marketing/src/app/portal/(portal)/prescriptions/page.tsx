"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Pill as PillIcon, Filter, ChevronRight, FileText } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface RxRow {
  id: string;
  patientId: string;
  title: string | null;
  diagnosis: string | null;
  date: string | null;
  patient: { id: string; name: string } | null;
  medicineCount: number;
}

type Status = "all" | "signed" | "draft" | "cancelled";

export default function PrescriptionsListPage() {
  const t = useT();
  const [status, setStatus] = useState<Status>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "prescriptions", "all"],
    queryFn: () => api<{ prescriptions: RxRow[]; count: number }>(
      `/doctor/prescriptions?limit=200`
    ),
  });

  const rows = data?.prescriptions ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("prescription.title")}
        subtitle={t("prescription.subtitle")}
        icon={<FileText size={18} className="text-emerald-600" />}
      />

      <Card padding={false} className="rounded-2xl border-border/50">
        <div className="px-4 py-3 flex flex-wrap items-center gap-1.5">
          {(["all", "signed", "draft", "cancelled"] as Status[]).map((s) => (
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
              {t(`prescription.status.${s}`)}
            </button>
          ))}
        </div>
      </Card>

      <Card padding={false} className="rounded-2xl border-border/50">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("prescription.emptyGlobal")} className="py-12" />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => (
              <li
                key={r.id}
                className="group flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <PillIcon size={18} />
                </div>
                <Avatar name={r.patient?.name ?? ""} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {r.patient?.name ?? "---"}
                  </div>
                  <div className="text-xs text-text-soft truncate">
                    {r.title ?? r.diagnosis ?? t("prescription.untitled")}
                  </div>
                </div>
                <Pill tone="brand">{r.medicineCount} meds</Pill>
                {r.date ? (
                  <span className="text-xs text-text-muted shrink-0">
                    {formatDate(r.date)}
                  </span>
                ) : null}
                <Link
                  href={`/patients/${r.patientId}`}
                  className="text-xs text-brand font-medium hover:underline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                >
                  Open
                  <ChevronRight size={12} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
