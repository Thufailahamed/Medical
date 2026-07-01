// @ts-nocheck

// Phase E-Rx 7: Public prescription verification page.
// Anyone with a prescription id (from a PDF QR code or a shared URL)
// can land here and see whether the prescription is authentic, what
// medicines it carries, who signed it, and when. The backend endpoint
// GET /verify/:id is unauthenticated and returns NO patient PHI — only
// doctor identity + SLMC + medicine names + signature metadata.
//
// Mobile layout mirrors the visual rhythm of the rest of the app
// (ScreenHeader → status card → meta → actions) so it doesn't feel
// like a foreign island.

import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ShieldCheck,
  ShieldAlert,
  ScanLine,
  Stethoscope,
  Pill,
  CalendarDays,
  Hash,
  Share2,
} from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import {
  useVerifyPrescription,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  useToast,
} from "@/components/ui";

export default function VerifyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography, radius } = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useVerifyPrescription(id as string);

  const valid = data?.valid === true;
  const hasSig = !!data?.signedAt && !!data?.payloadHash;

  const verifyUrl = useMemo(() => {
    if (!id) return "";
    // Mirrors the URL embedded in the PDF QR. The verify endpoint
    // itself is canonical; deep-linking the app back into the
    // same URL keeps the round-trip identical to the web flow.
    return `https://app.healthhub.app/verify/${id}`;
  }, [id]);

  async function onShare() {
    if (!verifyUrl) return;
    try {
      const Sharing = await import("expo-sharing").then((m) => m.default);
      const FileSystem = await import("expo-file-system");
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        toast.show(t("verify.shareUnavailable"), "warning");
        return;
      }
      // Hand the verify URL to the OS share sheet as a plain text
      // payload — the recipient can tap it to open the web verifier.
      // (We deliberately don't cache to a file because the data is
      // a single short string.)
      await Sharing.shareAsync(verifyUrl, {
        dialogTitle: t("verify.shareDialogTitle"),
        // mimeType omitted: text share is default on iOS + Android.
      } as any).catch(async () => {
        // expo-sharing rejects non-file URIs on iOS — fall back to
        // Clipboard via Share API on Android only by surfacing a
        // toast with the URL for manual copy.
        toast.show(verifyUrl, "neutral");
      });
    } catch {
      toast.show(verifyUrl, "neutral");
    }
  }

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("verify.title")}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={140} radius={radius.lg} />
          <Skeleton height={120} radius={radius.lg} />
          <Skeleton height={220} radius={radius.lg} />
        </View>
      ) : error ? (
        <View style={{ padding: spacing.xl }}>
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: colors.dangerSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldAlert size={22} color={colors.danger} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.text, fontWeight: "700" },
                  ]}
                >
                  {t("verify.errorTitle")}
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                >
                  {t("verify.errorBody")}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      ) : !data ? (
        <View style={{ padding: spacing.xl }}>
          <Card>
            <Text style={[typography.body.md, { color: colors.text }]}>
              {t("verify.noData")}
            </Text>
          </Card>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: spacing.xxl,
          }}
        >
          {/* Status banner: green verified / amber unsigned / red invalid. */}
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: valid
                    ? colors.successSoft
                    : colors.warningSoft ?? colors.dangerSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {valid ? (
                  <ShieldCheck size={28} color={colors.success} strokeWidth={2.2} />
                ) : (
                  <ShieldAlert size={28} color={colors.danger} strokeWidth={2.2} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.title.md,
                    { color: colors.text, fontWeight: "700" },
                  ]}
                >
                  {valid
                    ? t("verify.validTitle")
                    : hasSig
                    ? t("verify.invalidTitle")
                    : t("verify.unsignedTitle")}
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                >
                  {valid
                    ? t("verify.validBody")
                    : hasSig
                    ? t("verify.invalidBody", {
                        reason: data?.reason ?? "unknown",
                      })
                    : t("verify.unsignedBody")}
                </Text>
              </View>
            </View>
          </Card>

          {/* Doctor block — the only identity on the verify page. */}
          {data?.doctor ? (
            <Card>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: spacing.xs },
                ]}
              >
                {t("verify.signedBy").toUpperCase()}
              </Text>
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
                    borderRadius: 14,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Stethoscope size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.body.md,
                      { color: colors.text, fontWeight: "700" },
                    ]}
                  >
                    {data.doctor.name}
                  </Text>
                  {data.doctor.slmcRegistrationNo ? (
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                    >
                      SLMC {data.doctor.slmcRegistrationNo}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          ) : null}

          {/* Signature metadata — what the verifier confirmed. */}
          {hasSig ? (
            <Card>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: spacing.sm },
                ]}
              >
                {t("verify.signature").toUpperCase()}
              </Text>
              <MetaRow
                icon={CalendarDays}
                label={t("verify.signedAt")}
                value={data?.signedAt}
              />
              <MetaRow
                icon={Hash}
                label={t("verify.payloadHash")}
                value={
                  data?.payloadHash
                    ? `${data.payloadHash.slice(0, 16)}…`
                    : null
                }
              />
            </Card>
          ) : null}

          {/* Medicines on the prescription — the substance of the
              verification. */}
          {data?.medicines?.length ? (
            <Card>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: spacing.sm },
                ]}
              >
                {t("verify.medicines").toUpperCase()}
              </Text>
              <View style={{ gap: spacing.sm }}>
                {data.medicines.map((med: any, i: number) => (
                  <View
                    key={med.id || i}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: spacing.md,
                      paddingVertical: spacing.xs,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Pill size={16} color={colors.primary} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          typography.body.md,
                          { color: colors.text, fontWeight: "700" },
                        ]}
                      >
                        {med.name}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, marginTop: 2 },
                        ]}
                      >
                        {[med.dosage, med.frequency, med.timing]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Share QR so a pharmacist can scan from THIS screen too. */}
          {verifyUrl ? (
            <Card>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textMuted, marginBottom: spacing.sm },
                ]}
              >
                {t("verify.shareTitle").toUpperCase()}
              </Text>
              <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                <QRCode value={verifyUrl} size={180} />
              </View>
              <Button
                title={t("verify.shareCta")}
                onPress={onShare}
                iconLeft={Share2}
                size="md"
                fullWidth
              />
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.textSubtle,
                    textAlign: "center",
                    marginTop: spacing.sm,
                  },
                ]}
              >
                {verifyUrl}
              </Text>
            </Card>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <Icon size={14} color={colors.textMuted} strokeWidth={2.2} />
      <Text
        style={[
          typography.body.sm,
          { color: colors.textMuted, minWidth: 96 },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[typography.body.sm, { color: colors.text, fontWeight: "600", flex: 1 }]}
        numberOfLines={1}
      >
        {value || "—"}
      </Text>
    </View>
  );
}