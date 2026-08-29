"use client";

/**
 * /patient/teleconsult/[roomId] — Patient's video consult surface.
 *
 * Mirrors the doctor portal route. The patient joins a video room by
 * roomId (the shareable token). Layout: remote video fills the screen
 * with a local self-view in the corner.
 */

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Video } from "lucide-react";

import TeleconsultRoom from "@/portal/components/teleconsult/TeleconsultRoom";
import { api } from "@/portal/lib/api";
import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";

export default function PatientTeleconsultPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resolve the roomId for this patient. The patient side lists
        // sessions from /teleconsult/sessions/me filtered to the active
        // row.
        const result = await api<{
          sessions: Array<{ id: string; roomId: string }>;
        }>("/teleconsult/sessions/me?status=active");
        if (cancelled) return;
        const session = result.sessions?.find((s) => s.roomId === roomId);
        if (!session) {
          setError("This video room is not active for you.");
          setLoading(false);
          return;
        }
        setSessionId(session.id);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load video room"
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
