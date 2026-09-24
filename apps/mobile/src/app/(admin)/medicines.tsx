import React, { useState } from "react";
import { View, Text, FlatList } from "react-native";
import { Pill as PillIcon, Plus } from "lucide-react-native";
import {
  Screen,
  ListItem,
  Button,
  BottomSheet,
  TextInput,
  EmptyState,
  ChipGroup,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminMedicines,
  useSaveMedicine,
} from "@/hooks/useAdminApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AdminHero,
  SearchBar,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";

const BOOL_OPTS = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

export default function AdminMedicinesScreen() {
  const { spacing } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState("");
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

  const items = data?.items ?? [];

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
    setActive(m.active !== 0 && m.active !== false);
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

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Directory"
          title="Medicines master"
          subtitle={`${data?.total ?? 0} catalogue entries`}
          icon={PillIcon}
          right={
            <Pressable
              onPress={openCreate}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Add medicine"
              hitSlop={8}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
              }}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          }
        />
      </View>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginTop: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
        <SearchBar
          value={q}
          onChangeText={setQ}
          placeholder="Search generic or brand name"
        />
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListSkeleton rows={8} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m: any) => m.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 140,
            gap: spacing.sm,
          }}
          ListEmptyComponent={
            isError ? (
              <AdminError message="Couldn't load medicines." />
            ) : (
              <EmptyState
                icon={PillIcon}
                title="No medicines"
                message="Add catalogue entries or adjust your search."
              />
            )
          }
          renderItem={({ item }: { item: any }) => (
            <ListItem
              title={item.genericName}
              subtitle={[item.brandName, item.strength, item.scheduleClass]
                .filter(Boolean)
                .join(" · ")}
              onPress={() => openEdit(item)}
              rightSlot={
                <StatusPill status={item.active ? "active" : "suspended"} />
              }
            />
          )}
        />
      )}

      <BottomSheet
        visible={sheet}
        onDismiss={() => setSheet(false)}
        title={editing ? "Edit medicine" : "Add medicine"}
        height={560}
      >
        <MedicineForm
          genericName={genericName}
          setGenericName={setGenericName}
          brandName={brandName}
          setBrandName={setBrandName}
          strength={strength}
          setStrength={setStrength}
          scheduleClass={scheduleClass}
          setScheduleClass={setScheduleClass}
          isGeneric={isGeneric}
          setIsGeneric={setIsGeneric}
          active={active}
          setActive={setActive}
          notes={notes}
          setNotes={setNotes}
          onSave={onSave}
          onCancel={() => setSheet(false)}
          saving={save.isPending}
          valid={!!genericName.trim()}
          editing={!!editing}
        />
      </BottomSheet>
    </Screen>
  );
}

function MedicineForm(props: any) {
  const { colors, spacing, typography } = useTheme();
  const {
    genericName, setGenericName, brandName, setBrandName,
    strength, setStrength, scheduleClass, setScheduleClass,
    isGeneric, setIsGeneric, active, setActive,
    notes, setNotes, onSave, onCancel, saving, valid, editing,
  } = props;
  return (
    <View style={{ gap: spacing.md }}>
      <TextInput
        value={genericName}
        onChangeText={setGenericName}
        placeholder="Generic name (required)"
      />
      <TextInput
        value={brandName}
        onChangeText={setBrandName}
        placeholder="Brand name"
      />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextInput
            value={strength}
            onChangeText={setStrength}
            placeholder="Strength (e.g. 500mg)"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
            value={scheduleClass}
            onChangeText={setScheduleClass}
            placeholder="Schedule class"
          />
        </View>
      </View>
      <View>
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, fontWeight: "700", marginBottom: 6 },
          ]}
        >
          GENERIC
        </Text>
        <ChipGroup
          options={BOOL_OPTS}
          value={isGeneric ? "yes" : "no"}
          onChange={(v: string) => setIsGeneric(v === "yes")}
        />
      </View>
      <View>
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, fontWeight: "700", marginBottom: 6 },
          ]}
        >
          ACTIVE
        </Text>
        <ChipGroup
          options={BOOL_OPTS}
          value={active ? "yes" : "no"}
          onChange={(v: string) => setActive(v === "yes")}
        />
      </View>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes"
        multiline
        numberOfLines={2}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        <Button
          title={editing ? "Save changes" : "Add medicine"}
          onPress={onSave}
          loading={saving}
          disabled={!valid}
        />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
