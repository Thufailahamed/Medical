// @ts-nocheck
// Claim detail. Status banner + treatment summary + docs + message thread.

import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View, ScrollView, TextInput } from "react-native";
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
import { AppText } from "@/components/ui/AppText";
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
  const { colors } = useTheme();
  const { data, isLoading } = useClaim(id ?? "");
  const postMut = useSendInsuranceClaimMessage();
  const [msg, setMsg] = useState("");

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="" subtitle="" />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={120} radius={16} />
          <Skeleton height={200} radius={16} />
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
    <Screen>
      <ScreenHeader
        title={claim.claimNumber ?? t("insurance.claim.detail")}
        subtitle={
          claim.providerName ??
          t(`insurance.claim.treatments.${claim.treatmentType}`)
        }
        kicker={t("insurance.claim.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
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
            borderRadius: 20,
            padding: 16,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.2)",
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
                size="md"
                style={{ color: "#FFFFFF" }}
              >
                {t(`insurance.claim.statuses.${claim.status}`, claim.status)}
              </AppText>
              <AppText size="xs" style={{ color: "#FFFFFFCC" }}>
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
        <Card style={{ marginHorizontal: 16, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText size="xs" color="muted">
                {t("insurance.claim.amount")}
              </AppText>
              <AppText weight="700" size="md">
                LKR {claim.amountRequestedLkr.toLocaleString()}
              </AppText>
            </View>
            {typeof claim.amountApprovedLkr === "number" ? (
              <View style={{ flex: 1 }}>
                <AppText size="xs" color="muted">
                  {t("insurance.claim.approved")}
                </AppText>
                <AppText
                  weight="700"
                  size="md"
                  style={{ color: colors.success ?? "#10B981" }}
                >
                  LKR {claim.amountApprovedLkr.toLocaleString()}
                </AppText>
              </View>
            ) : null}
          </View>

          {claim.providerName ? (
            <Detail
              icon={<Building2 size={14} />}
              label={t("insurance.provider.label")}
              value={claim.providerName}
            />
          ) : null}
          {claim.policyNumber ? (
            <Detail
              icon={<FileText size={14} />}
              label={t("insurance.policy.policyNumber")}
              value={claim.policyNumber}
            />
          ) : null}
          {claim.incurringFacility ? (
            <Detail
              icon={<Building2 size={14} />}
              label={t("insurance.claim.facility")}
              value={claim.incurringFacility}
            />
          ) : null}
          {claim.admissionDate || claim.dischargeDate ? (
            <Detail
              icon={<Calendar size={14} />}
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
            <View style={{ marginTop: 4 }}>
              <AppText size="xs" color="muted">
                {t("insurance.claim.diagnosis")}
              </AppText>
              <AppText size="sm">{claim.diagnosis}</AppText>
            </View>
          ) : null}
        </Card>

        {/* Documents */}
        {Array.isArray(claim.documents) && claim.documents.length > 0 ? (
          <>
            <SectionHeader
              title={t("insurance.claim.documents", "Documents")}
              style={{ paddingHorizontal: 16, paddingTop: 16 }}
            />
            <View
              style={{
                paddingHorizontal: 16,
                gap: 8,
              }}
            >
              {claim.documents.map((d: any) => (
                <Card
                  key={d.id}
                  style={{
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor:
                        colors.surfaceMuted ?? colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="600">
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
          style={{ paddingHorizontal: 16, paddingTop: 16 }}
        />
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {messages.length === 0 ? (
            <AppText size="sm" color="muted">
              {t("insurance.claim.noMessages")}
            </AppText>
          ) : (
            messages.map((m: any, idx: number) => (
              <View key={m.id ?? idx} style={{ gap: 4 }}>
                <AppText
                  size="xs"
                  weight="700"
                  style={{
                    color:
                      m.senderRole === "patient"
                        ? colors.primary
                        : colors.accent ?? colors.primary,
                    marginLeft: 6,
                  }}
                >
                  {m.senderRole === "patient"
                    ? t("insurance.claim.you", "You")
                    : t("insurance.claim.operator", "Insurer")}
                </AppText>
                <Card
                  style={{
                    padding: 12,
                    backgroundColor:
                      m.senderRole === "patient"
                        ? colors.surface
                        : colors.surfaceMuted ?? colors.surface,
                    borderLeftWidth: 3,
                    borderLeftColor:
                      m.senderRole === "patient"
                        ? colors.primary
                        : colors.accent ?? colors.primary,
                  }}
                >
                  <AppText size="sm">{m.body}</AppText>
                  <AppText
                    size="xs"
                    color="muted"
                    style={{ marginTop: 6 }}
                  >
                    {new Date(m.createdAt).toLocaleString()}
                  </AppText>
                </Card>
              </View>
            ))
          )}
        </View>

        <Card style={{ margin: 16, padding: 12, gap: 8 }}>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder={t("insurance.claim.messagePlaceholder")}
            multiline
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 10,
              color: colors.text,
              minHeight: 60,
            }}
          />
          <Button
            label={t("insurance.claim.send")}
            leftIcon={<Send size={14} />}
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
        gap: 8,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <AppText size="sm" color="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText weight="600" size="sm" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}