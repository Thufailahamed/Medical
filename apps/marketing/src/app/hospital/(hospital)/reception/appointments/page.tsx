"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatTime } from "@/hospital/lib/format";

export default function ReceptionAppointmentsPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const q = useQuery({
    queryKey: ["appointments"],
    queryFn: () => api<{ appointments: any[] }>("/appointments"),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.appointments")}
        subtitle={t("reception.appointmentsSubtitle")}
      />
      <Card>
        {q.isLoading ? (
          <p className="text-sm text-text-muted">{t("common.loading")}</p>
        ) : !q.data?.appointments?.length ? (
          <Empty title={t("reception.noAppointments")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.time")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("reception.doctor")}</TH>
                <TH>{t("common.status")}</TH>
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