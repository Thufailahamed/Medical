// @ts-nocheck

/**
 * DoctorWaitingBanner — passive in-app banner mounted in (doctor)/_layout.
 *
 * Surfaces when /teleconsult/sessions/me/active returns a live session for
 * the doctor:
 *   - status="requested"  → "Video session created — tap to enter"
 *   - status="ringing"|"active" → "Call in progress — tap to return"
 *
 * Tap → router.push to /(doctor)/teleconsult/[roomId]. Dismiss → hide for
 * the current session id (resets when roomId changes or session ends).
 *
 * Realtime: useRealtime() in (doctor)/_layout already invalidates the
 * ["teleconsult","me","active"] query on `teleconsult` notification events
 * (apps/mobile/src/hooks/useRealtime.ts:42-46), so the banner picks up
 * status flips within ~5s (staleTime).
 */

import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Video, PhoneIncoming, X } from "lucide-react-native";
import { useActiveTeleconsultSession } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";

export default function DoctorWaitingBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { data, isLoading } = useActiveTeleconsultSession();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const session = data?.session ?? null;
  const dismissed = session ? dismissedFor === session.roomId : false;

  if (isLoading || !session || dismissed) return null;

  // Hide for terminal statuses — they should already be gone from
  // /me/active, but be defensive against the brief race after end.
  if (session.status === "ended" || session.status === "failed" || session.status === "timeout") {
    return null;
  }

  const isLive = session.status === "ringing" || session.status === "active";
  const Icon = isLive ? PhoneIncoming : Video;
  const tint = isLive ? "success" : "primary";
  const toneBg = isLive ? colors.successSoft : colors.primarySoft;
  const toneFg = isLive ? colors.success : colors.primary;
  const label = isLive
    ? t("consult.bannerInCall", "Call in progress — tap to return")
    : t("consult.bannerWaiting", "Video session created — tap to enter");

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: spacing.md,
        left: spacing.md,
        right: spacing.md,
        zIndex: 50,
      }}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(doctor)/teleconsult/[roomId]" as any,
            params: { roomId: session.roomId },
          })
        }
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingVertical: 10,
          paddingHorizontal: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: toneBg,
          borderWidth: 1,
          borderColor: toneFg,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: toneFg,
          }}
        >
          <Icon size={18} color="#fff" strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[typography.body.sm, { color: colors.text, fontWeight: "700" }]}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={[typography.caption, { color: colors.textMuted }]}
          >
            {t("consult.bannerRoom", { roomId: session.roomId })}
          </Text>
        </View>
        <Pressable
          onPress={() => setDismissedFor(session.roomId)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("consult.bannerDismiss", "Dismiss")}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={16} color={colors.textMuted} strokeWidth={2.25} />
        </Pressable>
      </Pressable>
    </View>
  );
}