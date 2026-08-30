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
  Lock,
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
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <FileSignature size={12} className="text-sky-300" />
                Data Privacy Governance
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Consents &amp; Authorization Grants
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Legally compliant consent authorization for medical providers, second opinions, and insurers. Issue or revoke access at any time.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/share"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Share2 size={13} />
                <span>Share Records</span>
              </Link>
              <Link
                href="/patient/dsar"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <FileLock2 size={14} className="text-sky-700" />
                <span>Data Requests (DSAR)</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <FileCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Grants
                </p>
                <p className="text-base font-extrabold text-white">
                  {activeGrants.length} Authorized
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <History size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Audit Events
                </p>
                <p className="text-base font-extrabold text-white">
                  {auditList.length} Logged
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Lock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Governance
                </p>
                <p className="text-base font-extrabold text-white">Granular RBAC</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Patient Rights
                </p>
                <p className="text-base font-extrabold text-white">Full Revocation</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Issue Consent Authorization Card ────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Plus size={16} className="text-sky-600" />
            <span>Issue New Consent Grant</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Authorize a third-party physician, clinic, or claims auditor to view your clinical records for a set duration.
          </p>
        </div>

        {/* Purpose Cards */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                    "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                    isSelected
                      ? "bg-sky-50/90 border-sky-400 ring-2 ring-sky-500/20 shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100/70",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon
                      size={16}
                      className={isSelected ? "text-sky-600" : "text-slate-500"}
                    />
                    {isSelected ? (
                      <CheckCircle2 size={14} className="text-sky-600" />
                    ) : null}
                  </div>
                  <span className="text-xs font-bold text-slate-900 mt-1">
                    {p.label}
                  </span>
                  <span className="text-[10.5px] text-slate-500 line-clamp-1">
                    {p.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={onIssue} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          <div className="sm:col-span-6 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Recipient / Doctor Label (Optional)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Dr. Silva Second Opinion Consult"
              className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Duration Validity</span>
              <div className="flex items-center gap-1 font-semibold text-[10px] text-sky-700">
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
                className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                Days
              </span>
            </div>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={issue.isPending}
              className="w-full h-10 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              {issue.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Issuing…</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Grant Consent</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {status && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{status}</span>
          </div>
        )}
      </section>

      {/* ── 3. Active & Existing Consent Grants ─────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <FileCheck size={16} className="text-emerald-600" />
            <span>Active Consent Grants</span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              {grantsList.length}
            </span>
          </h2>
        </div>

        {mine.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : grantsList.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-2xs">
              <ShieldCheck size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                No External Consent Grants Active
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
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
                    "p-4 sm:p-5 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3",
                    isRevoked
                      ? "border-slate-200 bg-slate-50/50 opacity-70"
                      : "border-slate-200/90 hover:border-emerald-300",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200",
                        )}
                      >
                        <FileSignature size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                            {c.label || c.purpose.replace(/_/g, " ")}
                          </h3>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold capitalize",
                              isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : isRevoked
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800",
                            )}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 capitalize mt-0.5">
                          Purpose: {c.purpose.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400 font-medium">
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
                        className="px-3 py-1 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
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
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <History size={16} className="text-purple-600" />
            <span>Immutable Privacy Audit Trail</span>
            <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
              {auditList.length} Events
            </span>
          </h2>
        </div>

        {audit.isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : auditList.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white text-slate-400 flex items-center justify-center shrink-0 border border-slate-200">
              <History size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                No Consent Audit Events Yet
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every consent grant, record access by a doctor, and revocation is cryptographically logged here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {auditList.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 font-bold text-[10px]">
                    EHR
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate capitalize">
                      {entry.action.replace(/_/g, " ")}
                    </p>
                    {entry.purpose ? (
                      <p className="text-[11px] text-slate-500 truncate capitalize">
                        Scope: {entry.purpose.replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <span className="text-[11px] text-slate-400 font-medium shrink-0">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Patient Data Rights Callout ──────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Patient Data Rights (GDPR &amp; HIPAA Compliant)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Under healthcare privacy regulations, you have full ownership over your medical history with the absolute right to revoke access or request data erasure at any time.
            </p>
          </div>
        </div>

        <Link
          href="/patient/dsar"
          className="px-4 py-2 rounded-xl text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ExternalLink size={13} className="text-sky-700" />
          <span>Exercise Data Rights</span>
        </Link>
      </section>
    </div>
  );
}
