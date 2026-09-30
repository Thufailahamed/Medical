// @ts-nocheck

import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Pill,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Info,
  Plus,
  X,
  Sparkles,
  Check,
  ShieldCheck,
  ListPlus,
  ChevronRight,
} from "lucide-react-native";
import {
  useAiDrugCheck,
  useMyMedicines,
  type DrugInteraction,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  Pill as PillCmp,
  TextInput,
  useToast,
} from "@/components/ui";

const SUGGESTIONS = [
  "Paracetamol",
  "Ibuprofen",
  "Aspirin",
  "Amoxicillin",
  "Metformin",
  "Atorvastatin",
  "Amlodipine",
  "Omeprazole",
];

function severityTone(s: string): any {
  switch (s) {
    case "severe":
      return "danger";
    case "moderate":
      return "warning";
    case "minor":
      return "info";
    default:
      return "neutral";
  }
}

const SEVERITY_RANK: Record<string, number> = { severe: 0, moderate: 1, minor: 2 };

function severityIcon(s: string) {
  switch (s) {
    case "severe":
      return AlertOctagon;
    case "moderate":
      return AlertTriangle;
    case "minor":
      return Info;
    default:
      return ShieldAlert;
  }
}

export default function DrugCheckScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme } = useTheme();
  const toast = useToast();

  const { data: medsData } = useMyMedicines();
  const aiDrugCheck = useAiDrugCheck();

  const [medicines, setMedicines] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<{
    interactions: DrugInteraction[];
    warnings?: string[];
  } | null>(null);

  const activeMeds: string[] = (medsData?.medicines || [])
    .filter((m: any) => m.active !== false)
    .map((m: any) => m.name);

  const has = (name: string) =>
    medicines.some((m) => m.toLowerCase() === name.trim().toLowerCase());

  // Any edit to the list makes a previous result stale.
  function updateList(next: string[]) {
    setMedicines(next);
    setResult(null);
  }

  function addMedicine(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (has(clean)) {
      toast.show(t("aiDrugCheck.alreadyAdded"), "warning");
      return;
    }
    updateList([...medicines, clean]);
    setDraft("");
  }

  function toggleSuggestion(name: string) {
    if (has(name)) updateList(medicines.filter((m) => m.toLowerCase() !== name.toLowerCase()));
    else updateList([...medicines, name]);
  }

  function removeMedicine(name: string) {
    updateList(medicines.filter((m) => m !== name));
  }

  function loadActiveMeds() {
    if (activeMeds.length === 0) {
      toast.show(t("aiDrugCheck.noActive"), "warning");
      return;
    }
    const merged = [...medicines];
    for (const m of activeMeds) {
      if (!merged.some((x) => x.toLowerCase() === m.toLowerCase())) merged.push(m);
    }
    updateList(merged);
    toast.show(t("aiDrugCheck.loadedN", { count: activeMeds.length }), "success");
  }

  async function runCheck() {
    if (medicines.length < 2) {
      toast.show(t("aiDrugCheck.minTwo"), "warning");
      return;
    }
    try {
      const res = await aiDrugCheck.mutateAsync({ medicines });
      setResult(res);
    } catch (err: any) {
      toast.show(err?.message || t("aiDrugCheck.checkError"), "danger");
    }
  }

  const interactions = [...(result?.interactions ?? [])].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
  );
  const severeCount = interactions.filter((i) => i.severity === "severe").length;
  const needed = Math.max(0, 2 - medicines.length);

  const sevColor = (sev: string) =>
    sev === "severe" ? colors.danger : sev === "moderate" ? colors.warning : colors.info;
  const sevSoft = (sev: string) =>
    sev === "severe" ? colors.dangerSoft : sev === "moderate" ? colors.warningSoft : colors.infoSoft;

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiDrugCheck.title")}
        subtitle={t("aiDrugCheck.subtitle")}
        right={<PillCmp icon={Sparkles} label={t("aiDrugCheck.aiPill")} tone="accent" size="sm" />}
      />

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl }}
      >
        {/* ─── Your list ─── */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 4 }}>
            <Text style={[typography.overline, { color: colors.textMuted }]}>
              {t("aiDrugCheck.v2.listTitle", "Medicines to check")}
            </Text>
            {medicines.length > 0 ? (
              <Pressable onPress={() => updateList([])} hitSlop={8}>
                <Text style={[typography.label.sm, { color: colors.primary }]}>
                  {t("common.clear", "Clear")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Card padded={false}>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t("aiDrugCheck.v2.addPlaceholder", "Type a medicine name…")}
                onSubmitEditing={() => addMedicine(draft)}
                blurOnSubmit={false}
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
                leadingIcon={Pill}
                trailingIcon={draft.trim() ? Plus : undefined}
                onTrailingIconPress={() => addMedicine(draft)}
                tone="soft"
              />

              {medicines.length === 0 ? (
                <View
                  style={{
                    alignItems: "center",
                    paddingVertical: spacing.lg,
                    gap: 6,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: colors.borderStrong,
                  }}
                >
                  <ShieldCheck size={22} color={colors.textSubtle} strokeWidth={2} />
                  <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.lg }]}>
                    {t("aiDrugCheck.v2.emptyList", "Add at least 2 medicines to check how they interact")}
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {medicines.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => removeMedicine(m)}
                      accessibilityRole="button"
                      accessibilityLabel={t("aiDrugCheck.v2.remove", { name: m, defaultValue: "Remove {{name}}" })}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        height: 36,
                        paddingLeft: 12,
                        paddingRight: 8,
                        borderRadius: 18,
                        backgroundColor: colors.primarySoft,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Pill size={13} color={colors.primary} strokeWidth={2.4} />
                      <Text style={[typography.label.md, { color: colors.primary }]}>{m}</Text>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: colors.surface,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={11} color={colors.primary} strokeWidth={3} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Load active medicines */}
            <Pressable
              onPress={loadActiveMeds}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  borderCurve: "continuous",
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ListPlus size={17} color={colors.accent} strokeWidth={2.3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.xs, { color: colors.text }]}>
                  {t("aiDrugCheck.v2.loadActiveTitle", "Add my active medicines")}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {activeMeds.length
                    ? t("aiDrugCheck.v2.loadActiveCount", {
                        count: activeMeds.length,
                        defaultValue: "{{count}} on your list",
                      })
                    : t("aiDrugCheck.noActive")}
                </Text>
              </View>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.well,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={15} color={colors.textMuted} strokeWidth={2.5} />
              </View>
            </Pressable>
          </Card>
        </View>

        {/* ─── Suggestions ─── */}
        <View style={{ gap: 10 }}>
          <Text style={[typography.overline, { color: colors.textMuted, marginHorizontal: 4 }]}>
            {t("aiDrugCheck.commonHeader")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SUGGESTIONS.map((m) => {
              const sel = has(m);
              return (
                <Pressable
                  key={m}
                  onPress={() => toggleSuggestion(m)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sel }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    height: 36,
                    paddingHorizontal: 13,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: sel ? colors.primary : colors.hairline,
                    backgroundColor: sel
                      ? colors.primarySoft
                      : scheme === "dark"
                        ? colors.surfaceElevated
                        : colors.surface,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  {sel ? (
                    <Check size={13} color={colors.primary} strokeWidth={3} />
                  ) : (
                    <Plus size={13} color={colors.textSubtle} strokeWidth={2.6} />
                  )}
                  <Text style={[typography.label.md, { color: sel ? colors.primary : colors.text }]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Results ─── */}
        {aiDrugCheck.isPending ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={72} radius={20} />
            <Skeleton height={120} radius={20} />
          </View>
        ) : result ? (
          <View style={{ gap: spacing.md }}>
            {/* Summary banner */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor:
                  interactions.length === 0
                    ? colors.successSoft
                    : severeCount > 0
                      ? colors.dangerSoft
                      : colors.warningSoft,
              }}
            >
              {interactions.length === 0 ? (
                <ShieldCheck size={26} color={colors.success} strokeWidth={2.2} />
              ) : severeCount > 0 ? (
                <AlertOctagon size={26} color={colors.danger} strokeWidth={2.2} />
              ) : (
                <AlertTriangle size={26} color={colors.warning} strokeWidth={2.2} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.title.md, { color: colors.text }]}>
                  {interactions.length === 0
                    ? t("aiDrugCheck.noInteractionsTitle")
                    : t("aiDrugCheck.v2.foundN", {
                        count: interactions.length,
                        defaultValue: "{{count}} interactions found",
                      })}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  {interactions.length === 0
                    ? t("aiDrugCheck.noInteractionsBody")
                    : severeCount > 0
                      ? t("aiDrugCheck.v2.severeN", {
                          count: severeCount,
                          defaultValue: "{{count}} severe — talk to your doctor before taking these together",
                        })
                      : t("aiDrugCheck.v2.reviewBody", "Review the notes below with your pharmacist")}
                </Text>
              </View>
            </View>

            {interactions.map((it, idx) => {
              const Icon = severityIcon(it.severity);
              const fg = sevColor(it.severity);
              return (
                <Card key={idx} padded={false} style={{ overflow: "hidden" }}>
                  <View style={{ flexDirection: "row" }}>
                    <View style={{ width: 4, backgroundColor: fg }} />
                    <View style={{ flex: 1, padding: spacing.lg, gap: spacing.sm }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            backgroundColor: sevSoft(it.severity),
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon size={16} color={fg} strokeWidth={2.4} />
                        </View>
                        <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]} numberOfLines={2}>
                          {it.medicines.join(" + ")}
                        </Text>
                        <PillCmp
                          label={t(`aiDrugCheck.v2.severity.${it.severity}`, { defaultValue: it.severity })}
                          tone={severityTone(it.severity)}
                          size="sm"
                        />
                      </View>
                      <Text style={[typography.body.sm, { color: colors.textMuted }]}>{it.note}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        {it.source === "curated" ? (
                          <ShieldCheck size={12} color={colors.success} strokeWidth={2.4} />
                        ) : (
                          <Sparkles size={12} color={colors.accent} strokeWidth={2.4} />
                        )}
                        <Text style={[typography.caption, { color: colors.textSubtle }]}>
                          {it.source === "curated"
                            ? t("aiDrugCheck.sourceVerified")
                            : t("aiDrugCheck.sourceAI")}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })}

            {result.warnings && result.warnings.length > 0 ? (
              <Card>
                <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                  {result.warnings.map((w, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
                      <AlertTriangle size={16} color={colors.warning} strokeWidth={2.4} style={{ marginTop: 2 }} />
                      <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>{w}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center" }]}>
              {t("aiDrugCheck.v2.disclaimer", "Not a substitute for advice from your doctor or pharmacist.")}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky action */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
        }}
      >
        <Button
          title={
            needed > 0
              ? t("aiDrugCheck.v2.addMore", {
                  count: needed,
                  defaultValue: "Add {{count}} more to check",
                })
              : t("aiDrugCheck.checkAction", { count: medicines.length })
          }
          onPress={runCheck}
          loading={aiDrugCheck.isPending}
          icon={ShieldAlert}
          size="lg"
          disabled={needed > 0}
        />
      </View>
    </Screen>
  );
}
