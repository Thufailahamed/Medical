// @ts-nocheck
// Caretaker Profiles: Marketplace — patient's sent inquiries list.

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Avatar,
  Chip,
  EmptyState,
} from "@/components/ui";
import {
  useMyMarketplaceInquiriesSent,
  type MarketplaceInquiryStatus,
} from "@/hooks/useCaretakerMarketplace";

const STATUS_FILTERS: ("all" | MarketplaceInquiryStatus)[] = [
  "all",
  "pending",
  "accepted",
  "declined",
  "expired",
];

function pillTone(status: MarketplaceInquiryStatus) {
  if (status === "accepted") return "success";
  if (status === "pending") return "info";
  if (status === "declined") return "danger";
  return "neutral";
}

export default function MyMarketplaceInquiriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  const [status, setStatus] = useState<"all" | MarketplaceInquiryStatus>(
    "all"
  );
  const sent = useMyMarketplaceInquiriesSent(
    status === "all" ? undefined : status
  );
  const inquiries = sent.data?.inquiries ?? [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={t("marketplace.inquiriesMine.title")} />

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs }}
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
              onPress={() => setStatus(s)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
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
          />
        ) : null}
        {inquiries.map((i) => (
          <Card key={i.id} style={{ gap: spacing.xs }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Avatar
                uri={i.caretakerPhoto ?? undefined}
                name={i.caretakerName ?? ""}
                size="md"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.text, fontWeight: "700" },
                  ]}
                  numberOfLines={1}
                >
                  {i.caretakerName ?? "—"}
                </Text>
              </View>
              <Pill
                label={t(`marketplace.inquiriesMine.status.${i.status}`)}
                tone={pillTone(i.status)}
                size="sm"
              />
            </View>
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary },
              ]}
              numberOfLines={3}
            >
              {i.patientMessage}
            </Text>
            {i.status === "accepted" && i.linkId ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.success },
                ]}
              >
                {t("marketplace.inquiry.alreadyLinked")}
              </Text>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}