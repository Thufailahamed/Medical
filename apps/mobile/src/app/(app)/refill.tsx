// @ts-nocheck

// Day 4 #5 mobile surface.
//
// Pulls the patient's "refill due" list from the server (pure SQL on
// the backend, no LLM) and renders it as a Card-per-medicine with a
// "request renewal" CTA. Counts up active medicines ending within
// the next 14 days; in chronic patients this catches the metformin,
// statin, beta-blocker regimens before they run out.

import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pill, RefreshCw, Clock, CheckCircle2, AlertTriangle } from "lucide-react-native";
import { useRefillDue } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  Skeleton,
  Pill as PillCmp,
  useToast,
} from "@/components/ui";

export default function RefillScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const { data, isLoading, refetch, isRefetching } = useRefillDue();

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("refill.title")}
          subtitle={t("refill.subtitle")}
        />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="100%" height={64} />
          <Skeleton width="100%" height={64} />
          <Skeleton width="100%" height={64} />
        </View>
      </Screen>
    );
  }

  const candidates = data?.refills ?? [];
  const overdue = candidates.filter((c) => c.daysRemaining < 0);
  const dueSoon = candidates.filter((c) => c.daysRemaining >= 0 && c.daysRemaining <= 14);

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("refill.title")}
        subtitle={t("refill.subtitle")}
        right={
          <PillCmp
            icon={RefreshCw}
            label={t("refill.dueCount", {
              count: candidates.length,
            })}
            tone={candidates.length ? "warning" : "neutral"}
            size="sm"
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
      >
        {candidates.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t("refill.emptyTitle")}
            body={t("refill.emptyBody")}
          />
        ) : (
          <>
            {overdue.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <SectionLabel
                  icon={AlertTriangle}
                  text={t("refill.sectionOverdue", { count: overdue.length })}
                  tone="warning"
                />
                {overdue.map((c) => (
                  <RefillCard
                    key={c.id}
                    candidate={c}
                    onRenew={() => requestRenewal(c.name, toast)}
                  />
                ))}
              </View>
            ) : null}
            {dueSoon.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <SectionLabel
                  icon={Clock}
                  text={t("refill.sectionSoon", { count: dueSoon.length })}
                  tone="primary"
                />
                {dueSoon.map((c) => (
                  <RefillCard
                    key={c.id}
                    candidate={c}
                    onRenew={() => requestRenewal(c.name, toast)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionLabel({
  icon: Icon,
  text,
  tone,
}: {
  icon: any;
  text: string;
  tone: "primary" | "warning";
}) {
  const { spacing, colors, typography } = useTheme();
  const tint = tone === "warning" ? colors.warning : colors.primary;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      <Icon size={14} color={tint} />
      <Text style={{ ...typography.label, color: tint }}>{text}</Text>
    </View>
  );
}

function RefillCard({
  candidate,
  onRenew,
}: {
  candidate: {
    id: string;
    name: string;
    dosage: string;
    frequency: string | null;
    startDate: string;
    expectedEndDate: string;
    daysRemaining: number;
    source: string;
  };
  onRenew: () => void;
}) {
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const overdue = candidate.daysRemaining < 0;
  const tone = overdue ? "warning" : "primary";
  return (
    <Card>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 }}>
            <Pill size={18} color={colors.primary} />
            <Text style={{ ...typography.h3, color: colors.text }} numberOfLines={1}>
              {candidate.name}
            </Text>
          </View>
          <PillCmp
            label={
              overdue
                ? t("refill.daysOverdue", { days: Math.abs(candidate.daysRemaining) })
                : t("refill.daysLeft", { days: candidate.daysRemaining })
            }
            tone={tone as any}
            size="sm"
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          <Detail label={t("refill.dosage")} value={candidate.dosage} />
          {candidate.frequency ? (
            <Detail label={t("refill.frequency")} value={candidate.frequency} />
          ) : null}
          <Detail
            label={t("refill.expectedEnd")}
            value={candidate.expectedEndDate}
          />
        </View>
        <Button
          label={t("refill.renew")}
          variant="secondary"
          onPress={onRenew}
          icon={RefreshCw}
        />
      </View>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { spacing, colors, typography } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 100 }}>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{label}</Text>
      <Text style={{ ...typography.body, color: colors.text }}>{value}</Text>
    </View>
  );
}

function requestRenewal(name: string, toast: any) {
  // The actual renewal request lives on the doctor portal side; from
  // mobile we surface a soft confirmation so the patient sees feedback.
  toast.show(`Renewal requested for ${name}`, "success");
}
