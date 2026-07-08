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
import { tr } from "@/hospital/i18n";
import { useState } from "react";

export default function PatientsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["patients", q],
    queryFn: () => api<{ patients: any[] }>(`/patients?q=${encodeURIComponent(q)}`),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.patients")}
        actions={
          <Link
            href="/hospital/reception/patients/new"
            className="rounded-lg bg-[var(--accent-600)] px-4 py-2 text-sm font-medium text-white"
          >
            + {tr(locale, "reception.newPatient")}
          </Link>
        }
      />
      <Card>
        <input
          type="search"
          placeholder={tr(locale, "common.search")}
          className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {list.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
        ) : !list.data?.patients?.length ? (
          <Empty title={tr(locale, "reception.noPatients")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{tr(locale, "common.name")}</TH>
                <TH>{tr(locale, "common.phone")}</TH>
                <TH>{tr(locale, "common.email")}</TH>
                <TH>{tr(locale, "common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.patients.map((p: any) => (
                <TR key={p.id}>
                  <TD>{p.name ?? p.fullName ?? "—"}</TD>
                  <TD>{p.phone ?? "—"}</TD>
                  <TD>{p.email ?? "—"}</TD>
                  <TD>
                    <Pill tone="neutral">{tr(locale, "common.view")}</Pill>
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