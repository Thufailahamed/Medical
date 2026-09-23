// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
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
  const { spacing, colors, typography, radius, scheme } = useTheme();
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
            colors={
              isDark
                ? [colors.surfaceElevated, colors.surface]
                : [colors.primarySoft, colors.surface]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 20,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Camera size={24} color={colors.onPrimary} />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
                  Scan Paper Card with AI
                </Text>
                <View
                  style={{
                    backgroundColor: colors.primarySoft,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: colors.primary + "30",
                  }}
                >
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: "700", fontSize: 10 }]}>
                    AI CAMERA
                  </Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, lineHeight: 16 }]}>
                Snap a photo of your immunization booklet to auto-extract dose dates & batch numbers.
              </Text>
            </View>

            <ArrowRight size={18} color={colors.primary} />
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
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xs }}>
            <Text style={[typography.overline, { color: colors.textMuted, fontWeight: "700" }]}>
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
                  padding: spacing.md,
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
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
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.successSoft,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.success + "30",
                    }}
                  >
                    <Syringe size={22} color={colors.success} strokeWidth={2.2} />
                  </View>

                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text
                        style={[
                          typography.title.sm,
                          { color: colors.text, fontWeight: "700" },
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
                        <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "500" }]}>
                          {formatDate(a.administeredAt || a.recordDate || a.createdAt, locale)}
                        </Text>
                      </View>

                      {a.provider ? (
                        <>
                          <Text style={[typography.caption, { color: colors.border }]}>•</Text>
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
        <View style={{ gap: spacing.sm }}>
          <View style={{ paddingHorizontal: spacing.xs }}>
            <Text style={[typography.overline, { color: colors.textMuted, fontWeight: "700" }]}>
              RECOMMENDED IMMUNIZATION SCHEDULE
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Standard adult & travel immunization reference schedule
            </Text>
          </View>

          <Card style={{ padding: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, gap: 2 }}>
            {ROUTINE_VACCINES.map((v, i) => (
              <Pressable
                key={v.name}
                onPress={() => openSheet(v.name)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.sm,
                  borderRadius: 12,
                  borderBottomWidth: i < ROUTINE_VACCINES.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border + "40",
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.label.md, { color: colors.text, fontWeight: "600" }]}>
                    {v.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]}>
                    {v.schedule} · {v.category}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: "600", fontSize: 11 }]}>
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
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
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
        borderRadius: 18,
        padding: spacing.md,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: tint + "30",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
          {title}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, lineHeight: 16 }]}>
          {body}
        </Text>
      </View>
    </View>
  );
}