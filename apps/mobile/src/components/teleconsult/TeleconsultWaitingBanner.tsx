// @ts-nocheck

/**
 * TeleconsultWaitingBanner — passive in-app banner for live video sessions.
 *
 * Surfaces when /teleconsult/sessions/me/active returns a live session:
 *   - status="requested"  → "Video session created — tap to enter"
 *   - status="ringing"|"active" → "Call in progress — tap to return"
 *
 * Tap → router.push to the role's teleconsult room route. Dismiss hides
 * for the current roomId (resets when the room changes or the call ends).
 *
 * Realtime: mount alongside useRealtime() (which invalidates
 * ["teleconsult","me","active"] on `teleconsult` SSE events) so the banner
 * picks up status flips within ~5s (staleTime).
 */

import { useEffect, useRef, useState } from "react";
import { Animated, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, PhoneIncoming, X, ChevronRight } from "lucide-react-native";
import { useActiveTeleconsultSession } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";

export default function TeleconsultWaitingBanner({
  roomPathname,
}: {
  /** Route of the in-call screen, e.g. "/(doctor)/teleconsult/[roomId]". */
  roomPathname: "/(doctor)/teleconsult/[roomId]" | "/(app)/teleconsult/[roomId]";
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const { data, isLoading } = useActiveTeleconsultSession();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const session = data?.session ?? null;
  const dismissed = session ? dismissedFor === session.roomId : false;

  const isLive =
    !!session && (session.status === "ringing" || session.status === "active");

  // Gentle pulse on the live dot while a call is ringing/active.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulse]);

  if (isLoading || !session || dismissed) return null;

  // Hide for terminal statuses — they should already be gone from
  // /me/active, but be defensive against the brief race after end.
  if (session.status === "ended" || session.status === "failed" || session.status === "timeout") {
    return null;
  }

  const Icon = isLive ? PhoneIncoming : Video;
  const toneFg = isLive ? colors.success : colors.primary;
  const label = isLive
    ? t("consult.bannerInCall", "Call in progress")
    : t("consult.bannerWaiting", "Video session created");
  const cta = isLive
    ? t("consult.bannerReturn", "Return")
    : t("consult.bannerJoin", "Join");

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + spacing.xs,
        left: spacing.md,
        right: spacing.md,
        zIndex: 50,
        elevation: 6,
      }}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: roomPathname as any,
            params: { roomId: session.roomId },
          })
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingVertical: 10,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: toneFg,
          }}
        >
          <Icon size={18} color="#fff" strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {isLive && (
              <Animated.View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: toneFg,
                  opacity: pulse,
                }}
              />
            )}
            <Text
              numberOfLines={1}
              style={[typography.body.sm, { color: colors.text, fontWeight: "700" }]}
            >
              {label}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[typography.caption, { color: colors.textMuted }]}
          >
            {t("consult.bannerRoom", { roomId: session.roomId })}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: radius.full,
            backgroundColor: toneFg,
          }}
        >
          <Text style={[typography.caption, { color: "#fff", fontWeight: "700" }]}>
            {cta}
          </Text>
          <ChevronRight size={14} color="#fff" strokeWidth={2.5} />
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
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <X size={14} color={colors.textMuted} strokeWidth={2.25} />
        </Pressable>
      </Pressable>
    </View>
  );
}
