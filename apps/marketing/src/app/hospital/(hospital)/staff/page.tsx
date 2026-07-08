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
import Link from "next/link";

export default function StaffPage() {
  const locale = useAuthStore((s) => s.locale);
  const list = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<{ staff: any[] }>("/hospital-portal/staff"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.staff")}
        actions={
          <div className="flex gap-2">
            <Link
              href="/hospital/staff/invites"
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            >
              {tr(locale, "nav.staffInvites")}
            </Link>
            <Link
              href="/hospital/staff/departments"
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            >
              {tr(locale, "nav.departments")}
            </Link>
          </div>
        }
      />

      <Card>
        {list.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
        ) : !list.data?.staff?.length ? (
          <Empty title={tr(locale, "staff.empty")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{tr(locale, "common.name")}</TH>
                <TH>{tr(locale, "common.email")}</TH>
                <TH>{tr(locale, "staff.role")}</TH>
                <TH>{tr(locale, "staff.department")}</TH>
                <TH>{tr(locale, "common.status")}</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.staff.map((s: any) => (
                <TR key={s.id}>
                  <TD>{s.name ?? s.fullName ?? "—"}</TD>
                  <TD>{s.email ?? "—"}</TD>
                  <TD>{s.role}</TD>
                  <TD>{s.department ?? "—"}</TD>
                  <TD>
                    <Pill tone={s.active ? "success" : "muted"}>
                      {s.active ? tr(locale, "common.yes") : tr(locale, "common.no")}
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