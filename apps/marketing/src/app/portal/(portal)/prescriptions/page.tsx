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
  X,
  ShieldCheck,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Input } from "@/portal/components/ui/Form";
import { Drawer } from "@/portal/components/ui/Modal";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { PrescriptionComposer } from "@/portal/components/rx/PrescriptionComposer";
import { useT } from "@/portal/i18n";
import { ageFrom, formatDate } from "@/portal/lib/format";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";
import { RxActions } from "@/portal/components/rx/RxActions";
import { ChartEmpty } from "@/portal/components/chart/ChartEmpty";

interface RxRow {
  id: string;
  patientId: string;
  title: string | null;
  diagnosis: string | null;
  date: string | null;
  status: string;
  patient: { id: string; name: string } | null;
  medicineCount: number;
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
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);
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

  const { data: allData } = useQuery({
    queryKey: ["doctor", "prescriptions", "global", "all"],
    queryFn: () => api<{ prescriptions: RxRow[]; count: number }>("/doctor/prescriptions?limit=200"),
    staleTime: 30_000,
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
  const allList = allData?.prescriptions ?? rows;
  const patients = patientData?.patients ?? [];
  const allergies = summary?.allergies ?? [];

  // Status telemetry counters
  const totalCount = allList.length;
  const signedCount = allList.filter((r) => r.status === "signed").length;
  const draftCount = allList.filter((r) => r.status === "draft").length;
  const dispensedCount = allList.filter((r) => r.status === "dispensed").length;
  const cancelledCount = allList.filter((r) => r.status === "cancelled").length;

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.patient?.name && r.patient.name.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.diagnosis && r.diagnosis.toLowerCase().includes(q))
    );
  });

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
      {/* ── Oceanic Hero Header ────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col gap-6"
        style={{
          background:
            "radial-gradient(134.49% 134.49% at 94.63% 0%, #009688 0%, #00695C 42.6%, #004D40 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/20">
                e-Prescribing & Pharmacotherapy
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>SLMC Authenticated</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
              Prescriptions & e-Rx Hub
            </h1>
            <p className="text-sm text-teal-100/90 max-w-2xl mt-1 leading-relaxed">
              Review signed pharmacological orders, manage dispense authorizations, and generate digitally authenticated medical prescriptions with real-time allergy cross-checks.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-teal-950 bg-white shadow-md hover:bg-teal-50 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Issue New Prescription</span>
          </button>
        </div>

        {/* 4 Telemetry Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-teal-200 uppercase tracking-wider">Total e-Rx Issued</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{totalCount}</span>
            <span className="text-[10.5px] text-teal-200/80 mt-0.5">Historical clinical orders</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Signed & Valid</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{signedCount}</span>
            <span className="text-[10.5px] text-emerald-200/80 mt-0.5">Ready for pharmacy dispense</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Draft In-Progress</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{draftCount}</span>
            <span className="text-[10.5px] text-amber-200/80 mt-0.5">Pending doctor sign-off</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Dispensed</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{dispensedCount}</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">Fulfilled by partner pharmacies</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all flex-1 max-w-md">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, medication, or diagnosis…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <FilterPills<Status>
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: totalCount },
            { value: "signed", label: "Signed", count: signedCount },
            { value: "draft", label: "Draft", count: draftCount },
            { value: "cancelled", label: "Cancelled", count: cancelledCount },
            { value: "dispensed", label: "Dispensed", count: dispensedCount },
          ]}
        />
      </div>

      {/* ── Prescriptions Listing ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-5 flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8">
            <ChartEmpty
              icon={<FileText size={24} />}
              title="No prescriptions found"
              description={
                search
                  ? `No prescriptions matching "${search}". Try clearing your search query.`
                  : "You have no prescriptions filed under this category yet."
              }
              action={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs"
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    }}
                  >
                    <Plus size={14} className="inline mr-1" />
                    Issue New Prescription
                  </button>
                )
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {filteredRows.map((r) => (
              <li
                key={r.id}
                className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-sky-50/40 transition-colors"
              >
                <Link
                  href={`/portal/prescriptions/${r.id}`}
                  className="flex items-center gap-3.5 flex-1 min-w-0"
                >
                  <Avatar
                    name={r.patient?.name ?? ""}
                    size="md"
                    className="ring-2 ring-slate-100 shadow-2xs shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 mb-0.5">
                      <span className="text-sm font-bold text-slate-900 truncate group-hover:text-sky-700 transition-colors">
                        {r.patient?.name ?? "—"}
                      </span>
                      <Pill tone={rxStatusToTone(r.status)}>
                        {t(`rx.status.${r.status}`) || r.status}
                      </Pill>
                      {r.date && (
                        <span className="text-xs text-slate-400 font-medium">
                          • {formatDate(r.date)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                      <span className="truncate font-medium">
                        {r.diagnosis ?? r.title ?? t("prescription.untitled")}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md text-[11px] border border-sky-100">
                        <PillIcon size={11} />
                        {r.medicineCount} {r.medicineCount === 1 ? "med" : "meds"}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-2.5 shrink-0">
                  <RxActions
                    id={r.id}
                    status={r.status}
                    hideEdit
                    compact
                    dispenseToken={r.dispenseToken}
                  />
                  <Link
                    href={`/portal/prescriptions/${r.id}`}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>{t("rx.actions.view")}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Prescription Composer Drawer ───────────────────────────────── */}
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
