// @ts-nocheck
// Claim detail. Status banner + treatment summary + docs + message thread.

import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View, Text, ScrollView, TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import {
  Send,
  AlertCircle,
  CheckCircle2,
  FileText,
  Wallet,
  Building2,
  Calendar,
} from "lucide-react-native";
import { useClaim, useSendInsuranceClaimMessage } from "@/hooks/useApi";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Skeleton,
  EmptyState,
  SectionHeader,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

const STATUS_TONE: Record<string, "accent" | "warning" | "danger" | "neutral"> = {
  approved: "accent",
  paid: "accent",
  rejected: "danger",
  submitted: "warning",
  under_review: "warning",
  more_info_needed: "warning",
  draft: "neutral",
};

export default function ClaimDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors, typography, radius, shadow, scheme } = useTheme();
  const { data, isLoading } = useClaim(id ?? "");
  const postMut = useSendInsuranceClaimMessage();
  const [msg, setMsg] = useState("");

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={96} radius={radius.xxl} />
          <Skeleton height={200} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  if (!data?.claim) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16 }}>
          <EmptyState title={t("insurance.claim.notFound")} />
        </View>
      </Screen>
    );
  }

  const claim = data.claim;
  const messages = claim.messages ?? data.messages ?? [];

  const tone = STATUS_TONE[claim.status] ?? "neutral";

  const onSend = async () => {
    if (!msg.trim()) return;
    await postMut.mutateAsync({ id: claim.id, body: msg.trim() });
    setMsg("");
  };

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={claim.claimNumber ?? t("insurance.claim.detail")}
        subtitle={
          claim.providerName ??
          t(`insurance.claim.treatments.${claim.treatmentType}`)
        }
        kicker={t("insurance.claim.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Status banner */}
        <LinearGradient
          colors={
            claim.status === "approved" || claim.status === "paid"
              ? [colors.success ?? "#10B981", "#059669"]
              : claim.status === "rejected"
                ? [colors.danger ?? "#EF4444", "#B91C1C"]
                : [colors.warning ?? "#F59E0B", "#D97706"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            margin: 16,
            marginTop: 8,
            borderRadius: radius.xxl,
            borderCurve: "continuous",
            padding: 20,
            overflow: "hidden",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -50,
              right: -40,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                borderCurve: "continuous",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {claim.status === "rejected" ? (
                <AlertCircle size={22} color="#FFFFFF" />
              ) : claim.status === "approved" ||
                claim.status === "paid" ? (
                <CheckCircle2 size={22} color="#FFFFFF" />
              ) : (
                <Wallet size={22} color="#FFFFFF" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <AppText
                weight="700"
                size="lg"
                style={{ color: "#FFFFFF", textTransform: "capitalize" }}
              >
                {t(`insurance.claim.statuses.${claim.status}`, claim.status)}
              </AppText>
              <AppText size="sm" style={{ color: "rgba(255,255,255,0.82)", marginTop: 1 }}>
                {claim.treatmentType
                  ? t(
                      `insurance.claim.treatments.${claim.treatmentType}`,
                    )
                  : ""}
              </AppText>
            </View>
          </View>
        </LinearGradient>

        {/* Amounts card */}
        <Card style={{ marginHorizontal: 16, padding: 18, gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              backgroundColor: colors.surfaceMuted,
              borderRadius: 16,
              borderCurve: "continuous",
              padding: 14,
              marginBottom: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText size="xs" color="subtle">
                {t("insurance.claim.amount")}
              </AppText>
              <AppText weight="700" size="xl" style={{ marginTop: 2 }}>
                LKR {claim.amountRequestedLkr.toLocaleString()}
              </AppText>
            </View>
            {typeof claim.amountApprovedLkr === "number" ? (
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <AppText size="xs" color="subtle">
                  {t("insurance.claim.approved")}
                </AppText>
                <AppText
                  weight="700"
                  size="xl"
                  style={{ color: colors.success ?? "#10B981", marginTop: 2 }}
                >
                  LKR {claim.amountApprovedLkr.toLocaleString()}
                </AppText>
              </View>
            ) : null}
          </View>

          {claim.providerName ? (
            <Detail
              icon={<Building2 size={15} color={colors.primary} strokeWidth={2.3} />}
              label={t("insurance.provider.label")}
              value={claim.providerName}
            />
          ) : null}
          {claim.policyNumber ? (
            <Detail
              icon={<FileText size={15} color={colors.primary} strokeWidth={2.3} />}
              label={t("insurance.policy.policyNumber")}
              value={claim.policyNumber}
            />
          ) : null}
          {claim.incurringFacility ? (
            <Detail
              icon={<Building2 size={15} color={colors.primary} strokeWidth={2.3} />}
              label={t("insurance.claim.facility")}
              value={claim.incurringFacility}
            />
          ) : null}
          {claim.admissionDate || claim.dischargeDate ? (
            <Detail
              icon={<Calendar size={15} color={colors.primary} strokeWidth={2.3} />}
              label={t("insurance.claim.dates", "Dates")}
              value={
                [
                  claim.admissionDate
                    ? new Date(claim.admissionDate).toLocaleDateString()
                    : null,
                  claim.dischargeDate
                    ? new Date(claim.dischargeDate).toLocaleDateString()
                    : null,
                ]
                  .filter(Boolean)
                  .join(" → ") || "—"
              }
            />
          ) : null}
          {claim.diagnosis ? (
            <View
              style={{
                marginTop: 4,
                paddingTop: 12,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
              }}
            >
              <AppText size="xs" color="subtle">
                {t("insurance.claim.diagnosis")}
              </AppText>
              <AppText size="md" style={{ marginTop: 2 }}>{claim.diagnosis}</AppText>
            </View>
          ) : null}
        </Card>

        {/* Documents */}
        {Array.isArray(claim.documents) && claim.documents.length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.claim.documents", "Documents")}
              style={{ paddingHorizontal: 16, paddingTop: 24 }}
            />
            <View
              style={{
                paddingHorizontal: 16,
                gap: 10,
              }}
            >
              {claim.documents.map((d: any) => (
                <Card
                  key={d.id}
                  style={{
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      borderCurve: "continuous",
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText size={17} color={colors.primary} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="700" size="sm" style={{ textTransform: "capitalize" }}>
                      {t(
                        `insurance.claim.docKinds.${d.kind}`,
                        d.kind,
                      )}
                    </AppText>
                    <AppText size="xs" color="muted" numberOfLines={1}>
                      {d.fileName ?? d.fileKey}
                    </AppText>
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : null}

        {/* Messages */}
        <SectionHeader
          title={t("insurance.claim.messages")}
          style={{ paddingHorizontal: 16, paddingTop: 24 }}
        />
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {messages.length === 0 ? (
            <AppText size="sm" color="muted">
              {t("insurance.claim.noMessages")}
            </AppText>
          ) : (
            messages.map((m: any, idx: number) => (
              <View
                key={m.id ?? idx}
                style={{
                  gap: 4,
                  maxWidth: "86%",
                  alignSelf: m.senderRole === "patient" ? "flex-end" : "flex-start",
                  alignItems: m.senderRole === "patient" ? "flex-end" : "flex-start",
                }}
              >
                <AppText
                  size="xs"
                  weight="700"
                  style={{
                    color:
                      m.senderRole === "patient"
                        ? colors.primary
                        : colors.accent ?? colors.primary,
                    marginHorizontal: 8,
                  }}
                >
                  {m.senderRole === "patient"
                    ? t("insurance.claim.you", "You")
                    : t("insurance.claim.operator", "Insurer")}
                </AppText>
                <Card
                  elevated={m.senderRole !== "patient"}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    borderWidth: m.senderRole === "patient" ? 0 : StyleSheet.hairlineWidth,
                    backgroundColor:
                      m.senderRole === "patient"
                        ? colors.primarySoft
                        : colors.surface,
                  }}
                >
                  <AppText size="md">{m.body}</AppText>
                  <AppText
                    size="xs"
                    color="subtle"
                    style={{ marginTop: 4 }}
                  >
                    {new Date(m.createdAt).toLocaleString()}
                  </AppText>
                </Card>
              </View>
            ))
          )}
        </View>

        <Card style={{ margin: 16, marginTop: 20, padding: 14, gap: 10 }}>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder={t("insurance.claim.messagePlaceholder")}
            placeholderTextColor={colors.textSubtle}
            multiline
            style={{
              backgroundColor: colors.fill,
              borderRadius: radius.field,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.text,
              minHeight: 72,
              textAlignVertical: "top",
              ...typography.body.md,
            }}
          />
          <Button
            label={t("insurance.claim.send")}
            icon={Send}
            onPress={onSend}
            loading={postMut.isPending}
            disabled={!msg.trim()}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          borderCurve: "continuous",
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <AppText size="md" color="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText weight="600" size="md" numberOfLines={1} style={{ maxWidth: "55%" }}>
        {value}
      </AppText>
    </View>
  );
}

// Theme-aware text used by this screen: maps the terse size/weight/color
// props onto typography tokens + theme colours so text stays legible in dark
// mode (the shared AppText hard-codes light-mode hex colours).
function AppText({
  size,
  weight,
  color,
  style,
  ...rest
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  weight?: string;
  color?: "muted" | "subtle" | "primary" | "accent" | "danger" | "text";
  style?: any;
  [key: string]: any;
}) {
  const { colors, typography, fontFamily } = useTheme();
  const tone =
    color === "muted"
      ? colors.textMuted
      : color === "subtle"
        ? colors.textSubtle
        : color === "primary"
          ? colors.primary
          : color === "accent"
            ? colors.accent
            : color === "danger"
              ? colors.danger
              : colors.text;
  const bold = weight === "700" || weight === "800" || weight === "900" || weight === "bold";
  const semi = weight === "600" || weight === "500";
  const base =
    size === "2xl"
      ? typography.display.md
      : size === "xl"
        ? typography.display.sm
        : size === "lg"
          ? bold
            ? typography.title.lg
            : typography.body.lg
          : size === "md"
            ? bold
              ? typography.title.md
              : typography.body.md
            : size === "xs"
              ? typography.caption
              : bold
                ? typography.title.xs
                : typography.body.sm;
  const family = bold
    ? size === "xl" || size === "2xl" || size === "lg" || size === "md"
      ? base.fontFamily
      : fontFamily.bodyBold
    : semi
      ? fontFamily.bodySemibold
      : base.fontFamily;
  return (
    <Text
      {...rest}
      style={[{ ...base, fontFamily: family, color: tone }, style]}
    />
  );
}
