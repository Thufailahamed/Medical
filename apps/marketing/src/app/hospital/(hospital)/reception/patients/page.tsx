"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, UserPlus, Users } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate } from "@/hospital/lib/format";

type FilterKey = "all" | "admitted" | "registered" | "discharged";

const FILTERS: { key: FilterKey; queryKey: string | null }[] = [
  { key: "all", queryKey: null },
  { key: "admitted", queryKey: "true" },
  { key: "registered", queryKey: "registered" },
  { key: "discharged", queryKey: "discharged" },
];

const STATUS_TONE: Record<string, "info" | "neutral" | "danger"> = {
  registered: "info",
  discharged: "neutral",
  deceased: "danger",
};

function patientInitials(name?: string | null) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export default function PatientsPage() {
  const t = useT();
  const router = useRouter();
  const locale = useAuthStore((s) => s.locale);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const activeFilter = FILTERS.find((f) => f.key === filter)!;
  const search = useQuery({
    queryKey: ["hospital-portal", "patients", { q, filter: activeFilter.queryKey }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (activeFilter.queryKey) {
        if (activeFilter.queryKey === "true") {
          params.set("admitted", "true");
        } else {
          params.set("status", activeFilter.queryKey);
        }
      }
      const qs = params.toString();
      return api<{ patients: any[] }>(`/hospital-portal/patients${qs ? `?${qs}` : ""}`);
    },
  });

  const patients = search.data?.patients ?? [];
  const filterLabels: Record<FilterKey, string> = {
    all: t("patients.filterAll"),
    admitted: t("patients.filterAdmitted"),
    registered: t("patients.filterRegistered"),
    discharged: t("patients.filterDischarged"),
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("nav.patients")}
        subtitle={t("reception.patientsSubtitle")}
        icon={<Users size={18} className="text-brand" />}
        actions={
          <Link
            href="/hospital/reception/patients/new"
            className="portal-btn portal-btn-primary portal-btn-md"
          >
            <UserPlus size={15} />
            {t("reception.newPatient")}
          </Link>
        }
      />

      <Card padding={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 px-5 py-4 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({
                value: f.key,
                label: filterLabels[f.key],
              }))}
            />
            {!search.isLoading && patients.length > 0 ? (
              <span className="text-[11px] font-semibold text-text-muted ml-1">
                {t("patients.patientCount", { count: patients.length })}
              </span>
            ) : null}
          </div>

          <div className="portal-input-search-wrap w-full sm:max-w-xs">
            <Search size={15} className="portal-input-search-icon" />
            <input
              type="search"
              placeholder={t("common.search")}
              className="portal-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="px-1 pb-1">
          {search.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : !patients.length ? (
            <Empty
              title={t("patients.noPatients")}
              description={t("patients.directorySubtitle")}
              icon={<Users size={22} className="text-text-muted" />}
              action={
                <Link
                  href="/hospital/reception/patients/new"
                  className="portal-btn portal-btn-primary portal-btn-sm mt-2"
                >
                  <UserPlus size={14} />
                  {t("reception.newPatient")}
                </Link>
              }
              className="py-12"
            />
          ) : (
            <div className="hospital-data-table-wrap">
              <table className="hospital-data-table">
                <thead>
                  <tr>
                    <th className="text-left">{t("common.name")}</th>
                    <th className="text-left">{t("patients.mrn")}</th>
                    <th className="text-left">{t("common.phone")}</th>
                    <th className="text-left">{t("common.status")}</th>
                    <th className="text-left">{t("patients.admitted")}</th>
                    <th className="text-left">{t("patients.registeredAt")}</th>
                    <th className="text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p: any) => (
                    <tr
                      key={p.id}
                      className="hospital-patient-row group"
                      onClick={() => router.push(`/hospital/reception/patients/${p.id}`)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="hospital-patient-avatar">
                            {patientInitials(p.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-text truncate">
                              {p.name ?? "—"}
                            </div>
                            {p.email ? (
                              <div className="text-[11px] text-text-muted truncate max-w-[220px]">
                                {p.email}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="hospital-mrn">{p.mrn ?? t("patients.actions.noMrn")}</span>
                      </td>
                      <td className="text-text-soft text-sm whitespace-nowrap">
                        {p.phone ?? "—"}
                      </td>
                      <td>
                        <Pill tone={STATUS_TONE[p.status] ?? "neutral"} className="text-[11px]">
                          {p.status === "registered"
                            ? t("patients.registered")
                            : p.status === "discharged"
                              ? t("patients.discharged")
                              : p.status}
                        </Pill>
                      </td>
                      <td>
                        {p.currentlyAdmitted ? (
                          <Pill tone="warn" className="text-[11px]">
                            {t("patients.admitted")}
                          </Pill>
                        ) : (
                          <span className="text-xs text-text-muted">
                            {t("patients.notAdmitted")}
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-text-muted whitespace-nowrap">
                        {p.registeredAt ? formatDate(p.registeredAt, locale) : "—"}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/hospital/reception/patients/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="portal-btn portal-btn-ghost portal-btn-sm opacity-70 group-hover:opacity-100"
                        >
                          {t("patients.actions.view")}
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
