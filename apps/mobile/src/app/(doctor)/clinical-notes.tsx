// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Edit3 } from "lucide-react-native";
import { useDoctorClinicalNotes } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  ErrorState,
  IconTile,
  SearchField,
  Skeleton,
} from "@/components/ui";

export default function DoctorClinicalNotesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const { data, isLoading, isError, refetch } = useDoctorClinicalNotes();
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  const all = data?.notes || [];

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return all;
    return all.filter((r: any) => {
      const hay = [r.title, r.diagnosis, r.notes, r.patient?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [all, q]);

  async function onRefresh() {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const count = data?.count ?? all.length;

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("doctorClinicalNotes.title")}
        subtitle={t("doctorClinicalNotes.subtitle", { count })}
        onBack={() => router.back()}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Search bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
          <SearchField
            value={q}
            onChangeText={setQ}
            placeholder={t("doctorClinicalNotes.searchPlaceholder")}
            clearLabel={t("doctorClinicalNotes.clearA11y")}
          />
        </View>

        {isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={120} radius={18} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load clinical notes")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            style={{ marginTop: spacing.xl }}
            icon={Edit3}
            title={q ? t("doctorClinicalNotes.emptySearchTitle") : t("doctorClinicalNotes.emptyTitle")}
            message={
              q
                ? t("doctorClinicalNotes.emptySearchBody")
                : t("doctorClinicalNotes.emptyBody")
            }
            actionLabel={!q ? t("doctorClinicalNotes.findPatient") : undefined}
            onAction={
              !q
                ? () => router.push("/(doctor)/prescription" as any)
                : undefined
            }
          />
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <View
              style={{
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDark ? colors.borderStrong : colors.hairline,
                paddingVertical: 4,
                ...(isDark ? {} : shadow.card),
              }}
            >
            {filtered.map((r: any, idx: number) => (
              <Pressable
                key={r.id}
                onPress={() =>
                  router.push({
                    pathname: "/(doctor)/patient-detail",
                    params: { id: r.patientId },
                  } as any)
                }
                accessibilityRole="button"
                accessibilityLabel={t("doctorClinicalNotes.itemA11y", {
                  name: r.patient?.name || t("doctorClinicalNotes.unknownPatient"),
                  title: r.title,
                })}
                style={({ pressed }) => ({
                  marginHorizontal: 5,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  backgroundColor: pressed ? colors.fill : "transparent",
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: spacing.md,
                    paddingVertical: 14,
                    paddingHorizontal: spacing.md,
                  }}
                >
                  {idx < filtered.length - 1 ? (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: spacing.md,
                        left: spacing.md + 40 + spacing.md,
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: colors.separator,
                      }}
                    />
                  ) : null}
                  <IconTile icon={Edit3} tone="accent2" appearance="soft" size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text
                        style={[typography.title.sm, { color: colors.text, flex: 1 }]}
                        numberOfLines={1}
                      >
                        {r.title || t("doctorClinicalNotes.noteFallback")}
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSubtle, fontVariant: ["tabular-nums"] },
                        ]}
                      >
                        {r.date || ""}
                      </Text>
                    </View>
                    <Text
                      style={[typography.label.sm, { color: colors.primary, marginTop: 2 }]}
                      numberOfLines={1}
                    >
                      {r.patient?.name || t("doctorClinicalNotes.unknownPatient")}
                      {r.diagnosis ? (
                        <Text style={{ color: colors.textMuted }}>{`  ·  ${r.diagnosis}`}</Text>
                      ) : null}
                    </Text>
                    {r.notes ? (
                      <Text
                        style={[typography.body.sm, { color: colors.textMuted, marginTop: 4 }]}
                        numberOfLines={2}
                      >
                        {r.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
