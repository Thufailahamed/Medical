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
  const { colors, spacing, typography } = useTheme();

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

  const styles = makeStyles({ colors, spacing, typography, compact: !!props.compact });

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
        <QRCode
          value={qrValue}
          size={props.compact ? 180 : 240}
          backgroundColor="#FFFFFF"
          color="#0B1F3A"
          ecl="M"
        />
      </View>

      <View style={styles.timerBlock}>
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
        <Text style={styles.timerLabel}>
          {t("healthId.rotateIn", { seconds: props.secondsRemaining })}
        </Text>
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
}: {
  colors: any;
  spacing: any;
  typography: any;
  compact: boolean;
}) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface ?? "#FFFFFF",
      borderRadius: 20,
      padding: compact ? spacing.md : spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: compact ? spacing.sm : spacing.md,
    },
    name: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    meta: {
      fontSize: 13,
      color: colors.textSubtle,
      marginTop: 2,
    },
    purposePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.primaryMuted ?? "#EEF2FF",
    },
    purposeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    qrFrame: {
      alignItems: "center",
      padding: compact ? spacing.sm : spacing.md,
      backgroundColor: "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timerBlock: {
      marginTop: compact ? spacing.sm : spacing.md,
    },
    timerBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    timerBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    timerLabel: {
      marginTop: spacing.xs,
      fontSize: 12,
      color: colors.textSubtle,
      textAlign: "right",
    },
    hospital: {
      marginTop: spacing.xs,
      fontSize: 12,
      color: colors.textSubtle,
      textAlign: "center",
    },
  });
}