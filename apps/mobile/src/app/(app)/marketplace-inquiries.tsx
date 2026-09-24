// @ts-nocheck
// Caretaker Profiles: Marketplace — patient's sent inquiries list.

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Send, BadgeCheck, Undo2 } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Avatar,
  Chip,
  Divider,
  Pressable,
  EmptyState,
  useToast,
} from "@/components/ui";
import {
  useMyMarketplaceInquiriesSent,
  useWithdrawMarketplaceInquiry,
  type MarketplaceInquiryStatus,
} from "@/hooks/useCaretakerMarketplace";

const STATUS_FILTERS: ("all" | MarketplaceInquiryStatus)[] = [
  "all",
  "pending",
  "accepted",
  "declined",
  "expired",
  "withdrawn",
];

function pillTone(status: MarketplaceInquiryStatus): Tone {
  if (status === "accepted") return "success";
  if (status === "pending") return "info";
  if (status === "declined") return "danger";
  return "neutral";
}

export default function MyMarketplaceInquiriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();

  const [status, setStatus] = useState<"all" | MarketplaceInquiryStatus>(
    "all"
  );
  const sent = useMyMarketplaceInquiriesSent(
    status === "all" ? undefined : status
  );
  const withdraw = useWithdrawMarketplaceInquiry();
  const inquiries = sent.data?.inquiries ?? [];

  function confirmWithdraw(id: string) {
    Alert.alert(t("marketplace.inquiry.withdrawConfirm"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("marketplace.inquiry.withdraw"),
        style: "destructive",
        onPress: () =>
          withdraw.mutate(id, {
            onSuccess: () =>
              toast.show(t("marketplace.inquiry.withdrawn"), "info"),
            onError: () => toast.show(t("common.error"), "danger"),
          }),
      },
    ]);
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={t("marketplace.inquiriesMine.title")} />

      <View style={{ paddingTop: spacing.xs }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        >
          {STATUS_FILTERS.map((s) => (
            <Chip
              key={s}
              label={
                s === "all"
                  ? t("marketplace.filters.any")
                  : t(`marketplace.inquiriesMine.status.${s}`)
              }
              selected={status === s}
              tone={status === s ? "primary" : "neutral"}
              onPress={() => setStatus(s)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.xl,
          gap: spacing.md,
          paddingBottom: spacing.xxxxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={sent.isFetching}
            onRefresh={() => sent.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {inquiries.length === 0 && !sent.isLoading ? (
          <EmptyState
            icon={Send}
            title={t("marketplace.inquiriesMine.empty")}
            actionLabel={t("marketplace.title")}
            onAction={() => router.push("/(app)/marketplace" as any)}
          />
        ) : null}

        {inquiries.map((i) => (
          <Card key={i.id} style={{ gap: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push(
                    `/(app)/marketplace/${i.caretakerUserId}` as any
                  )
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  flex: 1,
                }}
              >
                <Avatar
                  source={
                    i.caretakerPhoto ? { uri: i.caretakerPhoto } : undefined
                  }
                  name={i.caretakerName ?? ""}
                  size="md"
                />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Text
                      style={[
                        typography.title.md,
                        { color: colors.text, flexShrink: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {i.caretakerName ?? "—"}
                    </Text>
                  </View>
                  <Text
                    style={[typography.caption, { color: colors.textSubtle }]}
                  >
                    {formatDate(i.createdAt)}
                  </Text>
                </View>
              </Pressable>
              <Pill
                label={t(`marketplace.inquiriesMine.status.${i.status}`)}
                tone={pillTone(i.status)}
                size="sm"
              />
            </View>

            <View
              style={{
                backgroundColor: colors.fill,
                borderRadius: 14,
                borderCurve: "continuous",
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
              }}
            >
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
                numberOfLines={3}
              >
                {i.patientMessage}
              </Text>
            </View>

            {i.status === "accepted" && i.linkId ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  gap: 6,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  backgroundColor: colors.successSoft,
                }}
              >
                <BadgeCheck size={14} color={colors.success} />
                <Text
                  style={[
                    typography.label.sm,
                    { color: colors.success },
                  ]}
                >
                  {t("marketplace.inquiry.alreadyLinked")}
                </Text>
              </View>
            ) : null}

            {i.status === "pending" ? (
              <>
                <Divider />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("marketplace.inquiry.withdraw")}
                    haptic="light"
                    onPress={() => confirmWithdraw(i.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      height: 36,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.full,
                      backgroundColor: colors.dangerSoft,
                    }}
                  >
                    <Undo2 size={14} color={colors.danger} />
                    <Text
                      style={[
                        typography.label.md,
                        { color: colors.danger },
                      ]}
                    >
                      {t("marketplace.inquiry.withdraw")}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
