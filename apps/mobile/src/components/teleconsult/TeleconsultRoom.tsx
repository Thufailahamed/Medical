// @ts-nocheck

/**
 * TeleconsultRoom — patient's mobile video surface.
 *
 * Owns the TeleconsultSignaling instance, the RTCView tiles, the
 * control bar, and the connection-state pill. Reuses the same
 * signaling contract as the portal so any future "swap to SFU"
 * upgrade is one-sided.
 *
 * Auth:
 *   - The screen resolves session → ticket via the WS-ticket endpoint
 *     before constructing the signaling client (the ticket is the
 *     auth exchange RN can't do via cookies).
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { RTCView } from "react-native-webrtc";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Wifi,
  WifiOff,
} from "lucide-react-native";

import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import {
  TeleconsultSignaling,
  type SignalingStatus,
} from "@/lib/signaling";

interface Props {
  sessionId: string;
  apiBase: string;
}

interface SessionMeta {
  iceServers: RTCIceServer[];
  role: "doctor" | "patient";
}

export default function TeleconsultRoom({ sessionId, apiBase }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const { colors, radius, spacing } = useTheme();
  const signalingRef = useRef<TeleconsultSignaling | null>(null);
  const [status, setStatus] = useState<SignalingStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [hasLocal, setHasLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);
  const [, force] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Resolve session metadata (ICE servers + role).
        const meta: SessionMeta = await api(
          `/teleconsult/sessions/${sessionId}`
        );
        if (cancelled) return;
        // 2. Mint the WSS ticket (RN WebSocket can't attach cookies).
        const ticket: { ticket: string } = await api(
          `/teleconsult/sessions/${sessionId}/ws-ticket`,
          { method: "POST" }
        );
        if (cancelled) return;
        const signaling = new TeleconsultSignaling({
          sessionId,
          ticket: ticket.ticket,
          apiBase,
          iceServers: meta.iceServers,
          role: meta.role,
          polite: meta.role === "patient",
          onLocalStream: (stream) => {
            localStreamRef.current = stream;
            setHasLocal(true);
            force((n) => n + 1);
          },
          onRemoteStream: (stream) => {
            remoteStreamRef.current = stream;
            setHasRemote(true);
            force((n) => n + 1);
          },
          onStatus: setStatus,
          onError: (err) => {
            setError(err.message);
            toast.show(err.message, "error");
          },
          onPeerLeft: () => {
            setHasRemote(false);
            force((n) => n + 1);
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
        setError(err?.message || t("consult.connectionLost"));
        toast.show(t("consult.connectionLost"), "error");
      }
    })();
    return () => {
      cancelled = true;
      signalingRef.current?.end();
      signalingRef.current = null;
    };
  }, [sessionId, apiBase, t, toast]);

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
      await api(`/teleconsult/sessions/${sessionId}/end`, { method: "POST" });
    } catch {}
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Remote video — fills the stage. */}
      {hasRemote && remoteStreamRef.current ? (
        <RTCView
          streamURL={remoteStreamRef.current.toURL?.()}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          objectFit="cover"
          mirror={false}
        />
      ) : null}

      {!hasRemote ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          {status === "connecting" || status === "reconnecting" ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                  marginTop: 12,
                  fontWeight: "500",
                }}
              >
                {status === "connecting"
                  ? t("consult.connecting")
                  : t("consult.iceRestarting")}
              </Text>
            </>
          ) : status === "ended" ? (
            <>
              <PhoneOff size={36} color="rgba(255,255,255,0.5)" />
              <Text
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                  marginTop: 12,
                  fontWeight: "500",
                }}
              >
                {t("consult.ended")}
              </Text>
            </>
          ) : (
            <>
              <Video size={36} color="rgba(255,255,255,0.5)" />
              <Text
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                  marginTop: 12,
                  fontWeight: "500",
                }}
              >
                {t("consult.waitingForDoctor")}
              </Text>
            </>
          )}
          {error ? (
            <Text
              style={{
                color: "#FDA4AF",
                fontSize: 12,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Local PiP bottom-right */}
      <View
        style={{
          position: "absolute",
          bottom: 110,
          right: 12,
          width: 110,
          height: 150,
          borderRadius: radius.lg,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.25)",
          backgroundColor: "#111",
        }}
      >
        {hasLocal && localStreamRef.current && !cameraOff ? (
          <RTCView
            streamURL={localStreamRef.current.toURL?.()}
            style={{ flex: 1 }}
            objectFit="cover"
            mirror
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <VideoOff size={20} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </View>

      {/* Status pill top */}
      <View
        style={{
          position: "absolute",
          top: 56,
          left: 12,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: "rgba(0,0,0,0.6)",
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        {status === "connected" ? (
          <Wifi size={11} color="#34D399" />
        ) : status === "reconnecting" ? (
          <WifiOff size={11} color="#FBBF24" />
        ) : status === "ended" ? (
          <PhoneOff size={11} color="#FB7185" />
        ) : (
          <ActivityIndicator size="small" color="#fff" />
        )}
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
          {status === "connected"
            ? t("consult.connected")
            : status === "reconnecting"
              ? t("consult.connectionLost")
              : status === "ended"
                ? t("consult.ended")
                : t("consult.connecting")}
        </Text>
      </View>

      {/* Control bar bottom */}
      <View
        style={{
          position: "absolute",
          bottom: 32,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable
          onPress={toggleMute}
          accessibilityLabel={muted ? t("consult.unmute") : t("consult.mute")}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: muted ? "#F43F5E" : "rgba(255,255,255,0.18)",
          }}
        >
          {muted ? (
            <MicOff size={18} color="#fff" />
          ) : (
            <Mic size={18} color="#fff" />
          )}
        </Pressable>
        <Pressable
          onPress={toggleCamera}
          accessibilityLabel={
            cameraOff ? t("consult.cameraOn") : t("consult.cameraOff")
          }
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: cameraOff ? "#F43F5E" : "rgba(255,255,255,0.18)",
          }}
        >
          {cameraOff ? (
            <VideoOff size={18} color="#fff" />
          ) : (
            <Video size={18} color="#fff" />
          )}
        </Pressable>
        <Pressable
          onPress={endCall}
          accessibilityLabel={t("consult.endCall")}
          style={{
            paddingHorizontal: 22,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F43F5E",
            flexDirection: "row",
            gap: 6,
          }}
        >
          <PhoneOff size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
            {t("consult.endCall")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}