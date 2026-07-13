"use client";

/**
 * TeleconsultRoom — doctor's portal video surface.
 *
 * Owns:
 *   • The TeleconsultSignaling client (WebRTC + WS).
 *   • The video <video> elements + PiP/local layout.
 *   • The control bar (mute, camera, end).
 *   • The status pill + duration counter.
 *
 * Delegates:
 *   • Patient sidebar (`PatientSidebar`) — rendered by the parent page.
 *
 * Lifecycle:
 *   - On mount: GET /teleconsult/sessions/:id → start Signaling.
 *   - On "end": POST /teleconsult/sessions/:id/end, then close Signaling
 *     and navigate back to the queue.
 *
 * Auth:
 *   - The doctor's portal_session cookie rides the WS upgrade.
 *   - The DO enforces the same participant gate (only the doctor's
 *     userId OR the appointment's patient userId can join).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { teleconsultApi, API_URL } from "@/portal/lib/api";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";
import { TeleconsultSignaling, type SignalingStatus } from "./Signaling";

interface Props {
  sessionId: string;
  onLocalStreamChange?: (has: boolean) => void;
  onStatusChange?: (status: SignalingStatus) => void;
  onDurationChange?: (sec: number) => void;
}

export default function TeleconsultRoom({
  sessionId,
  onLocalStreamChange,
  onStatusChange,
  onDurationChange,
}: Props) {
  const router = useRouter();
  const t = useT();
  const signalingRef = useRef<TeleconsultSignaling | null>(null);
  const [status, setStatus] = useState<SignalingStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [hasLocal, setHasLocal] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Drive the duration counter once connected.
  useEffect(() => {
    if (status !== "connected") return;
    const started = Date.now();
    const id = setInterval(() => {
      const s = Math.round((Date.now() - started) / 1000);
      setDurationSec(s);
      onDurationChange?.(s);
    }, 1000);
    return () => clearInterval(id);
  }, [status, onDurationChange]);

  // Bootstrap signaling once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await teleconsultApi.getSession(sessionId);
        if (cancelled) return;
        const signaling = new TeleconsultSignaling({
          sessionId,
          roomId: meta.session.roomId,
          apiBase: API_URL,
          iceServers: meta.iceServers,
          // Doctors are impolite (offer first); patients are polite
          // (back off on glare). This is the canonical 2-peer split
          // and avoids the negotiationneeded dance in edge cases.
          role: meta.you.role,
          polite: meta.you.role === "patient",
          onLocalStream: (stream) => {
            setHasLocal(true);
            onLocalStreamChange?.(true);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
              localVideoRef.current.muted = true;
              localVideoRef.current.play().catch(() => {});
            }
          },
          onRemoteStream: (stream) => {
            setHasRemote(true);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current.play().catch(() => {});
            }
          },
          onStatus: (s) => {
            setStatus(s);
            onStatusChange?.(s);
          },
          onPeerJoined: () => {
            // No-op; UI state via remoteVideo.
          },
          onPeerLeft: () => {
            setHasRemote(false);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          },
          onError: (err) => {
            setError(err.message);
            toast.error(err.message);
          },
          onEnded: () => {
            setStatus("ended");
            setHasRemote(false);
          },
        });
        signalingRef.current = signaling;
        await signaling.start();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to join call";
        setError(msg);
        toast.error(msg);
      }
    })();
    return () => {
      cancelled = true;
      signalingRef.current?.end();
      signalingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    signalingRef.current?.setMuted(next);
  };

  const toggleCamera = () => {
    const next = !cameraOff;
    setCameraOff(next);
    signalingRef.current?.setCameraOff(next);
  };

  const endCall = async () => {
    try {
      signalingRef.current?.end();
    } catch {}
    try {
      await teleconsultApi.endSession(sessionId);
    } catch (err) {
      // Best-effort — the DO will also close on disconnect.
    }
    router.back();
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative h-full w-full bg-black rounded-2xl overflow-hidden flex items-center justify-center">
      {/* Remote video — fills the stage. */}
      <video
        ref={remoteVideoRef}
        playsInline
        autoPlay
        className={cn(
          "w-full h-full object-cover transition-opacity",
          hasRemote ? "opacity-100" : "opacity-0"
        )}
      />
      {!hasRemote && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-3">
          {status === "connecting" || status === "reconnecting" ? (
            <>
              <Loader2 size={36} className="animate-spin text-white/60" />
              <div className="text-sm font-medium">
                {status === "connecting"
                  ? t("consult.connecting")
                  : t("consult.iceRestarting")}
              </div>
            </>
          ) : status === "ended" ? (
            <>
              <PhoneOff size={36} className="text-white/50" />
              <div className="text-sm font-medium">{t("consult.ended")}</div>
            </>
          ) : (
            <>
              <Video size={36} className="text-white/50" />
              <div className="text-sm font-medium">
                {t("consult.waitingForPatient")}
              </div>
            </>
          )}
          {error ? (
            <div className="text-xs text-rose-300 max-w-xs text-center px-4">
              {error}
            </div>
          ) : null}
        </div>
      )}

      {/* Local PiP bottom-right. */}
      <div className="absolute bottom-20 right-4 w-32 h-44 sm:w-40 sm:h-52 rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-neutral-900">
        <video
          ref={localVideoRef}
          playsInline
          autoPlay
          muted
          className={cn(
            "w-full h-full object-cover",
            hasLocal && !cameraOff ? "opacity-100" : "opacity-0"
          )}
        />
        {!hasLocal || cameraOff ? (
          <div className="absolute inset-0 flex items-center justify-center text-white/60">
            <VideoOff size={20} />
          </div>
        ) : null}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 text-white">
          {t("consult.camera")}
        </div>
      </div>

      {/* Status pill top-left + duration top-right. */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 text-white">
        {status === "connected" ? (
          <>
            <Wifi size={11} className="text-emerald-400" />
            {t("consult.connected")}
          </>
        ) : status === "reconnecting" ? (
          <>
            <WifiOff size={11} className="text-amber-400" />
            {t("consult.connectionLost")}
          </>
        ) : status === "ended" ? (
          <>
            <PhoneOff size={11} className="text-rose-400" />
            {t("consult.ended")}
          </>
        ) : (
          <>
            <Loader2 size={11} className="animate-spin" />
            {t("consult.connecting")}
          </>
        )}
      </div>
      {status === "connected" ? (
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 text-white tabular-nums">
          {formatDuration(durationSec)}
        </div>
      ) : null}

      {/* Control bar bottom center. */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-2 rounded-2xl bg-black/60 backdrop-blur">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? t("consult.unmute") : t("consult.mute")}
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center text-white transition-colors",
            muted ? "bg-rose-500/90 hover:bg-rose-500" : "bg-white/15 hover:bg-white/25"
          )}
        >
          {muted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          aria-label={cameraOff ? t("consult.cameraOn") : t("consult.cameraOff")}
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center text-white transition-colors",
            cameraOff
              ? "bg-rose-500/90 hover:bg-rose-500"
              : "bg-white/15 hover:bg-white/25"
          )}
        >
          {cameraOff ? <VideoOff size={16} /> : <Video size={16} />}
        </button>
        <button
          type="button"
          onClick={endCall}
          aria-label={t("consult.endCall")}
          className="h-10 px-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm flex items-center gap-1.5"
        >
          <PhoneOff size={14} />
          {t("consult.endCall")}
        </button>
      </div>
    </div>
  );
}