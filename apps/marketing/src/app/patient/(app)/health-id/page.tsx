"use client";

import { useState } from "react";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function HealthIdPage() {
  const qc = useQueryClient();
  const current = useQuery({
    queryKey: ["patient", "health-id", "current"],
    queryFn: () => api<{ token: string | null; purpose: string | null }>("/me/health-id/current"),
  });
  const issue = useMutation({
    mutationFn: () => api<{ token: string; purpose: string; expiresAt: string }>("/me/health-id/issue", { method: "POST", json: { purpose: "all" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "health-id"] }),
  });
  const revoke = useMutation({
    mutationFn: () => api("/me/health-id/revoke", { method: "POST", json: { purpose: "all" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "health-id"] }),
  });
  const [error, setError] = useState<string | null>(null);
  const token = current.data?.token;

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader label="Identity" title="Health ID" description="Create a temporary QR identity for check-in and care coordination." />
      <Card>
        <QueryBoundary query={current} emptyTitle="No health ID yet" emptyDescription="Issue one when you need to share a time-limited identity token.">
          {(data) => (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-soft">{data.token ? "Your health ID is active." : "No active health ID is currently issued."}</p>
              {data.token ? <code className="break-all rounded-inner bg-surface-2 p-3 text-xs text-text">{data.token}</code> : null}
              {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={issue.isPending} onClick={async () => { setError(null); try { await issue.mutateAsync(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not issue health ID."); } }} className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{issue.isPending ? "Issuing…" : token ? "Rotate health ID" : "Issue health ID"}</button>
                {token ? <button type="button" disabled={revoke.isPending} onClick={async () => { setError(null); try { await revoke.mutateAsync(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not revoke health ID."); } }} className="rounded-pill bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60">{revoke.isPending ? "Revoking…" : "Revoke"}</button> : null}
              </div>
            </div>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}
