"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { formatTime } from "@/hospital/lib/format";

export default function ReceptionAppointmentsPage() {
  const locale = useAuthStore((s) => s.locale);
  const q = useQuery({
    queryKey: ["appointments"],
    queryFn: () => api<{ appointments: any[] }>("/appointments"),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.appointments")}
        subtitle={tr(locale, "reception.appointmentsSubtitle")}
      />
      <Card>
        {q.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
        ) : !q.data?.appointments?.length ? (
          <Empty title={tr(locale, "reception.noAppointments")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{tr(locale, "common.time")}</TH>
                <TH>{tr(locale, "common.name")}</TH>
                <TH>{tr(locale, "reception.doctor")}</TH>
                <TH>{tr(locale, "common.status")}</TH>
              </TR>
            </THead>
            <TBody>
              {q.data.appointments.map((a: any) => (
                <TR key={a.id}>
                  <TD>{formatTime(a.startsAt ?? a.date, locale)}</TD>
                  <TD>{a.patientName ?? a.patientId}</TD>
                  <TD>{a.doctorName ?? a.doctorId ?? "—"}</TD>
                  <TD>
                    <Pill tone={a.status === "completed" ? "success" : "info"}>
                      {a.status}
                    </Pill>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}