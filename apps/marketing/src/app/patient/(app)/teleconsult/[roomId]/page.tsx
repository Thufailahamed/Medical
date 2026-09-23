"use client";

/**
 * /patient/teleconsult/[roomId] — Patient's video consult surface.
 *
 * Mirrors the doctor portal route. The patient joins a video room by
 * roomId (the shareable token). Layout: remote video fills the screen
 * with a local self-view in the corner.
 *
 * One entry mode (fail closed — no fake URLs):
 *   - Real roomId: resolves roomId → session via
 *     GET /teleconsult/sessions/by-room/:roomId, then mounts
 *     <TeleconsultRoom>. Any failure renders an explicit error state
 *     with retry — never a blank room, never polling on a fake id.
 *   - roomId === "__pending__" (or any unknown roomId) is rejected.
 */

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Video, RotateCcw } from "lucide-react";

import TeleconsultRoom from "@/portal/components/teleconsult/TeleconsultRoom";
import { teleconsultApi } from "@/portal/lib/api";
import { useT } from "@/portal/i18n";
import { Card } from "@/patient/components/primitives/Card";

export default function PatientTeleconsultPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const t = useT();
  const invalidRoom = roomId === "__pending__";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    invalidRoom ? "Invalid room link." : null
  );
  const [loading, setLoading] = useState(() => !invalidRoom);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (invalidRoom) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await teleconsultApi.getByRoom(roomId);
        if (cancelled) return;
        if (!res.session) {
          setError("This room is no longer available.");
          setLoading(false);
          return;
        }
        setSessionId(res.session.id);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't join this room. Check your connection and try again."
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, invalidRoom, retryToken]);

  if (loading) {
    return (
      <div className="grid min-h-[60dvh] place-items-center p-6 text-text-soft">
        <div className="flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading video room…
        </div>
      </div>
    );
  }

  if (error || !sessionId) {
    return (
      <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
        <Link
          href="/patient/appointments"
          className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
        >
          <ArrowLeft size={14} aria-hidden /> Back to appointments
        </Link>
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertTriangle size={28} className="text-rose-500" />
            <h2 className="text-base font-semibold text-text">
              Couldn’t join the call
            </h2>
            <p className="max-w-sm text-sm text-text-soft">{error}</p>
            {!invalidRoom ? (
              <button
                type="button"
                onClick={() => setRetryToken((n) => n + 1)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
                data-testid="retry-join"
              >
                <RotateCcw size={14} aria-hidden /> Try again
              </button>
            ) : null}
            <Link
              href="/patient/appointments"
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Back to appointments
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-4 px-1 pb-2 sm:px-2">
      <div className="flex items-center justify-between">
        <Link
          href="/patient/appointments"
          className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
        >
          <ArrowLeft size={14} aria-hidden /> Back
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
          <Video size={13} aria-hidden /> Live consultation
        </span>
      </div>
      <div className="flex-1 overflow-hidden rounded-card border border-border bg-black">
        <TeleconsultRoom sessionId={sessionId} />
      </div>
    </div>
  );
}
