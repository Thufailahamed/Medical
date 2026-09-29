import React from "react";
import {
  View,
  TextInput as RNTextInput,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextInputProps,
} from "react-native";
import { Search, X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  clearLabel?: string;
  autoFocus?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  style?: StyleProp<ViewStyle>;
};

/** Paper search capsule — hairline edge, soft lift, round clear button. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  clearLabel = "Clear search",
  autoFocus,
  returnKeyType = "search",
  onSubmitEditing,
  style,
}: Props) {
  const { colors, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          height: 46,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? colors.borderStrong : colors.hairline,
        },
        isDark ? null : shadow.xs,
        style,
      ]}
    >
      <Search size={17} color={colors.textSubtle} strokeWidth={2.2} />
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[typography.body.md, { flex: 1, color: colors.text, paddingVertical: 0 }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          style={({ pressed }) => ({
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.fillStrong : colors.fill,
          })}
        >
          <X size={12} color={colors.textMuted} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}
