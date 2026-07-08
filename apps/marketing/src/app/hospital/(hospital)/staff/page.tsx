"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useT } from "@/hospital/i18n";
import Link from "next/link";

export default function StaffPage() {
  const t = useT();
  const list = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<{ staff: any[] }>("/hospital-portal/staff"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.staff")}
        actions={
          <div className="flex gap-2">
            <Link
              href="/hospital/staff/invites"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              {t("nav.staffInvites")}
            </Link>
            <Link
              href="/hospital/staff/departments"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              {t("nav.departments")}
            </Link>
          </div>
        }
      />

      <Card padding={false}>
        {list.isLoading ? (
          <p className="p-5 text-sm text-text-muted">{t("common.loading")}</p>
        ) : !list.data?.staff?.length ? (
          <div className="p-5">
            <Empty
              title={t("staff.empty")}
              icon={<Users size={28} className="text-text-muted opacity-40" />}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.name")}</TH>
                <TH>{t("common.email")}</TH>
                <TH>{t("staff.role")}</TH>
                <TH>{t("staff.department")}</TH>
                <TH>{t("common.status")}</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.staff.map((s: any) => (
                <TR key={s.id}>
                  <TD className="font-semibold">{s.name ?? s.fullName ?? "—"}</TD>
                  <TD className="text-text-muted">{s.email ?? "—"}</TD>
                  <TD>
                    <Pill tone="brand">{s.role}</Pill>
                  </TD>
                  <TD>{s.department ?? "—"}</TD>
                  <TD>
                    <Pill tone={s.active ? "success" : "neutral"}>
                      {s.active ? t("common.yes") : t("common.no")}
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