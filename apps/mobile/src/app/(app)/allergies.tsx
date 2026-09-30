// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertTriangle,
  ShieldAlert,
  Plus,
  Trash2,
  CircleAlert,
  Sparkles,
  Pill as PillIcon,
  Apple,
  Leaf,
  ChevronRight,
  Check,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  useAllergies,
  useAddAllergy,
  useUpdateAllergy,
  useDeleteAllergy,
  type Allergy,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Pill,
  ChipGroup,
  EmptyState,
  ErrorState,
  BottomSheet,
  FormField,
  TextInput,
  Skeleton,
  useToast,
  IconButton,
  Pressable,
  IconTile,
  SectionHeader,
} from "@/components/ui";

type Severity = "mild" | "moderate" | "severe" | "critical";

const SEVERITIES: { value: Severity; key: string; tone: any }[] = [
  { value: "mild", key: "allergies.severity.mild", tone: "info" },
  { value: "moderate", key: "allergies.severity.moderate", tone: "warning" },
  { value: "severe", key: "allergies.severity.severe", tone: "danger" },
  { value: "critical", key: "allergies.severity.critical", tone: "danger" },
];

const ALLERGEN_GROUPS: { key: string; title: string; icon: any; tone: Tone; items: string[] }[] = [
  {
    key: "medications",
    title: "Medications",
    icon: PillIcon,
    tone: "accent2",
    items: ["Penicillin", "Amoxicillin", "Aspirin / NSAIDs", "Sulfa drugs", "Codeine"],
  },
  {
    key: "food",
    title: "Food",
    icon: Apple,
    tone: "warning",
    items: ["Peanuts", "Tree nuts", "Shellfish", "Eggs", "Dairy / Lactose", "Gluten"],
  },
  {
    key: "environmental",
    title: "Latex & environment",
    icon: Leaf,
    tone: "success",
    items: ["Latex", "Pollen", "Dust mites", "Bee venom"],
  },
];

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, severe: 1, moderate: 2, mild: 3 };

const COMMON_REACTIONS = [
  "Hives / Rash",
  "Anaphylaxis",
  "Swelling / Angioedema",
  "Shortness of breath",
  "Nausea / GI upset",
];

function severityTone(sev: Severity): Tone {
  if (sev === "mild") return "info";
  if (sev === "moderate") return "warning";
  return "danger";
}

export default function AllergiesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useAllergies();
  const addAllergy = useAddAllergy();
  const updateAllergy = useUpdateAllergy();
  const deleteAllergy = useDeleteAllergy();

  const allergies: Allergy[] = useMemo(
    () => data?.allergies ?? [],
    [data?.allergies]
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Allergy | null>(null);
  const [substance, setSubstance] = useState("");
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [reaction, setReaction] = useState("");
  const [notes, setNotes] = useState("");

  const activeCount = allergies.filter((a) => a.active !== false).length;
  const critical = allergies.filter(
    (a) => a.severity === "critical" && a.active !== false
  );
  // Most dangerous first; inactive entries sink to the bottom.
  const sorted = useMemo(
    () =>
      [...allergies].sort(
        (a, b) =>
          Number(a.active === false) - Number(b.active === false) ||
          (SEVERITY_RANK[a.severity as Severity] ?? 2) - (SEVERITY_RANK[b.severity as Severity] ?? 2)
      ),
    [allergies]
  );
  const recorded = useMemo(
    () => new Set(allergies.map((a) => (a.substance || "").trim().toLowerCase())),
    [allergies]
  );
  const [presetTab, setPresetTab] = useState(ALLERGEN_GROUPS[0].key);

  function openAdd(initialSubstance = "") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditing(null);
    setSubstance(initialSubstance);
    setSeverity("moderate");
    setReaction("");
    setNotes("");
    setSheetOpen(true);
  }

  function openEdit(a: Allergy) {
    Haptics.selectionAsync().catch(() => {});
    setEditing(a);
    setSubstance(a.substance || "");
    setSeverity((a.severity as Severity) || "moderate");
    setReaction(a.reaction || "");
    setNotes(a.notes || "");
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  async function onSave() {
    const trimmed = substance.trim();
    if (trimmed.length < 2) {
      toast.show(t("allergies.error.substanceRequired", "Please specify the allergen substance"), "warning");
      return;
    }
    try {
      if (editing) {
        await updateAllergy.mutateAsync({
          id: editing.id,
          payload: {
            substance: trimmed,
            severity,
            reaction: reaction.trim() || undefined,
            notes: notes.trim() || undefined,
          },
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toast.show(t("allergies.toast.updated", "Allergy updated"), "success");
      } else {
        await addAllergy.mutateAsync({
          substance: trimmed,
          severity,
          reaction: reaction.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toast.show(t("allergies.toast.added", "Allergy added to profile"), "success");
      }
      closeSheet();
    } catch (e: any) {
      toast.show(e?.message || t("allergies.toast.saveError", "Could not save allergy"), "danger");
    }
  }

  function onDelete(a: Allergy) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      t("allergies.deleteConfirm.title", "Remove Allergy"),
      t("allergies.deleteConfirm.body", { substance: a.substance, defaultValue: `Are you sure you want to remove ${a.substance} from your allergy list?` }),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.remove", "Remove"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAllergy.mutateAsync(a.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              toast.show(t("allergies.toast.removed", "Allergy removed"), "success");
            } catch (e: any) {
              toast.show(e?.message || t("allergies.toast.removeError", "Could not remove allergy"), "danger");
            }
          },
        },
      ]
    );
  }

  async function toggleActive(a: Allergy) {
    Haptics.selectionAsync().catch(() => {});
    try {
      await updateAllergy.mutateAsync({
        id: a.id,
        payload: { active: a.active === false },
      });
    } catch (e: any) {
      toast.show(e?.message || t("allergies.toast.updateError", "Could not update status"), "danger");
    }
  }

  const reactionParts = reaction
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  function toggleReaction(r: string) {
    Haptics.selectionAsync().catch(() => {});
    const has = reactionParts.includes(r);
    setReaction((has ? reactionParts.filter((x) => x !== r) : [...reactionParts, r]).join(", "));
  }

  const subtitle =
    allergies.length === 0
      ? t("allergies.subtitleEmpty", "Track drugs, food, and environmental triggers")
      : t("allergies.subtitleCount", {
          active: activeCount,
          total: allergies.length,
          defaultValue: `${activeCount} active · ${allergies.length} recorded`,
        });

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("allergies.title", "Allergies")}
        subtitle={subtitle}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 96 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Allergy profile hero when populated ── */}
        {allergies.length > 0 && (
          <Card
            padded={false}
            elevated={false}
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              borderRadius: 28,
              borderCurve: "continuous",
              borderWidth: 0,
              overflow: "hidden",
              ...(isDark ? {} : shadow.hero),
            }}
          >
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: spacing.xl }}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: "rgba(255,255,255,0.10)",
                    opacity: 0.32,
                    borderRadius: 200,
                    transform: [{ translateX: 120 }, { translateY: -80 }],
                  },
                ]}
                pointerEvents="none"
              />
              <ShieldAlert
                size={140}
                color="#FFFFFF"
                strokeWidth={1}
                style={{
                  position: "absolute",
                  right: -24,
                  bottom: -24,
                  opacity: 0.1,
                }}
                pointerEvents="none"
              />

              <View style={{ gap: spacing.md }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 15,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255, 255, 255, 0.18)",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: "rgba(255, 255, 255, 0.28)",
                  }}
                >
                  <ShieldAlert size={22} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <View style={{ gap: 3 }}>
                  <Text
                    style={[
                      typography.title.lg,
                      { color: "#FFFFFF" },
                    ]}
                  >
                    {t("allergies.heroTitle", "Clinical Allergy Profile")}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: "rgba(255,255,255,0.86)" },
                    ]}
                  >
                    {t(
                      "allergies.heroBody",
                      "Flagged to doctors and pharmacies before prescribing or administering treatments."
                    )}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.sm,
                    marginTop: spacing.xs,
                  }}
                >
                  <HeroChip
                    label={t("allergies.chipActive", {
                      count: activeCount,
                      defaultValue: `${activeCount} Active`,
                    })}
                  />
                  {critical.length > 0 && (
                    <HeroChip
                      label={t("allergies.chipCritical", {
                        count: critical.length,
                        defaultValue: `${critical.length} Critical Alert${critical.length > 1 ? "s" : ""}`,
                      })}
                    />
                  )}
                </View>
              </View>
            </LinearGradient>
          </Card>
        )}

        {/* ── Critical Alerts Banner ── */}
        {critical.length > 0 && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              padding: spacing.lg,
              borderRadius: radius.card,
              borderCurve: "continuous",
              backgroundColor: colors.danger,
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "flex-start",
              ...(isDark ? {} : shadow.md),
            }}
            accessible
            accessibilityRole="alert"
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              <ShieldAlert size={19} color="#fff" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.title.md,
                  { color: "#fff" },
                ]}
              >
                {t("allergies.banner.title", "Critical Allergies")}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: "#fff", opacity: 0.95, marginTop: 2, fontFamily: typography.label.lg.fontFamily },
                ]}
              >
                {critical.map((c) => c.substance).join(", ")}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: "#fff", opacity: 0.85, marginTop: 4 },
                ]}
              >
                {t("allergies.banner.description", "High risk of severe anaphylaxis. Strict avoidance required.")}
              </Text>
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg }}>
          {isLoading ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <Skeleton width={42} height={42} radius={14} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Skeleton width="55%" height={14} />
                      <Skeleton width="80%" height={11} />
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : isError ? (
            <ErrorState
              title={t("recordDetail.errorTitle", "Couldn't load allergies")}
              message={t("recordDetail.errorBody", "Check your connection and try again.")}
              actionLabel={t("common.retry", "Retry")}
              onAction={() => refetch()}
            />
          ) : allergies.length === 0 ? (
            /* ── Zero state: compact safety hero ── */
            <View style={{ marginTop: spacing.xs }}>
              <Card variant="brand" padded={false}>
                <ShieldAlert
                  size={130}
                  color="#FFFFFF"
                  strokeWidth={1}
                  style={{ position: "absolute", right: -26, bottom: -30, opacity: 0.1 }}
                  pointerEvents="none"
                />
                <View style={{ padding: spacing.xl, gap: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <IconTile icon={ShieldAlert} appearance="glass" size={48} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[typography.kicker, { color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }]}>
                        {t("allergies.empty.kicker", "Safety profile")}
                      </Text>
                      <Text style={[typography.title.lg, { color: "#FFFFFF", marginTop: 2 }]}>
                        {t("allergies.empty.title", "No allergies recorded")}
                      </Text>
                    </View>
                  </View>
                  <Text style={[typography.body.sm, { color: "rgba(255,255,255,0.88)" }]}>
                    {t("allergies.empty.message")}
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing.lg }}>
                    <HeroCheck label={t("allergies.empty.sharedDoctors", "Shared with doctors")} />
                    <HeroCheck label={t("allergies.empty.sharedPharmacy", "Checked at pharmacy")} />
                  </View>
                </View>
              </Card>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {sorted.map((a) => (
                <AllergyCard
                  key={a.id}
                  allergy={a}
                  onPress={() => openEdit(a)}
                  onLongPress={() => onDelete(a)}
                  onToggle={() => toggleActive(a)}
                />
              ))}
            </View>
          )}

          {/* ── One-tap presets: tabbed by category, hides what's already recorded ── */}
          {!isLoading && !isError ? (
            <>
              <SectionHeader
                kicker={t("allergies.presets.kicker", "One-tap add")}
                title={t("allergies.presets.title", "Common allergens")}
              />
              <Card padded={false}>
                <View
                  style={{
                    flexDirection: "row",
                    margin: spacing.md,
                    marginBottom: 0,
                    padding: 4,
                    borderRadius: 999,
                    backgroundColor: colors.fill,
                  }}
                >
                  {ALLERGEN_GROUPS.map((g) => {
                    const on = presetTab === g.key;
                    const GIcon = g.icon;
                    return (
                      <Pressable
                        key={g.key}
                        onPress={() => setPresetTab(g.key)}
                        haptic="light"
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        style={[
                          {
                            flex: 1,
                            height: 36,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                            borderRadius: 999,
                            backgroundColor: on ? colors.surface : "transparent",
                          },
                          on && !isDark ? shadow.xs : null,
                        ]}
                      >
                        <GIcon size={14} color={on ? colors.primary : colors.textMuted} strokeWidth={2.4} />
                        <Text
                          numberOfLines={1}
                          style={[typography.label.sm, { color: on ? colors.text : colors.textMuted }]}
                        >
                          {t(`allergies.presets.tab.${g.key}`, g.title)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {(() => {
                  const g = ALLERGEN_GROUPS.find((x) => x.key === presetTab)!;
                  const pal = { tone: g.tone };
                  const items = g.items.filter((i) => !recorded.has(i.toLowerCase()));
                  return (
                    <View style={{ padding: spacing.md, paddingTop: spacing.md, gap: spacing.sm }}>
                      {items.length === 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.sm }}>
                          <Check size={15} color={colors.success} strokeWidth={2.6} />
                          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                            {t("allergies.presets.allAdded", "All common ones here are on your list")}
                          </Text>
                        </View>
                      ) : (
                        <PresetChips items={items} tone={pal.tone} onPick={openAdd} />
                      )}
                    </View>
                  );
                })()}
              </Card>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Persistent bottom CTA */}
      {!isLoading && !isError && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            backgroundColor: isDark ? colors.bgElevated : colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
          }}
        >
          <Button
            title={
              allergies.length === 0
                ? t("allergies.addCustom", "Add custom allergy")
                : t("allergies.addButton", "Add allergy")
            }
            icon={Plus}
            onPress={() => openAdd()}
            size="lg"
            fullWidth
          />
        </View>
      )}

      {/* Add / Edit Bottom Sheet */}
      <BottomSheet
        visible={sheetOpen}
        onDismiss={closeSheet}
        title={editing ? t("allergies.sheet.editTitle", "Edit Allergy") : t("allergies.sheet.newTitle", "Add New Allergy")}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
          {/* Substance Input */}
          <FormField label={t("allergies.field.substanceLabel", "Allergen Substance")} required>
            <TextInput
              value={substance}
              onChangeText={setSubstance}
              placeholder={t("allergies.field.substancePlaceholder", "E.g. Penicillin, Peanuts, Latex")}
              autoFocus={!editing}
            />
          </FormField>

          <FormField label={t("allergies.field.severityLabel", "Clinical Severity")}>
            <SeverityScale value={severity} onChange={setSeverity} />
          </FormField>

          <FormField label={t("allergies.field.reactionLabel", "Known Reaction")}>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {COMMON_REACTIONS.map((r) => {
                  const on = reactionParts.includes(r);
                  return (
                    <Pressable
                      key={r}
                      onPress={() => toggleReaction(r)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 11,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: on ? colors.primarySoft : colors.fill,
                        borderWidth: 1,
                        borderColor: on ? colors.primary : "transparent",
                      }}
                    >
                      {on ? <Check size={12} color={colors.primary} strokeWidth={3} /> : null}
                      <Text style={[typography.label.sm, { color: on ? colors.primary : colors.textMuted }]}>
                        {t(`allergies.reactions.${r}`, r)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={reaction}
                onChangeText={setReaction}
                placeholder={t("allergies.field.reactionPlaceholder", "E.g. Hives, difficulty breathing, facial swelling")}
              />
            </View>
          </FormField>

          {/* Notes Input */}
          <FormField label={t("allergies.field.notesLabel", "Additional Notes")}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("allergies.field.notesPlaceholder", "E.g. Diagnosed in childhood, carry EpiPen")}
              multiline
              numberOfLines={2}
            />
          </FormField>

          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <Button
              title={editing ? t("allergies.sheet.save", "Save changes") : t("allergies.sheet.add", "Add to profile")}
              icon={editing ? Check : Plus}
              size="lg"
              onPress={onSave}
              loading={addAllergy.isPending || updateAllergy.isPending}
              disabled={substance.trim().length < 2}
            />
            {editing ? (
              <Button
                title={t("common.remove", "Remove")}
                variant="ghost"
                icon={Trash2}
                onPress={() => {
                  const target = editing;
                  closeSheet();
                  setTimeout(() => onDelete(target), 250);
                }}
              />
            ) : null}
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function PresetChips({
  items,
  tone,
  onPick,
}: {
  items: string[];
  tone: Tone;
  onPick: (item: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const palette = useTone(tone);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {items.map((item) => (
        <Pressable
          key={item}
          onPress={() => onPick(item)}
          haptic="light"
          pressedScale={0.95}
          accessibilityRole="button"
          accessibilityLabel={item}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            height: 36,
            paddingLeft: 10,
            paddingRight: 14,
            borderRadius: 999,
            backgroundColor: palette.bg,
          }}
        >
          <Plus size={13} color={palette.fg} strokeWidth={2.8} />
          <Text style={[typography.label.md, { color: colors.text }]}>{t(`allergies.presetItems.${item}`, item)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Four-step severity picker with colour dots and a one-line meaning. */
function SeverityScale({ value, onChange }: { value: Severity; onChange: (s: Severity) => void }) {
  const { t } = useTranslation();
  const { colors, typography, spacing, shadow, scheme } = useTheme();
  const tones = {
    mild: useTone("info"),
    moderate: useTone("warning"),
    severe: useTone("danger"),
    critical: useTone("danger"),
  };
  const sel = tones[value];
  const help: Record<Severity, string> = {
    mild: t("allergies.severityHelp.mild", "Minor discomfort, no treatment needed"),
    moderate: t("allergies.severityHelp.moderate", "Noticeable reaction, may need medicine"),
    severe: t("allergies.severityHelp.severe", "Needs urgent medical care"),
    critical: t("allergies.severityHelp.critical", "Life-threatening — e.g. anaphylaxis"),
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", padding: 4, borderRadius: 16, backgroundColor: colors.fill, gap: 4 }}>
        {SEVERITIES.map((s) => {
          const on = s.value === value;
          const p = tones[s.value];
          return (
            <Pressable
              key={s.value}
              onPress={() => onChange(s.value)}
              haptic="light"
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[
                {
                  flex: 1,
                  height: 40,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 5,
                  backgroundColor: on ? (s.value === "critical" ? p.fg : colors.surface) : "transparent",
                },
                on && scheme !== "dark" ? shadow.xs : null,
              ]}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: on && s.value === "critical" ? "#fff" : p.fg,
                }}
              />
              <Text
                numberOfLines={1}
                style={[
                  typography.label.sm,
                  { color: on ? (s.value === "critical" ? "#fff" : colors.text) : colors.textMuted },
                ]}
              >
                {t(s.key, s.value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 12,
          backgroundColor: sel.bg,
        }}
      >
        <CircleAlert size={14} color={sel.fg} strokeWidth={2.4} />
        <Text style={[typography.caption, { color: colors.text, flex: 1 }]}>{help[value]}</Text>
      </View>
    </View>
  );
}

function HeroCheck({ label }: { label: string }) {
  const { typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.22)",
        }}
      >
        <Check size={11} color="#FFFFFF" strokeWidth={3} />
      </View>
      <Text style={[typography.label.sm, { color: "#FFFFFF", flexShrink: 1 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function HeroChip({ label, icon: Icon }: { label: string; icon?: any }) {
  const { spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(255, 255, 255, 0.18)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255, 255, 255, 0.28)",
        alignSelf: "flex-start",
      }}
    >
      {Icon ? <Icon size={13} color="#FFFFFF" strokeWidth={2.6} /> : null}
      <Text
        style={[
          typography.label.sm,
          { color: "#FFFFFF" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function AllergyCard({
  allergy,
  onPress,
  onLongPress,
  onToggle,
}: {
  allergy: Allergy;
  onPress: () => void;
  onLongPress: () => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const sev = (allergy.severity as Severity) || "moderate";
  const tone = severityTone(sev);
  const pal = useTone(tone);
  const active = allergy.active !== false;
  const sevKey =
    SEVERITIES.find((s) => s.value === sev)?.key ??
    "allergies.severity.moderate";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      pressedScale={0.985}
      accessibilityRole="button"
      accessibilityHint={t("allergies.accessibilityHint", "Tap to edit, hold to remove")}
      wrapperStyle={scheme === "dark" ? null : shadow.sm}
      style={{
        padding: spacing.lg,
        paddingLeft: spacing.lg + 4,
        borderRadius: radius.card,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: sev === "critical" && active ? 1 : StyleSheet.hairlineWidth,
        borderColor: sev === "critical" && active ? colors.danger + "59" : colors.hairline,
        opacity: active ? 1 : 0.7,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          backgroundColor: active ? pal.fg : colors.fillStrong,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        {/* Soft Avatar */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pal.bg,
          }}
        >
          <AlertTriangle size={19} color={pal.fg} strokeWidth={2.3} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <Text
              style={[
                typography.title.md,
                { color: colors.text, flexShrink: 1 },
              ]}
              numberOfLines={1}
            >
              {allergy.substance}
            </Text>
            <Pill label={t(sevKey, sev)} tone={tone} size="sm" />
            {!active && (
              <Pill
                label={t("allergies.status.inactive", "Inactive")}
                tone="neutral"
                size="sm"
              />
            )}
          </View>

          {!!allergy.reaction && (
            <Text
              style={[typography.body.sm, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {allergy.reaction}
            </Text>
          )}

          {!!allergy.notes && (
            <Text
              style={[typography.caption, { color: colors.textSubtle }]}
              numberOfLines={1}
            >
              {allergy.notes}
            </Text>
          )}
        </View>

        {/* Status Toggle Switch */}
        <Switch
          value={active}
          onValueChange={onToggle}
          trackColor={{ false: colors.fillStrong, true: colors.success }}
          thumbColor="#FFFFFF"
          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          accessibilityLabel={active ? t("allergies.toggle.deactivateLabel") : t("allergies.toggle.reactivateLabel")}
        />
      </View>
    </Pressable>
  );
}
