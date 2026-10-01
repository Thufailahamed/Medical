"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Building2,
  FileText,
  FlaskConical,
  Heart,
  Pill as PillIcon,
  Printer,
  ShieldAlert,
  Stethoscope,
  TestTube,
  User,
  UserCheck,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate, formatDateTime } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  PANEL,
  PanelHeader,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HERO_DANGER_CHIP,
  HeroPulse,
  HeroTile,
  TONE_BADGE,
} from "@/patient/components/workspace";

type Tab = "overview" | "admissions" | "records" | "prescriptions" | "lab" | "vitals";

const TABS: Tab[] = ["overview", "admissions", "records", "prescriptions", "lab", "vitals"];

const ADM_BADGE: Record<string, string> = {
  admitted: TONE_BADGE.amber,
  discharged: TONE_BADGE.emerald,
  transferred: TONE_BADGE.slate,
  dama: TONE_BADGE.slate,
  deceased: TONE_BADGE.rose,
};

const RX_BADGE: Record<string, string> = {
  draft: TONE_BADGE.slate,
  signed: TONE_BADGE.sky,
  dispensed: TONE_BADGE.emerald,
  cancelled: TONE_BADGE.rose,
};

const LAB_BADGE: Record<string, string> = {
  ordered: TONE_BADGE.sky,
  sample_collected: TONE_BADGE.amber,
  in_progress: TONE_BADGE.amber,
  completed: TONE_BADGE.emerald,
  cancelled: TONE_BADGE.rose,
};

const RECORD_BADGE: Record<string, string> = {
  hospital_visit: TONE_BADGE.sky,
  discharge_summary: TONE_BADGE.emerald,
  clinical_note: TONE_BADGE.slate,
  lab_report: TONE_BADGE.violet,
  imaging: TONE_BADGE.sky,
  prescription: TONE_BADGE.emerald,
  vaccination: TONE_BADGE.emerald,
  surgery: TONE_BADGE.amber,
  operation_note: TONE_BADGE.amber,
  insurance: TONE_BADGE.slate,
  allergy: TONE_BADGE.rose,
  follow_up: TONE_BADGE.sky,
  medical_certificate: TONE_BADGE.slate,
  other: TONE_BADGE.slate,
};

type AdmissionRow = {
  id: string;
  wardName?: string | null;
  reason?: string | null;
  admittedAt?: string | null;
  admissionType?: string | null;
  status?: string;
  hospitalName?: string | null;
  hospitalId?: string | null;
};

type RecordRow = {
  id: string;
  date?: string | null;
  recordType?: string;
  title?: string;
  doctorName?: string | null;
  hospitalName?: string | null;
  hospitalId?: string | null;
};

type RxMedicine = {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
};

type RxRow = {
  id: string;
  date?: string | null;
  doctorName?: string | null;
  hospitalName?: string | null;
  hospitalId?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  status?: string;
  medicines?: RxMedicine[];
};

type LabOrderRow = {
  id: string;
  orderedAt?: string | null;
  completedAt?: string | null;
  tests?: string | null;
  doctorName?: string | null;
  hospitalName?: string | null;
  hospitalId?: string | null;
  status?: string;
};

type VitalRow = {
  type?: string;
  value?: string | number;
  unit?: string;
  recordedAt?: string | null;
};

type VitalsAlert = { message?: string; type?: string };

type DoctorLink = {
  id: string;
  doctorName?: string | null;
  isPrimary?: boolean;
  hospitalName?: string | null;
  contextId?: string | null;
  relationshipKind?: string;
};

type Patient360 = {
  patient: {
    gender?: string | null;
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
    emergencyContacts?: string | null;
  } | null;
  user: { name?: string | null; phone?: string | null; email?: string | null } | null;
  registration: {
    mrn?: string | null;
    status?: string;
    registeredAt?: string | null;
    dischargedAt?: string | null;
  } | null;
  admission: AdmissionRow | null;
  admissions: AdmissionRow[];
  records: RecordRow[];
  prescriptions: RxRow[];
  labOrders: LabOrderRow[];
  vitals: VitalRow[];
  latestVitals: VitalRow[];
  vitalsAlerts: { count: number; items: VitalsAlert[] };
  doctors: DoctorLink[];
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
    queryFn: () => api<Patient360>(`/hospital-portal/patients/${id}`),
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

  const hero = (
    <DoctorHero
      kickerIcon={<User size={13} aria-hidden />}
      kicker={t("patients.directory")}
      kickerMeta="Patient 360"
      leading={
        <HeroTile tone="from-emerald-400 to-teal-600">
          <span className="text-2xl font-bold">{patientInitials(user?.name)}</span>
        </HeroTile>
      }
      title={
        <>
          {user?.name ?? (q.isLoading ? "…" : "—")}{" "}
          {reg?.mrn ? (
            <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text font-mono text-[0.6em] text-transparent">
              · {reg.mrn}
            </span>
          ) : null}
        </>
      }
      description={
        user?.phone || user?.email
          ? [user?.phone, user?.email].filter(Boolean).join(" · ")
          : t("reception.patientsSubtitle")
      }
      chips={
        <>
          {reg ? (
            <span className={HERO_CHIP}>
              <Building2 size={12} className="text-sky-300" />
              {regStatusLabel(reg.status, t)}
            </span>
          ) : null}
          {data?.admission ? (
            <span className={HERO_CHIP}>
              <BedDouble size={12} className="text-amber-300" />
              {t("patients.admitted")} · {data.admission.wardName ?? ""}
            </span>
          ) : null}
          {data?.vitalsAlerts?.count ? (
            <span className={HERO_DANGER_CHIP}>
              <ShieldAlert size={12} />
              {data.vitalsAlerts.count} {t("patients.vitals.alerts").toLowerCase()}
            </span>
          ) : null}
        </>
      }
      aside={
        data ? (
          <HeroPulse
            icon={<Heart size={18} />}
            label={t("patients.overview.admission")}
            value={data.admission ? t("patients.admitted") : t("patients.notAdmitted")}
            sub={data.admission?.wardName ?? regStatusLabel(reg?.status, t)}
          />
        ) : undefined
      }
      actions={
        <>
          <Link href="/hospital/reception/patients" className={HERO_GHOST}>
            <ArrowLeft size={13} /> {t("common.back")}
          </Link>
          <button
            type="button"
            className={HERO_GHOST}
            onClick={() => window.print()}
          >
            <Printer size={13} /> {t("patients.actions.print")}
          </button>
        </>
      }
    />
  );

  if (q.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        {hero}
        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </HeroOverlap>
      </div>
    );
  }

  if (q.isError || !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        {hero}
        <section className={PANEL}>
          <EmptyBlock
            icon={<User size={19} />}
            title={t("errors.notFound")}
            body="This patient record could not be loaded — it may belong to another facility."
            actions={
              <Link
                href="/hospital/reception/patients"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <ArrowLeft size={13} /> {t("common.back")}
              </Link>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<BedDouble size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("patients.tabs.admissions")}
          value={String(tabCounts.admissions ?? 0)}
          sub={data.admission ? data.admission.wardName ?? t("patients.admitted") : t("patients.notAdmitted")}
          active={tab === "admissions"}
          onClick={() => setTab("admissions")}
        />
        <StatTile
          icon={<FileText size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("patients.tabs.records")}
          value={String(tabCounts.records ?? 0)}
          sub="Clinical documents"
          active={tab === "records"}
          onClick={() => setTab("records")}
        />
        <StatTile
          icon={<PillIcon size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("patients.tabs.prescriptions")}
          value={String(tabCounts.prescriptions ?? 0)}
          sub="Issued at facilities"
          active={tab === "prescriptions"}
          onClick={() => setTab("prescriptions")}
        />
        <StatTile
          icon={<FlaskConical size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("patients.tabs.lab")}
          value={String(tabCounts.lab ?? 0)}
          sub="Orders & results"
          active={tab === "lab"}
          onClick={() => setTab("lab")}
          pulse={(data.vitalsAlerts?.count ?? 0) > 0}
        />
      </HeroOverlap>

      <div className="flex flex-col gap-5">
        <div className="no-print">
          <Segmented<Tab>
            ariaLabel="Patient record sections"
            value={tab}
            onChange={setTab}
            options={TABS.map((key) => ({
              value: key,
              label: tabLabels[key],
              count: key === "overview" ? undefined : tabCounts[key],
            }))}
          />
        </div>

        <div role="tabpanel">
          {tab === "overview" && (
            <OverviewTab data={data} locale={locale} currentHospitalId={activeHospitalId ?? null} />
          )}
          {tab === "admissions" && (
            <AdmissionsTab data={data} locale={locale} currentHospitalId={activeHospitalId ?? null} />
          )}
          {tab === "records" && (
            <RecordsTab data={data} locale={locale} currentHospitalId={activeHospitalId ?? null} />
          )}
          {tab === "prescriptions" && (
            <PrescriptionsTab data={data} locale={locale} currentHospitalId={activeHospitalId ?? null} />
          )}
          {tab === "lab" && (
            <LabTab data={data} locale={locale} currentHospitalId={activeHospitalId ?? null} />
          )}
          {tab === "vitals" && <VitalsTab data={data} locale={locale} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared pieces ────────────────────────────────────── */

function DetailCard({
  title,
  icon,
  tone = "bg-sky-50 text-sky-600",
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={PANEL}>
      <PanelHeader icon={icon} tone={tone} title={title} action={action} />
      <div className="mt-4">{children}</div>
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
  value: React.ReactNode;
  mono?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={cn("rounded-xl bg-slate-50 p-3.5", span2 && "sm:col-span-2")}>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-medium text-slate-900", mono && "font-mono text-[13px]")}>
        {value || "—"}
      </p>
    </div>
  );
}

function SourceBadge({ name, isCurrent }: { name?: string | null; isCurrent?: boolean }) {
  if (!name) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        isCurrent
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500",
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
    <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {columns}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{rows}</tbody>
      </table>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className={cn("py-2.5 pr-4 last:pr-0", align === "right" && "text-right")}>
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
      className={cn(
        "py-3 pr-4 align-middle last:pr-0",
        muted ? "text-slate-400" : "text-slate-700",
        align === "right" && "text-right",
      )}
    >
      {children}
    </td>
  );
}

/* ─── Overview ─────────────────────────────────────────── */

function OverviewTab({ data, locale, currentHospitalId }: { data: Patient360; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const p = data.patient;
  const u = data.user;
  const reg = data.registration;
  const adm = data.admission;
  const docs = data.doctors ?? [];

  const address = (() => {
    try {
      const ec = p?.emergencyContacts ? JSON.parse(p.emergencyContacts) : null;
      const note = Array.isArray(ec) ? ec.find((x: { type?: string; value?: string }) => x?.type === "note") : null;
      return note?.value ?? null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <DetailCard
        title={t("patients.overview.profile")}
        icon={<User size={16} />}
        tone="bg-sky-50 text-sky-600"
      >
        <div className="grid gap-2 sm:grid-cols-2">
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
        icon={<Building2 size={16} />}
        tone="bg-violet-50 text-violet-600"
      >
        <div className="grid gap-2 sm:grid-cols-2">
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
        icon={<Heart size={16} />}
        tone="bg-amber-50 text-amber-600"
        action={
          adm ? (
            <Link
              href={`/hospital/ipd/${adm.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
            >
              {t("patients.admissions.view")}
              <ArrowRight size={13} aria-hidden />
            </Link>
          ) : null
        }
      >
        {adm ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailField label={t("patients.admissions.ward")} value={adm.wardName} />
            <DetailField label={t("patients.admissions.reason")} value={adm.reason} />
            <DetailField
              label={t("common.from")}
              value={adm.admittedAt ? formatDateTime(adm.admittedAt, locale) : null}
            />
            <DetailField label={t("common.status")} value={adm.admissionType} />
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">
            {t("patients.overview.noAdmission")}
          </p>
        )}
      </DetailCard>

      <DetailCard
        title={t("patients.overview.doctors")}
        icon={<Stethoscope size={16} />}
        tone="bg-emerald-50 text-emerald-600"
      >
        {docs.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">
            {t("patients.overview.noDoctors")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <UserCheck size={14} className="shrink-0 text-emerald-600" />
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {d.doctorName ?? "—"}
                  </span>
                  {d.isPrimary ? (
                    <PillBadge tone="brand" className="shrink-0 text-[10px]">
                      {t("patients.overview.primary")}
                    </PillBadge>
                  ) : null}
                  <SourceBadge name={d.hospitalName} isCurrent={d.contextId === currentHospitalId} />
                </div>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">
                  {d.relationshipKind}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailCard>
    </div>
  );
}

/* ─── Admissions ───────────────────────────────────────── */

function AdmissionsTab({ data, locale, currentHospitalId }: { data: Patient360; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const adm = data.admission;
  const past = data.admissions ?? [];

  if (!adm && past.length === 0) {
    return (
      <section className={PANEL}>
        <EmptyBlock
          icon={<BedDouble size={19} />}
          title={t("patients.admissions.noAdmissions")}
          body="Ward admissions at this facility will appear here."
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {adm ? (
        <DetailCard
          title={t("patients.overview.admission")}
          icon={<Heart size={16} />}
          tone="bg-amber-50 text-amber-600"
          action={
            <Link
              href={`/hospital/ipd/${adm.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
            >
              {t("patients.admissions.view")}
              <ArrowRight size={13} aria-hidden />
            </Link>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
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
        <DetailCard
          title={t("patients.tabs.admissions")}
          icon={<FileText size={16} />}
          tone="bg-sky-50 text-sky-600"
        >
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
            rows={past.map((a) => (
              <tr key={a.id}>
                <Td muted>{a.admittedAt ? formatDateTime(a.admittedAt, locale) : "—"}</Td>
                <Td>{a.reason ?? "—"}</Td>
                <Td muted>{a.wardName ?? "—"}</Td>
                <Td>
                  <SourceBadge name={a.hospitalName} isCurrent={a.hospitalId === currentHospitalId} />
                </Td>
                <Td>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                      ADM_BADGE[a.status ?? ""] ?? TONE_BADGE.slate,
                    )}
                  >
                    {a.status}
                  </span>
                </Td>
                <Td align="right">
                  <Link
                    href={`/hospital/ipd/${a.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                  >
                    {t("patients.admissions.view")}
                    <ArrowRight size={13} aria-hidden />
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

function RecordsTab({ data, locale, currentHospitalId }: { data: Patient360; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const records = data.records ?? [];

  if (records.length === 0) {
    return (
      <section className={PANEL}>
        <EmptyBlock
          icon={<FileText size={19} />}
          title={t("patients.records.noRecords")}
          body="Clinical documents filed for this patient will appear here."
        />
      </section>
    );
  }

  return (
    <DetailCard
      title={t("patients.tabs.records")}
      icon={<FileText size={16} />}
      tone="bg-sky-50 text-sky-600"
    >
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
        rows={records.map((r) => (
          <tr key={r.id}>
            <Td muted>{r.date ? formatDate(r.date, locale) : "—"}</Td>
            <Td>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                  RECORD_BADGE[r.recordType ?? ""] ?? TONE_BADGE.slate,
                )}
              >
                {(r.recordType ?? "other").replace(/_/g, " ")}
              </span>
            </Td>
            <Td>
              <span className="font-semibold text-slate-900">{r.title}</span>
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

function PrescriptionsTab({ data, locale, currentHospitalId }: { data: Patient360; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const list = data.prescriptions ?? [];

  if (list.length === 0) {
    return (
      <section className={PANEL}>
        <EmptyBlock
          icon={<PillIcon size={19} />}
          title={t("patients.prescriptions.noPrescriptions")}
          body="Prescriptions issued for this patient will appear here."
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {list.map((p) => (
        <section key={p.id} className={PANEL}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                <span>{p.date ? formatDate(p.date, locale) : "—"}</span>
                <span>·</span>
                <span>{p.doctorName ?? "—"}</span>
                <span>·</span>
                <SourceBadge name={p.hospitalName} isCurrent={p.hospitalId === currentHospitalId} />
              </div>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">
                {p.diagnosis ?? t("patients.tabs.prescriptions")}
              </h3>
              {p.notes ? <p className="mt-1 text-xs text-slate-400">{p.notes}</p> : null}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                RX_BADGE[p.status ?? ""] ?? TONE_BADGE.slate,
              )}
            >
              {p.status}
            </span>
          </div>
          {(p.medicines?.length ?? 0) > 0 ? (
            <ul className="mt-4 flex flex-col gap-1.5">
              {(p.medicines ?? []).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <PillIcon size={12} className="shrink-0 text-emerald-600" />
                  <span className="font-semibold text-slate-900">{m.name}</span>
                  <span className="truncate text-xs text-slate-400">
                    {m.dosage}
                    {m.frequency ? ` · ${m.frequency}` : ""}
                    {m.timing ? ` · ${m.timing}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/* ─── Lab ──────────────────────────────────────────────── */

function LabTab({ data, locale, currentHospitalId }: { data: Patient360; locale: string; currentHospitalId: string | null }) {
  const t = useT();
  const list = data.labOrders ?? [];

  if (list.length === 0) {
    return (
      <section className={PANEL}>
        <EmptyBlock
          icon={<TestTube size={19} />}
          title={t("patients.lab.noOrders")}
          body="Lab orders for this patient will appear here."
        />
      </section>
    );
  }

  return (
    <DetailCard
      title={t("patients.tabs.lab")}
      icon={<TestTube size={16} />}
      tone="bg-violet-50 text-violet-600"
    >
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
        rows={list.map((o) => {
          let tests: string[] = [];
          try {
            tests = o.tests ? JSON.parse(o.tests) : [];
          } catch {
            tests = typeof o.tests === "string" ? [o.tests] : [];
          }
          return (
            <tr key={o.id}>
              <Td muted>{o.orderedAt ? formatDate(o.orderedAt, locale) : "—"}</Td>
              <Td>
                <span className="font-semibold text-slate-900">{tests.join(", ") || "—"}</span>
              </Td>
              <Td muted>{o.doctorName ?? "—"}</Td>
              <Td>
                <SourceBadge name={o.hospitalName} isCurrent={o.hospitalId === currentHospitalId} />
              </Td>
              <Td>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                    LAB_BADGE[o.status ?? ""] ?? TONE_BADGE.slate,
                  )}
                >
                  {(o.status ?? "ordered").replace(/_/g, " ")}
                </span>
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

function VitalsTab({ data, locale }: { data: Patient360; locale: string }) {
  const t = useT();
  const latest = data.latestVitals ?? [];
  const alerts = data.vitalsAlerts ?? { count: 0, items: [] };

  if (latest.length === 0 && alerts.count === 0) {
    return (
      <section className={PANEL}>
        <EmptyBlock
          icon={<Activity size={19} />}
          title={t("patients.vitals.noVitals")}
          body="Vital signs captured during visits will appear here."
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {alerts.count > 0 ? (
        <DetailCard
          title={`${t("patients.vitals.alerts")} (${alerts.count})`}
          icon={<AlertCircle size={16} />}
          tone="bg-rose-50 text-rose-600"
        >
          <ul className="flex flex-col gap-2">
            {alerts.items.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-xl bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-800"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{a.message ?? a.type ?? JSON.stringify(a)}</span>
              </li>
            ))}
          </ul>
        </DetailCard>
      ) : null}

      {latest.length > 0 ? (
        <DetailCard
          title={t("patients.vitals.latestByType")}
          icon={<Activity size={16} />}
          tone="bg-emerald-50 text-emerald-600"
        >
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {latest.map((v, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3.5">
                <div className="text-[11px] font-medium capitalize text-slate-400">
                  {(v.type ?? "vital").replace(/_/g, " ")}
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {v.value}
                  {v.unit ? (
                    <span className="ml-1 text-xs font-semibold text-slate-400">{v.unit}</span>
                  ) : null}
                </div>
                {v.recordedAt ? (
                  <div className="mt-1 text-[10px] text-slate-400">
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
