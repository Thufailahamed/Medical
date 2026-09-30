// @ts-nocheck
import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput as RNTextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Pill,
  Plus,
  Stethoscope,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Search,
  X,
  Sparkles,
  Flame,
  FilePenLine,
  HeartPulse,
} from "lucide-react-native";
import {
  useDoctorRxTemplates,
  useDeleteRxTemplate,
  useCreateRxTemplate,
} from "@/hooks/useApi";
import { Screen, ScreenHeader, ErrorState, IconButton, SearchField, Skeleton } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import { tonePalette, type Tone } from "@/theme/tone";

const STARTER_TEMPLATES = [
  {
    name: "Acute URTI / Cold Protocol",
    diagnosis: "Acute Upper Respiratory Tract Infection",
    specialty: "General Practice",
    notes: "Rest, warm saline gargle, steam inhalation, and oral hydration.",
    medicines: [
      { name: "Paracetamol", dosage: "500mg", frequency: "Three times daily", duration: "5 days", instructions: "After food" },
      { name: "Cetirizine", dosage: "10mg", frequency: "Once daily", duration: "5 days", instructions: "Night after food" },
      { name: "Amoxicillin", dosage: "500mg", frequency: "Three times daily", duration: "5 days", instructions: "After food" },
    ],
  },
  {
    name: "Hypertension Maintenance",
    diagnosis: "Essential Primary Hypertension",
    specialty: "Cardiology",
    notes: "Low sodium diet, moderate cardio exercise, monitor weekly BP.",
    medicines: [
      { name: "Amlodipine", dosage: "5mg", frequency: "Once daily", duration: "30 days", instructions: "Morning" },
      { name: "Losartan Potassium", dosage: "50mg", frequency: "Once daily", duration: "30 days", instructions: "Morning" },
    ],
  },
  {
    name: "Type 2 Diabetes First-Line",
    diagnosis: "Type 2 Diabetes Mellitus",
    specialty: "Endocrinology",
    notes: "Check FBS/HbA1c in 3 months. Maintain low glycemic index diet.",
    medicines: [
      { name: "Metformin", dosage: "500mg", frequency: "Twice daily", duration: "30 days", instructions: "With food" },
      { name: "Glimepiride", dosage: "1mg", frequency: "Once daily", duration: "30 days", instructions: "Before breakfast" },
    ],
  },
  {
    name: "Acute Gastritis / Acid Reflux",
    diagnosis: "Gastroesophageal Reflux Disease (GERD)",
    specialty: "Gastroenterology",
    notes: "Avoid spicy and oily food. Do not lie down within 2 hours of dinner.",
    medicines: [
      { name: "Omeprazole", dosage: "20mg", frequency: "Once daily", duration: "14 days", instructions: "30 mins before breakfast" },
      { name: "Domperidone", dosage: "10mg", frequency: "Three times daily", duration: "7 days", instructions: "15 mins before meals" },
    ],
  },
];

// Specialty colour coding, expressed as theme tones so it adapts to dark mode.
const SPECIALTY_TONES: Record<string, Tone> = {
  Cardiology: "danger",
  Endocrinology: "primary",
  Gastroenterology: "warning",
  "General Practice": "accent",
  Pulmonology: "info",
};

function getTemplatePalette(specialty: string | undefined, name: string | undefined, colors: any) {
  let tone: Tone;
  if (specialty && SPECIALTY_TONES[specialty]) {
    tone = SPECIALTY_TONES[specialty];
  } else {
    const tones = Object.values(SPECIALTY_TONES);
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
      hash = (hash + (name || "").charCodeAt(i)) % tones.length;
    }
    tone = tones[hash];
  }
  const tp = tonePalette(tone, colors);
  return { bg: tp.bg, fg: tp.fg, border: "transparent" };
}

export default function RxTemplatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.hairline;

  const { data, isLoading, isError, refetch, isRefetching } = useDoctorRxTemplates();
  const deleteMutation = useDeleteRxTemplate();
  const createMutation = useCreateRxTemplate();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isInstalling, setIsInstalling] = useState(false);

  const rawTemplates = data?.templates || [];

  const categories = useMemo(() => {
    const set = new Set<string>();
    rawTemplates.forEach((item: any) => {
      if (item.specialty) set.add(item.specialty);
    });
    return ["All", ...Array.from(set)];
  }, [rawTemplates]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: rawTemplates.length };
    rawTemplates.forEach((item: any) => {
      if (item.specialty) counts[item.specialty] = (counts[item.specialty] ?? 0) + 1;
    });
    return counts;
  }, [rawTemplates]);

  const filteredTemplates = useMemo(() => {
    let list = rawTemplates;
    if (selectedCategory !== "All") {
      list = list.filter((item: any) => item.specialty === selectedCategory);
    }
    if (search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      list = list.filter((item: any) => {
        const nameMatch = (item.name || "").toLowerCase().includes(q);
        const diagMatch = (item.diagnosis || "").toLowerCase().includes(q);
        const medMatch = (item.medicines || []).some((m: any) =>
          (m.name || "").toLowerCase().includes(q)
        );
        return nameMatch || diagMatch || medMatch;
      });
    }
    return list;
  }, [rawTemplates, selectedCategory, search]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      Alert.alert(
        t("rxTemplates.deleteTitle", { defaultValue: "Delete Template" }),
        t("rxTemplates.deleteMessage", {
          name,
          defaultValue: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        }),
        [
          { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
          {
            text: t("common.delete", { defaultValue: "Delete" }),
            style: "destructive",
            onPress: () => deleteMutation.mutate(id),
          },
        ]
      );
    },
    [deleteMutation, t]
  );

  const handleInstallStarters = async () => {
    setIsInstalling(true);
    try {
      for (const tpl of STARTER_TEMPLATES) {
        await createMutation.mutateAsync(tpl);
      }
      refetch();
    } catch (e: any) {
      Alert.alert(
        t("rxTemplates.starterErrorTitle"),
        e?.message || t("rxTemplates.starterErrorBody")
      );
    } finally {
      setIsInstalling(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const meds = Array.isArray(item.medicines) ? item.medicines : [];
      const palette = getTemplatePalette(item.specialty, item.name, colors);
      const shown = meds.slice(0, 3);
      const extra = meds.length - shown.length;

      return (
        <Pressable
          onPress={() => router.push(`/(doctor)/rx-templates/${item.id}` as any)}
          onLongPress={() => handleDelete(item.id, item.name)}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}. ${t("rxTemplates.medsShort", { count: meds.length })}`}
          accessibilityHint={t("rxTemplates.longPressHint", "Long-press to delete")}
          style={({ pressed }) => ({
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: hairline,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.md,
            overflow: "hidden",
            ...(isDark ? {} : shadow.card),
            transform: [{ scale: pressed ? 0.985 : 1 }],
          })}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 13,
                borderCurve: "continuous",
                backgroundColor: palette.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pill size={19} color={palette.fg} strokeWidth={2.2} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[typography.title.sm, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.diagnosis ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Stethoscope size={11} color={colors.textSubtle} strokeWidth={2.2} />
                  <Text
                    style={[typography.caption, { color: colors.textMuted, flexShrink: 1 }]}
                    numberOfLines={1}
                  >
                    {item.diagnosis}
                  </Text>
                </View>
              ) : null}
            </View>

            {item.useCount > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  paddingHorizontal: 7,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Flame size={11} color={colors.primary} strokeWidth={2.4} />
                <Text style={[typography.label.xs, { color: colors.primary, fontVariant: ["tabular-nums"] }]}>
                  {item.useCount}×
                </Text>
              </View>
            ) : null}

            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.well,
              }}
            >
              <ChevronRight size={15} color={colors.textMuted} strokeWidth={2.5} />
            </View>
          </View>

          {/* Medicines — compact regimen list */}
          <View
            style={{
              marginHorizontal: spacing.md,
              marginBottom: spacing.md,
              paddingVertical: 4,
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: colors.surfaceMuted,
            }}
          >
            {shown.length === 0 ? (
              <Text
                style={[typography.caption, { color: colors.textSubtle, paddingHorizontal: 12, paddingVertical: 8 }]}
              >
                {t("rxTemplates.noMeds")}
              </Text>
            ) : (
              shown.map((m: any, idx: number) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                  }}
                >
                  <View
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.fg }}
                  />
                  <Text numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.label.md, { color: colors.text }]}>{m.name}</Text>
                    {m.dosage ? (
                      <Text style={[typography.caption, { color: colors.textMuted }]}>  {m.dosage}</Text>
                    ) : null}
                  </Text>
                  {m.frequency ? (
                    <Text
                      numberOfLines={1}
                      style={[typography.caption, { color: colors.textSubtle, maxWidth: "45%" }]}
                    >
                      {m.frequency}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
            {extra > 0 ? (
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.primary,
                    paddingHorizontal: 12,
                    paddingTop: 2,
                    paddingBottom: 6,
                    marginLeft: 14,
                  },
                ]}
              >
                {t("rxTemplates.moreMeds", { count: extra, defaultValue: `+${extra} more` })}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [colors, spacing, typography, radius, router, handleDelete, hairline, isDark, shadow, t]
  );

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* ── Top Header ── */}
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("rxTemplates.title", { defaultValue: "Rx templates" })}
        subtitle={t("rxTemplates.subtitle", {
          defaultValue: "Saved prescriptions for quick prescribing",
        })}
        right={
          <IconButton
            icon={Plus}
            variant="solid"
            onPress={() => router.push("/(doctor)/rx-templates/new" as any)}
            accessibilityLabel={t("rxTemplates.newCta", { defaultValue: "New" })}
          />
        }
      />
      <View style={{ paddingHorizontal: spacing.lg }}>
        {/* ── Search & Filter Controls (when templates exist) ── */}
        {rawTemplates.length > 0 && (
          <View style={{ gap: 4 }}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t("rxTemplates.searchPlaceholder")}
            />

            {/* Category Filter Chips */}
            {categories.length > 2 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -spacing.lg }}
                contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.lg, paddingVertical: 10 }}
              >
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  const count = categoryCounts[cat] ?? 0;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        height: 32,
                        paddingLeft: 12,
                        paddingRight: 6,
                        borderRadius: 16,
                        borderCurve: "continuous",
                        backgroundColor: active ? colors.text : colors.surface,
                        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
                        borderColor: hairline,
                        opacity: pressed && !active ? 0.7 : 1,
                      })}
                    >
                      <Text
                        style={[
                          typography.label.md,
                          { color: active ? colors.bg : colors.text },
                        ]}
                      >
                        {cat === "All" ? t("rxTemplates.categoryAll") : cat}
                      </Text>
                      <View
                        style={{
                          minWidth: 20,
                          height: 20,
                          paddingHorizontal: 5,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: active ? withOpacity(colors.bg, 0.18) : colors.fill,
                        }}
                      >
                        <Text
                          style={[
                            typography.label.xs,
                            { color: active ? colors.bg : colors.textMuted, fontVariant: ["tabular-nums"] },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <Text style={[typography.caption, { color: colors.textSubtle, paddingHorizontal: 2, paddingBottom: 4 }]}>
              {t("rxTemplates.listHint", {
                count: filteredTemplates.length,
                defaultValue: `${filteredTemplates.length} templates · long-press to delete`,
              })}
            </Text>
          </View>
        )}
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View
              key={i}
              style={{
                padding: 16,
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: hairline,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Skeleton width={44} height={44} radius={14} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="55%" height={15} radius={4} />
                  <Skeleton width="35%" height={12} radius={4} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Skeleton width={90} height={24} radius={8} />
                <Skeleton width={80} height={24} radius={8} />
              </View>
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("rxTemplates.errorTitle", { defaultValue: "Failed to load templates" })}
          message={t("rxTemplates.errorBody", {
            defaultValue: "Could not retrieve your prescription templates. Please try again.",
          })}
          actionLabel={t("common.retry", { defaultValue: "Retry" })}
          onAction={() => refetch()}
        />
      ) : rawTemplates.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: 130,
          }}
        >
          {/* Elite Hero Card */}
          <View
            style={{
              alignItems: "center",
              padding: 24,
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderCurve: "continuous",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: hairline,
              ...(isDark ? {} : shadow.card),
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Layers size={30} color={colors.primary} strokeWidth={2.2} />
            </View>

            <Text
              style={[
                typography.title.lg,
                {
                  color: colors.text,
                  textAlign: "center",
                  marginBottom: 6,
                },
              ]}
            >
              {t("rxTemplates.emptyHeroTitle")}
            </Text>

            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, textAlign: "center", paddingHorizontal: 8, marginBottom: 20 },
              ]}
            >
              {t("rxTemplates.emptyHeroBody")}
            </Text>

            {/* Primary Action: Install Starters */}
            <Pressable
              onPress={handleInstallStarters}
              disabled={isInstalling}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                height: 52,
                borderRadius: radius.button,
                borderCurve: "continuous",
                backgroundColor: colors.primary,
                opacity: pressed || isInstalling ? 0.85 : 1,
                ...(isDark ? {} : shadow.primary),
              })}
            >
              {isInstalling ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Sparkles size={16} color={colors.onPrimary} strokeWidth={2.4} />
              )}
              <Text style={[typography.title.sm, { color: colors.onPrimary }]}>
                {isInstalling
                  ? t("rxTemplates.installingStarters")
                  : t("rxTemplates.installStarters", { count: STARTER_TEMPLATES.length })}
              </Text>
            </Pressable>

            {/* Secondary Action: Create Blank Template */}
            <Pressable
              onPress={() => router.push("/(doctor)/rx-templates/new" as any)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                width: "100%",
                height: 48,
                borderRadius: radius.button,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                marginTop: 10,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Plus size={16} color={colors.primary} strokeWidth={2.4} />
              <Text style={[typography.title.sm, { color: colors.primary }]}>
                {t("rxTemplates.createCustom")}
              </Text>
            </Pressable>
          </View>

          {/* Starter Pack Preview Section */}
          <View style={{ marginTop: spacing.xxl }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingHorizontal: 4 }}>
              <Sparkles size={16} color={colors.primary} />
              <Text style={[typography.title.lg, { color: colors.text }]}>
                {t("rxTemplates.starterPackTitle")}
              </Text>
            </View>

            <View
              style={{
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: hairline,
                overflow: "hidden",
                ...(isDark ? {} : shadow.card),
              }}
            >
              {STARTER_TEMPLATES.map((st, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 60,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[typography.title.sm, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {st.name}
                    </Text>
                    <Text
                      style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}
                      numberOfLines={1}
                    >
                      {st.medicines.map((m) => m.name).join(", ")}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.primarySoft,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      marginLeft: 10,
                    }}
                  >
                    <Text style={[typography.label.xs, { color: colors.primary }]}>
                      {t("rxTemplates.medsShort", { count: st.medicines.length })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : filteredTemplates.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: colors.fill,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Search size={22} color={colors.textSubtle} strokeWidth={2} />
          </View>
          <Text style={[typography.title.md, { color: colors.text, marginBottom: 4 }]}>
            {t("rxTemplates.noMatchingTitle")}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, textAlign: "center", marginBottom: 16 },
            ]}
          >
            {t("rxTemplates.noMatchingBody", { search })}
          </Text>
          <Pressable
            onPress={() => setSearch("")}
            style={{
              paddingHorizontal: 16,
              height: 36,
              justifyContent: "center",
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
            }}
          >
            <Text style={[typography.label.md, { color: colors.primary }]}>
              {t("rxTemplates.clearSearch")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredTemplates}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </Screen>
  );
}
