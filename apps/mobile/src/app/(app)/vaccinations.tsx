// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Syringe,
  Plus,
  CheckCircle2,
  CalendarClock,
  AlertCircle,
  Clock,
  X,
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
  ChipGroup,
  BottomSheet,
  FormField,
  Button,
  EmptyState,
  IconButton,
  useToast,
} from "@/components/ui";

export default function VaccinationsScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useVaccinations();
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
      toast.show({ message: "Vaccine name required", tone: "warning" });
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
      toast.show({ message: "Vaccination logged", tone: "success" });
      setSheetOpen(false);
    } catch (e: any) {
      toast.show({ message: e?.message || "Save failed", tone: "danger" });
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title="Vaccinations"
        subtitle={
          administered.length === 0
            ? "Track your immunization history"
            : `${administered.length} on record`
        }
        onBack={() => router.back()}
        right={
          <IconButton
            icon={Plus}
            onPress={openSheet}
            accessibilityLabel="Log vaccination"
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
        ) : (
          <>
            {overdue.length > 0 && (
              <BannerCard
                tone="danger"
                icon={AlertCircle}
                title={`${overdue.length} overdue`}
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
                title={`${due.length} due in 30 days`}
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
                title="Up to date"
                body="No vaccines due in the next 30 days."
              />
            )}
          </>
        )}

        {/* Administered list */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>
            ADMINISTERED
          </Text>
          {administered.length === 0 ? (
            <EmptyState
              icon={Syringe}
              title="No vaccinations logged"
              message="Add immunizations as you receive them to keep your record complete."
              actionLabel="Log first vaccination"
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
              UPCOMING
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
                      In {u.daysUntil} days • {String(u.dueDate).slice(0, 10)}
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
        <Button title="Log vaccination" icon={Plus} onPress={openSheet} size="lg" />
      </View>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        title="Log vaccination"
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <FormField label="From WHO catalog (optional)">
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

          <FormField label="Vaccine name" required>
            <TextInput
              value={vaccineName}
              onChangeText={(t) => {
                setVaccineName(t);
                if (selectedCatalogId) setSelectedCatalogId(null);
              }}
              placeholder="e.g. Influenza"
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
              <FormField label="Dose">
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
              <FormField label="Date">
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
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

          <FormField label="Provider">
            <TextInput
              value={provider}
              onChangeText={setProvider}
              placeholder="Hospital, clinic, or doctor"
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

          <FormField label="Notes">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Lot number, reactions, etc."
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
              title="Cancel"
              variant="outline"
              onPress={() => setSheetOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              title="Save"
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
