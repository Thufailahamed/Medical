// @ts-nocheck

/**
 * TeleconsultRoom — native WebRTC video surface (patient + doctor).
 *
 * Owns:
 *   • The TeleconsultSignaling client (WebRTC + WS, lib/signaling.ts).
 *   • The <RTCView> elements — remote fills the stage, local PiP corner.
 *   • The control bar (mute, camera, flip, end).
 *   • The status pill + duration counter.
 *
 * Lifecycle:
 *   - On mount: GET /teleconsult/sessions/:id → mint ws-ticket →
 *     signaling.start().
 *   - On "end": POST /teleconsult/sessions/:id/end, close signaling,
 *     navigate back.
 *
 * Auth: the WS upgrade carries a 60s purpose-scoped ticket
 * (?ticket=<jwt>) — minted fresh on every connect/reconnect because
 * RN WebSocket can't ride the portal_session cookie.
 *
 * react-native-webrtc is a native module — in Expo Go (no native code)
 * the require() fails and we render the error state instead of crashing.
 */

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  Wifi,
  WifiOff,
} from "lucide-react-native";

import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  TeleconsultSignaling,
  type SignalingStatus,
} from "@/lib/signaling";

// Native module — absent in Expo Go.
let RTCView: any = null;
try {
  RTCView = require("react-native-webrtc").RTCView;
} catch {}

interface Props {
  sessionId: string;
  apiBase: string;
}

interface SessionDetail {
  session: {
    id: string;
    roomId: string;
    status: string;
    appointmentId: string;
  };
  iceServers: any[];
  partyMax: number;
  you: { role: "doctor" | "patient"; userId: string };
}

export default function TeleconsultRoom({ sessionId, apiBase }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();

  const signalingRef = useRef<TeleconsultSignaling | null>(null);
  const [status, setStatus] = useState<SignalingStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Duration counter once connected.
  useEffect(() => {
    if (status !== "connected") return;
    const started = Date.now();
    const id = setInterval(() => {
      setDurationSec(Math.round((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Bootstrap signaling once on mount.
  useEffect(() => {
    let cancelled = false;
    if (!RTCView) {
      setError(t("consult.permissionDenied"));
      return;
    }
    (async () => {
      try {
        const detail: SessionDetail = await api(
          `/teleconsult/sessions/${sessionId}`
        );
        if (cancelled) return;

        // Fresh ticket per connect/reconnect — they expire in 60s.
        const getTicket = async () => {
          try {
            const res = await api<{ ticket: string }>(
              `/teleconsult/sessions/${sessionId}/ws-ticket`,
              { method: "POST" }
            );
            return res.ticket;
          } catch {
            return undefined;
          }
        };

        const signaling = new TeleconsultSignaling({
          sessionId,
          apiBase,
          iceServers: detail.iceServers ?? [],
          role: detail.you.role,
          polite: detail.you.role === "patient",
          getTicket,
          onLocalStream: (stream: any) => setLocalStream(stream),
          onRemoteStream: (stream: any) => {
            setRemoteStream(stream);
            setHasRemote(true);
          },
          onStatus: (s: SignalingStatus) => {
            setStatus(s);
            if (s === "connected") setError(null);
            if (s === "failed")
              toast.show(t("consult.connectionLost"), "danger");
          },
          onPeerLeft: () => {
            setHasRemote(false);
            setRemoteStream(null);
          },
          onError: (err: Error) => {
            setError(err.message);
          },
          onEnded: () => {
            setStatus("ended");
            setHasRemote(false);
          },
        });
        signalingRef.current = signaling;
        await signaling.start();
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || t("consult.connectionLost");
        setError(msg);
        toast.show(msg, "danger");
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

  const flipCamera = () => {
    try {
      localStream?.getVideoTracks?.()?.[0]?._switchCamera?.();
    } catch {}
  };

  const endCall = async () => {
    try {
      signalingRef.current?.end();
    } catch {}
    try {
      await api(`/teleconsult/sessions/${sessionId}/end`, { method: "POST" });
    } catch {}
    router.back();
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      {/* Remote video — fills the stage. */}
      {remoteStream && RTCView ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={[styles.remote, !hasRemote && styles.hidden]}
          objectFit="cover"
        />
      ) : null}
      {!hasRemote && (
        <View style={styles.centerOverlay}>
          {status === "connecting" || status === "reconnecting" ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.statusText}>
                {status === "connecting"
                  ? t("consult.connecting")
                  : t("consult.iceRestarting")}
              </Text>
            </>
          ) : status === "ended" ? (
            <>
              <PhoneOff size={36} color="rgba(255,255,255,0.5)" />
              <Text style={styles.statusText}>{t("consult.ended")}</Text>
            </>
          ) : status === "failed" || error ? (
            <>
              <PhoneOff size={36} color="rgba(255,255,255,0.5)" />
              <Text style={styles.statusText}>
                {t("consult.connectionLost")}
              </Text>
            </>
          ) : (
            <>
              <Video size={36} color="rgba(255,255,255,0.5)" />
              <Text style={styles.statusText}>
                {t("consult.waitingForPatient")}
              </Text>
            </>
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      )}

      {/* Local PiP bottom-right (above the control bar). */}
      <View style={styles.pip}>
        {localStream && RTCView && !cameraOff ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.pipVideo}
            objectFit="cover"
            mirror={true}
          />
        ) : (
          <View style={styles.pipOff}>
            <VideoOff size={20} color="rgba(255,255,255,0.6)" />
          </View>
        )}
        <View style={styles.pipLabel}>
          <Text style={styles.pipLabelText}>{t("consult.camera")}</Text>
        </View>
      </View>

      {/* Status pill top-left + duration top-right. */}
      <View style={styles.statusPill}>
        {status === "connected" ? (
          <>
            <Wifi size={11} color="#34d399" />
            <Text style={styles.pillText}>{t("consult.connected")}</Text>
          </>
        ) : status === "reconnecting" ? (
          <>
            <WifiOff size={11} color="#fbbf24" />
            <Text style={styles.pillText}>{t("consult.connectionLost")}</Text>
          </>
        ) : status === "ended" ? (
          <>
            <PhoneOff size={11} color="#fb7185" />
            <Text style={styles.pillText}>{t("consult.ended")}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size={11} color="#fff" />
            <Text style={styles.pillText}>{t("consult.connecting")}</Text>
          </>
        )}
      </View>
      {status === "connected" ? (
        <View style={styles.durationPill}>
          <Text style={styles.pillText}>{formatDuration(durationSec)}</Text>
        </View>
      ) : null}

      {/* Control bar bottom center. */}
      <View style={styles.controls}>
        <Pressable
          onPress={toggleMute}
          accessibilityLabel={muted ? t("consult.unmute") : t("consult.mute")}
          style={[styles.controlBtn, muted && styles.controlBtnDanger]}
        >
          {muted ? (
            <MicOff size={16} color="#fff" />
          ) : (
            <Mic size={16} color="#fff" />
          )}
        </Pressable>
        <Pressable
          onPress={toggleCamera}
          accessibilityLabel={
            cameraOff ? t("consult.cameraOn") : t("consult.cameraOff")
          }
          style={[styles.controlBtn, cameraOff && styles.controlBtnDanger]}
        >
          {cameraOff ? (
            <VideoOff size={16} color="#fff" />
          ) : (
            <Video size={16} color="#fff" />
          )}
        </Pressable>
        <Pressable
          onPress={flipCamera}
          accessibilityLabel={t("consult.flipCamera", "Flip camera")}
          style={styles.controlBtn}
        >
          <SwitchCamera size={16} color="#fff" />
        </Pressable>
        <Pressable
          onPress={endCall}
          accessibilityLabel={t("consult.endCall")}
          style={styles.endBtn}
        >
          <PhoneOff size={16} color="#fff" />
          <Text style={styles.endBtnText}>{t("consult.endCall")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  remote: {
    ...StyleSheet.absoluteFillObject,
  },
  hidden: {
    opacity: 0,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  statusText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  errorText: {
    color: "#fda4af",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  pip: {
    position: "absolute",
    bottom: 84,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#171717",
  },
  pipVideo: {
    width: "100%",
    height: "100%",
  },
  pipOff: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pipLabel: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  pipLabelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  statusPill: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  durationPill: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  pillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  controls: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  controlBtn: {
    height: 40,
    width: 40,
    borderRadius: 20,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  controlBtnDanger: {
    backgroundColor: "rgba(244,63,94,0.9)",
  },
  endBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e11d48",
  },
  endBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
