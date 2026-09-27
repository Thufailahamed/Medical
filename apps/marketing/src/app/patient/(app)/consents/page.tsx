"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  FileLock2,
  FileSignature,
  History,
  Key,
  Loader2,
  Plus,
  Share2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import {
  useConsentAudit,
  useConsentsMine,
  useIssueConsent,
  useRevokeConsent,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

const PURPOSES = [
  {
    id: "care_coordination",
    label: "Care Coordination",
    desc: "Hospital referrals & doctor handovers",
    icon: Stethoscope,
  },
  {
    id: "second_opinion",
    label: "Second Opinion",
    desc: "External specialist case review",
    icon: FileSignature,
  },
  {
    id: "insurance_claim",
    label: "Insurance Claim",
    desc: "Underwriting & claim reimbursement",
    icon: ShieldCheck,
  },
  {
    id: "research",
    label: "Clinical Research",
    desc: "Anonymized study participation",
    icon: Activity,
  },
  {
    id: "other",
    label: "Other Purpose",
    desc: "Custom provider authorization",
    icon: Key,
  },
];

const DURATION_PRESETS = [
  { days: "7", label: "7 Days" },
  { days: "30", label: "30 Days" },
  { days: "90", label: "90 Days" },
  { days: "365", label: "1 Year" },
];

export default function ConsentsPage() {
  const mine = useConsentsMine();
  const audit = useConsentAudit();
  const issue = useIssueConsent();
  const revoke = useRevokeConsent();

  const [purpose, setPurpose] = useState(PURPOSES[0].id);
  const [label, setLabel] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const grantsList = mine.data?.items ?? [];
  const auditList = audit.data?.items ?? [];

  const activeGrants = useMemo(
    () => grantsList.filter((c) => c.status === "active"),
    [grantsList],
  );

  async function onIssue(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      await issue.mutateAsync({
        purpose,
        label: label.trim() || undefined,
        durationDays: Number(durationDays) || 30,
      });
      setLabel("");
      setStatus("Consent authorization granted successfully.");
      setTimeout(() => setStatus(null), 4000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not issue consent.");
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<FileSignature size={13} aria-hidden />}
        kicker="Data Privacy Governance"
        title="Consents & Authorization Grants"
        description="Legally compliant consent authorization for medical providers, second opinions, and insurers. Issue or revoke access at any time."
        actions={
          <>
            <Link href="/patient/share" className={heroSecondaryAction}>
              <Share2 size={13} aria-hidden />
              Share Records
            </Link>
            <Link href="/patient/dsar" className={heroPrimaryAction}>
              <FileLock2 size={14} aria-hidden />
              Data Requests (DSAR)
            </Link>
          </>
        }
        footer={
          <>
            <span>Active Grants · {activeGrants.length} Authorized</span>
            <span>Audit Events · {auditList.length} Logged</span>
            <span>Governance · Granular RBAC</span>
            <span>Patient Rights · Full Revocation</span>
          </>
        }
      />

      {/* ── 2. Issue Consent Authorization Card ────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
        <div>
          <h2 className="pt-kicker flex items-center gap-2">
            <Plus size={16} className="text-brand" aria-hidden />
            <span>Issue New Consent Grant</span>
          </h2>
          <p className="text-xs text-text-soft mt-0.5">
            Authorize a third-party physician, clinic, or claims auditor to view your clinical records for a set duration.
          </p>
        </div>

        {/* Purpose Cards */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            Authorization Purpose
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {PURPOSES.map((p) => {
              const Icon = p.icon;
              const isSelected = purpose === p.id;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPurpose(p.id)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1",
                    isSelected
                      ? "bg-brand-soft/50 border-brand shadow-card"
                      : "bg-surface-2 border-border hover:border-border-strong",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon
                      size={16}
                      className={isSelected ? "text-brand" : "text-text-muted"}
                      aria-hidden
                    />
                    {isSelected ? (
                      <CheckCircle2 size={14} className="text-brand" aria-hidden />
                    ) : null}
                  </div>
                  <span className="text-xs font-bold text-text mt-1">
                    {p.label}
                  </span>
                  <span className="text-[10.5px] text-text-soft line-clamp-1">
                    {p.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={onIssue} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          <div className="sm:col-span-6 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
              Recipient / Doctor Label (Optional)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Dr. Silva Second Opinion Consult"
              className="pt-input text-xs sm:text-sm"
            />
          </div>

          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider flex items-center justify-between">
              <span>Duration Validity</span>
              <div className="flex items-center gap-1 font-semibold text-[10px] text-brand">
                {DURATION_PRESETS.map((dp) => (
                  <button
                    key={dp.days}
                    type="button"
                    onClick={() => setDurationDays(dp.days)}
                    className="hover:underline cursor-pointer px-1"
                  >
                    {dp.label}
                  </button>
                ))}
              </div>
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="30"
                className="pt-input text-xs sm:text-sm pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted pointer-events-none">
                Days
              </span>
            </div>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={issue.isPending}
              className="pt-btn pt-btn-primary h-11 w-full text-xs disabled:opacity-50"
            >
              {issue.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                  Issuing…
                </>
              ) : (
                <>
                  <Plus size={14} aria-hidden />
                  Grant Consent
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {status && (
          <div className="p-3 rounded-lg bg-success-soft border border-success/25 text-xs font-semibold text-success flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" aria-hidden />
            <span>{status}</span>
          </div>
        )}
      </section>

      {/* ── 3. Active & Existing Consent Grants ─────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="pt-kicker flex items-center gap-2">
            <FileCheck size={16} className="text-success" aria-hidden />
            <span>Active Consent Grants</span>
            <span className="rounded-md bg-success-soft px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-success">
              {grantsList.length}
            </span>
          </h2>
        </div>

        {mine.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : grantsList.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-xl bg-surface border border-border shadow-card flex flex-col items-center text-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-success-soft text-success shadow-2xs" aria-hidden>
              <ShieldCheck size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                No External Consent Grants Active
              </h3>
              <p className="text-xs sm:text-sm text-text-soft mt-1 leading-relaxed">
                Your medical record is strictly restricted to you and your primary care physician. External clinics and insurers cannot access your data without an explicit consent grant.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {grantsList.map((c) => {
              const isActive = c.status === "active";
              const isRevoked = c.status === "revoked";

              return (
                <article
                  key={c.id}
                  className={cn(
                    "p-4 sm:p-5 rounded-xl bg-surface border shadow-card hover:shadow-md transition-all flex flex-col justify-between gap-3",
                    isRevoked
                      ? "border-border bg-surface-2/40 opacity-70"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "grid h-10 w-10 place-items-center rounded-md shrink-0",
                          isActive
                            ? "bg-success-soft text-success"
                            : "bg-surface-2 text-text-muted",
                        )}
                        aria-hidden
                      >
                        <FileSignature size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-text text-sm sm:text-base truncate">
                            {c.label || c.purpose.replace(/_/g, " ")}
                          </h3>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider capitalize",
                              isActive
                                ? "bg-success-soft text-success"
                                : isRevoked
                                  ? "bg-danger-soft text-danger"
                                  : "bg-warn-soft text-warn",
                            )}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-text-soft capitalize mt-0.5">
                          Purpose: {c.purpose.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2">
                    <span className="text-xs text-text-muted font-medium">
                      Expires: {new Date(c.expiresAt).toLocaleDateString()}
                    </span>

                    {isActive && (
                      <button
                        type="button"
                        disabled={revoke.isPending}
                        onClick={() => {
                          if (window.confirm("Immediately revoke this consent grant?")) {
                            revoke.mutate(c.id);
                          }
                        }}
                        className="pt-btn h-7 px-3 text-xs text-danger hover:bg-danger-soft disabled:opacity-50"
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Immutable Privacy Audit Trail ────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="pt-kicker flex items-center gap-2">
            <History size={16} className="text-brand" aria-hidden />
            <span>Immutable Privacy Audit Trail</span>
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-brand">
              {auditList.length} Events
            </span>
          </h2>
        </div>

        {audit.isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : auditList.length === 0 ? (
          <div className="p-6 rounded-lg bg-surface-2 border border-border flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-surface text-text-muted shrink-0 border border-border" aria-hidden>
              <History size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-text">
                No Consent Audit Events Yet
              </p>
              <p className="text-[11px] text-text-soft mt-0.5">
                Every consent grant, record access by a doctor, and revocation is cryptographically logged here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden bg-surface">
            {auditList.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-text-soft shrink-0 font-mono font-bold text-[10px]" aria-hidden>
                    EHR
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-text truncate capitalize">
                      {entry.action.replace(/_/g, " ")}
                    </p>
                    {entry.purpose ? (
                      <p className="text-[11px] text-text-soft truncate capitalize">
                        Scope: {entry.purpose.replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <span className="text-[11px] text-text-muted font-medium shrink-0">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Patient Data Rights Callout ──────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-soft text-brand shrink-0" aria-hidden>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Patient Data Rights (GDPR &amp; HIPAA Compliant)
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Under healthcare privacy regulations, you have full ownership over your medical history with the absolute right to revoke access or request data erasure at any time.
            </p>
          </div>
        </div>

        <Link
          href="/patient/dsar"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <ExternalLink size={13} aria-hidden />
          Exercise Data Rights
        </Link>
      </section>
    </div>
  );
}
