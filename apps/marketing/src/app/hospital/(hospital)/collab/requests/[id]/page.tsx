"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Pill,
  FlaskConical,
  History,
  ShieldCheck,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate, relativeTime } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";
import { toast } from "@/portal/components/ui/Toast";

const STATUS_TONE: Record<string, "info" | "success" | "warn" | "danger" | "neutral"> = {
  pending: "warn",
  approved: "success",
  declined: "danger",
  expired: "neutral",
  revoked: "neutral",
};

export default function CollabRequestDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const myHospitalId = useAuthStore((s) => s.activeHospitalId);
  const locale = useAuthStore((s) => s.locale);

  const detail = useQuery({
    queryKey: ["hospital-share-requests", id],
    queryFn: () => api<any>(`/hospital-share-requests/${id}`),
  });

  const events = useQuery({
    queryKey: ["hospital-share-requests", id, "events"],
    queryFn: () => api<{ items: any[] }>(`/hospital-share-requests/${id}/events`),
  });

  const bundle = useQuery({
    queryKey: ["hospital-share-requests", id, "bundle"],
    queryFn: () => api<any>(`/hospital-share-requests/${id}/bundle`),
    enabled: detail.data?.request?.status === "approved",
  });

  const approve = useMutation({
    mutationFn: () => api(`/hospital-share-requests/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
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
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const revoke = useMutation({
    mutationFn: () => api(`/hospital-share-requests/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const d = detail.data;
  if (!d) return <Empty title="Not found" description="Request not found" className="py-12" />;
  const req = d.request;
  const isIncoming = d.source?.id === myHospitalId;
  const showApproveButtons = isIncoming && req.status === "pending";
  const showRevokeButton =
    (isIncoming && req.status === "approved") ||
    (!isIncoming && (req.status === "approved" || req.status === "pending"));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/hospital/collab/requests"
          className="text-xs text-text-muted hover:text-text inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} />
          Back to requests
        </Link>
      </div>

      <PageHeader
        title={d.user?.name ?? "Patient"}
        subtitle={`${t("patients.mrn")}: ${req.patientId.slice(0, 8)}…`}
        icon={<Building2 size={18} className="text-brand" />}
        actions={
          <div className="flex items-center gap-2">
            <PillBadge tone={STATUS_TONE[req.status] ?? "neutral"}>
              {t(`collab.requests.status.${req.status}`)}
            </PillBadge>
            {showApproveButtons ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending}
                >
                  <CheckCircle2 size={14} className="mr-1.5" />
                  {t("collab.requests.actions.approve")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt("Decline reason (optional):");
                    if (reason === null) return;
                    decline.mutate(reason);
                  }}
                  disabled={decline.isPending}
                >
                  <XCircle size={14} className="mr-1.5" />
                  {t("collab.requests.actions.decline")}
                </Button>
              </>
            ) : null}
            {showRevokeButton ? (
              <Button
                variant="ghost"
                onClick={() => revoke.mutate()}
                disabled={revoke.isPending}
                className="text-danger"
              >
                {t("collab.requests.actions.revoke")}
              </Button>
            ) : null}
          </div>
        }
      />

      {req.status === "approved" && new Date(req.expiresAt) > new Date() ? (
        <Card className="border border-success/30 bg-success-soft">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className="text-success" />
            <div className="flex-1 text-sm">
              {t("collab.requests.banner", {
                when: relativeTime(req.expiresAt, locale),
              })}
            </div>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("patient-bundle")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="portal-btn portal-btn-primary portal-btn-sm"
            >
              {t("collab.requests.actions.viewBundle")}
            </button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Request details" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Row label="Requester hospital" value={d.requester?.name ?? "—"} />
            <Row label="Source hospital" value={d.source?.name ?? "—"} />
            <Row label="Scope" value={<PillBadge tone="info">{req.scope}</PillBadge>} />
            <Row
              label="Expires"
              value={
                <span className="text-text-muted">
                  {formatDate(req.expiresAt, locale)}
                </span>
              }
            />
            <Row label="Created" value={formatDate(req.createdAt, locale)} />
            <Row
              label="Views"
              value={<span className="text-text-muted">{req.viewedCount ?? 0}</span>}
            />
            <Row
              label="Reason"
              value={
                <span className="text-text-soft whitespace-pre-wrap">{req.reason}</span>
              }
              full
            />
            {req.declinedReason ? (
              <Row
                label={t("collab.requests.declinedReason")}
                value={<span className="text-danger">{req.declinedReason}</span>}
                full
              />
            ) : null}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Activity" />
          {events.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : events.data?.items?.length ? (
            <ol className="space-y-3">
              {events.data.items.map((ev: any) => (
                <li key={ev.ev.id} className="flex items-start gap-2 text-sm">
                  <Clock size={14} className="text-text-muted mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{ev.ev.kind}</div>
                    <div className="text-[11px] text-text-muted">
                      {ev.actor?.name ?? "system"} · {relativeTime(ev.ev.createdAt, locale)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="No activity yet" className="py-8" />
          )}
        </Card>
      </div>

      {req.status === "approved" ? (
        <div id="patient-bundle">
          <BundleSection bundle={bundle} locale={locale} />
        </div>
      ) : null}
    </div>
  );
}

function BundleSection({
  bundle,
  locale,
}: {
  bundle: any;
  locale: string;
}) {
  const t = useT();
  if (bundle.isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }
  if (bundle.error) {
    return (
      <Card>
        <Empty
          title="Bundle unavailable"
          description="Access may have expired. Open the request again to check."
          icon={<ShieldCheck size={22} className="text-text-muted" />}
          className="py-8"
        />
      </Card>
    );
  }
  const data = bundle.data;
  if (!data) return null;
  const sections = [
    {
      key: "admissions",
      title: "Admissions",
      icon: History,
      rows: data.admissions,
      columns: ["admittedAt", "reason", "dischargeDiagnosis", "status"],
    },
    {
      key: "records",
      title: "Medical records",
      icon: FileText,
      rows: data.records,
      columns: ["date", "recordType", "title"],
    },
    {
      key: "prescriptions",
      title: "Prescriptions",
      icon: Pill,
      rows: data.prescriptions,
      columns: ["createdAt", "diagnosis", "status"],
    },
    {
      key: "labOrders",
      title: "Lab orders",
      icon: FlaskConical,
      rows: data.labOrders,
      columns: ["orderedAt", "tests", "status"],
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {sections.map((s) => {
        if (!s.rows || s.rows.length === 0) return null;
        const Icon = s.icon;
        return (
          <Card key={s.key} padding={false}>
            <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
              <Icon size={16} className="text-brand" />
              <h3 className="font-semibold text-text">{s.title}</h3>
              <span className="text-[11px] text-text-muted ml-2">
                {s.rows.length} item{s.rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="px-1 pb-1">
              <Table className="border-0 rounded-none shadow-none">
                <THead>
                  <TR>
                    {s.columns.map((c) => (
                      <TH key={c}>{c}</TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {s.rows.map((r: any, idx: number) => (
                    <TR key={idx}>
                      {s.columns.map((c) => (
                        <TD key={c} className="text-xs">
                          {formatBundleCell(c, r[c], locale)}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function formatBundleCell(key: string, value: any, locale: string) {
  if (value == null) return "—";
  if (key === "status" || key === "recordType") {
    return <PillBadge tone="neutral">{String(value)}</PillBadge>;
  }
  if (
    key === "admittedAt" ||
    key === "date" ||
    key === "createdAt" ||
    key === "orderedAt"
  ) {
    return formatDate(value, locale);
  }
  if (key === "tests" && Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function Row({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <>
      <dt className="text-xs font-semibold text-text-muted uppercase tracking-wide">
        {label}
      </dt>
      <dd className={cn("text-sm", full && "col-span-1")}>{value}</dd>
      {full ? <div /> : null}
    </>
  );
}
