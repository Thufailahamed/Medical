"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PatientHeader, usePatientHeader } from "@/portal/components/patient/PatientHeader";
import { Card } from "@/portal/components/ui/Card";
import { Skeleton } from "@/portal/components/ui/Empty";
import { cn } from "@/portal/lib/utils";
import { useT } from "@/portal/i18n";

const TABS = [
  { key: "overview", path: "/overview" },
  { key: "records", path: "/records" },
  { key: "medications", path: "/medications" },
  { key: "vitals", path: "/vitals" },
  { key: "allergies", path: "/allergies" },
  { key: "prescriptions", path: "/prescriptions" },
  { key: "lab-orders", path: "/lab-orders" },
  { key: "vaccinations", path: "/vaccinations" },
  { key: "clinical-notes", path: "/clinical-notes" },
  { key: "follow-ups", path: "/follow-ups" },
  { key: "visits", path: "/visits" },
  { key: "imaging", path: "/imaging" },
  { key: "messages", path: "/messages" },
  { key: "share", path: "/share" },
] as const;

export default function PatientChartLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const pathname = usePathname();
  const { data, isLoading } = usePatientHeader(id);
  const base = `/portal/patients/${id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/portal/patients"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text font-medium transition-colors"
        >
          <ArrowLeft size={12} /> {t("chart.backToList")}
        </Link>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ) : (
          <PatientHeader data={data} />
        )}
      </Card>

      <nav className="portal-chart-tabs sticky top-[var(--topbar-h,64px)] z-20 -mx-4 md:-mx-6 px-4 md:px-6 flex items-center gap-0.5 overflow-x-auto border-b border-border/60 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        {TABS.map((tab) => {
          const href = `${base}${tab.path}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "px-3.5 py-2.5 text-xs whitespace-nowrap border-b-2 -mb-px transition-all duration-200 rounded-t-lg",
                active
                  ? "border-brand text-brand font-bold bg-brand-soft/30"
                  : "border-transparent text-text-muted hover:text-text hover:bg-surface-2/40 font-medium"
              )}
            >
              {t(`chart.tab.${tab.key}`)}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
