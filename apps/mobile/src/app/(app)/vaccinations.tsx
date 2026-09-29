// @ts-nocheck

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Syringe,
  Plus,
  CheckCircle2,
  CalendarClock,
  AlertCircle,
  Camera,
  Sparkles,
  ShieldCheck,
  Building2,
  ChevronRight,
  Check,
  Wind,
  Shield,
  Baby,
  Globe,
} from "lucide-react-native";
import {
  useVaccinations,
  useVaccinationsDue,
  useAddVaccination,
  type VaccinationDueItem,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  BottomSheet,
  FormField,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  useToast,
  Pill,
  TextInput,
  Pressable,
  IconTile,
  SectionHeader,
  Skeleton,
} from "@/components/ui";
import type { Tone } from "@/theme/tone";

const ROUTINE_VACCINES: { name: string; schedule: string; icon: any; tone: Tone; match: string[] }[] = [
  { name: "Tetanus / Tdap", schedule: "Booster every 10 years", icon: Shield, tone: "primary", match: ["tetanus", "tdap", "td "] },
  { name: "Influenza (Flu)", schedule: "Annual seasonal shot", icon: Wind, tone: "info", match: ["influenza", "flu"] },
  { name: "Hepatitis B", schedule: "3-dose primary series", icon: Syringe, tone: "accent", match: ["hepatitis b", "hep b"] },
  { name: "COVID-19", schedule: "Updated annual booster", icon: ShieldCheck, tone: "accent2", match: ["covid"] },
  { name: "MMR (Measles, Mumps, Rubella)", schedule: "2 doses, childhood or adult catch-up", icon: Baby, tone: "warning", match: ["mmr", "measles"] },
  { name: "HPV", schedule: "2–3 dose series", icon: Globe, tone: "success", match: ["hpv"] },
];

function formatDate(iso: string | null | undefined, locale: any): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return fmtDateLong(d, locale);
}

export default function VaccinationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, scheme, shadow } = useTheme();
  const isDark = scheme === "dark";
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useVaccinations();
  const { data: dueData, isLoading: dueLoading } = useVaccinationsDue();
  const addVaccination = useAddVaccination();

  const administered: any[] = data?.administered ?? [];
  const catalog: any[] = data?.catalog ?? [];
  const overdue: VaccinationDueItem[] = dueData?.overdue ?? [];
  const due: VaccinationDueItem[] = dueData?.due ?? [];
  const upcoming: VaccinationDueItem[] = dueData?.upcoming ?? [];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [vaccineName, setVaccineName] = useState("");
  const [dose, setDose] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  function openSheet(prefillName = "") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setVaccineName(prefillName);
    setDose("1");
    setDate(new Date().toISOString().slice(0, 10));
    setProvider("");
    setNotes("");
    setSelectedCatalogId(null);
    setSheetOpen(true);
  }

  function openScan() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push("/(app)/ai/vaccination-card");
  }

  const loggedNames = useMemo(
    () => administered.map((a) => String(a.vaccineName || "").toLowerCase()),
    [administered]
  );
  const isLogged = (match: string[]) =>
    loggedNames.some((n) => match.some((m) => n.includes(m)));

  function pickFromCatalog(v: any) {
    Haptics.selectionAsync().catch(() => {});
    setSelectedCatalogId(v.id);
    setVaccineName(v.name);
  }

  async function save() {
    const name = vaccineName.trim();
    if (name.length < 2) {
      toast.show(t("vaccinations.error.nameRequired", "Please enter vaccine name"), "warning");
      return;
    }
    try {
      await addVaccination.mutateAsync({
        vaccineName: name,
        vaccineId: selectedCatalogId || undefined,
        dose: parseInt(dose, 10) || 1,
        recordDate: date,
        provider: provider.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.show(t("vaccinations.toast.logged", "Vaccination recorded"), "success");
      setSheetOpen(false);
    } catch (e: any) {
      toast.show(e?.message || t("vaccinations.toast.saveError", "Could not save record"), "danger");
    }
  }

  const subtitle =
    administered.length === 0
      ? t("vaccinations.subtitleEmpty", "Digital immunization card")
      : t("vaccinations.subtitleCount", {
          count: administered.length,
          defaultValue: `${administered.length} on record · Up to date`,
        });

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("vaccinations.title", "Vaccinations")}
        subtitle={subtitle}
        onBack={() => router.back()}
        right={
          <IconButton
            icon={Plus}
            onPress={() => openSheet()}
            accessibilityLabel={t("vaccinations.logLabel", "Log vaccination")}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 110 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading || dueLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={200} radius={radius.card} />
            <Skeleton height={76} radius={radius.card} />
            <Skeleton height={160} radius={radius.card} />
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load vaccinations")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry", "Retry")}
            onAction={() => refetch()}
          />
        ) : (
          <>
            {/* ── Immunization status hero ── */}
            <LinearGradient
              colors={
                overdue.length > 0
                  ? [colors.danger, colors.accent2]
                  : due.length > 0
                  ? [colors.warning, colors.accent2]
                  : [colors.primaryGradientStart, colors.primaryGradientEnd]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: radius.card,
                borderCurve: "continuous",
                padding: spacing.xl,
                gap: spacing.lg,
                overflow: "hidden",
                ...(isDark ? {} : shadow.hero),
              }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.7, y: 0.8 }}
                style={StyleSheet.absoluteFill}
              />
              <Syringe
                size={140}
                color="#FFFFFF"
                strokeWidth={1}
                style={{ position: "absolute", right: -28, top: -20, opacity: 0.1 }}
                pointerEvents="none"
              />
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile
                  icon={overdue.length > 0 ? AlertCircle : due.length > 0 ? CalendarClock : ShieldCheck}
                  appearance="glass"
                  size={48}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.kicker, { color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }]}>
                    {t("vaccinations.hero.kicker", "Immunization card")}
                  </Text>
                  <Text style={[typography.title.lg, { color: "#FFFFFF", marginTop: 2 }]} numberOfLines={2}>
                    {overdue.length > 0
                      ? t("vaccinations.banners.overdue", {
                          count: overdue.length,
                          defaultValue: `${overdue.length} overdue vaccine${overdue.length > 1 ? "s" : ""}`,
                        })
                      : due.length > 0
                      ? t("vaccinations.banners.dueCount", {
                          count: due.length,
                          defaultValue: `${due.length} vaccine${due.length > 1 ? "s" : ""} due soon`,
                        })
                      : t("vaccinations.hero.upToDate", "You're up to date")}
                  </Text>
                  <Text style={[typography.body.sm, { color: "rgba(255,255,255,0.86)", marginTop: 2 }]} numberOfLines={2}>
                    {overdue.length + due.length > 0
                      ? [...overdue, ...due].slice(0, 3).map((d) => d.vaccine).join(", ")
                      : t("vaccinations.hero.upToDateBody", "Nothing due in the next 30 days")}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.24)",
                  paddingVertical: spacing.md,
                }}
              >
                <HeroStat value={administered.length} label={t("vaccinations.hero.onRecord", "On record")} />
                <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.3)" }} />
                <HeroStat value={due.length + upcoming.length} label={t("vaccinations.hero.upcoming", "Coming up")} />
                <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.3)" }} />
                <HeroStat value={overdue.length} label={t("vaccinations.hero.overdue", "Overdue")} />
              </View>
            </LinearGradient>

            {/* ── AI scan shortcut ── */}
            <Card
              padded={false}
              onPress={openScan}
              accessibilityLabel={t("vaccinations.scanCard", "Scan card with AI")}
              style={{ marginTop: spacing.md }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
                <IconTile icon={Camera} tone="primary" appearance="solid" size={44} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                      {t("vaccinations.scan.title", "Scan your paper card")}
                    </Text>
                    <Pill label="AI" tone="primary" size="sm" icon={Sparkles} />
                  </View>
                  <Text style={[typography.body.sm, { color: colors.textMuted }]} numberOfLines={2}>
                    {t("vaccinations.scan.body", "Auto-fill dose dates and batch numbers from a photo")}
                  </Text>
                </View>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: colors.well,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.4} />
                </View>
              </View>
            </Card>

            {/* ── Due / overdue ── */}
            {overdue.length + due.length + upcoming.length > 0 ? (
              <>
                <SectionHeader
                  kicker={t("vaccinations.sectionsV2.dueKicker", "Schedule")}
                  title={t("vaccinations.sectionsV2.due", "Coming up")}
                  count={overdue.length + due.length + upcoming.length}
                />
                <Card padded={false}>
                  {[...overdue, ...due, ...upcoming].map((d, i, arr) => {
                    const tone = d.daysUntil < 0 ? "danger" : d.daysUntil <= 30 ? "warning" : "primary";
                    return (
                      <Row key={`${d.vaccineId}-${d.dose}`} last={i === arr.length - 1} onPress={() => openSheet(d.vaccine)}>
                        <IconTile icon={d.daysUntil < 0 ? AlertCircle : CalendarClock} tone={tone} size={38} />
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
                            {d.vaccine}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                            {d.doseLabel} · {formatDate(d.dueDate, locale)}
                          </Text>
                        </View>
                        <Pill
                          label={
                            d.daysUntil < 0
                              ? t("vaccinations.daysOverdue", { count: -d.daysUntil, defaultValue: `${-d.daysUntil}d overdue` })
                              : t("vaccinations.daysUntil", { count: d.daysUntil, defaultValue: `in ${d.daysUntil}d` })
                          }
                          tone={tone}
                          size="sm"
                        />
                      </Row>
                    );
                  })}
                </Card>
              </>
            ) : null}

            {/* ── Administered doses ── */}
            <SectionHeader
              kicker={t("vaccinations.sectionsV2.recordKicker", "Your record")}
              title={t("vaccinations.sectionsV2.administeredTitle", "Administered")}
              count={administered.length}
            />
            {administered.length === 0 ? (
              <EmptyState
                icon={Syringe}
                title={t("vaccinations.empty.title", "No vaccinations recorded")}
                message={t("vaccinations.empty.message", "Keep a verified digital record of all childhood, travel, and routine vaccinations.")}
                actionLabel={t("vaccinations.logFirstAction", "Log first vaccination")}
                onAction={() => openSheet()}
              />
            ) : (
              <Card padded={false}>
                {administered.map((a, i) => (
                  <Row key={a.id} last={i === administered.length - 1}>
                    <IconTile icon={Syringe} tone="success" size={38} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
                        {a.vaccineName}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                        {[formatDate(a.administeredAt || a.recordDate || a.createdAt, locale), a.provider]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                      {a.notes ? (
                        <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                          {a.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Pill
                      label={t("vaccinations.doseN", { n: a.dose || 1, defaultValue: `Dose ${a.dose || 1}` })}
                      tone="success"
                      size="sm"
                    />
                  </Row>
                ))}
              </Card>
            )}

            {/* ── Routine schedule reference ── */}
            <SectionHeader
              kicker={t("vaccinations.sectionsV2.routineKicker", "Adult & travel")}
              title={t("vaccinations.sectionsV2.routineTitle", "Recommended vaccines")}
            />
            <Card padded={false}>
              {ROUTINE_VACCINES.map((v, i) => {
                const logged = isLogged(v.match);
                return (
                  <Row
                    key={v.name}
                    last={i === ROUTINE_VACCINES.length - 1}
                    onPress={() => openSheet(v.name)}
                    accessibilityLabel={t("vaccinations.logNamed", { name: v.name, defaultValue: `Log ${v.name}` })}
                  >
                    <IconTile icon={v.icon} tone={logged ? "success" : v.tone} size={38} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                        {v.schedule}
                      </Text>
                    </View>
                    {logged ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={15} color={colors.success} strokeWidth={2.4} />
                        <Text style={[typography.label.sm, { color: colors.success }]}>
                          {t("vaccinations.logged", "Logged")}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: colors.primarySoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Plus size={16} color={colors.primary} strokeWidth={2.6} />
                      </View>
                    )}
                  </Row>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Sticky Bottom Log Button */}
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
          title={t("vaccinations.logButton", "Log vaccination")}
          icon={Plus}
          onPress={() => openSheet()}
          size="lg"
          fullWidth
        />
      </View>

      {/* ── Log Vaccination Bottom Sheet ── */}
      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        title={t("vaccinations.logLabel", "Record Vaccination")}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
          {/* Quick Catalog Shortcuts */}
          <FormField label={t("vaccinations.field.catalogLabel", "Common Vaccines")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {catalog.slice(0, 12).map((c: any) => (
                <Chip
                  key={c.id}
                  label={c.shortName || c.name}
                  selected={selectedCatalogId === c.id}
                  tone={selectedCatalogId === c.id ? "primary" : "neutral"}
                  onPress={() =>
                    selectedCatalogId === c.id
                      ? setSelectedCatalogId(null)
                      : pickFromCatalog(c)
                  }
                  size="sm"
                />
              ))}
            </View>
          </FormField>

          {/* Vaccine Name */}
          <FormField label={t("vaccinations.field.nameLabel", "Vaccine Name")} required>
            <TextInput
              value={vaccineName}
              onChangeText={(v) => {
                setVaccineName(v);
                if (selectedCatalogId) setSelectedCatalogId(null);
              }}
              placeholder={t("vaccinations.field.namePlaceholder", "E.g. COVID-19, Tdap, MMR")}
            />
          </FormField>

          {/* Dose and Date Row */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <FormField label={t("vaccinations.field.doseLabel", "Dose #")}>
                <TextInput
                  value={dose}
                  onChangeText={setDose}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </FormField>
            </View>
            <View style={{ flex: 2 }}>
              <FormField label={t("vaccinations.field.dateLabel", "Administered Date")}>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
            </View>
          </View>

          {/* Provider / Clinic */}
          <FormField label={t("vaccinations.field.providerLabel", "Healthcare Provider / Hospital")}>
            <TextInput
              value={provider}
              onChangeText={setProvider}
              placeholder={t("vaccinations.field.providerPlaceholder", "E.g. General Hospital Colombo, MOH Clinic")}
              leadingIcon={Building2}
            />
          </FormField>

          {/* Notes */}
          <FormField label={t("vaccinations.field.notesLabel", "Batch / Lot Number or Notes")}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("vaccinations.field.notesPlaceholder", "E.g. Batch #AB1234, left deltoid")}
              multiline
              numberOfLines={2}
            />
          </FormField>

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
            <Button
              title={t("common.cancel", "Cancel")}
              variant="outline"
              onPress={() => setSheetOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              title={t("common.save", "Save Record")}
              icon={Plus}
              onPress={save}
              loading={addVaccination.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  const { typography } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
      <Text style={[typography.title.lg, { color: "#FFFFFF" }]}>{value}</Text>
      <Text style={[typography.caption, { color: "rgba(255,255,255,0.82)" }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Inset-divided list row used by every grouped card on this screen. */
function Row({
  children,
  last,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  last: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { spacing, colors } = useTheme();
  const inner = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 64,
        paddingVertical: spacing.md,
        paddingRight: spacing.lg,
        marginLeft: spacing.lg,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
      }}
    >
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} haptic="light" pressedScale={0.99} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {inner}
    </Pressable>
  );
}
