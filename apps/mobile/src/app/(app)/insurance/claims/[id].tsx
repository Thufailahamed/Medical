// @ts-nocheck
// Claim detail. Timeline + messages thread.

import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View, ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react-native";
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
  const messages = data.messages ?? [];

  const onSend = async () => {
    if (!msg.trim()) return;
    await postMut.mutateAsync({ id: claim.id, body: msg.trim() });
    setMsg("");
  };

  return (
    <Screen>
      <ScreenHeader
        title={t("insurance.claim.detail")}
        subtitle={t(`insurance.claim.treatments.${claim.treatmentType}`)}
        kicker={t("insurance.claim.kicker")}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Card style={{ margin: 16, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pill
              tone={
                claim.status === "approved"
                  ? "accent"
                  : claim.status === "rejected"
                    ? "danger"
                    : "neutral"
              }
            >
              {t(`insurance.claim.statuses.${claim.status}`)}
            </Pill>
          </View>
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
                <AppText weight="700" size="md" style={{ color: colors.accent }}>
                  LKR {claim.amountApprovedLkr.toLocaleString()}
                </AppText>
              </View>
            ) : null}
          </View>
          {claim.diagnosis ? (
            <View>
              <AppText size="xs" color="muted">
                {t("insurance.claim.diagnosis")}
              </AppText>
              <AppText size="sm">{claim.diagnosis}</AppText>
            </View>
          ) : null}
          {claim.incurringFacility ? (
            <View>
              <AppText size="xs" color="muted">
                {t("insurance.claim.facility")}
              </AppText>
              <AppText size="sm">{claim.incurringFacility}</AppText>
            </View>
          ) : null}
        </Card>

        <SectionHeader
          title={t("insurance.claim.messages")}
          style={{ paddingHorizontal: 16 }}
        />
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {messages.length === 0 ? (
            <AppText size="sm" color="muted">
              {t("insurance.claim.noMessages")}
            </AppText>
          ) : (
            messages.map((m: any) => (
              <Card
                key={m.id}
                style={{
                  padding: 12,
                  backgroundColor:
                    m.senderRole === "patient"
                      ? colors.surface
                      : colors.surface,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <AppText size="xs" weight="700" color="muted">
                    {m.senderName ?? m.senderRole}
                  </AppText>
                  <AppText size="xs" color="muted">
                    {new Date(m.createdAt).toLocaleString()}
                  </AppText>
                </View>
                <AppText size="sm" style={{ marginTop: 4 }}>
                  {m.body}
                </AppText>
              </Card>
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