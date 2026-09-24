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
import { Screen, ErrorState, Skeleton } from "@/components/ui";
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
      hash = (hash + name.charCodeAt(i)) % tones.length;
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
  const hairline = isDark ? colors.borderStrong : colors.separator;

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
        "Starter Protocols",
        e?.message || "Some starter templates could not be created."
      );
    } finally {
      setIsInstalling(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const meds = Array.isArray(item.medicines) ? item.medicines : [];
      const palette = getTemplatePalette(item.specialty, item.name, colors);

      return (
        <Pressable
          onPress={() => router.push(`/(doctor)/rx-templates/${item.id}` as any)}
          style={({ pressed }) => ({
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: hairline,
            padding: 16,
            marginHorizontal: spacing.lg,
            marginBottom: 12,
            ...(isDark ? {} : shadow.sm),
            opacity: pressed ? 0.94 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          {/* Card Top: Icon, Title, Diagnosis, Usage Badge, Trash */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                borderCurve: "continuous",
                backgroundColor: palette.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pill size={20} color={palette.fg} strokeWidth={2.2} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text
                  style={[typography.title.md, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </View>

              {item.diagnosis && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <Stethoscope size={12} color={colors.textSubtle} />
                  <Text
                    style={[typography.body.sm, { color: colors.textMuted, flexShrink: 1 }]}
                    numberOfLines={1}
                  >
                    {item.diagnosis}
                  </Text>
                </View>
              )}
            </View>

            {/* Badges & Actions */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {item.useCount > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Flame size={11} color={colors.primary} />
                  <Text style={[typography.label.xs, { color: colors.primary, fontVariant: ["tabular-nums"] }]}>
                    {item.useCount}x
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => handleDelete(item.id, item.name)}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor: pressed ? colors.dangerSoft : colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Trash2 size={14} color={colors.danger} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Medicines List Chips */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 12,
              paddingTop: 10,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
            }}
          >
            {meds.map((m: any, idx: number) => (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: colors.surfaceMuted,
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 9,
                  borderCurve: "continuous",
                }}
              >
                <Text style={[typography.label.sm, { color: colors.text }]}>
                  {m.name}
                </Text>
                {m.dosage ? (
                  <Text style={[typography.caption, { fontSize: 11, color: colors.textMuted }]}>
                    {m.dosage}
                  </Text>
                ) : null}
                {m.frequency ? (
                  <Text style={[typography.caption, { fontSize: 11, color: colors.textSubtle }]}>
                    • {m.frequency}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {/* Card Footer: Quick stats & Action trigger */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              paddingTop: 8,
            }}
          >
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              {meds.length} medication{meds.length === 1 ? "" : "s"} configured
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={[typography.label.md, { color: colors.primary }]}>
                View & Edit
              </Text>
              <ChevronRight size={13} color={colors.primary} strokeWidth={2.4} />
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, spacing, typography, fontFamily, radius, router, handleDelete, hairline, isDark, shadow]
  );

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* ── Top Header ── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: colors.bg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            {/* Back Button */}
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.fillStrong : colors.fill,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <ChevronLeft size={20} color={colors.text} strokeWidth={2.4} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[typography.display.sm, { color: colors.text }]}>
                {t("rxTemplates.title", { defaultValue: "Rx Templates" })}
              </Text>
              <Text
                numberOfLines={1}
                style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}
              >
                {t("rxTemplates.subtitle", {
                  defaultValue: "Saved prescriptions for quick prescribing",
                })}
              </Text>
            </View>
          </View>

          {/* New Template CTA */}
          <Pressable
            onPress={() => router.push("/(doctor)/rx-templates/new" as any)}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              height: 36,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Plus size={15} color={colors.primary} strokeWidth={2.6} />
            <Text style={[typography.label.md, { color: colors.primary }]}>
              {t("rxTemplates.newCta", { defaultValue: "New" })}
            </Text>
          </Pressable>
        </View>

        {/* ── Search & Filter Controls (when templates exist) ── */}
        {rawTemplates.length > 0 && (
          <View style={{ marginTop: 14, gap: 10 }}>
            {/* Search Bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.fill,
                borderRadius: 12,
                borderCurve: "continuous",
                paddingHorizontal: 12,
                height: 40,
                gap: 8,
              }}
            >
              <Search size={16} color={colors.textSubtle} strokeWidth={2.2} />
              <RNTextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search templates, drugs, or diagnosis..."
                placeholderTextColor={colors.textSubtle}
                style={{
                  flex: 1,
                  ...typography.body.md,
                  color: colors.text,
                  paddingVertical: 0,
                }}
              />
              {search.length > 0 && (
                <Pressable
                  onPress={() => setSearch("")}
                  hitSlop={8}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: colors.fillStrong,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={12} color={colors.textMuted} strokeWidth={2.6} />
                </Pressable>
              )}
            </View>

            {/* Category Filter Chips */}
            {categories.length > 2 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
              >
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={{
                        height: 32,
                        justifyContent: "center",
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderCurve: "continuous",
                        backgroundColor: active ? colors.primarySoft : colors.fill,
                      }}
                    >
                      <Text
                        style={[
                          active ? typography.label.md : typography.body.sm,
                          { color: active ? colors.primary : colors.textMuted },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
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
              ...(isDark ? {} : shadow.sm),
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
              Clinical Prescription Protocols
            </Text>

            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, textAlign: "center", paddingHorizontal: 8, marginBottom: 20 },
              ]}
            >
              Save standard drug combinations, dosages, and instructions to autofill your prescription composer with a single tap.
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
                {isInstalling ? "Installing Starter Protocols..." : "Install 4 Recommended Starters"}
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
                Create Custom Template
              </Text>
            </Pressable>
          </View>

          {/* Starter Pack Preview Section */}
          <View style={{ marginTop: spacing.xxl }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingHorizontal: 4 }}>
              <Sparkles size={16} color={colors.primary} />
              <Text style={[typography.title.lg, { color: colors.text }]}>
                Included in Starter Pack
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
                ...(isDark ? {} : shadow.sm),
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
                      {st.medicines.length} meds
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
            No matching templates
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, textAlign: "center", marginBottom: 16 },
            ]}
          >
            No template matched "{search}". Try searching for another medicine or condition.
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
              Clear Search
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
