"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/portal/lib/api";

const SCOPES = [
  { value: "all", label: "Entire record" },
  { value: "recent6m", label: "Last 6 months" },
  { value: "custom", label: "Selected documents" },
] as const;

const EXPIRIES = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
  { hours: 720, label: "30 days" },
] as const;

/**
 * Unified share dialog — single source of truth for patient + staff sharing.
 * Supports full record, recent-6-months, or explicit record-id packs (≤50).
 * Never grants edit access; links are view-only with expiry + revocation.
 */
export function UnifiedShareDialog({
  defaultRecordIds,
  onCreated,
}: {
  defaultRecordIds?: string[];
  onCreated?: (link: { token: string; url: string }) => void;
}) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<string>(defaultRecordIds?.length ? "custom" : "all");
  const [recordIds, setRecordIds] = useState<string>( (defaultRecordIds ?? []).join(", ") );
  const [expiresInHours, setExpiresInHours] = useState<number>(168);
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ token: string; url?: string; link?: { token: string } }>("/share/links", { method: "POST", json: body }),
    onSuccess: (res: { token?: string; url?: string; link?: { token: string } }) => {
      const token = res.token ?? res.link?.token;
      const url = res.url ?? (token ? `/share/${token}` : "");
      if (token) {
        setResult({ token, url });
        onCreated?.({ token, url });
        qc.invalidateQueries({ queryKey: ["share-links"] });
      } else {
        setError("Share created but no token returned");
      }
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Share failed"),
  });

  function submit() {
    setError(null);
    setResult(null);
    const ids = recordIds.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 50);
    if (scope === "custom" && ids.length === 0) {
      setError("Enter at least one record ID for a custom pack");
      return;
    }
    mut.mutate({
      scope: scope === "custom" ? "custom" : scope,
      recordIds: scope === "custom" ? ids : undefined,
      expiresInHours,
      label: label.slice(0, 100) || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold">Share records securely</h2>
      <label className="flex flex-col gap-1 text-sm">
        Scope
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="rounded-lg border px-2 py-1.5">
          {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      {scope === "custom" ? (
        <label className="flex flex-col gap-1 text-sm">
          Record IDs (comma-separated, max 50)
          <textarea value={recordIds} onChange={(e) => setRecordIds(e.target.value)} rows={2} className="rounded-lg border px-2 py-1.5 font-mono text-xs" placeholder="rec_abc123, rec_def456" />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Expires
        <select value={expiresInHours} onChange={(e) => setExpiresInHours(Number(e.target.value))} className="rounded-lg border px-2 py-1.5">
          {EXPIRIES.map((x) => <option key={x.hours} value={x.hours}>{x.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Label (optional)
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} className="rounded-lg border px-2 py-1.5" placeholder="Shared with Dr. Perera" />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {result ? (
        <p className="rounded-lg bg-emerald-50 px-2 py-1.5 font-mono text-xs text-emerald-800 break-all">
          {result.url}
        </p>
      ) : null}
      <button type="button" onClick={submit} disabled={mut.isPending} className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">
        {mut.isPending ? "Creating…" : "Create secure link"}
      </button>
      <p className="text-xs text-slate-500">View-only. Expires automatically. Revocable anytime. Access is audited.</p>
    </div>
  );
}
