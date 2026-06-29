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
import { Edit3, Search, ChevronRight, CalendarDays } from "lucide-react-native";
import { useDoctorClinicalNotes } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  EmptyState,
  Skeleton,
} from "@/components/ui";

export default function DoctorClinicalNotesScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const { data, isLoading, refetch } = useDoctorClinicalNotes();
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

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title="Clinical notes"
        subtitle={`${data?.count ?? all.length} recorded`}
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
              placeholder="Search by title, diagnosis, patient"
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
                accessibilityLabel="Clear search"
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.textMuted,
                  }}
                >
                  Clear
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
        ) : filtered.length === 0 ? (
          <EmptyState
            style={{ marginTop: spacing.xl }}
            icon={Edit3}
            title={q ? "No matches" : "No clinical notes yet"}
            message={
              q
                ? "Try a different search."
                : "Notes you write from a patient's chart will appear here."
            }
            actionLabel={!q ? "Find a patient" : undefined}
            onAction={
              !q
                ? () => router.push("/doctor/prescription")
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
                    pathname: "/doctor/patient-detail",
                    params: { id: r.patientId },
                  } as any)
                }
                accessibilityRole="button"
                accessibilityLabel={`Note for ${r.patient?.name || "patient"}: ${r.title}`}
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
                      {r.title || "Clinical note"}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                      numberOfLines={1}
                    >
                      {r.patient?.name || "Unknown patient"}
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

// Local inline TextInput to avoid pulling FormField for a single-line search.
function TextInputShim(props: any) {
  return <RNTextInput {...props} />;
}