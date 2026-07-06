"use client";

/**
 * /portal/verify/[id] — in-app public verify view.
 *
 * Calls the public GET /verify/:prescriptionId endpoint (no auth
 * required). The QR codes printed on signed PDF prescriptions point
 * at the public base URL; this page is the in-app fallback for when
 * a logged-in doctor or patient opens the link inside the portal
 * session.
 *
 * Layout mirrors the printed PDF's signed block: integrity check,
 * status, doctor, signed-at, medicines, payload hash.
 */

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Pill,
  Hash,
  Calendar,
  Stethoscope,
  Globe,
} from "lucide-react";

import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { api, API_URL } from "@/portal/lib/api";
import { formatDateTime } from "@/portal/lib/format";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";
import { useT } from "@/portal/i18n";

interface VerifyResponse {
  valid: boolean;
  reason?: string;
  prescriptionId: string;
  signedAt?: string;
  payloadHash?: string;
  signatureB64?: string;
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
    startDate?: string | null;
    endDate?: string | null;
  }>;
  date?: string;
}

async function verifyFetch(id: string): Promise<VerifyResponse> {
  // Public endpoint — call directly so we don't leak the user's auth
  // header into a public response (and to avoid being redirected to
  // /login on 401).
  const res = await fetch(`${API_URL}/verify/${id}`);
  if (res.status === 404) {
    return { valid: false, reason: "not_found", prescriptionId: id };
  }
  if (!res.ok) {
    return { valid: false, reason: "error", prescriptionId: id };
  }
  return res.json();
}

export default function VerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ["verify", id],
    queryFn: () => verifyFetch(id),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return <Empty title={t("verify.invalid")} />;
  }

  const reasonLabel: Record<string, string> = {
    not_found: t("verify.reason.notFound"),
    no_signature: t("verify.reason.noSignature"),
    revoked: t("verify.reason.revoked"),
    payload_mismatch: t("verify.reason.payloadMismatch"),
    error: t("verify.reason.error"),
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/portal/prescriptions"
          className="p-2 rounded-md hover:bg-surface-2 text-text-soft"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-text">
            {t("verify.title")}
          </h1>
          <p className="text-sm text-text-soft mt-0.5">
            #{data.prescriptionId.slice(0, 8)}
          </p>
        </div>
      </div>

      {/* Public banner */}
      <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
        <Globe size={14} />
        <span>{t("verify.publicBanner")}</span>
      </div>

      {/* Integrity check */}
      <Card padding={false}>
        <div className="p-4 flex items-center gap-3">
          {data.valid ? (
            <div className="h-10 w-10 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
          ) : data.reason === "no_signature" ? (
            <div className="h-10 w-10 rounded-lg bg-warn-soft text-warn flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-lg bg-danger-soft text-danger flex items-center justify-center shrink-0">
              <ShieldX size={18} />
            </div>
          )}
          <div className="flex-1">
            <div className="text-sm font-semibold text-text">
              {data.valid
                ? t("verify.intact")
                : data.reason === "no_signature"
                  ? t("verify.notSigned")
                  : t("verify.tampered")}
            </div>
            <div className="text-xs text-text-soft">
              {data.reason ? reasonLabel[data.reason] ?? data.reason : ""}
            </div>
          </div>
          {data.signedAt ? (
            <div className="text-right">
              <div className="text-[10px] text-text-muted">
                {t("verify.signedAt")}
              </div>
              <div className="text-xs text-text">
                {formatDateTime(data.signedAt)}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Doctor */}
      {data.doctor ? (
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope size={14} /> {t("verify.doctor")}
              </span>
            }
          />
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-text-soft">{t("common.name")}</div>
              <div className="text-text">{data.doctor.name}</div>
            </div>
            {data.doctor.specialization ? (
              <div>
                <div className="text-[11px] text-text-soft">
                  {t("settings.specialty")}
                </div>
                <div className="text-text">{data.doctor.specialization}</div>
              </div>
            ) : null}
            {data.doctor.slmcRegistrationNo ? (
              <div>
                <div className="text-[11px] text-text-soft">
                  {t("settings.slmc")}
                </div>
                <div className="text-text font-mono">
                  {data.doctor.slmcRegistrationNo}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Medicines */}
      {data.medicines && data.medicines.length > 0 ? (
        <Card padding={false}>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <Pill size={14} /> {t("verify.medicines")}
              </span>
            }
            right={
              <PillBadge tone="brand">
                {data.medicines.length} meds
              </PillBadge>
            }
          />
          <ul className="flex flex-col">
            {data.medicines.map((m, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 px-4 py-3 border-t border-border/60 first:border-t-0"
              >
                <div className="h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Pill size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text">
                      {m.name}
                    </span>
                    {m.dosage ? (
                      <PillBadge tone="neutral">{m.dosage}</PillBadge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-text-soft mt-0.5">
                    {m.frequency ? <span>{m.frequency}</span> : null}
                    {m.timing ? <span>· {m.timing}</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Payload hash + signature */}
      {data.payloadHash ? (
        <Card padding={false}>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <Hash size={14} /> {t("verify.payloadHash")}
              </span>
            }
          />
          <div className="px-4 py-3">
            <div className="text-[10px] text-text-muted font-mono break-all">
              {data.payloadHash}
            </div>
            {data.signedAt ? (
              <div className="mt-2 text-[10px] text-text-muted inline-flex items-center gap-1">
                <Calendar size={10} />
                {formatDateTime(data.signedAt)}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
