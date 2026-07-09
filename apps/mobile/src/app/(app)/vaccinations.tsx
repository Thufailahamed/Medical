// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Syringe,
  Plus,
  CheckCircle2,
  CalendarClock,
  AlertCircle,
  Clock,
} from "lucide-react-native";
import {
  useVaccinations,
  useVaccinationsDue,
  useAddVaccination,
  type VaccinationDueItem,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
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
} from "@/components/ui";

export default function VaccinationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
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

  function openSheet() {
    setVaccineName("");
    setDose("1");
    setDate(new Date().toISOString().slice(0, 10));
    setProvider("");
    setNotes("");
    setSelectedCatalogId(null);
    setSheetOpen(true);
  }

  function pickFromCatalog(v: any) {
    setSelectedCatalogId(v.id);
    setVaccineName(v.name);
  }

  async function save() {
    const name = vaccineName.trim();
    if (name.length < 2) {
      toast.show({ message: t("vaccinations.error.nameRequired"), tone: "warning" });
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
      toast.show({ message: t("vaccinations.toast.logged"), tone: "success" });
      setSheetOpen(false);
    } catch (e: any) {
      toast.show({
        message: e?.message || t("vaccinations.toast.saveError"),
        tone: "danger",
      });
    }
  }

  const subtitle =
    administered.length === 0
      ? t("vaccinations.subtitleEmpty")
      : t("vaccinations.subtitleCount", { count: administered.length });

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("vaccinations.title")}
        subtitle={subtitle}
        onBack={() => router.back()}
        right={
          <IconButton
            icon={Plus}
            onPress={openSheet}
            accessibilityLabel={t("vaccinations.logLabel")}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banners */}
        {isLoading || dueLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load vaccinations")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : (
          <>
            {overdue.length > 0 && (
              <BannerCard
                tone="danger"
                icon={AlertCircle}
                title={t("vaccinations.banners.overdue", { count: overdue.length })}
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
                title={t("vaccinations.banners.dueCount", { count: due.length })}
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
                title={t("vaccinations.banners.upToDate")}
                body={t("vaccinations.banners.upToDateBody")}
              />
            )}
          </>
        )}

        {/* Administered list */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>
            {t("vaccinations.sections.administered")}
          </Text>
          {administered.length === 0 ? (
            <EmptyState
              icon={Syringe}
              title={t("vaccinations.empty.title")}
              message={t("vaccinations.empty.message")}
              actionLabel={t("vaccinations.logFirstAction")}
              onAction={openSheet}
            />
          ) : (
            administered.map((a) => (
              <Card key={a.id}>
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
                      borderRadius: 20,
                      backgroundColor: colors.successSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Syringe size={20} color={colors.success} strokeWidth={2.25} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {a.title}
                    </Text>
                    {!!a.description && (
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted, marginTop: 2 },
                        ]}
                        numberOfLines={2}
                      >
                        {a.description}
                      </Text>
                    )}
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textSubtle, marginTop: 2 },
                      ]}
                    >
                      {a.recordDate || a.createdAt}
                      {a.provider ? ` • ${a.provider}` : ""}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Upcoming list (collapsed) */}
        {upcoming.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.overline, { color: colors.textMuted }]}>
              {t("vaccinations.sections.upcoming")}
            </Text>
            {upcoming.slice(0, 10).map((u, i) => (
              <Card key={`up-${i}`}>
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
                      borderRadius: 20,
                      backgroundColor: colors.infoSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Clock size={18} color={colors.info} strokeWidth={2.25} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                    >
                      {u.vaccine}{" "}
                      <Text
                        style={[typography.body.sm, { color: colors.textMuted }]}
                      >
                        ({u.doseLabel})
                      </Text>
                    </Text>
                    <Text
                      style={[typography.caption, { color: colors.textMuted }]}
                    >
                      {t("vaccinations.upcomingRow", {
                        days: u.daysUntil,
                        date: String(u.dueDate).slice(0, 10),
                      })}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.lg,
        }}
      >
        <Button title={t("vaccinations.logButton")} icon={Plus} onPress={openSheet} size="lg" />
      </View>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        title={t("vaccinations.logLabel")}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <FormField label={t("vaccinations.field.catalogLabel")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {catalog.slice(0, 20).map((c: any) => (
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

          <FormField label={t("vaccinations.field.nameLabel")} required>
            <TextInput
              value={vaccineName}
              onChangeText={(v) => {
                setVaccineName(v);
                if (selectedCatalogId) setSelectedCatalogId(null);
              }}
              placeholder={t("vaccinations.field.namePlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </FormField>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <FormField label={t("vaccinations.field.doseLabel")}>
                <TextInput
                  value={dose}
                  onChangeText={setDose}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    color: colors.text,
                    fontSize: 16,
                  }}
                />
              </FormField>
            </View>
            <View style={{ flex: 2 }}>
              <FormField label={t("vaccinations.field.dateLabel")}>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder={t("vaccinations.field.datePlaceholder")}
                  placeholderTextColor={colors.textSubtle}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    color: colors.text,
                    fontSize: 16,
                  }}
                />
              </FormField>
            </View>
          </View>

          <FormField label={t("vaccinations.field.providerLabel")}>
            <TextInput
              value={provider}
              onChangeText={setProvider}
              placeholder={t("vaccinations.field.providerPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </FormField>

          <FormField label={t("vaccinations.field.notesLabel")}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("vaccinations.field.notesPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              multiline
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                minHeight: 56,
                color: colors.text,
                fontSize: 16,
                textAlignVertical: "top",
              }}
            />
          </FormField>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              title={t("common.cancel")}
              variant="outline"
              onPress={() => setSheetOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              title={t("common.save")}
              icon={CheckCircle2}
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
  const { spacing, colors, typography, radius } = useTheme();
  const palette = {
    danger: { bg: colors.dangerSoft, fg: colors.danger, textOnBg: colors.danger },
    warning: { bg: colors.warningSoft, fg: colors.warning, textOnBg: colors.warning },
    success: { bg: colors.successSoft, fg: colors.success, textOnBg: colors.success },
  }[tone];

  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: palette.bg,
        flexDirection: "row",
        gap: spacing.sm,
        alignItems: "flex-start",
      }}
      accessible
      accessibilityRole="summary"
    >
      <Icon size={20} color={palette.fg} strokeWidth={2.25} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "800" },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted, marginTop: 2 },
          ]}
          numberOfLines={3}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}