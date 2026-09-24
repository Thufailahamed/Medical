import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Settings2, Lock } from "lucide-react-native";
import {
  Screen,
  Button,
  BottomSheet,
  TextInput,
  ChipGroup,
  EmptyState,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminSettings,
  useUpdateSetting,
  type AdminSetting,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  ListSkeleton,
  AdminError,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

export default function AdminSettingsScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminSettings();
  const update = useUpdateSetting();

  const [selected, setSelected] = useState<AdminSetting | null>(null);
  const [text, setText] = useState("");

  const grouped = data?.grouped ?? {};
  const categories = Object.keys(grouped).sort();

  const open = (s: AdminSetting) => {
    setSelected(s);
    setText(
      typeof s.value === "object" ? JSON.stringify(s.value) : String(s.value ?? "")
    );
  };

  const parseValue = (): unknown => {
    if (!selected) return text;
    switch (selected.valueType) {
      case "boolean":
        return text === "true" || text === "yes";
      case "number":
        return Number(text);
      case "json":
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      default:
        return text;
    }
  };

  const onSave = () => {
    if (!selected) return;
    update.mutate(
      {
        key: selected.key,
        value: parseValue(),
        confirm: selected.isSensitive ? true : undefined,
      },
      {
        onSuccess: () => {
          toast.show("Setting updated", "success");
          setSelected(null);
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  return (
    <Screen
      scroll
      padded={false}
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="System"
          title="Settings"
          subtitle="Runtime configuration"
          icon={Settings2}
          stats={[
            { value: String(categories.length), label: "Groups" },
            {
              value: String(
                categories.reduce((n, c) => n + (grouped[c]?.length ?? 0), 0)
              ),
              label: "Keys",
            },
          ]}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        {isError ? <AdminError message="Couldn't load settings." /> : null}
        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Settings2}
            title="No settings"
            message="Runtime settings will appear here."
          />
        ) : (
          categories.map((cat) => (
            <View key={cat}>
              <AdminSection
                title={cat.replace(/_/g, " ")}
                count={grouped[cat].length}
              />
              <AdminCard style={{ padding: 0 }}>
                {grouped[cat].map((s, i) => (
                  <SettingRow
                    key={s.key}
                    s={s}
                    locale={locale}
                    last={i === grouped[cat].length - 1}
                    onPress={() => open(s)}
                  />
                ))}
              </AdminCard>
            </View>
          ))
        )}
      </View>

      <BottomSheet
        visible={!!selected}
        onDismiss={() => setSelected(null)}
        title={selected?.key ?? "Setting"}
        height={480}
      >
        {selected ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing.md }}>
              {selected.description ? (
                <Text
                  style={[typography.body.sm, { color: colors.textMuted }]}
                >
                  {selected.description}
                </Text>
              ) : null}
              {selected.isSensitive ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: colors.warningSoft,
                    padding: spacing.sm,
                    borderRadius: 12,
                    borderCurve: "continuous",
                  }}
                >
                  <Lock size={14} color={colors.warning} />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.warning, fontWeight: "700", flex: 1 },
                    ]}
                  >
                    Sensitive setting — changes are confirmed automatically
                  </Text>
                </View>
              ) : null}
              {selected.valueType === "boolean" ? (
                <ChipGroup
                  options={[
                    { label: "Enabled", value: "true" },
                    { label: "Disabled", value: "false" },
                  ]}
                  value={text === "true" || text === "yes" ? "true" : "false"}
                  onChange={(v: string) => setText(v)}
                />
              ) : (
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={`Value (${selected.valueType})`}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={
                    selected.valueType === "number" ? "numeric" : "default"
                  }
                  multiline={selected.valueType === "json"}
                  numberOfLines={selected.valueType === "json" ? 4 : 1}
                />
              )}
              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                Type: {selected.valueType} · Updated{" "}
                {selected.updatedAt
                  ? fmtDateTime(selected.updatedAt, locale as any)
                  : "never"}
              </Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                <Button
                  title="Save"
                  onPress={onSave}
                  loading={update.isPending}
                />
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setSelected(null)}
                />
              </View>
            </View>
          </ScrollView>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function SettingRow({
  s,
  last,
  locale,
  onPress,
}: {
  s: AdminSetting;
  last: boolean;
  locale: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const display =
    s.valueType === "boolean"
      ? s.value
        ? "Enabled"
        : "Disabled"
      : typeof s.value === "object"
        ? JSON.stringify(s.value)
        : String(s.value ?? "—");
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Text
          style={[typography.body.md, { color: colors.text, fontWeight: "600", flex: 1 }]}
          numberOfLines={1}
        >
          {s.key}
        </Text>
        {s.isSensitive ? (
          <Lock size={12} color={colors.warning} />
        ) : null}
      </View>
      <Text
        style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
        numberOfLines={1}
      >
        {display}
      </Text>
    </Pressable>
  );
}
