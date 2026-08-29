"use client";

import { useState } from "react";
import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  useConsentAudit,
  useConsentsMine,
  useIssueConsent,
  useRevokeConsent,
} from "@/patient/hooks";

const PURPOSES = [
  "care_coordination",
  "second_opinion",
  "insurance_claim",
  "research",
  "other",
];

export default function ConsentsPage() {
  const mine = useConsentsMine();
  const audit = useConsentAudit();
  const issue = useIssueConsent();
  const revoke = useRevokeConsent();

  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [label, setLabel] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
      setStatus("Consent issued.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not issue consent.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Sharing"
        title="Consents"
        description="Grant and revoke access to your health data for care coordination."
        action={
          <Link
            href="/patient/dsar"
            className="rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-text-soft"
          >
            Data requests
          </Link>
        }
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Issue consent</h2>
        <form onSubmit={onIssue} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Purpose
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="h-11 rounded-inner border border-border bg-surface-2 px-3"
            >
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Duration (days)
            <input
              type="number"
              min={1}
              max={365}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="h-11 rounded-inner border border-border bg-surface-2 px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Label (optional)
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Dr. Silva second opinion"
              className="h-11 rounded-inner border border-border bg-surface-2 px-3"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {error}
            </p>
          ) : null}
          {status ? (
            <p role="status" className="text-sm font-semibold text-success sm:col-span-2">
              {status}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={issue.isPending}
            className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
          >
            {issue.isPending ? "Issuing…" : "Issue consent"}
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Your grants</h2>
        <QueryBoundary
          query={mine}
          loadingCount={3}
          emptyTitle="No consents yet"
          emptyDescription="Issue a consent when you want to share access for a limited time."
          isEmpty={(data) => !data.items?.length}
        >
          {(data) => (
            <ul className="flex flex-col gap-2">
              {data.items.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-inner bg-surface-2 px-3 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text">
                      {c.label || c.purpose.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-text-soft">
                      Expires {new Date(c.expiresAt).toLocaleDateString()}
                    </span>
                  </span>
                  <Pill
                    tone={
                      c.status === "active"
                        ? "success"
                        : c.status === "revoked"
                          ? "danger"
                          : "warn"
                    }
                  >
                    {c.status}
                  </Pill>
                  {c.status === "active" ? (
                    <button
                      type="button"
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (window.confirm("Revoke this consent?")) {
                          revoke.mutate(c.id);
                        }
                      }}
                      className="rounded-pill bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                    >
                      Revoke
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Audit trail</h2>
        <QueryBoundary
          query={audit}
          loadingCount={3}
          emptyTitle="No audit events"
          emptyDescription="Consent grants and revocations will appear here."
          isEmpty={(data) => !data.items?.length}
        >
          {(data) => (
            <ul className="flex flex-col gap-2">
              {data.items.slice(0, 20).map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-inner bg-surface-2 px-3 py-2 text-sm text-text"
                >
                  <span className="font-semibold">{entry.action}</span>
                  {entry.purpose ? (
                    <span className="text-text-soft"> · {entry.purpose}</span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-text-soft">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}
