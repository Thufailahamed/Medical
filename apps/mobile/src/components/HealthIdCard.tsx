// QR-Code Check-in & Dispensing: the rotating QR card.
//
// Renders a 240×240 QR (via react-native-qrcode-svg) above the patient
// identity row + a countdown progress bar. The card itself is dumb:
// it takes the patient info + token from props and renders. All
// rotation / refresh logic lives in the parent screen so the card can
// be reused inside the patient picker sheet, caretaker preview, etc.
//
// The QR encodes a compact JSON blob (`{t, p, h?}`) — see
// `lib/healthId.ts`. The token itself is the authoritative lookup key;
// payload fields are scanner hints only.

import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCodeImpl from "react-native-qrcode-svg";
import { useTranslation } from "react-i18next";

// react-native-qrcode-svg hasn't shipped React 19-compatible types yet;
// cast through `unknown` so the JSX usage compiles without `any`.
const QRCode = QRCodeImpl as unknown as React.ComponentType<{
  value: string;
  size: number;
  backgroundColor?: string;
  color?: string;
  ecl?: "L" | "M" | "Q" | "H";
}>;
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar } from "@/components/ui";
import {
  encodeHealthIdPayload,
  type HealthIdPurpose,
} from "@/lib/healthId";

export interface HealthIdCardProps {
  token: string;
  purpose: HealthIdPurpose;
  expiresAt: string;
  rotationSeconds: number;
  secondsRemaining: number;
  patientName: string;
  patientPhoto?: string | null;
  nicTail?: string | null;
  bloodGroup?: string | null;
  hospitalId?: string | null;
  hospitalName?: string | null;
  compact?: boolean;
}

function purposeLabelKey(p: HealthIdPurpose): string {
  switch (p) {
    case "checkin":
      return "healthId.purpose.checkin";
    case "dispense":
      return "healthId.purpose.dispense";
    case "id":
      return "healthId.purpose.id";
    case "all":
    default:
      return "healthId.purpose.all";
  }
}

export function HealthIdCard(props: HealthIdCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography, scheme } = useTheme();

  const qrValue = useMemo(
    () =>
      encodeHealthIdPayload(
        props.token,
        props.purpose,
        props.hospitalId ?? null,
      ),
    [props.token, props.purpose, props.hospitalId],
  );

  const pct = Math.max(
    0,
    Math.min(1, props.secondsRemaining / Math.max(1, props.rotationSeconds)),
  );
  const pctLabel = Math.round(pct * 100);

  const styles = makeStyles({ colors, spacing, typography, compact: !!props.compact, isDark: scheme === "dark" });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Avatar
          source={props.patientPhoto ? { uri: props.patientPhoto } : undefined}
          name={props.patientName}
          size={props.compact ? "sm" : "md"}
        />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.name} numberOfLines={1}>
            {props.patientName || t("healthId.unnamed")}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {props.nicTail ? `••• ${props.nicTail}` : ""}
            {props.bloodGroup ? `  ·  ${props.bloodGroup}` : ""}
          </Text>
        </View>
        <View style={styles.purposePill}>
          <Text style={styles.purposeText}>
            {t(purposeLabelKey(props.purpose))}
          </Text>
        </View>
      </View>

      <View style={styles.qrFrame}>
        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <View key={c} pointerEvents="none" style={[styles.corner, styles[c]]} />
        ))}
        <QRCode
          value={qrValue}
          size={props.compact ? 180 : 240}
          backgroundColor="#FFFFFF"
          color="#0B1F3A"
          ecl="M"
        />
      </View>

      <View style={styles.timerBlock}>
        <View style={styles.timerHead}>
          <Text style={styles.timerLabel}>
            {t("healthId.rotateIn", { seconds: props.secondsRemaining })}
          </Text>
          <Text style={styles.timerPct}>{props.secondsRemaining}s</Text>
        </View>
        <View style={styles.timerBarTrack}>
          <View
            style={[
              styles.timerBarFill,
              {
                width: `${pctLabel}%`,
                backgroundColor:
                  pct > 0.4
                    ? colors.success ?? "#10B981"
                    : pct > 0.15
                      ? colors.warning ?? "#F59E0B"
                      : colors.danger ?? "#EF4444",
              },
            ]}
          />
        </View>
      </View>

      {props.hospitalName ? (
        <Text style={styles.hospital} numberOfLines={1}>
          {t("healthId.issuedAt", { hospital: props.hospitalName })}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Styles (kept inline so the card stays self-contained) ──

function makeStyles({
  colors,
  spacing,
  typography,
  compact,
  isDark,
}: {
  colors: any;
  spacing: any;
  typography: any;
  compact: boolean;
  isDark: boolean;
}) {
  const cornerSize = compact ? 18 : 24;
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface ?? "#FFFFFF",
      borderRadius: 22,
      borderCurve: "continuous",
      padding: compact ? spacing.md : spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? colors.borderStrong : colors.hairline ?? colors.separator,
      shadowColor: "#0B1B3A",
      shadowOpacity: isDark ? 0 : 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: compact ? spacing.sm : spacing.lg,
    },
    name: {
      ...typography.title.md,
      color: colors.text,
    },
    meta: {
      ...typography.caption,
      color: colors.textSubtle,
      marginTop: 2,
    },
    purposePill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.primarySoft ?? "#EEF2FF",
    },
    purposeText: {
      ...typography.label.xs,
      color: colors.primary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    qrFrame: {
      alignSelf: "center",
      alignItems: "center",
      padding: compact ? spacing.md : spacing.lg,
      backgroundColor: "#FFFFFF",
      borderRadius: 20,
      borderCurve: "continuous",
    },
    corner: {
      position: "absolute",
      width: cornerSize,
      height: cornerSize,
      borderColor: colors.primary,
    },
    tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
    tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
    bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
    br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
    timerBlock: {
      marginTop: compact ? spacing.sm : spacing.lg,
    },
    timerHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    timerBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.fill ?? colors.border,
      overflow: "hidden",
    },
    timerBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    timerLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    timerPct: {
      ...typography.label.sm,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    hospital: {
      ...typography.caption,
      marginTop: spacing.sm,
      color: colors.textSubtle,
      textAlign: "center",
    },
  });
}
