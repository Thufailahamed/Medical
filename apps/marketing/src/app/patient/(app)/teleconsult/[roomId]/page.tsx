"use client";

/**
 * /patient/teleconsult/[roomId] — Patient's video consult surface.
 *
 * Mirrors the doctor portal route. The patient joins a video room by
 * roomId (the shareable token). Layout: remote video fills the screen
 * with a local self-view in the corner.
 *
 * Two entry modes (same contract as the mobile app):
 *   - Real roomId: resolves roomId → sessionId via
 *     GET /teleconsult/sessions/me/active, then mounts <TeleconsultRoom>.
 *   - roomId === "__pending__": the doctor hasn't opened the room yet —
 *     poll /me/active every 5s and swap to the real roomId when one
 *     appears.
 */

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Video } from "lucide-react";

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
  const router = useRouter();
  const t = useT();
  const isPending = roomId === "__pending__";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !isPending);

  useEffect(() => {
    let cancelled = false;

    // Pending branch — poll until the doctor creates a session, then
    // replace this route with the real roomId.
    if (isPending) {
      const interval = setInterval(async () => {
        if (cancelled) return;
        try {
          const active = await teleconsultApi.getActiveForMe();
          if (cancelled || !active.session) return;
          clearInterval(interval);
          router.replace(`/patient/teleconsult/${active.session.roomId}`);
        } catch {
          // network blip — keep polling
        }
      }, 5_000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    // Real-room branch — one-shot lookup; mismatch means the link is
    // stale or belongs to someone else.
    (async () => {
      try {
        const active = await teleconsultApi.getActiveForMe();
        if (cancelled) return;
        if (!active.session || active.session.roomId !== roomId) {
          setError("This video room is not active for you.");
          setLoading(false);
          return;
        }
        setSessionId(active.session.id);
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
  }, [roomId, isPending, router]);

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

  if (isPending) {
    return (
      <div className="grid min-h-[60dvh] place-items-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Loader2 size={32} className="animate-spin text-brand" />
          <h2 className="text-base font-semibold text-text">
            {t("consult.waitingForDoctor")}
          </h2>
          <p className="text-sm text-text-soft">
            Keep this page open — you’ll join automatically when the call
            starts.
          </p>
          <Link
            href="/patient/appointments"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
          >
            <ArrowLeft size={14} aria-hidden /> Back to appointments
          </Link>
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
