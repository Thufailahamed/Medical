import { useState } from "react";
import { View, Text, ActivityIndicator, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Inbox, Copy, RefreshCw, MailQuestion } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useEmailAlias, useRotateEmailAlias } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  SectionHeader,
  IconButton,
  useToast,
} from "@/components/ui";

export default function EmailImportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
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
        {/* ─── Your alias ──────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("emailImport.aliasHeading")} />
          <Card padded>
            {isLoading || !data ? (
              <View style={{ alignItems: "center", padding: spacing.lg }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={{ alignItems: "center", gap: spacing.md }}>
                {/* QR code */}
                <View
                  style={{
                    padding: spacing.md,
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                  }}
                >
                  <QRCode
                    value={`mailto:${data.address}`}
                    size={180}
                    color={colors.text}
                    backgroundColor={colors.surface}
                  />
                </View>

                {/* Monospace address */}
                <Text
                  selectable
                  style={[
                    typography.title.sm,
                    {
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                      color: colors.text,
                      textAlign: "center",
                    },
                  ]}
                >
                  {data.address}
                </Text>

                {/* Copy + rotate row */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.sm,
                    marginTop: spacing.xs,
                  }}
                >
                  <Button
                    title={t("emailImport.copyButton")}
                    icon={Copy}
                    variant="primary"
                    size="sm"
                    onPress={copyAlias}
                  />
                  <Button
                    title={
                      confirmingRotate
                        ? t("emailImport.confirmRotate")
                        : t("emailImport.rotateButton")
                    }
                    icon={RefreshCw}
                    variant={confirmingRotate ? "danger" : "secondary"}
                    size="sm"
                    onPress={onRotate}
                    loading={rotate.isPending}
                  />
                </View>

                <Text
                  style={[
                    typography.caption,
                    { color: colors.textMuted, textAlign: "center" },
                  ]}
                >
                  {t("emailImport.qrCaption")}
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* ─── How it works ────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("emailImport.howHeading")} />
          <Card padded>
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.body.sm, { color: colors.text }]}>
                {t("emailImport.howStep1")}
              </Text>
              <Text style={[typography.body.sm, { color: colors.text }]}>
                {t("emailImport.howStep2")}
              </Text>
              <Text style={[typography.body.sm, { color: colors.text }]}>
                {t("emailImport.howStep3")}
              </Text>
            </View>
          </Card>
        </View>

        {/* ─── Legacy path ─────────────────────────────── */}
        {data?.email ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t("emailImport.legacyHeading")} />
            <Card padded>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: colors.infoSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MailQuestion size={18} color={colors.info} strokeWidth={2.25} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body.sm, { color: colors.text }]}>
                    {t("emailImport.legacyBody", { email: data.email })}
                  </Text>
                </View>
                <IconButton
                  icon={Inbox}
                  variant="soft"
                  onPress={openMailto}
                  accessibilityLabel={t("emailImport.legacyAction")}
                />
              </View>
            </Card>
          </View>
        ) : null}

        <Button
          title={t("common.done")}
          onPress={() => router.back()}
          variant="ghost"
          fullWidth
        />
      </View>
    </Screen>
  );
}
