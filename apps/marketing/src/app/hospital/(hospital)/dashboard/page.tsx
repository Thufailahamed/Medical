"use client";

import Link from "next/link";
import { useDashboard } from "@/hospital/hooks/useDashboard";
import { KpiTile } from "@/hospital/components/dashboard/KpiTile";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Card } from "@/portal/components/ui/Card";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Pill } from "@/portal/components/ui/Pill";
import { BedDouble, ArrowRight, Building2 } from "lucide-react";
import { useT } from "@/hospital/i18n";
import { relativeTime } from "@/hospital/lib/format";
import { cn } from "@/hospital/lib/utils";

export default function HospitalDashboardPage() {
  const t = useT();
  const { data, isLoading, isError, error, refetch } = useDashboard();

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />
        <Card>
          <div className="flex flex-col gap-2 text-center py-8">
            <div className="text-sm font-bold text-danger">{t("dashboard.errorTitle")}</div>
            <div className="text-xs text-text-muted">
              {(error as Error)?.message ?? "—"}
            </div>
            <button
              onClick={() => refetch()}
              className="self-center mt-2 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-surface-2 transition-colors"
            >
              {t("common.refresh")}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const hospital = data?.hospital;
  const tiles = data?.tiles ?? [];
  const admissions = data?.admissions ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />
          {hospital && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-soft -mt-3 ml-0.5">
              <Building2 size={13} /> {hospital.name}
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs font-semibold text-text-soft hover:text-text underline underline-offset-2"
        >
          {t("common.refresh")}
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {tiles.map((tile) => (
          <KpiTile key={tile.key} tile={tile} />
        ))}
      </div>

      {/* Active admissions */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-text">{t("dashboard.admitted")}</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Open bed assignments in this facility
            </p>
          </div>
          <Link
            href="/hospital/ipd"
            className="text-[11px] font-bold text-brand hover:text-brand-strong inline-flex items-center gap-1"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {admissions.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-muted">
            <BedDouble size={20} className="mx-auto opacity-40 mb-2" />
            {t("dashboard.noAdmissions")}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {admissions.slice(0, 5).map((a) => (
              <li
                key={a.assignmentId}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #34D399, #059669)",
                  }}
                >
                  {(a.patientName || "?")
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/hospital/ipd?patient=${a.patientId}`}
                    className="text-[13px] font-semibold text-text truncate hover:text-brand"
                  >
                    {a.patientName}
                  </Link>
                  <div className="text-[11px] text-text-muted truncate flex items-center gap-1.5">
                    <BedDouble size={10} />
                    Bed {a.bedNumber} · {a.wardName}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill tone="success">Admitted</Pill>
                  <span
                    className={cn(
                      "text-[10px] font-medium text-text-muted"
                    )}
                  >
                    {relativeTime(a.assignedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}