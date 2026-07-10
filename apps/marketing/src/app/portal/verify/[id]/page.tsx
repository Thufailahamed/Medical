"use client";

/**
 * /portal/verify/[id] — public verify view without portal chrome.
 * Calls GET /verify/:prescriptionId (no auth required).
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Copy,
  Globe,
  Hash,
  Pill,
  ShieldCheck,
  ShieldX,
  Stethoscope,
} from "lucide-react";

import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { API_URL } from "@/portal/lib/api";
import { formatDateTime } from "@/portal/lib/format";
import { useT } from "@/portal/i18n";
import { useAuthStore } from "@/portal/stores/auth";

interface VerifyResponse {
  valid: boolean;
  reason?: string;
  prescriptionId: string;
  signedAt?: string;
  payloadHash?: string;
  doctor?: {
    name: string;
    slmcRegistrationNo: string | null;
    specialization: string | null;
  } | null;
  medicines?: Array<{
    name: string;
    dosage?: string | null;
    frequency?: string | null;
    timing?: string | null;
  }>;
}

async function verifyFetch(id: string): Promise<VerifyResponse> {
  const res = await fetch(`${API_URL}/verify/${id}`);
  if (res.status === 404) {
    return { valid: false, reason: "not_found", prescriptionId: id };
  }
  if (!res.ok) {
    return { valid: false, reason: "error", prescriptionId: id };
  }
  return res.json();
}

function humanize(value?: string | null) {
  if (!value) return null;
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PortalVerifyPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error } = useQuery({
    queryKey: ["verify", id],
    queryFn: () => verifyFetch(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/verify/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const copyHash = async () => {
    if (!data?.payloadHash) return;
    try {
      await navigator.clipboard.writeText(data.payloadHash);
      toast.success("Hash copied");
    } catch {
      toast.error("Could not copy hash");
    }
  };

  const backHref = token ? "/portal/prescriptions" : "/login";

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-10 flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-10">
        <Empty title={t("verify.invalid")} />
      </div>
    );
  }

  const reasonLabel: Record<string, string> = {
    not_found: t("verify.reason.notFound"),
    no_signature: t("verify.reason.noSignature"),
    revoked: t("verify.reason.revoked"),
    payload_mismatch: t("verify.reason.payloadMismatch"),
    error: t("verify.reason.error"),
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {token ? t("nav.prescriptions") : t("common.signIn")}
        </Link>
        <Button variant="ghost" size="sm" onClick={copyPublicLink}>
          <Copy className="h-3.5 w-3.5" />
          Copy public link
        </Button>
      </div>

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-text tracking-tight">
          {t("verify.title")}
        </h1>
        <p className="mt-1 text-sm text-text-muted font-mono">
          #{data.prescriptionId.slice(0, 8)}
        </p>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-info/30 bg-info-soft px-4 py-2.5 text-sm text-info">
        <Globe className="h-4 w-4 shrink-0" />
        <span>{t("verify.publicBanner")}</span>
      </div>

      <div className="space-y-4">
        {/* Integrity status */}
        <Card padding={false}>
          <div className="flex items-center gap-4 p-4 md:p-5">
            {data.valid ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                <ShieldCheck className="h-5 w-5" />
              </div>
            ) : data.reason === "no_signature" ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn">
                <AlertTriangle className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                <ShieldX className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-text">
                {data.valid
                  ? t("verify.intact")
                  : data.reason === "no_signature"
                    ? t("verify.notSigned")
                    : t("verify.tampered")}
              </p>
              {data.reason ? (
                <p className="mt-0.5 text-sm text-text-muted">
                  {reasonLabel[data.reason] ?? data.reason}
                </p>
              ) : null}
            </div>
            {data.signedAt ? (
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {t("verify.signedAt")}
                </p>
                <p className="mt-0.5 text-sm text-text">
                  {formatDateTime(data.signedAt)}
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        {data.doctor ? (
          <Card>
            <CardHeader
              title={t("verify.doctor")}
              icon={<Stethoscope className="h-4 w-4 text-brand" />}
            />
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {t("common.name")}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-text">
                  {data.doctor.name}
                </dd>
              </div>
              {data.doctor.specialization ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {t("settings.specialty")}
                  </dt>
                  <dd className="mt-0.5 text-sm text-text">
                    {data.doctor.specialization}
                  </dd>
                </div>
              ) : null}
              {data.doctor.slmcRegistrationNo ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {t("settings.slmc")}
                  </dt>
                  <dd className="mt-0.5 text-sm font-mono text-text">
                    {data.doctor.slmcRegistrationNo}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        ) : null}

        {data.medicines && data.medicines.length > 0 ? (
          <Card padding={false}>
            <div className="px-4 pt-4 md:px-5 md:pt-5">
              <CardHeader
                title={t("verify.medicines")}
                icon={<Pill className="h-4 w-4 text-brand" />}
                right={
                  <PillBadge tone="brand">
                    {data.medicines.length} meds
                  </PillBadge>
                }
              />
            </div>
            <ul className="divide-y divide-border/60">
              {data.medicines.map((m, idx) => {
                const freq = humanize(m.frequency);
                const timing = humanize(m.timing);
                const detail = [freq, timing].filter(Boolean).join(" · ");
                return (
                  <li
                    key={idx}
                    className="flex items-start gap-3 px-4 py-3.5 md:px-5"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Pill className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text">
                          {m.name}
                        </span>
                        {m.dosage ? (
                          <PillBadge tone="neutral">{m.dosage}</PillBadge>
                        ) : null}
                      </div>
                      {detail ? (
                        <p className="mt-0.5 text-xs text-text-muted">
                          {detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {data.payloadHash ? (
          <Card className="bg-bg/40">
            <CardHeader
              title={t("verify.payloadHash")}
              icon={<Hash className="h-4 w-4 text-text-muted" />}
              right={
                <button
                  type="button"
                  onClick={copyHash}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Copy
                </button>
              }
            />
            <p className="mt-3 break-all font-mono text-[11px] leading-relaxed text-text-muted">
              {data.payloadHash}
            </p>
            {data.signedAt ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateTime(data.signedAt)}
              </p>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
