"use client";

/**
 * /portal/teleconsult/[roomId] — Doctor's video consult surface.
 *
 * The URL param `roomId` is the human-readable session token (not the
 * internal session.id). We map roomId → sessionId via the active-session
 * fetch so the URL the doctor's app shows is short and shareable.
 *
 * Layout: stacked, top video / bottom chart.
 *   - Top half (flex-1): <TeleconsultRoom> with remote + local PiP.
 *   - Bottom half (flex-1): <PatientSidebar> with Records / E-Rx /
 *     Notes tabs.
 *
 * Auth: any logged-in doctor with `doctor` role. If the URL's roomId
 * isn't theirs, the GET /teleconsult/sessions/:id returns 403 and we
 * show an error toast + bounce to the queue.
 *
 * Edge cases:
 *   - User navigates here without an active session → page shows the
 *     "session not found" error state.
 *   - DO rejects the WS upgrade (3rd peer, eviction, role mismatch) →
 *     <TeleconsultRoom> surfaces the error toast and the page renders
 *     a "call failed" state with a back-to-queue button.
 */

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";

import TeleconsultRoom from "@/portal/components/teleconsult/TeleconsultRoom";
import PatientSidebar from "@/portal/components/teleconsult/PatientSidebar";
import { teleconsultApi } from "@/portal/lib/api";
import { useT } from "@/portal/i18n";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";

export default function TeleconsultPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const t = useT();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resolve roomId → sessionId by listing the doctor's active
        // sessions. There's at most one live row per appointment so
        // there's at most one live row the doctor cares about right now.
        const active = await teleconsultApi.getActiveForMe();
        if (cancelled) return;
        if (active.session?.roomId !== roomId) {
          setError("Session not found or no longer active");
          setLoading(false);
          return;
        }
        const detail = await teleconsultApi.getSession(active.session.id);
        if (cancelled) return;
        setSessionId(detail.session.id);
        setPatientId(detail.session.patientId ?? null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load session"
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center text-text-soft">
        <div className="flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading video room…
        </div>
      </div>
    );
  }

  if (error || !sessionId) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle size={28} className="text-rose-500 mx-auto" />
          <div className="text-base font-semibold text-text">
            {error ?? "Session not found"}
          </div>
          <div className="text-sm text-text-soft">
            The video room may have ended or the link is no longer valid.
          </div>
          <Link href="/portal/queue">
            <Button variant="primary" leftIcon={<ArrowLeft size={14} />}>
              Back to queue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-3 p-3 bg-surface-2">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/portal/queue"
          className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-text"
        >
          <ArrowLeft size={12} />
          {t("common.back")}
        </Link>
        <div className="text-xs text-text-muted">
          Room <span className="font-mono">{roomId}</span>
        </div>
      </div>

      {/* Video stage (top) + patient sidebar (bottom) */}
      <div className="flex-1 min-h-0 grid grid-rows-2 lg:grid-rows-[1fr_1fr] gap-3">
        <div className="min-h-0">
          <TeleconsultRoom sessionId={sessionId} />
        </div>
        <div className="min-h-0">
          <PatientSidebar sessionId={sessionId} patientId={patientId} />
        </div>
      </div>
    </div>
  );
}