"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  ChevronLeft,
  FileText,
  Heart,
  Pill as PillIcon,
  Stethoscope,
  TestTube,
  User,
  UserCheck,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate, formatDateTime } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";

type Tab = "overview" | "admissions" | "records" | "prescriptions" | "lab" | "vitals";

const TABS: Tab[] = ["overview", "admissions", "records", "prescriptions", "lab", "vitals"];

const RECORD_TONE: Record<string, any> = {
  hospital_visit: "info",
  discharge_summary: "success",
  clinical_note: "neutral",
  lab_report: "violet",
  imaging: "accent",
  prescription: "brand",
  vaccination: "success",
  surgery: "warn",
  operation_note: "warn",
  insurance: "neutral",
  allergy: "danger",
  follow_up: "info",
  medical_certificate: "neutral",
  other: "neutral",
};

const RX_TONE: Record<string, any> = {
  draft: "neutral",
  signed: "info",
  dispensed: "success",
  cancelled: "danger",
};

const LAB_TONE: Record<string, any> = {
  ordered: "info",
  sample_collected: "warn",
  in_progress: "warn",
  completed: "success",
  cancelled: "danger",
};

const ADM_TONE: Record<string, any> = {
  admitted: "warn",
  discharged: "success",
  transferred: "neutral",
  dama: "neutral",
  deceased: "danger",
};

function patientInitials(name?: string | null) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function regStatusLabel(status: string | undefined, t: ReturnType<typeof useT>) {
  if (status === "registered") return t("patients.registered");
  if (status === "discharged") return t("patients.discharged");
  return status ?? "—";
}

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const { id } = use(params);
  const locale = useAuthStore((s) => s.locale);
  const activeHospitalId = useAuthStore((s) => s.activeHospitalId);
  const [tab, setTab] = useState<Tab>("overview");

  const q = useQuery({
    queryKey: ["hospital-portal", "patient-360", id],
    queryFn: () =>
      api<{
        patient: any;
        user: any;
        registration: any;
        admission: any | null;
        admissions: any[];
        records: any[];
        prescriptions: any[];
        labOrders: any[];
        vitals: any[];
        latestVitals: any[];
        vitalsAlerts: { count: number; items: any[] };
        doctors: any[];
      }>(`/hospital-portal/patients/${id}`),
  });

  const data = q.data;
  const user = data?.user;
  const reg = data?.registration;

  const tabLabels: Record<Tab, string> = {
    overview: t("patients.tabs.overview"),
    admissions: t("patients.tabs.admissions"),
    records: t("patients.tabs.records"),
    prescriptions: t("patients.tabs.prescriptions"),
    lab: t("patients.tabs.lab"),
    vitals: t("patients.tabs.vitals"),
  };

  const tabCounts: Partial<Record<Tab, number>> = data
    ? {
        admissions: (data.admission ? 1 : 0) + (data.admissions?.length ?? 0),
        records: data.records?.length ?? 0,
        prescriptions: data.prescriptions?.length ?? 0,
        lab: data.labOrders?.length ?? 0,
        vitals: (data.latestVitals?.length ?? 0) + (data.vitalsAlerts?.count ?? 0),
      }
    : {};

  return (
    <div className="flex flex-col gap-4">
      <Link href="/hospital/reception/patients" className="hospital-back-link no-print">
        <ChevronLeft size={14} />
        {t("common.back")}
      </Link>

      {q.isLoading ? (
        <PatientDetailSkeleton />
      ) : q.isError ? (
        <Empty title={t("errors.notFound")} />
      ) : (
        <>
          <header className="hospital-patient-hero">
            <div className="hospital-patient-hero-main">
              <div className="hospital-patient-avatar hospital-patient-avatar-lg">
                {patientInitials(user?.name)}
              </div>
              <div className="hospital-patient-hero-info">
                <h1 className="hospital-patient-hero-name">{user?.name ?? "—"}</h1>
                <div className="hospital-patient-hero-meta">
                  {reg?.mrn ? <span className="hospital-mrn">{reg.mrn}</span> : null}
                  {reg ? (
                    <PillBadge
                      tone={reg.status === "registered" ? "info" : "neutral"}
                      className="text-[10px]"
                    >
                      {regStatusLabel(reg.status, t)}
                    </PillBadge>
                  ) : null}
                  {data?.admission ? (
                    <PillBadge tone="warn" className="text-[10px]">
                      {t("patients.admitted")}
                    </PillBadge>
                  ) : null}
                </div>
              </div>
              <div className="hospital-patient-hero-actions no-print">
                <button
                  type="button"
                  className="portal-btn portal-btn-secondary portal-btn-sm"
                  onClick={() => window.print()}
                >
                  <FileText size={14} />
                  {t("patients.actions.print")}
                </button>
              </div>
            </div>
          </header>

          <nav className="hospital-detail-tabs no-print" role="tablist">
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                data-active={tab === key ? "true" : "false"}
                className="hospital-detail-tab"
                onClick={() => setTab(key)}
              >
                {tabLabels[key]}
                {key !== "overview" && tabCounts[key] != null && tabCounts[key]! > 0 ? (
                  <span className="hospital-detail-tab-count">{tabCounts[key]}</span>
                ) : null}
              </button>
            ))}
          </nav>

          <div role="tabpanel">
            {tab === "overview" && (
              <OverviewTab data={data!} locale={locale} currentHospitalId={activeHospitalId ?? null} />
            )}
            {tab === "admissions" && (
              <AdmissionsTab data={data!} locale={locale} currentHospitalId={activeHospitalId ?? null} />
            )}
            {tab === "records" && (
              <RecordsTab data={data!} locale={locale} currentHospitalId={activeHospitalId ?? null} />
            )}
            {tab === "prescriptions" && (
              <PrescriptionsTab data={data!} locale={locale} currentHospitalId={activeHospitalId ?? null} />
            )}
            {tab === "lab" && (
              <LabTab data={data!} locale={locale} currentHospitalId={activeHospitalId ?? null} />
            )}
            {tab === "vitals" && <VitalsTab data={data!} locale={locale} />}
          </div>
        </>
      )}
    </div>
  );
}

function PatientDetailSkeleton() {
  return (
    <>
      <div className="hospital-patient-hero">
        <div className="hospital-patient-hero-main">
          <Skeleton className="h-14 w-14 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="hospital-detail-grid cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-2xl" />
        ))}
      </div>
    </>
  );
}

function DetailCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="hospital-detail-card">
      <header className="hospital-detail-card-header">
        <div className="hospital-detail-card-heading">
          <div className="hospital-detail-card-icon">{icon}</div>
          <h2 className="hospital-detail-card-title">{title}</h2>
        </div>
        {action}
      </header>
      <div className="hospital-detail-card-body">{children}</div>
    </section>
  );
}

function DetailField({
  label,
  value,
  mono,
  span2,
}: {
  label: string;
  value: any;
  mono?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "hospital-detail-field-span-2" : undefined}>
      <dl className="hospital-detail-field">
        <dt>{label}</dt>
        <dd className={mono ? "mono" : undefined}>{value || "—"}</dd>
      </dl>
    </div>
  );
}

function SourceBadge({ name, isCurrent }: { name?: string | null; isCurrent?: boolean }) {
  if (!name) return <span className="text-xs text-text-muted">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        isCurrent
          ? "bg-brand-soft text-brand"
          : "bg-surface-2 text-text-muted border border-border/60"
      )}
      title={isCurrent ? "From this hospital" : `From ${name}`}
    >
      {name}
      {isCurrent ? <span className="text-[9px] opacity-80">· here</span> : null}
    </span>
  );
}

function DetailTable({
  columns,
  rows,
}: {
  columns: React.ReactNode;
  rows: React.ReactNode;
}) {
  return (
    <div className="hospital-data-table-wrap">
      <table className="hospital-data-table">
        <thead>
          <tr>{columns}</tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className={align === "right" ? "text-right" : undefined} style={{ textAlign: align }}>
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
}: {
  children: React.ReactNode;
  align?: "right";
  muted?: boolean;
}) {
  return (
    <td
      className={muted ? "text-text-muted" : undefined}
      style={{ textAlign: align }}
    >
      {children}
    </td>
  );
}

/* ─── Overview ─────────────────────────────────────────── */

function OverviewTab({ data, locale, currentHospitalId }: { data: any; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const p = data.patient;
  const u = data.user;
  const reg = data.registration;
  const adm = data.admission;
  const docs = data.doctors ?? [];

  const address = (() => {
    try {
      const ec = p?.emergencyContacts ? JSON.parse(p.emergencyContacts) : null;
      const note = Array.isArray(ec) ? ec.find((x: any) => x?.type === "note") : null;
      return note?.value ?? null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="hospital-detail-grid cols-2">
      <DetailCard
        title={t("patients.overview.profile")}
        icon={<User size={15} />}
      >
        <div className="hospital-detail-fields">
          <DetailField label={t("common.name")} value={u?.name} />
          <DetailField label={t("patients.overview.gender")} value={p?.gender} />
          <DetailField
            label={t("patients.overview.dob")}
            value={p?.dateOfBirth ? formatDate(p.dateOfBirth, locale) : null}
          />
          <DetailField label={t("patients.overview.bloodGroup")} value={p?.bloodGroup} />
          <DetailField label={t("common.phone")} value={u?.phone} />
          <DetailField label={t("common.email")} value={u?.email} />
          <DetailField label={t("patients.overview.address")} value={address} span2 />
        </div>
      </DetailCard>

      <DetailCard
        title={t("patients.overview.registration")}
        icon={<Building2 size={15} />}
      >
        <div className="hospital-detail-fields">
          <DetailField label={t("patients.mrn")} value={reg?.mrn} mono />
          <DetailField label={t("common.status")} value={regStatusLabel(reg?.status, t)} />
          <DetailField
            label={t("common.from")}
            value={reg?.registeredAt ? formatDate(reg.registeredAt, locale) : null}
          />
          <DetailField
            label={t("patients.discharged")}
            value={reg?.dischargedAt ? formatDate(reg.dischargedAt, locale) : null}
          />
        </div>
      </DetailCard>

      <DetailCard
        title={t("patients.overview.admission")}
        icon={<Heart size={15} />}
        action={
          adm ? (
            <Link
              href={`/hospital/ipd/${adm.id}`}
              className="portal-btn portal-btn-ghost portal-btn-sm"
            >
              {t("patients.admissions.view")}
              <ArrowRight size={13} />
            </Link>
          ) : null
        }
      >
        {adm ? (
          <div className="hospital-detail-fields">
            <DetailField label={t("patients.admissions.ward")} value={adm.wardName} />
            <DetailField label={t("patients.admissions.reason")} value={adm.reason} />
            <DetailField
              label={t("common.from")}
              value={adm.admittedAt ? formatDateTime(adm.admittedAt, locale) : null}
            />
            <DetailField label={t("common.status")} value={adm.admissionType} />
          </div>
        ) : (
          <p className="hospital-detail-empty">{t("patients.overview.noAdmission")}</p>
        )}
      </DetailCard>

      <DetailCard
        title={t("patients.overview.doctors")}
        icon={<Stethoscope size={15} />}
      >
        {docs.length === 0 ? (
          <p className="hospital-detail-empty">{t("patients.overview.noDoctors")}</p>
        ) : (
          <ul>
            {docs.map((d: any) => (
              <li key={d.id} className="hospital-detail-list-item">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck size={14} className="text-brand shrink-0" />
                  <span className="font-semibold text-sm truncate">{d.doctorName ?? "—"}</span>
                  {d.isPrimary ? (
                    <PillBadge tone="brand" className="text-[10px] shrink-0">
                      {t("patients.overview.primary")}
                    </PillBadge>
                  ) : null}
                  <SourceBadge name={d.hospitalName} isCurrent={d.contextId === currentHospitalId} />
                </div>
                <PillBadge tone="neutral" className="text-[10px] shrink-0">
                  {d.relationshipKind}
                </PillBadge>
              </li>
            ))}
          </ul>
        )}
      </DetailCard>
    </div>
  );
}

/* ─── Admissions ───────────────────────────────────────── */

function AdmissionsTab({ data, locale, currentHospitalId }: { data: any; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const adm = data.admission;
  const past = data.admissions ?? [];

  if (!adm && past.length === 0) {
    return <Empty title={t("patients.admissions.noAdmissions")} className="py-12" />;
  }

  return (
    <div className="hospital-detail-panel">
      {adm ? (
        <DetailCard
          title={t("patients.overview.admission")}
          icon={<Heart size={15} />}
          action={
            <Link
              href={`/hospital/ipd/${adm.id}`}
              className="portal-btn portal-btn-ghost portal-btn-sm"
            >
              {t("patients.admissions.view")}
              <ArrowRight size={13} />
            </Link>
          }
        >
          <div className="hospital-detail-fields">
            <DetailField label={t("patients.admissions.ward")} value={adm.wardName} />
            <DetailField label={t("patients.admissions.reason")} value={adm.reason} />
            <DetailField
              label={t("common.from")}
              value={adm.admittedAt ? formatDateTime(adm.admittedAt, locale) : null}
            />
            <DetailField label={t("ipd.admission")} value={adm.admissionType} />
          </div>
        </DetailCard>
      ) : null}

      {past.length > 0 ? (
        <DetailCard title={t("patients.tabs.admissions")} icon={<FileText size={15} />}>
          <DetailTable
            columns={
              <>
                <Th>{t("common.date")}</Th>
                <Th>{t("patients.admissions.reason")}</Th>
                <Th>{t("patients.admissions.ward")}</Th>
                <Th>Hospital</Th>
                <Th>{t("common.status")}</Th>
                <Th align="right">{t("common.actions")}</Th>
              </>
            }
            rows={past.map((a: any) => (
              <tr key={a.id}>
                <Td muted>{a.admittedAt ? formatDateTime(a.admittedAt, locale) : "—"}</Td>
                <Td>{a.reason ?? "—"}</Td>
                <Td muted>{a.wardName ?? "—"}</Td>
                <Td>
                  <SourceBadge name={a.hospitalName} isCurrent={a.hospitalId === currentHospitalId} />
                </Td>
                <Td>
                  <PillBadge tone={ADM_TONE[a.status] ?? "neutral"} className="text-[10px]">
                    {a.status}
                  </PillBadge>
                </Td>
                <Td align="right">
                  <Link
                    href={`/hospital/ipd/${a.id}`}
                    className="portal-btn portal-btn-ghost portal-btn-sm"
                  >
                    {t("patients.admissions.view")}
                    <ArrowRight size={13} />
                  </Link>
                </Td>
              </tr>
            ))}
          />
        </DetailCard>
      ) : null}
    </div>
  );
}

/* ─── Records ──────────────────────────────────────────── */

function RecordsTab({ data, locale, currentHospitalId }: { data: any; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const records = data.records ?? [];

  if (records.length === 0) {
    return <Empty title={t("patients.records.noRecords")} className="py-12" />;
  }

  return (
    <DetailCard title={t("patients.tabs.records")} icon={<FileText size={15} />}>
      <DetailTable
        columns={
          <>
            <Th>{t("common.date")}</Th>
            <Th>{t("patients.records.type")}</Th>
            <Th>{t("common.name")}</Th>
            <Th>{t("patients.records.doctor")}</Th>
            <Th>Hospital</Th>
          </>
        }
        rows={records.map((r: any) => (
          <tr key={r.id}>
            <Td muted>{r.date ? formatDate(r.date, locale) : "—"}</Td>
            <Td>
              <PillBadge tone={RECORD_TONE[r.recordType] ?? "neutral"} className="text-[10px]">
                {r.recordType.replace(/_/g, " ")}
              </PillBadge>
            </Td>
            <Td>
              <span className="font-semibold">{r.title}</span>
            </Td>
            <Td muted>{r.doctorName ?? "—"}</Td>
            <Td>
              <SourceBadge name={r.hospitalName} isCurrent={r.hospitalId === currentHospitalId} />
            </Td>
          </tr>
        ))}
      />
    </DetailCard>
  );
}

/* ─── Prescriptions ────────────────────────────────────── */

function PrescriptionsTab({ data, locale, currentHospitalId }: { data: any; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const list = data.prescriptions ?? [];

  if (list.length === 0) {
    return <Empty title={t("patients.prescriptions.noPrescriptions")} className="py-12" />;
  }

  return (
    <div className="hospital-detail-panel">
      {list.map((p: any) => (
        <article key={p.id} className="hospital-rx-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                <span>{p.date ? formatDate(p.date, locale) : "—"}</span>
                <span>·</span>
                <span>{p.doctorName ?? "—"}</span>
                <span>·</span>
                <SourceBadge name={p.hospitalName} isCurrent={p.hospitalId === currentHospitalId} />
              </div>
              <h3 className="mt-1 text-sm font-bold text-text">
                {p.diagnosis ?? t("patients.tabs.prescriptions")}
              </h3>
              {p.notes ? <p className="mt-1 text-xs text-text-muted">{p.notes}</p> : null}
            </div>
            <PillBadge tone={RX_TONE[p.status] ?? "neutral"} className="text-[10px] shrink-0">
              {p.status}
            </PillBadge>
          </div>
          {p.medicines?.length > 0 ? (
            <ul className="hospital-rx-med-list">
              {p.medicines.map((m: any) => (
                <li key={m.id} className="hospital-rx-med-item">
                  <PillIcon size={12} className="text-brand shrink-0" />
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-xs text-text-muted truncate">
                    {m.dosage}
                    {m.frequency ? ` · ${m.frequency}` : ""}
                    {m.timing ? ` · ${m.timing}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}

/* ─── Lab ──────────────────────────────────────────────── */

function LabTab({ data, locale, currentHospitalId }: { data: any; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const list = data.labOrders ?? [];

  if (list.length === 0) {
    return <Empty title={t("patients.lab.noOrders")} className="py-12" />;
  }

  return (
    <DetailCard title={t("patients.tabs.lab")} icon={<TestTube size={15} />}>
      <DetailTable
        columns={
          <>
            <Th>{t("patients.lab.orderedAt")}</Th>
            <Th>{t("patients.lab.tests")}</Th>
            <Th>{t("patients.records.doctor")}</Th>
            <Th>Hospital</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("patients.lab.completedAt")}</Th>
          </>
        }
        rows={list.map((o: any) => {
          let tests: string[] = [];
          try {
            tests = o.tests ? JSON.parse(o.tests) : [];
          } catch {
            tests = [o.tests];
          }
          return (
            <tr key={o.id}>
              <Td muted>{o.orderedAt ? formatDate(o.orderedAt, locale) : "—"}</Td>
              <Td>
                <span className="font-semibold">{tests.join(", ") || "—"}</span>
              </Td>
              <Td muted>{o.doctorName ?? "—"}</Td>
              <Td>
                <SourceBadge name={o.hospitalName} isCurrent={o.hospitalId === currentHospitalId} />
              </Td>
              <Td>
                <PillBadge tone={LAB_TONE[o.status] ?? "neutral"} className="text-[10px]">
                  {o.status.replace(/_/g, " ")}
                </PillBadge>
              </Td>
              <Td muted>{o.completedAt ? formatDate(o.completedAt, locale) : "—"}</Td>
            </tr>
          );
        })}
      />
    </DetailCard>
  );
}

/* ─── Vitals ───────────────────────────────────────────── */

function VitalsTab({ data, locale }: { data: any; locale: string }) {
  const t = useT();
  const latest = data.latestVitals ?? [];
  const alerts = data.vitalsAlerts ?? { count: 0, items: [] };

  if (latest.length === 0 && alerts.count === 0) {
    return <Empty title={t("patients.vitals.noVitals")} className="py-12" />;
  }

  return (
    <div className="hospital-detail-panel">
      {alerts.count > 0 ? (
        <DetailCard
          title={`${t("patients.vitals.alerts")} (${alerts.count})`}
          icon={<AlertCircle size={15} className="text-danger" />}
        >
          <ul>
            {alerts.items.map((a: any, i: number) => (
              <li key={i} className="hospital-alert-item">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{a.message ?? a.type ?? JSON.stringify(a)}</span>
              </li>
            ))}
          </ul>
        </DetailCard>
      ) : null}

      {latest.length > 0 ? (
        <DetailCard
          title={t("patients.vitals.latestByType")}
          icon={<Activity size={15} />}
        >
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {latest.map((v: any, i: number) => (
              <div key={i} className="hospital-vital-tile">
                <div className="hospital-vital-tile-label">{v.type}</div>
                <div className="hospital-vital-tile-value">
                  {v.value}
                  {v.unit ? (
                    <span className="text-xs font-semibold text-text-muted ml-1">{v.unit}</span>
                  ) : null}
                </div>
                {v.recordedAt ? (
                  <div className="text-[10px] text-text-muted mt-1">
                    {formatDateTime(v.recordedAt, locale)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </DetailCard>
      ) : null}
    </div>
  );
}
