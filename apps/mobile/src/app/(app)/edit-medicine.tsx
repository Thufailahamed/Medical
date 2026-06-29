// @ts-nocheck

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pill,
  Save,
  Power,
  History,
  Sparkles,
  CornerDownLeft,
} from "lucide-react-native";
import {
  useMedicine,
  useEditMedicine,
  useStopMedicine,
  useMedicineSuggestions,
  type MedicineSuggestion,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, ScreenHeader, Button, Card } from "@/components/ui";

const FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "As needed",
];

const TIMINGS = [
  "Before food",
  "After food",
  "With food",
  "Any time",
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
];

export default function EditMedicineScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = (params.id as string) || "";
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();

  const { data, isLoading, error } = useMedicine(id);
  const edit = useEditMedicine();
  const stop = useStopMedicine();

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState<string>("Once daily");
  const [timing, setTiming] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [active, setActive] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  const med = data?.medicine;

  useEffect(() => {
    if (med && !hydrated) {
      setName(med.name ?? "");
      setDosage(med.dosage ?? "");
      setFrequency(med.frequency ?? "Once daily");
      setTiming(med.timing ?? undefined);
      setStartDate(med.startDate ?? "");
      setEndDate(med.endDate ?? "");
      setNotes(med.notes ?? "");
      setActive(med.active !== false);
      setHydrated(true);
    }
  }, [med, hydrated]);

  const dirty = useMemo(() => {
    if (!med) return false;
    return (
      name !== (med.name ?? "") ||
      dosage !== (med.dosage ?? "") ||
      frequency !== (med.frequency ?? "Once daily") ||
      (timing ?? null) !== (med.timing ?? null) ||
      startDate !== (med.startDate ?? "") ||
      (endDate || null) !== (med.endDate ?? null) ||
      notes !== (med.notes ?? "") ||
      active !== (med.active !== false)
    );
  }, [med, name, dosage, frequency, timing, startDate, endDate, notes, active]);

  // Autocomplete — only when name changed from the original value.
  const { data: suggestData, isFetching } = useMedicineSuggestions(name, 6);
  const suggestions: MedicineSuggestion[] = suggestData?.suggestions || [];
  const showDropdown =
    nameFocused &&
    name.trim().length > 0 &&
    name.trim().toLowerCase() !== (med?.name ?? "").trim().toLowerCase() &&
    suggestions.length > 0;

  function applyNameOnly(s: MedicineSuggestion) {
    setName(s.name);
    setNameFocused(false);
  }

  async function onSave() {
    if (!med) return;
    try {
      await edit.mutateAsync({
        id: med.id,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        timing: timing as any,
        startDate,
        endDate: endDate || undefined,
        notes: notes.trim() || undefined,
        active,
      } as any);
      setSavedOnce(true);
      setHydrated(false);
      setTimeout(() => router.back(), 400);
    } catch (err: any) {
      // Mutation error surfaces in toast via hook; nothing to do here.
    }
  }

  async function onStop() {
    if (!med) return;
    try {
      await stop.mutateAsync(med.id);
      setHydrated(false);
      setTimeout(() => router.back(), 400);
    } catch {}
  }

  if (isLoading || (!med && !error)) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ScreenHeader title="Edit medicine" onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !med) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ScreenHeader title="Edit medicine" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg }}>
          <Card>
            <Text style={[typography.title.sm, { color: colors.text }]}>
              Could not load medicine
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: 4 },
              ]}
            >
              It may have been deleted, or you may not have access.
            </Text>
            <Button
              title="Back"
              variant="outline"
              onPress={() => router.back()}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title="Edit medicine"
        subtitle={med.name}
        onBack={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.lg }}
      >
        {/* Active toggle */}
        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text, fontWeight: "700" },
                ]}
              >
                {active ? "Active" : "Paused"}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                {active
                  ? "Reminders will continue."
                  : "Reminders are off until you reactivate."}
              </Text>
            </View>
            <Pressable
              onPress={() => setActive((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: active }}
              accessibilityLabel="Active toggle"
              hitSlop={8}
              style={({ pressed }) => ({
                width: 52,
                height: 30,
                borderRadius: 16,
                backgroundColor: active ? colors.primary : colors.surfaceMuted,
                padding: 3,
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#fff",
                  transform: [{ translateX: active ? 22 : 0 }],
                }}
              />
            </Pressable>
          </View>
        </Card>

        {/* Name */}
        <Card>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "700" },
            ]}
          >
            Medicine name
          </Text>
          <View style={{ position: "relative" }}>
            <TextInput
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => {
                // Delay so taps on suggestion rows register before dismiss.
                setTimeout(() => setNameFocused(false), 120);
              }}
              placeholder="e.g. Metformin"
              placeholderTextColor={colors.textMuted}
              style={{
                color: colors.text,
                fontSize: 16,
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            />
            {isFetching && name.trim().length > 0 ? (
              <View
                style={{
                  position: "absolute",
                  right: spacing.sm,
                  top: 0,
                  bottom: 0,
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
          </View>
          {showDropdown ? (
            <View
              style={{
                marginTop: 8,
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
                maxHeight: 240,
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {suggestions.map((s) => {
                  const isHistory = s.source === "history";
                  const topDosage = s.commonDosages[0];
                  const topFreq = s.commonFrequencies[0];
                  const topTiming = s.commonTimings[0];
                  return (
                    <Pressable
                      key={`${s.source}-${s.name}`}
                      onPress={() => applyNameOnly(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${s.name}`}
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        backgroundColor: pressed
                          ? colors.surfaceMuted
                          : colors.surface,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                      })}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          backgroundColor: isHistory
                            ? colors.primarySoft
                            : "rgba(14, 165, 183, 0.12)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isHistory ? (
                          <History size={14} color={colors.primary} strokeWidth={2.25} />
                        ) : (
                          <Sparkles size={14} color="#0EA5B7" strokeWidth={2.25} />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            typography.title.sm,
                            { color: colors.text, fontWeight: "700" },
                          ]}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textMuted, marginTop: 1 },
                          ]}
                          numberOfLines={1}
                        >
                          {s.category ? `${s.category} · ` : ""}
                          {topDosage
                            ? `${topDosage}${
                                topFreq ? ` · ${topFreq}` : ""
                              }${topTiming ? ` · ${topTiming}` : ""}`
                            : "Tap to use name"}
                        </Text>
                      </View>
                      <CornerDownLeft
                        size={14}
                        color={colors.textSubtle}
                        strokeWidth={2.25}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </Card>

        {/* Dosage */}
        <Card>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "700" },
            ]}
          >
            Dosage
          </Text>
          <TextInput
            value={dosage}
            onChangeText={setDosage}
            placeholder="e.g. 500 mg"
            placeholderTextColor={colors.textMuted}
            style={{
              color: colors.text,
              fontSize: 16,
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          />
        </Card>

        {/* Frequency chips */}
        <Card>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, marginBottom: spacing.sm, fontWeight: "700" },
            ]}
          >
            Frequency
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {FREQUENCIES.map((f) => {
              const sel = f === frequency;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFrequency(f)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={f}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: sel ? colors.primary : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: sel ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: sel ? colors.onPrimary : colors.text,
                    }}
                  >
                    {f}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Timing chips */}
        <Card>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, marginBottom: spacing.sm, fontWeight: "700" },
            ]}
          >
            Timing (optional)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Pressable
              onPress={() => setTiming(undefined)}
              accessibilityRole="button"
              accessibilityState={{ selected: !timing }}
              accessibilityLabel="No timing"
              style={({ pressed }) => ({
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: !timing ? colors.primary : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: !timing ? colors.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: !timing ? colors.onPrimary : colors.text,
                }}
              >
                None
              </Text>
            </Pressable>
            {TIMINGS.map((t) => {
              const sel = t === timing;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTiming(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={t}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: sel ? colors.primary : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: sel ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: sel ? colors.onPrimary : colors.text,
                    }}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Date range */}
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.label.md,
                  { color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "700" },
                ]}
              >
                Start
              </Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={{
                  color: colors.text,
                  fontSize: 16,
                  paddingVertical: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.label.md,
                  { color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "700" },
                ]}
              >
                End
              </Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={{
                  color: colors.text,
                  fontSize: 16,
                  paddingVertical: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              />
            </View>
          </View>
        </Card>

        {/* Notes */}
        <Card>
          <Text
            style={[
              typography.label.md,
              { color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "700" },
            ]}
          >
            Notes
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything to remember"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            style={{
              color: colors.text,
              fontSize: 15,
              minHeight: 60,
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              textAlignVertical: "top",
            }}
          />
        </Card>

        {/* Actions */}
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            title={savedOnce ? "Saved" : "Save changes"}
            icon={Save}
            onPress={onSave}
            loading={edit.isPending}
            disabled={!dirty || edit.isPending}
            variant="primary"
          />
          {med.active !== false ? (
            <Button
              title="Stop medicine"
              icon={Power}
              onPress={onStop}
              loading={stop.isPending}
              variant="danger"
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}