// @ts-nocheck
import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { WebView } from "react-native-webview";
import { X } from "lucide-react-native";

import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast } from "@/components/ui/Toast";

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
    wherebyUrl: string;
  };
}

export default function TeleconsultRoom({ sessionId, apiBase }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const { colors, radius, spacing } = useTheme();

  const [wherebyUrl, setWherebyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail: SessionDetail = await api(`/teleconsult/sessions/${sessionId}`);
        if (cancelled) return;

        if (detail?.session?.wherebyUrl) {
          setWherebyUrl(detail.session.wherebyUrl);
        } else {
          setError(t("consult.connectionLost"));
        }
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || t("consult.connectionLost"));
        toast.show(t("consult.connectionLost"), "error");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, t, toast]);

  const endCall = async () => {
    try {
      await api(`/teleconsult/sessions/${sessionId}/end`, { method: "POST" });
    } catch {}
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>{t("consult.connecting")}</Text>
      </View>
    );
  }

  if (error || !wherebyUrl) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>{t("consult.waitingForDoctor")}</Text>
        <Text style={styles.errorText}>{error || t("consult.connectionLost")}</Text>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { borderRadius: radius.lg }]}>
          <Text style={styles.backButtonText}>{t("consult.leave")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: wherebyUrl }}
        style={styles.webview}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        onPermissionRequest={(request) => {
          request.grant(request.resources);
        }}
        onNavigationStateChange={(navState) => {
          // If the WebView navigates away from the room URL (e.g. user leaves the call), close the screen
          const cleanRoomUrl = wherebyUrl.split("?")[0];
          if (!navState.url.startsWith(cleanRoomUrl)) {
            endCall();
          }
        }}
      />

      {/* Floating overlay close button */}
      <Pressable onPress={endCall} style={styles.closeButton}>
        <X size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 12,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  errorText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
});