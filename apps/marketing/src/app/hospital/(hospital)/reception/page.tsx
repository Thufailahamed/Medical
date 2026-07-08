"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  ClipboardList,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatTime } from "@/hospital/lib/format";

export default function ReceptionPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);

  const walkInsQ = useQuery({
    queryKey: ["walkIns", "today"],
    queryFn: () => api<{ walkIns: any[] }>("/walk-ins?status=waiting"),
    refetchInterval: 30_000,
  });

  const appointmentsQ = useQuery({
    queryKey: ["appointments", "today"],
    queryFn: () => api<{ appointments: any[] }>("/appointments?today=1"),
    refetchInterval: 60_000,
  });

  const walkIns = walkInsQ.data?.walkIns ?? [];
  const appointments = appointmentsQ.data?.appointments ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.reception")}
        subtitle={t("reception.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader
            title={t("reception.quickWalkIn")}
            icon={<Users size={15} className="text-brand" />}
            right={
              <span className="text-3xl font-extrabold tracking-tight text-text">
                {walkIns.length}
              </span>
            }
          />
          <Link
            href="/hospital/reception/walk-ins"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-strong"
          >
            {t("reception.openQueue")} <ArrowRight size={12} />
          </Link>
        </Card>

        <Card>
          <CardHeader
            title={t("reception.todayAppointments")}
            icon={<Calendar size={15} className="text-brand" />}
            right={
              <span className="text-3xl font-extrabold tracking-tight text-text">
                {appointments.length}
              </span>
            }
          />
          <Link
            href="/hospital/reception/appointments"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-strong"
          >
            {t("reception.openList")} <ArrowRight size={12} />
          </Link>
        </Card>

        <Card>
          <CardHeader
            title={t("reception.newPatient")}
            icon={<UserPlus size={15} className="text-brand" />}
          />
          <Link
            href="/hospital/reception/patients/new"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong shadow-sm transition-colors"
          >
            <UserPlus size={14} />
            {t("reception.registerNew")}
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t("reception.queueNow")}
          subtitle={t("reception.walkInSubtitle")}
          icon={<ClipboardList size={15} className="text-brand" />}
          right={
            walkIns.length > 0 ? (
              <Pill tone="warn">{walkIns.length} {t("reception.waiting")}</Pill>
            ) : null
          }
        />
        {walkInsQ.isLoading ? (
          <p className="mt-3 text-sm text-text-muted">{t("common.loading")}</p>
        ) : walkIns.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">{t("reception.noWalkIns")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {walkIns.slice(0, 8).map((w: any) => (
              <li key={w.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold text-text">{w.patientName ?? w.patientId}</p>
                  <p className="text-xs text-text-muted">
                    {w.reason ?? "—"}
                  </p>
                </div>
                <Pill tone="warn">{formatTime(w.createdAt, locale)}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}