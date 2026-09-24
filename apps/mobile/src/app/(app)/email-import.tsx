import { useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import {
  Copy,
  RefreshCw,
  MailQuestion,
  Mail,
  Send,
  FileText,
  ListChecks,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useEmailAlias, useRotateEmailAlias } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  SectionHeader,
  Divider,
  ListItem,
  Pressable,
  useToast,
} from "@/components/ui";

export default function EmailImportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useEmailAlias();
  const rotate = useRotateEmailAlias();
  const [confirmingRotate, setConfirmingRotate] = useState(false);

  async function copyAlias() {
    if (!data?.address) return;
    await Clipboard.setStringAsync(data.address);
    toast.show(t("emailImport.copiedToast"), "success");
  }

  function onRotate() {
    if (confirmingRotate) {
      setConfirmingRotate(false);
      rotate.mutate(undefined, {
        onSuccess: () =>
          toast.show(t("emailImport.rotateToast"), "success"),
        onError: () =>
          toast.show(t("emailImport.rotateError"), "danger"),
      });
    } else {
      setConfirmingRotate(true);
    }
  }

  function openMailto() {
    if (!data?.email) return;
    Linking.openURL(`mailto:${data.email}`);
  }

  const steps: { icon: LucideIcon; tone: Tone; text: string }[] = [
    { icon: Send, tone: "primary", text: t("emailImport.howStep1") },
    { icon: FileText, tone: "accent", text: t("emailImport.howStep2") },
    { icon: ListChecks, tone: "info", text: t("emailImport.howStep3") },
  ];

  return (
    <Screen padded={false} edges={["top"]} bottomInset scroll>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("emailImport.title")}
        subtitle={t("emailImport.subtitle")}
      />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
      >
        {/* ─── Personal inbox hero (gradient + ticket) ─── */}
        <View
          style={{
            borderRadius: radius.xxxl,
            borderCurve: "continuous",
            overflow: "hidden",
            ...shadow.hero,
          }}
        >
          <LinearGradient
            colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* radial accent overlays */}
          <View
            style={{
              position: "absolute",
              top: -80,
              right: -60,
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: "rgba(56, 189, 248, 0.30)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -100,
              left: -60,
              width: 240,
              height: 240,
              borderRadius: 120,
              backgroundColor: "rgba(14, 165, 233, 0.28)",
            }}
          />
          {/* top sheen */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: "rgba(255, 255, 255, 0.25)",
            }}
          />
          {/* mail watermark */}
          <View
            pointerEvents="none"
            style={{ position: "absolute", right: -14, top: -14, opacity: 0.08 }}
          >
            <Mail size={140} color="#FFFFFF" strokeWidth={1.5} />
          </View>

          <View
            style={{
              padding: spacing.xl,
              gap: spacing.lg,
              alignItems: "stretch",
            }}
          >
            <Text
              style={[
                typography.overline,
                {
                  color: "rgba(255, 255, 255, 0.75)",
                  letterSpacing: 1.4,
                  textAlign: "center",
                },
              ]}
            >
              {t("emailImport.aliasHeading").toUpperCase()}
            </Text>

            {/* white ticket */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                borderCurve: "continuous",
                padding: spacing.lg,
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              {isLoading || !data ? (
                <View
                  style={{
                    height: 170,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <>
                  <QRCode
                    value={`mailto:${data.address}`}
                    size={170}
                    color={colors.text}
                    backgroundColor="#FFFFFF"
                  />
                  <DashLine />
                  <Text
                    selectable
                    style={[
                      typography.title.sm,
                      {
                        fontFamily:
                          Platform.OS === "ios" ? "Menlo" : "monospace",
                        color: colors.text,
                        textAlign: "center",
                        letterSpacing: -0.2,
                      },
                    ]}
                  >
                    {data.address}
                  </Text>
                </>
              )}
            </View>

            {/* glass actions */}
            {!isLoading && data ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: spacing.sm,
                  flexWrap: "wrap",
                }}
              >
                <GlassButton
                  icon={Copy}
                  label={t("emailImport.copyButton")}
                  onPress={copyAlias}
                />
                <GlassButton
                  icon={RefreshCw}
                  label={
                    confirmingRotate
                      ? t("emailImport.confirmRotate")
                      : t("emailImport.rotateButton")
                  }
                  danger={confirmingRotate}
                  loading={rotate.isPending}
                  onPress={onRotate}
                />
              </View>
            ) : null}

            <Text
              style={[
                typography.caption,
                {
                  color: "rgba(255, 255, 255, 0.75)",
                  textAlign: "center",
                },
              ]}
            >
              {t("emailImport.qrCaption")}
            </Text>
          </View>
        </View>

        {/* ─── How it works ────────────────────────────── */}
        <View>
          <SectionHeader title={t("emailImport.howHeading")} />
          <Card padded={false}>
            {steps.map((s, i) => (
              <View key={i}>
                <StepRow step={i + 1} icon={s.icon} tone={s.tone} text={s.text} />
                {i < steps.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </View>

        {/* ─── Legacy path ─────────────────────────────── */}
        {data?.email ? (
          <View>
            <SectionHeader title={t("emailImport.legacyHeading")} />
            <Card padded={false}>
              <ListItem
                icon={MailQuestion}
                iconTone="info"
                title={data.email}
                subtitle={t("emailImport.legacyHint")}
                onPress={openMailto}
                showChevron
                bordered={false}
                accessibilityHint={t("emailImport.legacyAction")}
              />
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

/** Translucent pill button rendered on the gradient hero card. */
function GlassButton({
  icon: Icon,
  label,
  onPress,
  danger,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  const { spacing, typography } = useTheme();
  const fg = danger ? "#B91C1C" : "#FFFFFF";
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md + 2,
        height: 38,
        borderRadius: 999,
        backgroundColor: danger
          ? "rgba(254, 226, 226, 0.95)"
          : "rgba(255, 255, 255, 0.16)",
        borderWidth: 1,
        borderColor: danger
          ? "rgba(254, 226, 226, 1)"
          : "rgba(255, 255, 255, 0.32)",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Icon size={14} color={fg} strokeWidth={2.5} />
      )}
      <Text
        style={[typography.label.md, { color: fg, fontWeight: "700" }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Numbered step row for the "How it works" card. */
function StepRow({
  step,
  icon: Icon,
  tone,
  text,
}: {
  step: number;
  icon: LucideIcon;
  tone: Tone;
  text: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const pal = useTone(tone);
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.lg,
        alignItems: "flex-start",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          backgroundColor: pal.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={pal.fg} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            typography.overline,
            { color: pal.fg, letterSpacing: 1.1, fontSize: 10 },
          ]}
        >
          {t("emailImport.step", { n: step }).toUpperCase()}
        </Text>
        <Text style={[typography.body.sm, { color: colors.text }]}>{text}</Text>
      </View>
    </View>
  );
}

/** Dashed divider used inside the QR ticket. */
function DashLine() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignSelf: "stretch",
      }}
    >
      {Array.from({ length: 22 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 1.5,
            borderRadius: 1,
            backgroundColor: colors.border,
          }}
        />
      ))}
    </View>
  );
}
