// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Search,
  Pill,
  ChevronRight,
  CalendarDays,
  Stethoscope,
} from "lucide-react-native";
import { useMyPrescriptions } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  Skeleton,
} from "@/components/ui";

export default function MyPrescriptionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const { data, isLoading, refetch } = useMyPrescriptions();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("");

  const all = data?.prescriptions || [];

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r: any) => {
      const hay = [r.diagnosis, r.notes, r.doctorName, r.doctorSpecialization]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [all, filter]);

  async function onRefresh() {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("myPrescriptions.title")}
        subtitle={t("myPrescriptions.subtitle", { count: all.length })}
        onBack={() => router.back()}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 44,
            }}
          >
            <Search size={16} color={colors.textSubtle} strokeWidth={2.2} />
            <Pressable
              onPress={() => setFilter("")}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: !filter ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: !filter ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: !filter ? colors.onPrimary : colors.text,
                }}
              >
                {t("myPrescriptions.filters.all")}
              </Text>
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={92} radius={18} />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            style={{ marginTop: spacing.xl }}
            icon={FileText}
            title={
              filter
                ? t("myPrescriptions.emptySearchTitle")
                : t("myPrescriptions.emptyTitle")
            }
            message={
              filter
                ? t("myPrescriptions.emptySearchBody")
                : t("myPrescriptions.emptyBody")
            }
          />
        ) : (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              gap: spacing.sm,
            }}
          >
            {filtered.map((r: any) => (
              <Pressable
                key={r.id}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/prescription-detail",
                    params: { id: r.id },
                  } as any)
                }
                style={({ pressed }) => ({
                  backgroundColor: pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText
                      size={20}
                      color={colors.primary}
                      strokeWidth={2.25}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {r.diagnosis || t("myPrescriptions.fallbackTitle")}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <Stethoscope
                        size={11}
                        color={colors.textSubtle}
                        strokeWidth={2.2}
                      />
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, flex: 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {r.doctorName}
                        {r.doctorSpecialization
                          ? ` · ${r.doctorSpecialization}`
                          : ""}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        marginTop: 6,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <CalendarDays
                          size={11}
                          color={colors.textSubtle}
                          strokeWidth={2.2}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: colors.textSubtle,
                          }}
                        >
                          {(r.date || "").toUpperCase()}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Pill
                          size={11}
                          color={colors.textSubtle}
                          strokeWidth={2.2}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: colors.textSubtle,
                          }}
                        >
                          {t("myPrescriptions.medCount", {
                            count: r.medicineCount || 0,
                          })}
                        </Text>
                      </View>
                      <StatusPill status={r.status} />
                    </View>
                  </View>
                  <ChevronRight
                    size={18}
                    color={colors.textSubtle}
                    strokeWidth={2.2}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatusPill({ status }: { status: string }) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = {
    signed: { bg: colors.successSoft, fg: colors.success },
    cancelled: { bg: colors.dangerSoft ?? colors.surfaceMuted, fg: colors.danger ?? colors.textMuted },
    dispensed: { bg: colors.primarySoft, fg: colors.primary },
  }[status] ?? { bg: colors.surfaceMuted, fg: colors.textMuted };

  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
        backgroundColor: palette.bg,
      }}
    >
      <Text
        style={[
          typography.caption,
          { color: palette.fg, fontWeight: "700", textTransform: "uppercase" },
        ]}
      >
        {status}
      </Text>
    </View>
  );
}
