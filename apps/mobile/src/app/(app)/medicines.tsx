import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Pill as PillIcon,
  Plus,
  Check,
  Clock,
  Sun,
  Moon,
  Sunrise,
  CheckCircle2,
} from "lucide-react-native";
import {
  useMyMedicines,
  useTodayMedicines,
  useStopMedicine,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  IconButton,
  Card,
  Pill,
  EmptyState,
  Skeleton,
  Timeline,
  DoseRing,
  useToast,
} from "@/components/ui";

const TABS = [
  { value: "today", label: "Today" },
  { value: "all", label: "All active" },
];

function periodIcon(timing: string) {
  const t = (timing || "").toLowerCase();
  if (t.includes("morning") || t.includes("am") || t.includes("breakfast"))
    return Sunrise;
  if (t.includes("night") || t.includes("pm") || t.includes("bed")) return Moon;
  if (t.includes("noon") || t.includes("afternoon") || t.includes("lunch"))
    return Sun;
  return Clock;
}

function periodKey(timing: string) {
  const t = (timing || "").toLowerCase();
  if (t.includes("morning") || t.includes("am") || t.includes("breakfast"))
    return "morning";
  if (t.includes("night") || t.includes("pm") || t.includes("bed"))
    return "night";
  if (t.includes("noon") || t.includes("afternoon") || t.includes("lunch"))
    return "afternoon";
  return "anytime";
}

const PERIOD_META: Record<
  string,
  { label: string; tone: "primary" | "accent" | "accent2" | "info" }
> = {
  morning: { label: "Morning", tone: "primary" },
  afternoon: { label: "Afternoon", tone: "accent" },
  night: { label: "Evening", tone: "accent2" },
  anytime: { label: "Anytime", tone: "info" },
};

export default function MedicinesScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const { data: allMeds, isLoading } = useMyMedicines();
  const { data: todayMeds } = useTodayMedicines();
  const stopMedicine = useStopMedicine();
  const [tab, setTab] = useState("today");

  const medicines =
    (tab === "today" ? todayMeds?.medicines : allMeds?.medicines) || [];
  const [takenMap, setTakenMap] = useState<Record<string, boolean>>({});

  const takenCount = Object.values(takenMap).filter(Boolean).length;
  const adherence =
    medicines.length > 0 ? takenCount / medicines.length : 0;

  function markTaken(id: string, name: string) {
    setTakenMap((m) => ({ ...m, [id]: !m[id] }));
    toast.show(`${name} marked as ${takenMap[id] ? "not taken" : "taken"}`, "success");
  }

  function handleStop(id: string, name: string) {
    toast.show(`${name} stopped`, "info");
    stopMedicine.mutate(id);
  }

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        title="Medicines"
        subtitle={`${medicines.length} active`}
        right={
          <IconButton
            icon={Plus}
            variant="solid"
            onPress={() => router.push("/(app)/add-medicine")}
            accessibilityLabel="Add medicine"
          />
        }
      />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: "row",
          gap: spacing.sm,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {TABS.map((t) => (
            <FilterPill
              key={t.value}
              label={t.label}
              active={tab === t.value}
              onPress={() => setTab(t.value)}
            />
          ))}
        </View>
        {medicines.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {Math.round(adherence * 100)}% today
            </Text>
            <DoseRing
              value={adherence}
              size={36}
              tone="accent"
              label={`${Math.round(adherence * 100)}`}
            />
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={120} radius={20} />
          ))}
        </View>
      ) : medicines.length === 0 ? (
        <EmptyState
          icon={PillIcon}
          title={tab === "today" ? "Nothing today" : "No medicines"}
          message={
            tab === "today"
              ? "You're all caught up for today"
              : "Add your first medicine to get reminders"
          }
          actionLabel={tab === "all" ? "Add medicine" : undefined}
          onAction={
            tab === "all" ? () => router.push("/(app)/add-medicine") : undefined
          }
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Timeline
            data={medicines}
            groupBy={(m: any) => periodKey(m.medicines.timing)}
            groupMeta={PERIOD_META}
            keyExtractor={(m: any) => m.medicines.id}
            flush
            renderItem={(item: any) => {
              const med = item.medicines;
              const taken = !!takenMap[med.id];
              return (
                <MedicineRow
                  med={med}
                  taken={taken}
                  onToggle={() => markTaken(med.id, med.name)}
                  onStop={() => handleStop(med.id, med.name)}
                />
              );
            }}
          />
        </View>
      )}
    </Screen>
  );
}

function MedicineRow({
  med,
  taken,
  onToggle,
  onStop,
}: {
  med: any;
  taken: boolean;
  onToggle: () => void;
  onStop: () => void;
}) {
  const { spacing, colors, typography, radius } = useTheme();
  const Icon = periodIcon(med.timing);
  return (
    <Card padded={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: taken ? colors.successSoft : colors.primarySoft,
          }}
        >
          {taken ? (
            <CheckCircle2 size={26} color={colors.success} strokeWidth={2.25} />
          ) : (
            <Icon size={26} color={colors.primary} strokeWidth={2.25} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text
            style={[typography.title.sm, { color: colors.text }]}
            numberOfLines={1}
          >
            {med.name}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.primary, fontWeight: "700" },
            ]}
          >
            {med.dosage} · {med.timing || "Anytime"}
          </Text>
          <View
            style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}
          >
            {med.frequency ? (
              <Pill label={med.frequency} tone="primary" size="sm" />
            ) : null}
            {med.notes ? (
              <Pill label="Notes" tone="info" size="sm" />
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={taken ? "Mark as not taken" : "Mark as taken"}
          hitSlop={10}
          style={({ pressed }: any) => ({
            width: 44,
            height: 44,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: taken
              ? colors.success
              : pressed
              ? colors.surfaceMuted
              : colors.surface,
            borderWidth: 1,
            borderColor: taken ? colors.success : colors.border,
          })}
        >
          <Check
            size={20}
            color={taken ? colors.onSuccess : colors.textMuted}
            strokeWidth={3}
          />
        </Pressable>
      </View>
      {med.notes ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
            paddingTop: 0,
          }}
        >
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, fontStyle: "italic" },
            ]}
          >
            {med.notes}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel={`Stop ${med.name}`}
        style={{
          paddingVertical: spacing.sm,
          alignItems: "center",
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Text style={[typography.caption, { color: colors.danger, fontWeight: "700" }]}>
          Stop medicine
        </Text>
      </Pressable>
    </Card>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onTouchEnd={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={[
          typography.label.md,
          {
            color: active ? colors.onPrimary : colors.text,
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
