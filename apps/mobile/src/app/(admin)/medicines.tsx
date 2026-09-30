import React, { useMemo, useState } from "react";
import { View, Text, FlatList } from "react-native";
import {
  Pill as PillIcon,
  Plus,
  ShoppingBag,
  FileText,
  Lock,
  Dna,
  Power,
  SearchX,
  ChevronRight,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  Screen,
  BottomSheet,
  TextInput,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { useAdminMedicines, useSaveMedicine } from "@/hooks/useAdminApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AdminHero,
  AdminCard,
  AdminEmpty,
  AdminSection,
  SearchBar,
  FilterChips,
  ListSkeleton,
  AdminError,
  FormGroup,
  SheetField,
  SheetForm,
  ToggleList,
} from "@/components/admin/ui";

type Schedule = "otc" | "pom" | "controlled" | "other";

function scheduleOf(v?: string | null): Schedule {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "otc") return "otc";
  if (s === "pom" || s === "rx") return "pom";
  if (s.startsWith("control")) return "controlled";
  return "other";
}

const SCHEDULE_META: Record<
  Schedule,
  { label: string; tone: Tone; icon: LucideIcon }
> = {
  otc: { label: "OTC", tone: "success", icon: ShoppingBag },
  pom: { label: "Prescription", tone: "info", icon: FileText },
  controlled: { label: "Controlled", tone: "danger", icon: Lock },
  other: { label: "Unclassified", tone: "neutral", icon: PillIcon },
};

const SCHEDULE_CHOICES = [
  { label: "OTC", value: "OTC", tone: "success" as const },
  { label: "POM (Rx)", value: "POM", tone: "info" as const },
  { label: "Controlled", value: "controlled", tone: "danger" as const },
  { label: "None", value: "" },
];

const isActive = (m: any) => m.active !== 0 && m.active !== false;

export default function AdminMedicinesScreen() {
  const { colors, spacing, typography, shadow } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Schedule | "inactive">("all");
  const debouncedQ = useDebounce(q, 350);

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminMedicines(debouncedQ);
  const save = useSaveMedicine();

  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [genericName, setGenericName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [strength, setStrength] = useState("");
  const [scheduleClass, setScheduleClass] = useState("");
  const [isGeneric, setIsGeneric] = useState(true);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");

  const all = data?.items ?? [];
  const counts = useMemo(() => {
    const c = { otc: 0, pom: 0, controlled: 0, other: 0, inactive: 0 };
    all.forEach((m: any) => {
      c[scheduleOf(m.scheduleClass)]++;
      if (!isActive(m)) c.inactive++;
    });
    return c;
  }, [all]);

  const items = useMemo(
    () =>
      all.filter((m: any) =>
        filter === "all"
          ? true
          : filter === "inactive"
            ? !isActive(m)
            : scheduleOf(m.scheduleClass) === filter
      ),
    [all, filter]
  );

  const filterOptions = [
    { label: `All ${all.length}`, value: "all" },
    { label: `OTC ${counts.otc}`, value: "otc" },
    { label: `Prescription ${counts.pom}`, value: "pom" },
    { label: `Controlled ${counts.controlled}`, value: "controlled" },
    ...(counts.inactive ? [{ label: `Inactive ${counts.inactive}`, value: "inactive" }] : []),
  ];

  const openCreate = () => {
    setEditing(null);
    setGenericName("");
    setBrandName("");
    setStrength("");
    setScheduleClass("");
    setIsGeneric(true);
    setActive(true);
    setNotes("");
    setSheet(true);
  };

  const openEdit = (m: any) => {
    setEditing(m);
    setGenericName(m.genericName ?? "");
    setBrandName(m.brandName ?? "");
    setStrength(m.strength ?? "");
    setScheduleClass(m.scheduleClass ?? "");
    setIsGeneric(!!m.isGeneric);
    setActive(isActive(m));
    setNotes(m.notes ?? "");
    setSheet(true);
  };

  const onSave = () => {
    if (!genericName.trim()) return;
    save.mutate(
      {
        id: editing?.id,
        body: {
          genericName: genericName.trim(),
          brandName: brandName.trim() || null,
          strength: strength.trim() || null,
          scheduleClass: scheduleClass.trim() || null,
          isGeneric,
          active,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.show(editing ? "Medicine updated" : "Medicine added", "success");
          setSheet(false);
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  // Keep a custom (non-standard) schedule value selectable when editing.
  const scheduleChoices =
    scheduleClass &&
    !SCHEDULE_CHOICES.some(
      (c) => c.value.toLowerCase() === scheduleClass.toLowerCase()
    )
      ? [...SCHEDULE_CHOICES, { label: scheduleClass, value: scheduleClass }]
      : SCHEDULE_CHOICES;
  const scheduleValue =
    SCHEDULE_CHOICES.find(
      (c) => c.value.toLowerCase() === scheduleClass.toLowerCase()
    )?.value ?? scheduleClass;

  const header = (
    <View>
      <View style={{ paddingTop: spacing.md, marginHorizontal: -spacing.lg }}>
        <AdminHero
          compact
          back
          eyebrow="Directory"
          title="Medicines"
          subtitle="Master drug catalogue"
          icon={PillIcon}
          stats={[
            { icon: PillIcon, value: data?.total ?? 0, label: "Entries" },
            { icon: ShoppingBag, value: counts.otc, label: "OTC" },
            { icon: FileText, value: counts.pom + counts.controlled, label: "Rx only" },
          ]}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginTop: spacing.lg,
        }}
      >
        <View style={{ flex: 1 }}>
          <SearchBar
            value={q}
            onChangeText={setQ}
            placeholder="Generic or brand name"
          />
        </View>
        <Pressable
          onPress={openCreate}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Add medicine"
          style={[
            {
              height: 52,
              paddingHorizontal: spacing.lg,
              borderRadius: 26,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.primary,
            },
            shadow.primary,
          ]}
        >
          <Plus size={18} color={colors.onPrimary} strokeWidth={2.6} />
          <Text style={[typography.label.md, { color: colors.onPrimary }]}>Add</Text>
        </Pressable>
      </View>

      <View style={{ marginHorizontal: -spacing.lg, marginTop: spacing.md }}>
        <FilterChips
          options={filterOptions}
          value={filter}
          onChange={(v) => setFilter(v as any)}
          size="sm"
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AdminSection
          title={debouncedQ ? "Results" : "Catalogue"}
          count={items.length}
          style={{ marginBottom: spacing.sm }}
        />
      </View>
    </View>
  );

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <FlatList
        data={isLoading || isError ? [] : items}
        keyExtractor={(m: any) => m.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 140,
          gap: spacing.sm,
        }}
        ListEmptyComponent={
          isLoading ? (
            <ListSkeleton rows={8} />
          ) : isError ? (
            <AdminError
              title="Load failed"
              message="Couldn't load medicines."
              onRetry={refetch}
              retrying={isRefetching}
            />
          ) : debouncedQ || filter !== "all" ? (
            <AdminEmpty
              icon={SearchX}
              title="No matches"
              message="Try another name or filter."
              actionLabel="Clear filters"
              onAction={() => {
                setQ("");
                setFilter("all");
              }}
            />
          ) : (
            <AdminEmpty
              icon={PillIcon}
              title="Catalogue is empty"
              message="Add the first medicine to the master list."
              actionLabel="Add medicine"
              onAction={openCreate}
            />
          )
        }
        renderItem={({ item }: { item: any }) => (
          <MedicineRow m={item} onPress={() => openEdit(item)} />
        )}
      />

      <BottomSheet
        visible={sheet}
        onDismiss={() => setSheet(false)}
        title={editing ? "Edit medicine" : "Add medicine"}
        height={700}
      >
        <SheetForm
          submitLabel={editing ? "Save changes" : "Add medicine"}
          onSubmit={onSave}
          onCancel={() => setSheet(false)}
          loading={save.isPending}
          disabled={!genericName.trim()}
        >
          <FormGroup title="Name">
            <SheetField label="Generic name" required>
              <TextInput
                value={genericName}
                onChangeText={setGenericName}
                placeholder="e.g. Paracetamol"
              />
            </SheetField>
            <SheetField label="Brand name">
              <TextInput
                value={brandName}
                onChangeText={setBrandName}
                placeholder="e.g. Panadol"
              />
            </SheetField>
          </FormGroup>

          <FormGroup title="Dosage & classification">
            <SheetField label="Strength">
              <TextInput
                value={strength}
                onChangeText={setStrength}
                placeholder="e.g. 500 mg"
              />
            </SheetField>
            <SheetField label="Schedule">
              <FilterChips
                options={scheduleChoices}
                value={scheduleValue}
                onChange={setScheduleClass}
                size="sm"
                flush
              />
            </SheetField>
          </FormGroup>

          <FormGroup title="Status">
            <ToggleList
              items={[
                {
                  key: "generic",
                  label: "Generic",
                  hint: "Non-branded formulation",
                  icon: Dna,
                  value: isGeneric,
                  onChange: setIsGeneric,
                },
                {
                  key: "active",
                  label: "Active",
                  hint: "Available to prescribers and pharmacies",
                  icon: Power,
                  value: active,
                  onChange: setActive,
                },
              ]}
            />
          </FormGroup>

          <FormGroup title="Notes">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Interactions, storage, substitutions…"
              multiline
              numberOfLines={3}
              style={{ minHeight: 76, textAlignVertical: "top" }}
            />
          </FormGroup>
        </SheetForm>
      </BottomSheet>
    </Screen>
  );
}

function MedicineRow({ m, onPress }: { m: any; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const meta = SCHEDULE_META[scheduleOf(m.scheduleClass)];
  const tone = useTone(meta.tone);
  const active = isActive(m);
  const Icon = meta.icon;
  return (
    <AdminCard
      onPress={onPress}
      style={{ paddingVertical: spacing.md, opacity: active ? 1 : 0.6 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tone.bg,
          }}
        >
          <PillIcon size={19} color={tone.fg} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text
              style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}
              numberOfLines={1}
            >
              {m.genericName}
            </Text>
            {m.strength ? (
              <Text
                style={[typography.label.sm, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {m.strength}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                height: 20,
                paddingHorizontal: 7,
                borderRadius: 10,
                backgroundColor: tone.bg,
              }}
            >
              <Icon size={10} color={tone.fg} strokeWidth={2.6} />
              <Text style={[typography.label.xs, { color: tone.fg }]}>
                {meta.label}
              </Text>
            </View>
            <Text
              style={[typography.caption, { color: colors.textSubtle, flexShrink: 1 }]}
              numberOfLines={1}
            >
              {m.brandName ? m.brandName : m.isGeneric ? "Generic" : "No brand"}
              {!active ? " · Inactive" : ""}
            </Text>
          </View>
        </View>
        <ChevronRight size={17} color={colors.textSubtle} strokeWidth={2.3} />
      </View>
    </AdminCard>
  );
}
