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
  { key: "records", path: "" },
  { key: "medications", path: "/medications" },
  { key: "vitals", path: "/vitals" },
  { key: "allergies", path: "/allergies" },
  { key: "prescriptions", path: "/portal/prescriptions" },
  { key: "lab-orders", path: "/portal/lab-orders" },
  { key: "clinical-notes", path: "/clinical-notes" },
  { key: "follow-ups", path: "/follow-ups" },
  { key: "visits", path: "/visits" },
  { key: "messages", path: "/portal/messages" },
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
          className="inline-flex items-center gap-1 text-xs text-text-soft hover:text-text"
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

      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const href = `${base}${tab.path}`;
          const active =
            tab.path === ""
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(href);
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "px-3 py-2 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-brand text-brand font-medium"
                  : "border-transparent text-text-soft hover:text-text"
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