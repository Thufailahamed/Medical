import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Share,
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
  Share2,
  Lock,
  QrCode,
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
  ListItem,
  Pressable,
  Skeleton,
  useToast,
} from "@/components/ui";

const MONO = Platform.OS === "ios" ? "Menlo" : "monospace";

export default function EmailImportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useEmailAlias();
  const rotate = useRotateEmailAlias();
  const ready = !isLoading && !!data;

  async function copyAlias() {
    if (!data?.address) return;
    await Clipboard.setStringAsync(data.address);
    toast.show(t("emailImport.copiedToast"), "success");
  }

  function shareAlias() {
    if (!data?.address) return;
    Share.share({ message: data.address });
  }

  function onRotate() {
    Alert.alert(
      t("emailImport.rotateConfirmTitle"),
      t("emailImport.rotateConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("emailImport.rotateButton"),
          style: "destructive",
          onPress: () =>
            rotate.mutate(undefined, {
              onSuccess: () =>
                toast.show(t("emailImport.rotateToast"), "success"),
              onError: () =>
                toast.show(t("emailImport.rotateError"), "danger"),
            }),
        },
      ]
    );
  }

  function openMailto() {
    if (!data?.email) return;
    Linking.openURL(`mailto:${data.email}`);
  }

  const steps: { icon: LucideIcon; tone: Tone; title: string; text: string }[] = [
    { icon: Send, tone: "primary", title: t("emailImport.stepTitle1"), text: t("emailImport.howStep1") },
    { icon: FileText, tone: "accent", title: t("emailImport.stepTitle2"), text: t("emailImport.howStep2") },
    { icon: ListChecks, tone: "info", title: t("emailImport.stepTitle3"), text: t("emailImport.howStep3") },
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
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
      >
        {/* ─── Personal inbox hero ─── */}
        <View
          style={[
            {
              borderRadius: radius.xxxl,
              borderCurve: "continuous",
              overflow: "hidden",
            },
            scheme === "dark" ? null : shadow.hero,
          ]}
        >
          <LinearGradient
            colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: "absolute",
              top: -90,
              right: -70,
              width: 240,
              height: 240,
              borderRadius: 120,
              backgroundColor: "rgba(56, 189, 248, 0.22)",
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: "rgba(255, 255, 255, 0.22)",
            }}
          />

          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            {/* Title row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.lg,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.16)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.24)",
                }}
              >
                <Mail size={20} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <Text
                style={[typography.title.md, { color: "#FFFFFF", flex: 1 }]}
                numberOfLines={1}
              >
                {t("emailImport.aliasHeading")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: "rgba(16, 185, 129, 0.22)",
                }}
              >
                <Lock size={11} color="#A7F3D0" strokeWidth={2.6} />
                <Text style={[typography.caption, { color: "#D1FAE5", fontWeight: "700" }]}>
                  {t("emailImport.privateBadge")}
                </Text>
              </View>
            </View>

            {/* Address field — tap to copy */}
            <Pressable
              onPress={copyAlias}
              disabled={!ready}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={t("emailImport.copyButton")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                minHeight: 56,
                paddingLeft: spacing.lg,
                paddingRight: spacing.sm,
                borderRadius: radius.xl,
                borderCurve: "continuous",
                backgroundColor: "rgba(4, 18, 31, 0.28)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.14)",
              }}
            >
              {ready ? (
                <Text
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[
                    typography.body.md,
                    { flex: 1, fontFamily: MONO, color: "#FFFFFF", letterSpacing: -0.3 },
                  ]}
                >
                  {data.address}
                </Text>
              ) : (
                <View style={{ flex: 1 }}>
                  <ActivityIndicator color="#FFFFFF" style={{ alignSelf: "flex-start" }} />
                </View>
              )}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.14)",
                }}
              >
                <Copy size={16} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </Pressable>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <HeroButton
                icon={Copy}
                label={t("emailImport.copyButton")}
                onPress={copyAlias}
                disabled={!ready}
                solid
              />
              <HeroButton
                icon={Share2}
                label={t("emailImport.shareButton")}
                onPress={shareAlias}
                disabled={!ready}
              />
            </View>
          </View>
        </View>

        {/* ─── QR for another device ─── */}
        <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
          <View
            style={{
              padding: 8,
              borderRadius: radius.lg,
              borderCurve: "continuous",
              backgroundColor: "#FFFFFF",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairline,
            }}
          >
            {ready ? (
              <QRCode
                value={`mailto:${data.address}`}
                size={96}
                color="#0B1220"
                backgroundColor="#FFFFFF"
              />
            ) : (
              <Skeleton width={96} height={96} radius={8} />
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <QrCode size={14} color={colors.primary} strokeWidth={2.4} />
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("emailImport.qrTitle")}
              </Text>
            </View>
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>
              {t("emailImport.qrHint")}
            </Text>
          </View>
        </Card>

        {/* ─── How it works ─── */}
        <View>
          <SectionHeader title={t("emailImport.howHeading")} />
          <Card style={{ paddingVertical: spacing.lg }}>
            {steps.map((s, i) => (
              <StepRow
                key={i}
                step={i + 1}
                icon={s.icon}
                tone={s.tone}
                title={s.title}
                text={s.text}
                last={i === steps.length - 1}
              />
            ))}
          </Card>
        </View>

        {/* ─── Legacy path ─── */}
        {data?.email ? (
          <View>
            <SectionHeader title={t("emailImport.legacyTitle")} />
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

        {/* ─── Manage ─── */}
        {ready ? (
          <View>
            <SectionHeader title={t("emailImport.manageHeading")} />
            <Card padded={false}>
              <ListItem
                icon={RefreshCw}
                iconTone="danger"
                title={t("emailImport.rotateButton")}
                subtitle={t("emailImport.rotateHint")}
                onPress={rotate.isPending ? undefined : onRotate}
                trailing={
                  rotate.isPending ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : undefined
                }
                showChevron={!rotate.isPending}
                bordered={false}
              />
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

/** Pill button on the gradient hero: solid white (primary) or glass. */
function HeroButton({
  icon: Icon,
  label,
  onPress,
  solid,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  solid?: boolean;
  disabled?: boolean;
}) {
  const { spacing, typography } = useTheme();
  const fg = solid ? "#0B2B64" : "#FFFFFF";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: spacing.md,
        height: 48,
        borderRadius: 999,
        backgroundColor: solid ? "#FFFFFF" : "rgba(255, 255, 255, 0.14)",
        borderWidth: solid ? 0 : 1,
        borderColor: "rgba(255, 255, 255, 0.28)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Icon size={16} color={fg} strokeWidth={2.5} />
      <Text
        style={[typography.label.md, { color: fg, fontWeight: "700" }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Timeline step: tinted icon node + connector, bold title, body. */
function StepRow({
  step,
  icon: Icon,
  tone,
  title,
  text,
  last,
}: {
  step: number;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  text: string;
  last: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const pal = useTone(tone);
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <View style={{ alignItems: "center", width: 40 }}>
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
        {!last ? (
          <View
            style={{
              flex: 1,
              width: 2,
              minHeight: 16,
              marginVertical: 6,
              borderRadius: 1,
              backgroundColor: colors.separator,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2, paddingBottom: last ? 0 : spacing.lg }}>
        <Text style={[typography.caption, { color: pal.fg, fontWeight: "700" }]}>
          {t("emailImport.step", { n: step })}
        </Text>
        <Text style={[typography.title.sm, { color: colors.text }]}>{title}</Text>
        <Text style={[typography.body.sm, { color: colors.textMuted, lineHeight: 20 }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}
