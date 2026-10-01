"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
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
import {
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";

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

  const grantsList = useMemo(() => mine.data?.items ?? [], [mine.data?.items]);
  const auditList = useMemo(() => audit.data?.items ?? [], [audit.data?.items]);

  const activeGrants = useMemo(
    () => grantsList.filter((c) => c.status === "active"),
    [grantsList],
  );
  const revokedCount = grantsList.length - activeGrants.length;

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
    <PatientPage>
      <PatientHero
        kickerIcon={<FileSignature size={13} aria-hidden />}
        kicker="Privacy"
        kickerMeta="Data governance"
        title={
          <>
            Consents &amp; <HeroAccent>authorization grants</HeroAccent>
          </>
        }
        description="Legally compliant consent authorization for medical providers, second opinions, and insurers. Issue or revoke access at any time."
        chips={
          <>
            <span className={HERO_CHIP}>
              <CheckCircle2 size={12} className="text-emerald-300" />
              {activeGrants.length} active grants
            </span>
            <span className={HERO_CHIP}>
              <History size={12} className="text-sky-300" />
              {auditList.length} audit events
            </span>
          </>
        }
        actions={
          <>
            <Link href="/patient/share" className={HERO_GHOST}>
              <Share2 size={13} /> Share records
            </Link>
            <Link href="/patient/dsar" className={HERO_PRIMARY}>
              <FileLock2 size={14} className="text-sky-600" /> Data requests
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Active grants"
          value={String(activeGrants.length)}
          sub="Currently authorized"
          pulse={activeGrants.length > 0}
        />
        <StatTile
          icon={<FileCheck size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Total grants"
          value={String(grantsList.length)}
          sub="Issued to date"
        />
        <StatTile
          icon={<Key size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Expired / revoked"
          value={String(revokedCount)}
          sub="Access withdrawn"
        />
        <StatTile
          icon={<History size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Audit events"
          value={String(auditList.length)}
          sub="Immutable log"
          href="/patient/audit"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<Plus size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Issue new consent grant"
              caption="Authorize a third-party physician, clinic, or claims auditor for a set duration."
            />

            <div className="mt-4 flex flex-col gap-2">
              <span className={FIELD_LABEL}>Authorization purpose</span>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                {PURPOSES.map((p) => {
                  const Icon = p.icon;
                  const isSelected = purpose === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPurpose(p.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition-all",
                        isSelected
                          ? "border-sky-300 bg-sky-50 shadow-sm"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          size={16}
                          className={isSelected ? "text-sky-600" : "text-slate-400"}
                          aria-hidden
                        />
                        {isSelected ? (
                          <CheckCircle2 size={14} className="text-sky-600" aria-hidden />
                        ) : null}
                      </div>
                      <span className="mt-1 text-xs font-bold text-slate-900">{p.label}</span>
                      <span className="line-clamp-1 text-[10.5px] text-slate-500">{p.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={onIssue} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <label className={FIELD_LABEL}>Recipient / doctor label (optional)</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Dr. Silva Second Opinion Consult"
                  className={FIELD_INPUT}
                />
              </div>

              <div className="sm:col-span-4">
                <div className="flex items-center justify-between">
                  <label className={FIELD_LABEL}>Duration validity</label>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-700">
                    {DURATION_PRESETS.map((dp) => (
                      <button
                        key={dp.days}
                        type="button"
                        onClick={() => setDurationDays(dp.days)}
                        className="cursor-pointer px-1 hover:underline"
                      >
                        {dp.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    placeholder="30"
                    className={cn(FIELD_INPUT, "pr-14")}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Days
                  </span>
                </div>
              </div>

              <div className="flex items-end sm:col-span-2">
                <button
                  type="submit"
                  disabled={issue.isPending}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                >
                  {issue.isPending ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : (
                    <Plus size={14} aria-hidden />
                  )}
                  {issue.isPending ? "Issuing…" : "Grant"}
                </button>
              </div>
            </form>

            {error ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <AlertCircle size={14} className="shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            {status ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={14} className="shrink-0" aria-hidden />
                <span>{status}</span>
              </div>
            ) : null}
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<FileCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Consent grants"
              caption={`${grantsList.length} issued · ${activeGrants.length} active`}
            />
            {mine.isLoading ? (
              <PanelSkeleton rows={2} />
            ) : grantsList.length === 0 ? (
              <EmptyBlock
                icon={<ShieldCheck size={19} />}
                title="No external consent grants"
                body="Your medical record is restricted to you and your primary care physician. External clinics and insurers cannot access your data without an explicit grant."
              />
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {grantsList.map((c) => {
                  const isActive = c.status === "active";
                  const isRevoked = c.status === "revoked";
                  return (
                    <article
                      key={c.id}
                      className={cn(
                        "flex flex-col justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all sm:p-5",
                        isRevoked
                          ? "border-slate-100 bg-slate-50/50 opacity-70"
                          : "border-slate-100 hover:border-slate-200 hover:shadow-md",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                            isActive
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-400",
                          )}
                          aria-hidden
                        >
                          <FileSignature size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                              {c.label || c.purpose.replace(/_/g, " ")}
                            </h3>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : isRevoked
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-amber-50 text-amber-700",
                              )}
                            >
                              {c.status}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs capitalize text-slate-500">
                            Purpose: {c.purpose.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                        <span className="text-xs font-medium text-slate-400">
                          Expires {new Date(c.expiresAt).toLocaleDateString()}
                        </span>
                        {isActive ? (
                          <button
                            type="button"
                            disabled={revoke.isPending}
                            onClick={() => {
                              if (window.confirm("Immediately revoke this consent grant?")) {
                                revoke.mutate(c.id);
                              }
                            }}
                            className="inline-flex h-7 items-center rounded-lg px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            Revoke access
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<History size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Privacy audit trail"
              caption={`${auditList.length} events logged`}
            />
            {audit.isLoading ? (
              <PanelSkeleton rows={2} />
            ) : auditList.length === 0 ? (
              <EmptyBlock
                icon={<History size={19} />}
                title="No consent audit events yet"
                body="Every grant, record access by a doctor, and revocation is cryptographically logged here."
              />
            ) : (
              <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
                {auditList.slice(0, 20).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 p-3 text-xs transition-colors hover:bg-slate-50 sm:p-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 font-mono text-[10px] font-bold text-slate-500"
                        aria-hidden
                      >
                        EHR
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold capitalize text-slate-900">
                          {entry.action.replace(/_/g, " ")}
                        </p>
                        {entry.purpose ? (
                          <p className="truncate text-[11px] capitalize text-slate-500">
                            Scope: {entry.purpose.replace(/_/g, " ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-slate-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<ShieldCheck size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Your data rights"
              caption="GDPR & HIPAA compliant."
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Under healthcare privacy regulations, you have full ownership of your
              medical history — with the absolute right to revoke access or request
              data erasure at any time.
            </p>
            <Link
              href="/patient/dsar"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <FileLock2 size={13} /> Exercise data rights
            </Link>
          </section>

          <QuickToolsPanel
            id="consent-tools"
            title="Tools"
            tools={[
              {
                icon: Share2,
                label: "Share",
                hint: "Links",
                href: "/patient/share",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: FileLock2,
                label: "DSAR",
                hint: "Requests",
                href: "/patient/dsar",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
              {
                icon: History,
                label: "Audit",
                hint: "Activity",
                href: "/patient/audit",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}
