"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { adminApi, adminApiWithStepUp, adminQk, setImpersonationToken, getImpersonationToken } from "@/portal/lib/admin-api";
import { getPasskey } from "@/portal/lib/webauthn";

interface WhoamiResponse {
  actingAs: { id: string; name: string; email: string; role: string } | null;
  impersonatedBy: { id: string; name: string; email: string } | null;
  impName?: string | null;
}

/**
 * Global banner mounted at the admin layout that polls
 * `/admin/impersonate/whoami` every 30s. When a token in localStorage
 * indicates active impersonation, the auth middleware's
 * `impersonatedBy` claim is set and this endpoint returns a non-null
 * `actingAs`. The banner is shown sticky at the top of every admin
 * page and offers a one-click "end session" action.
 *
 * The store is intentionally kept in TanStack Query so a polling
 * admin in another tab stays in sync.
 */
export function ImpersonationBanner() {
  const qc = useQueryClient();
  // Always poll even if no impersonation token — this lets the
  // banner stay hidden when there's no session.
  const { data } = useQuery({
    queryKey: adminQk.impersonateWhoami(),
    queryFn: () => adminApi<WhoamiResponse>("/admin/impersonate/whoami"),
    refetchInterval: 30_000,
    retry: false,
  });

  // If token expired server-side, clear local cache.
  useEffect(() => {
    if (data && !data.actingAs && getImpersonationToken()) {
      setImpersonationToken(null);
    }
  }, [data]);

  const end = useMutation({
    mutationFn: async () => {
      // Token in sessionStorage belongs to admin; this call uses it.
      return adminApi<{ ok: boolean }>("/admin/impersonate/end", {
        method: "POST",
        json: {},
      });
    },
    onSuccess: () => {
      setImpersonationToken(null);
      qc.invalidateQueries();
    },
  });

  async function refresh(): Promise<string> {
    // Step-up before ending — ending an impersonation is sensitive.
    const opts = await adminApi<any>("/admin/webauthn/auth/options", {
      method: "POST",
      json: {},
    });
    const credential = await getPasskey(opts);
    const res = await adminApi<{ stepUpToken: string }>(
      "/admin/webauthn/auth/verify",
      { method: "POST", json: credential },
    );
    return res.stepUpToken;
  }

  const endWithStepUp = useMutation({
    mutationFn: () => adminApiWithStepUp<{ ok: boolean }>(
      "/admin/impersonate/end",
      { method: "POST", json: {} },
      refresh,
    ),
    onSuccess: () => {
      setImpersonationToken(null);
      qc.invalidateQueries();
    },
  });

  if (!data?.actingAs) return null;

  const target = data.actingAs;
  const actor = data.impersonatedBy;
  const startedAt = new Date().toLocaleTimeString();

  return (
    <div className="sticky top-0 z-40 bg-red-600 text-white px-4 py-2 flex items-center gap-3 text-sm shadow-md">
      <ShieldOff size={16} />
      <div className="flex-1">
        <b>Acting as {target.name}</b>
        <span className="opacity-80"> · {target.email} · {target.role}</span>
        <span className="opacity-80"> · impersonation started by {actor?.name ?? data.impName ?? "admin"} at {startedAt}</span>
      </div>
      <button
        onClick={() => endWithStepUp.mutate()}
        disabled={endWithStepUp.isPending}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50"
      >
        <RefreshCw size={12} className={endWithStepUp.isPending ? "animate-spin" : ""} />
        End session
      </button>
    </div>
  );
}