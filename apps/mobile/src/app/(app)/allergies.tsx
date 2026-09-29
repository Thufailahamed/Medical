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
        right={
          <IconButton
            icon={Plus}
            onPress={() => openAdd()}
            accessibilityLabel={t("allergies.addButton", "Add allergy")}
          />
        }
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
            /* ── Zero state: safety hero + one-tap category presets ── */
            <View style={{ marginTop: spacing.xs }}>
              <Card variant="brand" padded={false}>
                <ShieldAlert
                  size={150}
                  color="#FFFFFF"
                  strokeWidth={1}
                  style={{ position: "absolute", right: -30, bottom: -34, opacity: 0.1 }}
                  pointerEvents="none"
                />
                <View style={{ padding: spacing.xl, gap: spacing.lg }}>
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
                    {t(
                      "allergies.empty.message",
                      "Record medication, food, latex, and environmental triggers so your care team avoids contraindications."
                    )}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    <HeroChip label={t("allergies.empty.sharedDoctors", "Shared with doctors")} icon={Check} />
                    <HeroChip label={t("allergies.empty.sharedPharmacy", "Checked at pharmacy")} icon={Check} />
                  </View>
                </View>
              </Card>

              <SectionHeader
                kicker={t("allergies.presets.kicker", "One-tap add")}
                title={t("allergies.presets.title", "Common allergens")}
              />
              <View style={{ gap: spacing.md }}>
                {ALLERGEN_GROUPS.map((g) => (
                  <PresetGroup
                    key={g.key}
                    icon={g.icon}
                    tone={g.tone}
                    title={t(`allergies.presets.${g.key}`, g.title)}
                    items={g.items}
                    onPick={openAdd}
                  />
                ))}
              </View>

              <Pressable
                onPress={() => openAdd()}
                accessibilityRole="button"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  marginTop: spacing.md,
                  padding: spacing.lg,
                  borderRadius: radius.card,
                  borderCurve: "continuous",
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: colors.borderStrong,
                }}
              >
                <IconTile icon={Plus} tone="primary" size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("allergies.presets.customTitle", "Something else?")}
                  </Text>
                  <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                    {t("allergies.presets.customBody", "Add any substance with its severity and reaction")}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textSubtle} />
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {allergies.map((a) => (
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

          {/* Severity selector */}
          <FormField label={t("allergies.field.severityLabel", "Clinical Severity")}>
            <ChipGroup
              options={SEVERITIES.map((s) => ({
                value: s.value,
                label: t(s.key, s.value.charAt(0).toUpperCase() + s.value.slice(1)),
              }))}
              value={severity}
              onChange={(v) => setSeverity(v as Severity)}
            />
          </FormField>

          {/* Reaction Input + Quick Chips */}
          <FormField label={t("allergies.field.reactionLabel", "Known Reaction")}>
            <View style={{ gap: spacing.xs }}>
              <TextInput
                value={reaction}
                onChangeText={setReaction}
                placeholder={t("allergies.field.reactionPlaceholder", "E.g. Hives, difficulty breathing, facial swelling")}
                multiline
                numberOfLines={2}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {COMMON_REACTIONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setReaction(r)}
                    style={{
                      paddingHorizontal: 10,
                      height: 30,
                      justifyContent: "center",
                      borderRadius: 15,
                      backgroundColor: reaction === r ? colors.primarySoft : colors.fill,
                    }}
                  >
                    <Text
                      style={[
                        typography.label.sm,
                        {
                          color: reaction === r ? colors.primary : colors.textMuted,
                        },
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
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

          {/* Sheet Actions */}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
            {editing && (
              <Button
                title={t("common.remove", "Remove")}
                variant="outline"
                tone="danger"
                icon={Trash2}
                onPress={() => {
                  closeSheet();
                  setTimeout(() => onDelete(editing), 250);
                }}
                style={{ flex: 1 }}
              />
            )}
            <Button
              title={t("common.cancel", "Cancel")}
              variant="outline"
              onPress={closeSheet}
              style={{ flex: 1 }}
            />
            <Button
              title={editing ? t("common.save", "Save") : t("common.add", "Add")}
              icon={editing ? undefined : Plus}
              onPress={onSave}
              loading={addAllergy.isPending || updateAllergy.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function PresetGroup({
  icon,
  tone,
  title,
  items,
  onPick,
}: {
  icon: any;
  tone: Tone;
  title: string;
  items: string[];
  onPick: (item: string) => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const palette = useTone(tone);

  return (
    <Card padded={false}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconTile icon={icon} tone={tone} size={36} />
          <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]}>{title}</Text>
        </View>
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
                height: 34,
                paddingLeft: 10,
                paddingRight: 13,
                borderRadius: 999,
                backgroundColor: palette.bg,
              }}
            >
              <Plus size={13} color={palette.fg} strokeWidth={2.6} />
              <Text style={[typography.label.md, { color: colors.text }]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Card>
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
  onToggle,
}: {
  allergy: Allergy;
  onPress: () => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const sev = (allergy.severity as Severity) || "moderate";
  const tone = severityTone(sev);
  const pal = useTone(tone);
  const active = allergy.active !== false;
  const sevKey =
    SEVERITIES.find((s) => s.value === sev)?.key ??
    "allergies.severity.moderate";

  return (
    <Card
      onPress={onPress}
      accessibilityHint={t("allergies.accessibilityHint", "Double tap to edit")}
      style={{
        opacity: active ? 1 : 0.75,
        ...(sev === "critical"
          ? { borderWidth: 1, borderColor: colors.danger + "59" }
          : null),
      }}
    >
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
        />
      </View>
    </Card>
  );
}
