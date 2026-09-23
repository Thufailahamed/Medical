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

const SPECIALTY_PALETTES: Record<string, { bg: string; fg: string; border: string }> = {
  Cardiology: { bg: "#FEF2F2", fg: "#EF4444", border: "#FECACA" },
  Endocrinology: { bg: "#EFF6FF", fg: "#2563EB", border: "#BFDBFE" },
  Gastroenterology: { bg: "#FFFBEB", fg: "#D97706", border: "#FDE68A" },
  "General Practice": { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0" },
  Pulmonology: { bg: "#F5F3FF", fg: "#7C3AED", border: "#DDD6FE" },
};

function getTemplatePalette(specialty?: string, name?: string) {
  if (specialty && SPECIALTY_PALETTES[specialty]) {
    return SPECIALTY_PALETTES[specialty];
  }
  const palettes = Object.values(SPECIALTY_PALETTES);
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash + name.charCodeAt(i)) % palettes.length;
  }
  return palettes[hash];
}

export default function RxTemplatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();

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
      const palette = getTemplatePalette(item.specialty, item.name);

      return (
        <Pressable
          onPress={() => router.push(`/(doctor)/rx-templates/${item.id}` as any)}
          style={({ pressed }) => ({
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.borderSubtle ?? colors.border,
            padding: 16,
            marginHorizontal: spacing.lg,
            marginBottom: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1.5,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.995 : 1 }],
          })}
        >
          {/* Card Top: Icon, Title, Diagnosis, Usage Badge, Trash */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: palette.bg,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: palette.border,
              }}
            >
              <Pill size={20} color={palette.fg} strokeWidth={2.2} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.text,
                    fontFamily: fontFamily.displayBold,
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </View>

              {item.diagnosis && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <Stethoscope size={12} color={colors.textSubtle} />
                  <Text
                    style={{
                      fontSize: 12.5,
                      color: colors.textMuted,
                      fontFamily: fontFamily.body,
                    }}
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
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Flame size={11} color={colors.primary} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: colors.primary,
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
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
                  borderRadius: 10,
                  backgroundColor: pressed ? (colors.dangerSoft || "#FEE2E2") : colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Trash2 size={14} color={colors.danger || "#EF4444"} strokeWidth={2} />
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
              borderTopColor: colors.borderSubtle ?? colors.border,
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
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle ?? colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: "600",
                    color: colors.text,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {m.name}
                </Text>
                {m.dosage ? (
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    {m.dosage}
                  </Text>
                ) : null}
                {m.frequency ? (
                  <Text style={{ fontSize: 10, color: colors.textSubtle }}>
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
            <Text style={{ fontSize: 11.5, color: colors.textSubtle }}>
              {meds.length} medication{meds.length === 1 ? "" : "s"} configured
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.primary,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                View & Edit
              </Text>
              <ChevronRight size={13} color={colors.primary} strokeWidth={2.4} />
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, spacing, typography, fontFamily, radius, router, handleDelete]
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
                width: 38,
                height: 38,
                borderRadius: 13,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderSubtle ?? colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              })}
            >
              <ChevronLeft size={20} color={colors.text} strokeWidth={2.4} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.display.lg,
                  {
                    color: colors.text,
                    fontFamily: fontFamily.displayBold,
                    fontSize: 22,
                    lineHeight: 28,
                    letterSpacing: -0.4,
                  },
                ]}
              >
                {t("rxTemplates.title", { defaultValue: "Rx Templates" })}
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  color: colors.textMuted,
                  marginTop: 1,
                  fontFamily: fontFamily.body,
                }}
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
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 2,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.6} />
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "700",
                fontSize: 13,
                fontFamily: fontFamily.bodyBold,
              }}
            >
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
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.borderSubtle ?? colors.border,
                paddingHorizontal: 14,
                height: 44,
                gap: 10,
              }}
            >
              <Search size={16} color={colors.primary} strokeWidth={2.2} />
              <RNTextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search templates, drugs, or diagnosis..."
                placeholderTextColor={colors.textSubtle}
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  color: colors.text,
                  fontFamily: fontFamily.body,
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
                    backgroundColor: colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={12} color={colors.textMuted} strokeWidth={2.2} />
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
                        paddingVertical: 5,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.borderSubtle ?? colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: active ? "700" : "600",
                          color: active ? "#FFFFFF" : colors.textMuted,
                          fontFamily: active ? fontFamily.bodyBold : fontFamily.body,
                        }}
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
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderSubtle ?? colors.border,
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
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.03,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                backgroundColor: colors.primarySoft,
                borderWidth: 1,
                borderColor: withOpacity(colors.primary, 0.25),
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Layers size={30} color={colors.primary} strokeWidth={2.2} />
            </View>

            <Text
              style={[
                typography.title.md,
                {
                  color: colors.text,
                  fontFamily: fontFamily.displayBold,
                  fontSize: 19,
                  fontWeight: "800",
                  textAlign: "center",
                  marginBottom: 6,
                },
              ]}
            >
              Clinical Prescription Protocols
            </Text>

            <Text
              style={{
                fontSize: 13.5,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 20,
                paddingHorizontal: 8,
                marginBottom: 20,
              }}
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
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: colors.primary,
                opacity: pressed || isInstalling ? 0.85 : 1,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
                elevation: 3,
              })}
            >
              {isInstalling ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
              )}
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "700",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
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
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.borderSubtle ?? colors.border,
                marginTop: 10,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Plus size={16} color={colors.text} strokeWidth={2.4} />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 13.5,
                  fontWeight: "700",
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                Create Custom Template
              </Text>
            </Pressable>
          </View>

          {/* Starter Pack Preview Section */}
          <View style={{ marginTop: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Sparkles size={14} color={colors.primary} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                Included in Starter Pack
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {STARTER_TEMPLATES.map((st, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle ?? colors.border,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: colors.text,
                        fontFamily: fontFamily.bodyBold,
                      }}
                      numberOfLines={1}
                    >
                      {st.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        marginTop: 2,
                      }}
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
                      marginLeft: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: colors.primary }}>
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
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Search size={22} color={colors.textSubtle} strokeWidth={2} />
          </View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
              marginBottom: 4,
            }}
          >
            No matching templates
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 18,
              marginBottom: 16,
            }}
          >
            No template matched "{search}". Try searching for another medicine or condition.
          </Text>
          <Pressable
            onPress={() => setSearch("")}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 16,
              backgroundColor: colors.primarySoft,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
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
