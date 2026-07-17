"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Share2,
  ScrollText,
  ChevronRight,
  Activity,
  Upload,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Skeleton } from "@/portal/components/ui/Empty";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";

interface PatientMe {
  patient: {
    id: string;
    fullName: string;
    bloodGroup: string | null;
    dateOfBirth: string | null;
  };
}

interface RecordsSummary {
  total: number;
  byKind: Record<string, number>;
}

export default function PatientHome() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const me = useQuery({
    queryKey: ["patient", "me"],
    queryFn: () => api<PatientMe>("/patients/me"),
  });
  const summary = useQuery({
    queryKey: ["patient", "records", "summary"],
    queryFn: () => api<RecordsSummary>("/medical-records/me/stats"),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text">
          {me.data?.patient.fullName || user?.email || t("patientPortal.home.welcome")}
        </h1>
        <p className="text-sm text-text-soft mt-1">
          {t("patientPortal.home.tagline")}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SummaryCard
          loading={summary.isLoading}
          icon={<FileText size={16} />}
          label={t("patientPortal.home.recordsCount")}
          value={summary.data?.total}
          href="/portal/me/records"
        />
        <SummaryCard
          loading={summary.isLoading}
          icon={<Activity size={16} />}
          label={t("patientPortal.home.vitalsCount")}
          value={Object.keys(summary.data?.byKind || {}).length}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard
          href="/portal/me/records"
          icon={<Upload size={16} />}
          title={t("patientPortal.home.addRecord")}
          body={t("patientPortal.home.addRecordBody")}
        />
        <ActionCard
          href="/portal/me/imaging"
          icon={<ScanLine size={16} />}
          title={t("patientPortal.home.imaging")}
          body={t("patientPortal.home.imagingBody")}
        />
        <ActionCard
          href="/portal/me/share"
          icon={<Share2 size={16} />}
          title={t("patientPortal.home.share")}
          body={t("patientPortal.home.shareBody")}
        />
        <ActionCard
          href="/portal/me/audit"
          icon={<ScrollText size={16} />}
          title={t("patientPortal.home.audit")}
          body={t("patientPortal.home.auditBody")}
        />
        <ActionCard
          href="/portal/me/insurance"
          icon={<ShieldCheck size={16} />}
          title={t("patientPortal.insurance.title")}
          body={t("patientPortal.insurance.tagline")}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  loading,
  icon,
  label,
  value,
  href,
}: {
  loading?: boolean;
  icon: React.ReactNode;
  label: string;
  value: number | string | undefined;
  href?: string;
}) {
  const inner = (
    <Card className="h-full flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-text-soft text-xs">
        {icon}
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <div className="text-2xl font-bold text-text">{value ?? "—"}</div>
      )}
    </Card>
  );
  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

function ActionCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border/60 bg-surface-1 hover:bg-surface-2/50 transition-colors"
    >
      <div className="p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text">{title}</div>
          <div className="text-xs text-text-soft mt-0.5">{body}</div>
        </div>
        <ChevronRight
          size={16}
          className="text-text-muted shrink-0 mt-1"
        />
      </div>
    </Link>
  );
}
