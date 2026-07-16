"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Pill as PillIcon,
  FileText,
  ArrowRight,
  Plus,
  Search,
  CheckCircle,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Input } from "@/portal/components/ui/Form";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Drawer } from "@/portal/components/ui/Modal";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { PrescriptionComposer } from "@/portal/components/rx/PrescriptionComposer";
import { useT } from "@/portal/i18n";
import { ageFrom, formatDate } from "@/portal/lib/format";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";
import { RxActions } from "@/portal/components/rx/RxActions";

interface RxRow {
  id: string;
  patientId: string;
  title: string | null;
  diagnosis: string | null;
  date: string | null;
  status: string;
  patient: { id: string; name: string } | null;
  medicineCount: number;
  // Migration 0059: single-use dispense token. Surfaced for the row
  // so the dispense action (when called from the doctor list) has the
  // token to forward to /doctor/prescriptions/:id/dispense. NULL on
  // legacy signed Rx → RxActions disables the button.
  dispenseToken: string | null;
}

interface PatientRow {
  patient: {
    id: string;
    nic?: string | null;
    dob?: string | null;
    sex?: string | null;
    bloodGroup?: string | null;
    photo?: string | null;
  };
  user: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
}

interface PatientSummary {
  allergies: Array<{ id: string; substance: string; severity: string }>;
}

type Status = "all" | "signed" | "draft" | "cancelled" | "dispensed";

const STATUS_VALUES: Status[] = ["all", "signed", "draft", "cancelled", "dispensed"];

export default function PrescriptionsListPage() {
  const t = useT();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(
    null
  );
  const [patientQuery, setPatientQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(patientQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [patientQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "prescriptions", "global", status],
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("limit", "200");
      if (status !== "all") q.set("status", status);
      return api<{ prescriptions: RxRow[]; count: number }>(
        `/doctor/prescriptions?${q.toString()}`
      );
    },
  });

  const { data: patientData, isLoading: patientsLoading } = useQuery({
    queryKey: qk.portalPatientSearch(debouncedQuery),
    queryFn: () =>
      api<{ patients: PatientRow[] }>(
        `/doctor-portal/search-patients?q=${encodeURIComponent(debouncedQuery)}`
      ),
    enabled: composeOpen && !selectedPatient && debouncedQuery.length >= 2,
  });

  const { data: summary } = useQuery({
    queryKey: ["doctor-portal", "patient", selectedPatient?.patient.id, "summary"],
    queryFn: () =>
      api<PatientSummary>(
        `/doctor-portal/patients/${selectedPatient!.patient.id}/summary`
      ),
    enabled: composeOpen && !!selectedPatient?.patient.id,
  });

  const rows = data?.prescriptions ?? [];
  const patients = patientData?.patients ?? [];
  const allergies = summary?.allergies ?? [];

  function closeComposer() {
    setComposeOpen(false);
    setSelectedPatient(null);
    setPatientQuery("");
    setDebouncedQuery("");
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    closeComposer();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("tab.prescriptions.title")}
        subtitle={t("prescription.subtitle")}
        icon={<FileText size={18} className="text-brand" />}
        actions={
          <button
            type="button"
            className="portal-btn portal-btn-primary portal-btn-sm"
            onClick={() => setComposeOpen(true)}
          >
            <Plus size={14} />
            {t("prescription.new")}
          </button>
        }
      />

      <Card padding={false} className="rounded-2xl border-border/50 shadow-sm overflow-hidden bg-surface">
        <div className="px-4 py-3 border-b border-border/40 bg-surface-2/30">
          <FilterPills<Status>
            value={status}
            onChange={setStatus}
            options={STATUS_VALUES.map((s) => ({
              value: s,
              label: t(
                s === "all"
                  ? "tab.prescriptions.filterAll"
                  : `status.${s}`
              ),
            }))}
          />
        </div>

        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={t("prescription.emptyGlobal")}
            className="py-16"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border/40">
            {rows.map((r) => (
              <li
                key={r.id}
                className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2/40 transition-colors"
              >
                <Link
                  href={`/portal/prescriptions/${r.id}`}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <Avatar name={r.patient?.name ?? ""} size="md" className="ring-1 ring-border/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 mb-0.5">
                      <span className="text-sm font-semibold text-text truncate group-hover:text-brand transition-colors">
                        {r.patient?.name ?? "—"}
                      </span>
                      <Pill tone={rxStatusToTone(r.status)}>
                        {t(`rx.status.${r.status}`)}
                      </Pill>
                      {r.date && (
                        <span className="text-[11px] text-text-muted">
                          • {formatDate(r.date)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-soft truncate">
                      <span className="truncate">
                        {r.diagnosis ?? r.title ?? t("prescription.untitled")}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 font-medium text-brand">
                        <PillIcon size={11} />
                        {r.medicineCount}{" "}
                        {r.medicineCount === 1 ? "med" : "meds"}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-3 shrink-0">
                  <RxActions
                    id={r.id}
                    status={r.status}
                    hideEdit
                    compact
                    dispenseToken={r.dispenseToken}
                  />
                  <Link
                    href={`/portal/prescriptions/${r.id}`}
                    className="portal-btn portal-btn-ghost portal-btn-sm"
                  >
                    {t("rx.actions.view")}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer
        open={composeOpen}
        onClose={closeComposer}
        title={
          selectedPatient
            ? t("prescription.composerTitle")
            : t("bookAppointment.selectPatient")
        }
        subtitle={
          selectedPatient
            ? selectedPatient.user.name
            : t("tab.prescriptions.emptyBody")
        }
        size="xl"
      >
        {!selectedPatient ? (
          <div className="flex flex-col gap-4">
            <div className="portal-input-search-wrap">
              <Search size={15} className="portal-input-search-icon" />
              <Input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder={t("bookAppointment.searchPatient")}
                className="portal-input-icon-left"
                autoFocus
              />
            </div>
            {debouncedQuery.length < 2 ? (
              <p className="text-xs text-text-muted text-center py-8">
                {t("bookAppointment.searchHint")}
              </p>
            ) : patientsLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : patients.length === 0 ? (
              <Empty title={t("bookAppointment.noPatientResults")} />
            ) : (
              <ul className="flex flex-col max-h-[min(420px,60vh)] overflow-y-auto rounded-xl border border-border/60">
                {patients.map((p) => {
                  const age = p.patient.dob ? ageFrom(p.patient.dob) : null;
                  return (
                    <li
                      key={p.patient.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(p)}
                        className="portal-patient-pick-row w-full flex items-center gap-3 px-3 py-3 text-left transition-colors"
                      >
                        <Avatar
                          name={p.user.name}
                          src={p.patient.photo ?? undefined}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-text truncate">
                              {p.user.name}
                            </span>
                            {age != null ? (
                              <span className="text-[11px] text-text-muted font-medium">
                                {age}y · {p.patient.sex ?? "—"}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {p.patient.nic ? `NIC ${p.patient.nic} · ` : ""}
                            {p.user.phone ?? p.user.email ?? "—"}
                          </div>
                        </div>
                        {p.patient.bloodGroup ? (
                          <Pill tone="neutral">{p.patient.bloodGroup}</Pill>
                        ) : null}
                        <CheckCircle
                          size={16}
                          className="text-text-muted/30 shrink-0"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="portal-patient-banner">
              <Avatar
                name={selectedPatient.user.name}
                src={selectedPatient.patient.photo ?? undefined}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text truncate">
                  {selectedPatient.user.name}
                </div>
                <div className="text-xs text-text-muted truncate">
                  {selectedPatient.patient.nic
                    ? `NIC ${selectedPatient.patient.nic}`
                    : selectedPatient.user.phone ?? selectedPatient.user.email}
                </div>
              </div>
              <button
                type="button"
                className="portal-btn portal-btn-ghost portal-btn-sm"
                onClick={() => setSelectedPatient(null)}
              >
                {t("common.back")}
              </button>
            </div>
            <PrescriptionComposer
              patientId={selectedPatient.patient.id}
              patientAllergies={allergies}
              onSaved={handleSaved}
              onCancel={() => setSelectedPatient(null)}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
