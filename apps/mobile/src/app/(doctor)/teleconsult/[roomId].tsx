// @ts-nocheck

/**
 * /(doctor)/teleconsult/[roomId] — Doctor's video consult surface.
 *
 * Mirrors the patient wrapper at apps/mobile/src/app/(app)/teleconsult/
 * [roomId].tsx but resolves patientId from GET /teleconsult/sessions/:id
 * and mounts <DoctorSidePanel> instead of <RecordsDrawer>. Same two-branch
 * resolution:
 *
 *   - Legacy branch (real roomId): GET /teleconsult/sessions/me/active →
 *     assert roomId matches → GET /teleconsult/sessions/:id → render room.
 *   - Pending branch (roomId === "__pending__"): poll /me/active every 5s,
 *     router.replace to the real roomId once one appears.
 *
 * Auth: standard mobile Bearer token + purpose-scoped WSS ticket for the
 * WebSocket upgrade (RN WebSocket can't ride the SecureStore JWT via
 * cookies — same as patient).
 */

import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { PhoneOff } from "lucide-react-native";

import TeleconsultRoom from "@/components/teleconsult/TeleconsultRoom";
import DoctorSidePanel from "@/components/teleconsult/DoctorSidePanel";
import { api, getApiBaseUrl } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";

interface ActiveSessionResp {
  session: {
    id: string;
    roomId: string;
    status: string;
    appointmentId: string;
    createdAt: string;
  } | null;
}

interface SessionDetail {
  session: {
    id: string;
    roomId: string;
    status: string;
    appointmentId: string;
    patientId: string | null;
    startedAt: string | null;
    endedAt: string | null;
  };
  iceServers: any[];
  partyMax: number;
  you: { role: "doctor" | "patient"; userId: string };
}

export default function DoctorTeleconsultPage() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { radius } = useTheme();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const apiBase = getApiBaseUrl();

  useEffect(() => {
    let cancelled = false;
    if (roomId !== "__pending__") {
      (async () => {
        try {
          const active: ActiveSessionResp = await api(
            "/teleconsult/sessions/me/active"
          );
          if (cancelled) return;
          if (!active.session || active.session.roomId !== roomId) {
            setError(t("consult.waitingForPatient"));
            setWaiting(true);
            setLoading(false);
            return;
          }
          // Detail fetch gives us patientId; the room itself doesn't
          // need it but the side panel does.
          const detail: SessionDetail = await api(
            `/teleconsult/sessions/${active.session.id}`
          );
          if (cancelled) return;
          setSessionId(detail.session.id);
          setPatientId(detail.session.patientId ?? null);
          setAppointmentId(detail.session.appointmentId);
          setLoading(false);
        } catch (err: any) {
          if (cancelled) return;
          setError(err?.message || t("consult.connectionLost"));
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setLoading(false);
    setWaiting(true);
    setError(t("consult.waitingForPatient"));
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const active: ActiveSessionResp = await api(
          "/teleconsult/sessions/me/active"
        );
        if (cancelled || !active.session) return;
        clearInterval(interval);
        router.replace({
          pathname: "/(doctor)/teleconsult/[roomId]" as any,
          params: { roomId: active.session.roomId },
        });
      } catch {
        // network blip — keep polling
      }
    }, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, t, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 12 }}>
          {t("consult.connecting")}
        </Text>
      </View>
    );
  }

  if (error || !sessionId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        {waiting ? (
          <ActivityIndicator
            size="large"
            color="#fff"
            style={{ marginBottom: 16 }}
          />
        ) : (
          <PhoneOff size={28} color="#fff" style={{ marginBottom: 16 }} />
        )}
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {t("consult.waitingForPatient")}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {error}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 22,
            paddingVertical: 10,
            borderRadius: radius.lg,
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {t("consult.leave")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ flex: 1 }}>
        <TeleconsultRoom sessionId={sessionId} apiBase={apiBase} />
      </View>
      <DoctorSidePanel
        patientId={patientId}
        appointmentId={appointmentId ?? undefined}
      />
    </View>
  );
}