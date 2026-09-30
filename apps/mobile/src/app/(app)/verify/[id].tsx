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

import { useMemo, useState, type ReactNode } from "react";
import { View, Text, Share, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Stethoscope,
  Pill,
  CalendarDays,
  Hash,
  Share2,
  Copy,
  Check,
  BadgeCheck,
  FileLock2,
  Link2,
} from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import { useVerifyPrescription } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  ErrorState,
  IconTile,
  Pressable,
  useToast,
} from "@/components/ui";

// Same vocabulary as the patient prescription screen, so a pharmacist sees
// "Three times daily · After meals" instead of raw enum codes.
const DIRECTION_LABELS: Record<string, [string, string]> = {
  once_daily: ["verify.dir.once_daily", "Once daily"],
  twice_daily: ["verify.dir.twice_daily", "Twice daily"],
  three_times_daily: ["verify.dir.three_times_daily", "Three times daily"],
  four_times_daily: ["verify.dir.four_times_daily", "Four times daily"],
  every_morning: ["verify.dir.every_morning", "Every morning"],
  every_night: ["verify.dir.every_night", "Every night"],
  as_needed: ["verify.dir.as_needed", "As needed"],
  every_other_day: ["verify.dir.every_other_day", "Every other day"],
  weekly: ["verify.dir.weekly", "Once weekly"],
  before_food: ["verify.dir.before_food", "Before meals"],
  after_food: ["verify.dir.after_food", "After meals"],
  with_food: ["verify.dir.with_food", "With meals"],
  empty_stomach: ["verify.dir.empty_stomach", "On an empty stomach"],
  bedtime: ["verify.dir.bedtime", "At bedtime"],
  morning: ["verify.dir.morning", "In the morning"],
};

function direction(t: any, v?: string | null) {
  if (!v) return null;
  const k = v.trim().toLowerCase();
  const hit = DIRECTION_LABELS[k];
  if (hit) return t(hit[0], hit[1]);
  return k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatSigned(iso: string | null | undefined, locale: any) {
  if (!iso) return null;
  // Server sends "YYYY-MM-DD HH:MM:SS" in UTC; make it parseable + local.
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso.replace(" ", "T")}Z`);
  if (isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${fmtDateLong(d, locale)} · ${time}`;
}

export default function VerifyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useVerifyPrescription(id as string);
  const [copied, setCopied] = useState<"hash" | "link" | null>(null);

  const valid = data?.valid === true;
  const hasSig = !!data?.signedAt && !!data?.payloadHash;
  const state: "valid" | "invalid" | "unsigned" = valid ? "valid" : hasSig ? "invalid" : "unsigned";
  const tone: Tone = state === "valid" ? "success" : state === "invalid" ? "danger" : "warning";
  const pal = useTone(tone);
  const StatusIcon = state === "valid" ? ShieldCheck : state === "invalid" ? ShieldAlert : ShieldQuestion;

  const verifyUrl = useMemo(() => (id ? `https://app.healthhub.app/verify/${id}` : ""), [id]);
  const signedAt = formatSigned(data?.signedAt, locale);
  const hash: string = data?.payloadHash ?? "";

  async function copy(kind: "hash" | "link", value: string) {
    try {
      await Clipboard.setStringAsync(value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {}
  }

  // expo-sharing only accepts file URIs on iOS (the old path always fell
  // through to a toast); the RN Share sheet handles plain links natively.
  async function onShare() {
    if (!verifyUrl) return;
    try {
      await Share.share({ message: verifyUrl, url: verifyUrl, title: t("verify.shareDialogTitle") });
    } catch {
      toast.show(t("verify.shareUnavailable"), "warning");
    }
  }

  const checks =
    state === "valid"
      ? [
          { icon: BadgeCheck, label: t("verify.check.signature", "Digital signature is valid") },
          { icon: FileLock2, label: t("verify.check.unchanged", "Contents unchanged since signing") },
          ...(data?.doctor?.slmcRegistrationNo
            ? [{ icon: Stethoscope, label: t("verify.check.registered", "Signed by an SLMC-registered doctor") }]
            : []),
        ]
      : [];

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <ScreenHeader title={t("verify.title")} subtitle={t("verify.subtitle", "Prescription authenticity check")} onBack={() => router.back()} />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={200} radius={radius.card} />
          <Skeleton height={140} radius={radius.card} />
          <Skeleton height={120} radius={radius.card} />
        </View>
      ) : isError ? (
        <ErrorState
          title={t("verify.errorTitle")}
          message={t("verify.errorBody")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
          style={{ padding: spacing.xl }}
        />
      ) : !data ? (
        <View style={{ padding: spacing.xl }}>
          <Card>
            <Text style={[typography.body.md, { color: colors.text }]}>{t("verify.noData")}</Text>
          </Card>
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.md }}>
          {/* ── Verdict: the one thing a pharmacist needs at a glance ── */}
          <View
            style={{
              borderRadius: radius.card,
              borderCurve: "continuous",
              backgroundColor: pal.bg,
              borderWidth: 1,
              borderColor: pal.fg + "33",
              padding: spacing.xl,
              alignItems: "center",
              gap: spacing.sm,
            }}
            accessibilityRole="summary"
          >
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pal.fg,
                marginBottom: spacing.xs,
                ...(scheme === "dark" ? null : { ...shadow.md, shadowColor: pal.fg, shadowOpacity: 0.3 }),
              }}
            >
              <StatusIcon size={38} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <Text style={[typography.display.sm, { color: colors.text, textAlign: "center" }]}>
              {state === "valid"
                ? t("verify.validHeadline", "Authentic prescription")
                : state === "invalid"
                ? t("verify.invalidTitle")
                : t("verify.unsignedTitle")}
            </Text>
            <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
              {state === "valid"
                ? t("verify.validBody")
                : state === "invalid"
                ? t("verify.invalidBody", { reason: String(data?.reason ?? "unknown").replace(/_/g, " ") })
                : t("verify.unsignedBody")}
            </Text>

            {checks.length ? (
              <View style={{ alignSelf: "stretch", marginTop: spacing.md, gap: spacing.sm }}>
                {checks.map((c) => {
                  const CIcon = c.icon;
                  return (
                    <View key={c.label} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.surface,
                        }}
                      >
                        <Check size={13} color={pal.fg} strokeWidth={3} />
                      </View>
                      <Text style={[typography.label.md, { color: colors.text, flex: 1 }]}>{c.label}</Text>
                      <CIcon size={15} color={pal.fg} strokeWidth={2.2} />
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          {/* ── Signed by + signature details, one card ── */}
          {data?.doctor || hasSig ? (
            <Card padded={false}>
              {data?.doctor ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
                  <IconTile icon={Stethoscope} tone="primary" size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase" }]}>
                      {t("verify.signedBy")}
                    </Text>
                    <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
                      {data.doctor.name}
                    </Text>
                    {data.doctor.slmcRegistrationNo ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <BadgeCheck size={13} color={colors.success} strokeWidth={2.4} />
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {`SLMC #${String(data.doctor.slmcRegistrationNo).replace(/^SLMC-?/i, "")}`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {hasSig ? (
                <View
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    borderTopWidth: data?.doctor ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: colors.separator,
                  }}
                >
                  <MetaRow icon={CalendarDays} label={t("verify.signedAt")} value={signedAt} />
                  <MetaRow
                    icon={Hash}
                    label={t("verify.fingerprint", "Fingerprint")}
                    value={`${hash.slice(0, 8)} ${hash.slice(8, 16)}…`}
                    mono
                    action={
                      <Pressable
                        onPress={() => copy("hash", hash)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("verify.copyHash", "Copy fingerprint")}
                        style={{ padding: 4 }}
                      >
                        {copied === "hash" ? (
                          <Check size={15} color={colors.success} strokeWidth={2.6} />
                        ) : (
                          <Copy size={15} color={colors.textSubtle} strokeWidth={2.2} />
                        )}
                      </Pressable>
                    }
                  />
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* ── Medicines ── */}
          {data?.medicines?.length ? (
            <Card padded={false}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, paddingBottom: spacing.sm }}>
                <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase" }]}>
                  {t("verify.medicines")}
                </Text>
                <Text style={[typography.label.sm, { color: colors.textMuted }]}>{data.medicines.length}</Text>
              </View>
              {data.medicines.map((med: any, i: number) => {
                const chips = [direction(t, med.frequency), direction(t, med.timing)].filter(Boolean);
                return (
                  <View
                    key={med.id || i}
                    style={{
                      flexDirection: "row",
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    <IconTile icon={Pill} tone="accent2" size={40} />
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                        <Text style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}>{med.name}</Text>
                        {med.dosage ? (
                          <Text style={[typography.label.md, { color: colors.primary }]}>{med.dosage}</Text>
                        ) : null}
                      </View>
                      {chips.length ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {chips.map((c) => (
                            <View key={c} style={{ paddingHorizontal: 9, height: 24, borderRadius: 12, justifyContent: "center", backgroundColor: colors.well }}>
                              <Text style={[typography.label.xs, { color: colors.textMuted, letterSpacing: 0 }]}>{c}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* ── Share: QR for a pharmacist to scan + link actions ── */}
          {verifyUrl ? (
            <Card style={{ gap: spacing.md }}>
              <View style={{ gap: 2 }}>
                <Text style={[typography.title.sm, { color: colors.text }]}>{t("verify.shareTitle")}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t("verify.shareHelp", "A pharmacist can scan this to confirm the prescription themselves.")}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: "center",
                  padding: spacing.md,
                  borderRadius: 20,
                  backgroundColor: "#FFFFFF",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.hairline,
                }}
              >
                <QRCode value={verifyUrl} size={168} />
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={copied === "link" ? t("verify.copied", "Copied") : t("verify.copyLink", "Copy link")}
                    icon={copied === "link" ? Check : Link2}
                    variant="secondary"
                    size="md"
                    onPress={() => copy("link", verifyUrl)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={t("verify.shareShort", "Share")} icon={Share2} size="md" onPress={onShare} />
                </View>
              </View>
            </Card>
          ) : null}
          <View style={{ height: spacing.xl }} />
        </View>
      )}
    </Screen>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono,
  action,
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  action?: ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm }}>
      <Icon size={15} color={colors.textSubtle} strokeWidth={2.2} />
      <Text style={[typography.body.sm, { color: colors.textMuted, width: 96 }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          typography.label.md,
          { color: colors.text, flex: 1, textAlign: "right" },
          mono ? { fontFamily: "Menlo", fontSize: 13 } : null,
        ]}
        numberOfLines={1}
      >
        {value || "—"}
      </Text>
      {action}
    </View>
  );
}
