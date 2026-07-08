"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { useState } from "react";

export default function PatientsPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["patients", q],
    queryFn: () => api<{ patients: any[] }>(`/patients?q=${encodeURIComponent(q)}`),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.patients")}
        actions={
          <Link
            href="/hospital/reception/patients/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            + {t("reception.newPatient")}
          </Link>
        }
      />
      <Card>
        <input
          type="search"
          placeholder={t("common.search")}
          className="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {list.isLoading ? (
          <p className="text-sm text-text-muted">{t("common.loading")}</p>
        ) : !list.data?.patients?.length ? (
          <Empty title={t("reception.noPatients")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.name")}</TH>
                <TH>{t("common.phone")}</TH>
                <TH>{t("common.email")}</TH>
                <TH>{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.patients.map((p: any) => (
                <TR key={p.id}>
                  <TD>{p.name ?? p.fullName ?? "—"}</TD>
                  <TD>{p.phone ?? "—"}</TD>
                  <TD>{p.email ?? "—"}</TD>
                  <TD>
                    <Pill tone="neutral">{t("common.view")}</Pill>
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