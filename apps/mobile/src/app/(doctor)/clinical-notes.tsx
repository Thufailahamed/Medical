// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput as RNTextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Edit3, Search, ChevronRight, CalendarDays } from "lucide-react-native";
import { useDoctorClinicalNotes } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui";

export default function DoctorClinicalNotesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
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
            <TextInputShim
              value={q}
              onChangeText={setQ}
              placeholder={t("doctorClinicalNotes.searchPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 14,
                paddingVertical: 8,
              }}
            />
            {q ? (
              <Pressable
                onPress={() => setQ("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("doctorClinicalNotes.clearA11y")}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.textMuted,
                  }}
                >
                  {t("doctorClinicalNotes.clear")}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
                    <Edit3
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
                      {r.title || t("doctorClinicalNotes.noteFallback")}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                      numberOfLines={1}
                    >
                      {r.patient?.name || t("doctorClinicalNotes.unknownPatient")}
                      {r.diagnosis ? ` · ${r.diagnosis}` : ""}
                    </Text>
                    {r.notes ? (
                      <Text
                        style={[
                          typography.body.sm,
                          {
                            color: colors.textMuted,
                            marginTop: 6,
                            lineHeight: 18,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {r.notes}
                      </Text>
                    ) : null}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 8,
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
                          letterSpacing: 0.3,
                        }}
                      >
                        {(r.date || "").toUpperCase()}
                      </Text>
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

function TextInputShim(props: any) {
  return <RNTextInput {...props} />;
}