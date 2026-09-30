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
  ShieldCheck,
  PenLine,
  PackageCheck,
  LayoutTemplate,
  CalendarDays,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Input } from "@/portal/components/ui/Form";
import { Drawer } from "@/portal/components/ui/Modal";
import { PrescriptionComposer } from "@/portal/components/rx/PrescriptionComposer";
import { useT } from "@/portal/i18n";
import { ageFrom, formatDate } from "@/portal/lib/format";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";
import { RxActions } from "@/portal/components/rx/RxActions";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PRIMARY_BTN,
  ROW_LINK,
  RowAccent,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";

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

const RX_ACCENT: Record<string, string> = {
  signed: "bg-emerald-500",
  draft: "bg-amber-400",
  dispensed: "bg-violet-500",
  cancelled: "bg-slate-300",
};

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

  const signedPct = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;
  const dispensedPct =
    signedCount + dispensedCount > 0
      ? Math.round((dispensedCount / (signedCount + dispensedCount)) * 100)
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<PillIcon size={13} aria-hidden />}
          kicker="e-Prescribing"
          kickerMeta={`${totalCount} order${totalCount === 1 ? "" : "s"} on file`}
          title={
            <>
              Prescriptions &amp;{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                e-Rx hub
              </span>
            </>
          }
          description="Review signed orders, track pharmacy dispensing, and issue digitally signed prescriptions with live allergy cross-checks."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                SLMC authenticated
              </span>
              {draftCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setStatus("draft")}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  <PenLine size={12} aria-hidden />
                  {draftCount} draft{draftCount === 1 ? "" : "s"} awaiting sign-off
                </button>
              ) : null}
            </>
          }
          actions={
            <>
              <Link href="/portal/rx-templates" className={HERO_GHOST}>
                <LayoutTemplate size={15} aria-hidden />
                Templates
              </Link>
              <button type="button" onClick={() => setComposeOpen(true)} className={HERO_PRIMARY}>
                <Plus size={15} strokeWidth={2.5} className="text-sky-600" aria-hidden />
                New prescription
              </button>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Total issued"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading && !allData ? "…" : String(totalCount)}
            sub={cancelledCount > 0 ? `${cancelledCount} cancelled` : "All clinical orders"}
            active={status === "all"}
            onClick={() => setStatus("all")}
          />
          <StatTile
            label="Signed & valid"
            icon={<ShieldCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(signedCount)}
            sub="Ready for pharmacy dispense"
            progress={totalCount > 0 ? signedPct : null}
            active={status === "signed"}
            onClick={() => setStatus("signed")}
          />
          <StatTile
            label="Drafts"
            icon={<PenLine size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(draftCount)}
            sub={draftCount > 0 ? "Pending your sign-off" : "Nothing pending"}
            badge={draftCount > 0 ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            pulse={draftCount > 0}
            active={status === "draft"}
            onClick={() => setStatus("draft")}
          />
          <StatTile
            label="Dispensed"
            icon={<PackageCheck size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(dispensedCount)}
            sub="Fulfilled by pharmacies"
            progress={signedCount + dispensedCount > 0 ? dispensedPct : null}
            active={status === "dispensed"}
            onClick={() => setStatus("dispensed")}
          />
        </HeroOverlap>
      </div>

      {/* ── Prescriptions ledger ───────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="rx-ledger">
        <PanelHeader
          id="rx-ledger"
          icon={<PillIcon size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Prescription ledger"
          caption={
            isLoading
              ? "Loading orders…"
              : `${filteredRows.length} of ${rows.length} shown${search ? ` · matching “${search}”` : ""}`
          }
        />

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch
            value={search}
            onChange={setSearch}
            placeholder="Search patient, medication or diagnosis…"
            ariaLabel="Search prescriptions"
          />
          <Segmented<Status>
            ariaLabel="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: totalCount },
              { value: "signed", label: "Signed", count: signedCount },
              { value: "draft", label: "Draft", count: draftCount },
              { value: "dispensed", label: "Dispensed", count: dispensedCount },
              { value: "cancelled", label: "Cancelled", count: cancelledCount },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyBlock
            icon={<FileText size={19} />}
            title={search ? "No matching prescriptions" : "No prescriptions here yet"}
            body={
              search
                ? `Nothing matches “${search}”. Try a patient name, drug or diagnosis.`
                : "Orders you issue appear here with their dispense status and a downloadable signed PDF."
            }
            actions={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className={SECONDARY_BTN}
                >
                  Clear search
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className={PRIMARY_BTN}
                >
                  <Plus size={13} strokeWidth={2.5} />
                  New prescription
                </button>
              )
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {filteredRows.map((r) => (
              <li
                key={r.id}
                className={LIST_ROW}
              >
                <RowAccent className={RX_ACCENT[r.status]} />
                <Link href={`/portal/prescriptions/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5">
                  <Avatar name={r.patient?.name ?? ""} size="md" className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                        {r.patient?.name ?? "—"}
                      </span>
                      <Pill tone={rxStatusToTone(r.status)}>{t(`rx.status.${r.status}`) || r.status}</Pill>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">{r.diagnosis ?? r.title ?? t("prescription.untitled")}</span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">
                        <PillIcon size={11} />
                        {r.medicineCount} {r.medicineCount === 1 ? "med" : "meds"}
                      </span>
                      {r.date ? (
                        <>
                          <span className="hidden text-slate-300 sm:inline">·</span>
                          <span className="hidden shrink-0 items-center gap-1 text-slate-400 sm:inline-flex">
                            <CalendarDays size={11} />
                            {formatDate(r.date)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-2 pl-1.5 sm:pl-0">
                  <RxActions id={r.id} status={r.status} hideEdit compact dispenseToken={r.dispenseToken} />
                  <Link
                    href={`/portal/prescriptions/${r.id}`}
                    className={ROW_LINK}
                  >
                    {t("rx.actions.view")}
                    <ArrowRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
