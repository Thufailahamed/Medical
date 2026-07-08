"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { formatTime } from "@/hospital/lib/format";

export default function ReceptionPage() {
  const locale = useAuthStore((s) => s.locale);
  const tenantType = useAuthStore((s) => s.tenantType);

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
        title={tr(locale, "nav.reception")}
        subtitle={tr(locale, "reception.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            {tr(locale, "reception.quickWalkIn")}
          </h3>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
            {walkIns.length}
          </p>
          <Link
            href="/hospital/reception/walk-ins"
            className="mt-3 inline-block text-sm text-[var(--accent-600)] hover:underline"
          >
            {tr(locale, "reception.openQueue")} →
          </Link>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            {tr(locale, "reception.todayAppointments")}
          </h3>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
            {appointments.length}
          </p>
          <Link
            href="/hospital/reception/appointments"
            className="mt-3 inline-block text-sm text-[var(--accent-600)] hover:underline"
          >
            {tr(locale, "reception.openList")} →
          </Link>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            {tr(locale, "reception.newPatient")}
          </h3>
          <Link
            href="/hospital/reception/patients/new"
            className="mt-3 inline-block rounded-lg bg-[var(--accent-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-700)]"
          >
            {tr(locale, "reception.registerNew")}
          </Link>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">{tr(locale, "reception.queueNow")}</h3>
        {walkInsQ.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
        ) : walkIns.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "reception.noWalkIns")}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {walkIns.slice(0, 8).map((w: any) => (
              <li key={w.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{w.patientName ?? w.patientId}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {w.reason ?? "—"}
                  </p>
                </div>
                <Pill tone="warning">{formatTime(w.createdAt, locale)}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}