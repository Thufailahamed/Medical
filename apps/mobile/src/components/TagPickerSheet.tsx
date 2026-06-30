// @ts-nocheck
import { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
} from "react-native";
import { Plus, Tag as TagIcon } from "lucide-react-native";
import { BottomSheet, Chip } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  visible: boolean;
  onDismiss?: () => void;
  onClose?: () => void;
  currentTags?: string[];
  suggestions: string[]; // top used tags derived from the records cache
  onApply: (next: string[]) => void;
};

export function TagPickerSheet({
  visible,
  onDismiss,
  onClose,
  currentTags,
  suggestions,
  onApply,
}: Props) {
  const { colors, spacing, typography } = useTheme();
  const [working, setWorking] = useState<string[]>(currentTags || []);
  const [draft, setDraft] = useState("");

  const handleDismiss = onDismiss || onClose || (() => {});

  useEffect(() => {
    if (visible) {
      setWorking(currentTags || []);
    }
  }, [visible, currentTags]);

  function toggle(tag: string) {
    setWorking((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addDraft() {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (!working.includes(t)) setWorking([...working, t]);
    setDraft("");
  }

  function apply() {
    onApply(working);
    handleDismiss();
  }

  return (
    <BottomSheet visible={visible} onDismiss={handleDismiss} title="Edit tags">
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        {suggestions.length ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.label.md, { color: colors.textMuted }]}>
              Suggestions
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {suggestions.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={working.includes(s)}
                  onPress={() => toggle(s)}
                  size="sm"
                  icon={TagIcon}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.label.md, { color: colors.textMuted }]}>
            Add a new tag
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bgElevated,
              }}
            >
              <TagIcon size={16} color={colors.textMuted} />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="e.g. urgent, follow-up"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 15,
                  padding: 0,
                }}
                onSubmitEditing={addDraft}
                returnKeyType="done"
              />
            </View>
            <Pressable
              onPress={addDraft}
              accessibilityRole="button"
              accessibilityLabel="Add tag"
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: pressed ? colors.primary : colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Plus size={20} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {working.length ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.label.md, { color: colors.textMuted }]}>
              Applied ({working.length})
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {working.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected
                  onPress={() => toggle(t)}
                  size="sm"
                />
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={apply}
          accessibilityRole="button"
          accessibilityLabel="Apply tags"
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primary : colors.primary,
            paddingVertical: spacing.md,
            borderRadius: 12,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              color: colors.onPrimary,
              fontWeight: "800",
              fontSize: 15,
            }}
          >
            Apply
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}