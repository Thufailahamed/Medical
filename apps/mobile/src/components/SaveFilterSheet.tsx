// @ts-nocheck
import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { BookmarkPlus } from "lucide-react-native";
import { BottomSheet, FormField, TextInput as UIInput } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
};

export function SaveFilterSheet({
  visible,
  onDismiss,
  onSave,
  defaultName = "",
}: Props) {
  const { colors, spacing, typography } = useTheme();
  const [name, setName] = useState(defaultName);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    onDismiss();
  }

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title="Save filter">
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <FormField label="Filter name" helper="Pick something you'll recognise later">
          <UIInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Diabetes labs"
            leadingIcon={BookmarkPlus}
            autoCapitalize="sentences"
            onSubmitEditing={submit}
            returnKeyType="done"
          />
        </FormField>
        <Pressable
          onPress={submit}
          disabled={!name.trim()}
          accessibilityRole="button"
          accessibilityLabel="Save filter"
          style={({ pressed }) => ({
            backgroundColor: name.trim()
              ? pressed
                ? colors.primary
                : colors.primary
              : colors.surfaceMuted,
            paddingVertical: spacing.md,
            borderRadius: 12,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              color: name.trim() ? colors.onPrimary : colors.textMuted,
              fontWeight: "800",
              fontSize: 15,
            }}
          >
            Save
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}