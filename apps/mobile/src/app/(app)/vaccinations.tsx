// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Syringe,
  Plus,
  CheckCircle2,
  CalendarClock,
  AlertCircle,
  Clock,
  Camera,
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  ArrowRight,
  ChevronRight,
  Check,
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
} from "@/components/ui";

const ROUTINE_VACCINES = [
  { name: "Tetanus / Tdap", schedule: "Booster every 10 years", category: "Adult Routine" },
  { name: "Influenza (Flu)", schedule: "Annual seasonal shot", category: "Annual" },
  { name: "Hepatitis B", schedule: "3-dose primary series", category: "Protection" },
  { name: "COVID-19", schedule: "Updated annual booster", category: "Respiratory" },
  { name: "MMR (Measles, Mumps, Rubella)", schedule: "2 doses in childhood/adulthood", category: "Core" },
  { name: "HPV", schedule: "2-3 dose series", category: "Preventative" },
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
          <View style={{ flexDirection: "row", gap: 6 }}>
            <IconButton
              icon={Camera}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push("/(app)/ai/vaccination-card");
              }}
              accessibilityLabel={t("vaccinations.scanCard", "Scan card with AI")}
            />
            <IconButton
              icon={Plus}
              onPress={() => openSheet()}
              accessibilityLabel={t("vaccinations.logLabel", "Log vaccination")}
            />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── AI Vaccination Card Scan Banner ── */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push("/(app)/ai/vaccination-card");
          }}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 28,
              borderCurve: "continuous",
              padding: spacing.xl,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.lg,
              ...(isDark ? {} : shadow.hero),
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={24} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "rgba(255,255,255,0.18)",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.28)",
                }}
              >
                <Text style={[typography.label.xs, { color: "#FFFFFF", fontSize: 10 }]}>
                  AI CAMERA
                </Text>
              </View>
              <Text style={[typography.title.md, { color: "#FFFFFF" }]}>
                Scan Paper Card with AI
              </Text>
              <Text style={[typography.body.sm, { color: "rgba(255,255,255,0.86)" }]}>
                Snap a photo of your immunization booklet to auto-extract dose dates & batch numbers.
              </Text>
            </View>

            <ArrowRight size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>

        {/* Status banners */}
        {isLoading || dueLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load vaccinations")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry", "Retry")}
            onAction={() => refetch()}
          />
        ) : (
          <>
            {overdue.length > 0 && (
              <BannerCard
                tone="danger"
                icon={AlertCircle}
                title={t("vaccinations.banners.overdue", {
                  count: overdue.length,
                  defaultValue: `${overdue.length} Overdue Vaccine${overdue.length > 1 ? "s" : ""}`,
                })}
                body={overdue
                  .slice(0, 3)
                  .map((o) => `${o.vaccine} (${o.doseLabel})`)
                  .join(", ")}
              />
            )}
            {due.length > 0 && (
              <BannerCard
                tone="warning"
                icon={CalendarClock}
                title={t("vaccinations.banners.dueCount", {
                  count: due.length,
                  defaultValue: `${due.length} Vaccine${due.length > 1 ? "s" : ""} Due Soon`,
                })}
                body={due
                  .slice(0, 3)
                  .map((d) => `${d.vaccine} (${d.doseLabel})`)
                  .join(", ")}
              />
            )}
            {overdue.length === 0 && due.length === 0 && (
              <BannerCard
                tone="success"
                icon={CheckCircle2}
                title={t("vaccinations.banners.upToDate", "Immunizations Up to Date")}
                body={t("vaccinations.banners.upToDateBody", "No routine vaccinations or boosters are due in the next 30 days.")}
              />
            )}
          </>
        )}

        {/* Administered list */}
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 }}>
            <Text style={[typography.overline, { color: colors.textSubtle }]}>
              {t("vaccinations.sections.administered", "ADMINISTERED DOSES")} · {administered.length}
            </Text>
          </View>

          {administered.length === 0 ? (
            <EmptyState
              icon={Syringe}
              title={t("vaccinations.empty.title", "No vaccinations recorded")}
              message={t("vaccinations.empty.message", "Keep a verified digital record of all childhood, travel, and routine vaccinations.")}
              actionLabel={t("vaccinations.logFirstAction", "Log first vaccination")}
              onAction={() => openSheet()}
            />
          ) : (
            administered.map((a) => (
              <Card
                key={a.id}
                style={{
                  padding: spacing.lg,
                }}
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
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      backgroundColor: colors.successSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Syringe size={20} color={colors.success} strokeWidth={2.2} />
                  </View>

                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
                      <Text
                        style={[
                          typography.title.md,
                          { color: colors.text, flexShrink: 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {a.vaccineName}
                      </Text>
                      <Pill
                        label={a.dose ? `Dose ${a.dose}` : "Dose 1"}
                        tone="primary"
                        size="sm"
                      />
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Calendar size={12} color={colors.textSubtle} />
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {formatDate(a.administeredAt || a.recordDate || a.createdAt, locale)}
                        </Text>
                      </View>

                      {a.provider ? (
                        <>
                          <Text style={[typography.caption, { color: colors.textSubtle }]}>•</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flex: 1 }}>
                            <Building2 size={12} color={colors.textSubtle} />
                            <Text
                              style={[typography.caption, { color: colors.textMuted }]}
                              numberOfLines={1}
                            >
                              {a.provider}
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </View>

                    {a.notes ? (
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSubtle, marginTop: 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {a.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* ── Routine Vaccine Schedule Reference ── */}
        <View style={{ gap: spacing.md }}>
          <View style={{ paddingHorizontal: 2, gap: 2 }}>
            <Text style={[typography.overline, { color: colors.textSubtle }]}>
              RECOMMENDED IMMUNIZATION SCHEDULE
            </Text>
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              Standard adult & travel immunization reference schedule
            </Text>
          </View>

          <Card padded={false}>
            {ROUTINE_VACCINES.map((v, i) => (
              <Pressable
                key={v.name}
                onPress={() => openSheet(v.name)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  minHeight: 60,
                  paddingVertical: spacing.md,
                  marginLeft: spacing.lg,
                  paddingRight: spacing.lg,
                  borderBottomWidth: i < ROUTINE_VACCINES.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: colors.separator,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {v.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSubtle }]}>
                    {v.schedule} · {v.category}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 12,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Text style={[typography.label.sm, { color: colors.primary }]}>
                    Log
                  </Text>
                  <Plus size={14} color={colors.primary} />
                </View>
              </Pressable>
            ))}
          </Card>
        </View>
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
          paddingBottom: spacing.xl,
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

function BannerCard({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "danger" | "warning" | "success";
  icon: any;
  title: string;
  body: string;
}) {
  const { spacing, colors, typography } = useTheme();
  const tint =
    tone === "danger"
      ? colors.danger
      : tone === "warning"
      ? colors.warning
      : colors.success;
  const bg =
    tone === "danger"
      ? colors.dangerSoft
      : tone === "warning"
      ? colors.warningSoft
      : colors.successSoft;

  return (
    <View
      style={{
        borderRadius: 22,
        borderCurve: "continuous",
        padding: spacing.lg,
        backgroundColor: bg,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          borderCurve: "continuous",
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.title.sm, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>
          {body}
        </Text>
      </View>
    </View>
  );
}