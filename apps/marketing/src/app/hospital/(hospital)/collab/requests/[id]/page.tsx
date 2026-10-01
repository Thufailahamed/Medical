"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  FlaskConical,
  History,
  Pill,
  Share2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate, relativeTime } from "@/hospital/lib/format";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

interface RequestDetail {
  request: {
    id: string;
    status: string;
    scope: string;
    patientId: string;
    expiresAt?: string | null;
    createdAt: string;
    viewedCount?: number;
    reason?: string;
    declinedReason?: string | null;
  };
  requester?: { id: string; name: string } | null;
  source?: { id: string; name: string } | null;
  user?: { name?: string } | null;
}

interface EventItem {
  ev: { id: string; kind: string; createdAt: string };
  actor?: { name?: string } | null;
}

interface BundleData {
  admissions?: Record<string, unknown>[];
  records?: Record<string, unknown>[];
  prescriptions?: Record<string, unknown>[];
  labOrders?: Record<string, unknown>[];
}

export default function CollabRequestDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const myHospitalId = useAuthStore((s) => s.activeHospitalId);
  const locale = useAuthStore((s) => s.locale);

  const detail = useQuery({
    queryKey: ["hospital-share-requests", id],
    queryFn: () => api<RequestDetail>(`/hospital-share-requests/${id}`),
  });

  const events = useQuery({
    queryKey: ["hospital-share-requests", id, "events"],
    queryFn: () => api<{ items: EventItem[] }>(`/hospital-share-requests/${id}/events`),
  });

  const bundle = useQuery({
    queryKey: ["hospital-share-requests", id, "bundle"],
    queryFn: () => api<BundleData>(`/hospital-share-requests/${id}/bundle`),
    enabled: detail.data?.request?.status === "approved",
  });

  const approve = useMutation({
    mutationFn: () => api(`/hospital-share-requests/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });
  const decline = useMutation({
    mutationFn: (reason?: string) =>
      api(`/hospital-share-requests/${id}/decline`, {
        method: "POST",
        json: { reason: reason ?? "" },
      }),
    onSuccess: () => {
      toast.success("Declined");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });
  const revoke = useMutation({
    mutationFn: () => api(`/hospital-share-requests/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  if (detail.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        <PanelSkeleton rows={5} />
      </div>
    );
  }

  const d = detail.data;
  if (!d) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        <section className={PANEL}>
          <EmptyBlock icon={<FileText size={19} />} title="Not found" body="Request not found" />
        </section>
      </div>
    );
  }

  const req = d.request;
  const isIncoming = d.source?.id === myHospitalId;
  const showApproveButtons = isIncoming && req.status === "pending";
  const showRevokeButton =
    (isIncoming && req.status === "approved") ||
    (!isIncoming && (req.status === "approved" || req.status === "pending"));

  const bundleItemCount =
    (bundle.data?.admissions?.length ?? 0) +
    (bundle.data?.records?.length ?? 0) +
    (bundle.data?.prescriptions?.length ?? 0) +
    (bundle.data?.labOrders?.length ?? 0);

  const hero = (
    <DoctorHero
      kickerIcon={<Share2 size={13} aria-hidden />}
      kicker={t("collab.tabs.requests")}
      kickerMeta={req.status.replace("_", " ")}
      title={
        <>
          {d.user?.name ?? "Patient"}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · {t("patients.mrn")} {req.patientId.slice(0, 8)}…
          </span>
        </>
      }
      description={`${d.requester?.name ?? "—"} → ${d.source?.name ?? "—"} · ${req.scope} scope`}
      chips={
        <>
          <span className={HERO_CHIP}>
            <ShieldCheck size={12} className="text-emerald-300" />
            {t(`collab.requests.status.${req.status}`)}
          </span>
          <span className={HERO_CHIP}>
            <Clock size={12} className="text-amber-300" />
            {req.expiresAt ? formatDate(req.expiresAt, locale) : "—"}
          </span>
          <span className={HERO_CHIP}>
            <Eye size={12} className="text-sky-300" />
            {req.viewedCount ?? 0} views
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<FileText size={18} />}
          label={t(`collab.requests.status.${req.status}`)}
          value={req.status.replace("_", " ")}
          sub={`${bundleItemCount} bundle items`}
        />
      }
      actions={
        <>
          <Link href="/hospital/collab/requests" className={HERO_GHOST}>
            <ArrowLeft size={14} />
            {t("common.back")}
          </Link>
          {showApproveButtons ? (
            <>
              <button
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className={HERO_PRIMARY}
              >
                <CheckCircle2 size={14} className="text-emerald-600" />
                {t("collab.requests.actions.approve")}
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt("Decline reason (optional):");
                  if (reason === null) return;
                  decline.mutate(reason);
                }}
                disabled={decline.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25"
              >
                <XCircle size={14} />
                {t("collab.requests.actions.decline")}
              </button>
            </>
          ) : null}
          {showRevokeButton ? (
            <button
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25"
            >
              <XCircle size={14} />
              {t("collab.requests.actions.revoke")}
            </button>
          ) : null}
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<ShieldCheck size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("common.status")}
          value={req.status.replace("_", " ")}
          sub={t("collab.tabs.requests")}
        />
        <StatTile
          icon={<Building2 size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("collab.requests.form.scope")}
          value={req.scope}
          sub="Data shared"
        />
        <StatTile
          icon={<Clock size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Expires"
          value={req.expiresAt ? formatDate(req.expiresAt, locale) : "—"}
          sub="Access window"
        />
        <StatTile
          icon={<Eye size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Views"
          value={String(req.viewedCount ?? 0)}
          sub="Bundle opens"
        />
      </HeroOverlap>

      {req.status === "approved" && req.expiresAt && new Date(req.expiresAt) > new Date() ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <ShieldCheck size={18} className="shrink-0 text-emerald-600" />
          <p className="flex-1 text-sm font-medium text-emerald-900">
            {t("collab.requests.banner", { when: relativeTime(req.expiresAt, locale) })}
          </p>
          <button
            type="button"
            onClick={() =>
              document.getElementById("patient-bundle")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            {t("collab.requests.actions.viewBundle")}
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Request details"
            caption={`${t("common.date")} · ${formatDate(req.createdAt, locale)}`}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailTile label="Requester hospital" value={d.requester?.name ?? "—"} />
            <DetailTile label="Source hospital" value={d.source?.name ?? "—"} />
            <DetailTile
              label="Scope"
              value={
                <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase", TONE_BADGE.sky)}>
                  {req.scope}
                </span>
              }
            />
            <DetailTile label="Expires" value={req.expiresAt ? formatDate(req.expiresAt, locale) : "—"} />
            <DetailTile label="Created" value={formatDate(req.createdAt, locale)} />
            <DetailTile label="Views" value={String(req.viewedCount ?? 0)} />
          </div>
          {req.reason ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("collab.requests.form.reason")}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{req.reason}</p>
            </div>
          ) : null}
          {req.declinedReason ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500">{t("collab.requests.declinedReason")}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-rose-800">{req.declinedReason}</p>
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<History size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Activity"
              caption={String(events.data?.items?.length ?? 0)}
            />
            {events.isLoading ? (
              <PanelSkeleton rows={3} className="mt-4" />
            ) : events.data?.items?.length ? (
              <ul className="mt-4 flex flex-col gap-2">
                {events.data.items.map((ev) => (
                  <li key={ev.ev.id}>
                    <RailRow
                      tone="slate"
                      icon={<Clock size={14} />}
                      title={ev.ev.kind}
                      meta={`${ev.actor?.name ?? "system"} · ${relativeTime(ev.ev.createdAt, locale)}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyBlock icon={<History size={19} />} title="No activity yet" body="Events will appear here." />
            )}
          </section>
          <QuickToolsPanel
            id="request-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: FileText, label: t("collab.tabs.requests"), hint: "All requests", href: "/hospital/collab/requests", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Share2, label: t("collab.tabs.referrals"), hint: "Cross-hospital", href: "/hospital/collab/referrals", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
            ]}
          />
        </aside>
      </div>

      {req.status === "approved" ? (
        <div id="patient-bundle">
          <BundleSection bundle={bundle} locale={locale} />
        </div>
      ) : null}
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function BundleSection({
  bundle,
  locale,
}: {
  bundle: { isLoading: boolean; error: unknown; data?: BundleData };
  locale: string;
}) {
  if (bundle.isLoading) {
    return <PanelSkeleton rows={6} />;
  }
  if (bundle.error) {
    return (
      <section className={PANEL}>
        <EmptyBlock
          icon={<ShieldCheck size={19} />}
          title="Bundle unavailable"
          body="Access may have expired. Open the request again to check."
        />
      </section>
    );
  }
  const data = bundle.data;
  if (!data) return null;

  const sections: {
    key: keyof BundleData;
    title: string;
    icon: React.ReactNode;
    tone: string;
    rail: "sky" | "emerald" | "amber" | "violet";
    rows?: Record<string, unknown>[];
    columns: string[];
  }[] = [
    {
      key: "admissions",
      title: "Admissions",
      icon: <History size={16} />,
      tone: "bg-violet-50 text-violet-600",
      rail: "violet",
      rows: data.admissions,
      columns: ["admittedAt", "reason", "dischargeDiagnosis", "status"],
    },
    {
      key: "records",
      title: "Medical records",
      icon: <FileText size={16} />,
      tone: "bg-sky-50 text-sky-600",
      rail: "sky",
      rows: data.records,
      columns: ["date", "recordType", "title"],
    },
    {
      key: "prescriptions",
      title: "Prescriptions",
      icon: <Pill size={16} />,
      tone: "bg-amber-50 text-amber-600",
      rail: "amber",
      rows: data.prescriptions,
      columns: ["createdAt", "diagnosis", "status"],
    },
    {
      key: "labOrders",
      title: "Lab orders",
      icon: <FlaskConical size={16} />,
      tone: "bg-emerald-50 text-emerald-600",
      rail: "emerald",
      rows: data.labOrders,
      columns: ["orderedAt", "tests", "status"],
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {sections.map((s) => {
        if (!s.rows || s.rows.length === 0) return null;
        return (
          <section key={s.key} className={PANEL}>
            <PanelHeader
              icon={s.icon}
              tone={s.tone}
              title={s.title}
              caption={`${s.rows.length} item${s.rows.length === 1 ? "" : "s"}`}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[color:var(--ink-border)] text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {s.columns.map((c) => (
                      <th key={c} className="py-2 pr-3">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, idx) => (
                    <tr key={idx} className="border-b border-[color:var(--ink-border)] last:border-0">
                      {s.columns.map((c) => (
                        <td key={c} className="py-2.5 pr-3 text-slate-700">
                          {formatBundleCell(c, r[c], locale)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function formatBundleCell(key: string, value: unknown, locale: string) {
  if (value == null) return "—";
  if (key === "status" || key === "recordType") {
    return (
      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase", TONE_BADGE.slate)}>
        {String(value)}
      </span>
    );
  }
  if (
    key === "admittedAt" ||
    key === "date" ||
    key === "createdAt" ||
    key === "orderedAt"
  ) {
    return formatDate(String(value), locale);
  }
  if (key === "tests" && Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}
