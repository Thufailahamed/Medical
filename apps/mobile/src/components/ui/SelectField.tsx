import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { BottomSheet } from "./BottomSheet";

type Option = {
  label: string;
  value: string;
};

type Props = {
  value?: string;
  onChange: (value: string) => void;
  options: (string | Option)[];
  label?: string;
  helper?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function SelectField({
  value,
  onChange,
  options,
  label,
  helper,
  error,
  placeholder = "Select option",
  disabled,
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const [showSheet, setShowSheet] = useState(false);

  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  const borderColor = error
    ? colors.danger
    : showSheet
    ? colors.borderFocus
    : colors.border;

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text
          style={[
            typography.label.md,
            {
              color: colors.textMuted,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => !disabled && setShowSheet(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? "Select field"}
        accessibilityState={{ disabled }}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 52,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor,
            gap: spacing.sm,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={[
            typography.body.md,
            { color: selectedOption ? colors.text : colors.textSubtle, flex: 1 },
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown
          size={18}
          color={showSheet ? colors.primary : colors.textSubtle}
          strokeWidth={2.25}
        />
      </Pressable>

      <BottomSheet
        visible={showSheet}
        onDismiss={() => setShowSheet(false)}
        title={label ?? "Select Option"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 350 }}
          contentContainerStyle={{ paddingVertical: spacing.xs }}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onChange(opt.value);
                  setShowSheet(false);
                }}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: isSelected
                      ? colors.primarySoft
                      : pressed
                      ? colors.border
                      : "transparent",
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.body.md,
                    {
                      color: isSelected ? colors.primary : colors.text,
                      fontWeight: isSelected ? "600" : "400",
                      flex: 1,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
                {isSelected && (
                  <Check size={18} color={colors.primary} strokeWidth={2.5} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {error ? (
        <Text style={[typography.caption, { color: colors.danger }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
