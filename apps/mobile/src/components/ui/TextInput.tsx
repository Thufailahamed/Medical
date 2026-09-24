import React, { forwardRef, useState } from "react";
import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  Pressable,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

export type TextInputTone = "default" | "soft";

type Props = TextInputProps & {
  invalid?: boolean;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  onTrailingIconPress?: () => void;
  showPasswordToggle?: boolean;
  tone?: TextInputTone;
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextInput = forwardRef<RNTextInput, Props>(function TextInput(
  {
    invalid,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    onTrailingIconPress,
    showPasswordToggle,
    tone = "default",
    secureTextEntry,
    containerStyle,
    style,
    editable = true,
    ...rest
  },
  ref
) {
  const { colors, spacing, radius, fontFamily, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  const borderColor = invalid
    ? colors.danger
    : focused
    ? colors.borderFocus
    : scheme === "dark"
    ? colors.borderStrong
    : colors.border;

  const bg = tone === "soft" ? colors.fill : colors.surface;

  const iconColor = invalid
    ? colors.danger
    : focused
    ? colors.primary
    : colors.textSubtle;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          minHeight: 52,
          paddingHorizontal: spacing.md + 2,
          backgroundColor: bg,
          borderRadius: radius.field,
          borderCurve: "continuous",
          borderWidth: focused || invalid ? 1.5 : tone === "soft" ? 0 : 1,
          borderColor,
          gap: spacing.sm + 2,
          opacity: editable ? 1 : 0.6,
        },
        focused && !invalid
          ? {
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.18,
              shadowRadius: 8,
            }
          : null,
        containerStyle,
      ]}
    >
      {LeadingIcon ? (
        <LeadingIcon size={18} color={iconColor} strokeWidth={2.25} />
      ) : null}
      <RNTextInput
        ref={ref}
        editable={editable}
        secureTextEntry={hidden}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          {
            flex: 1,
            fontSize: 16,
            lineHeight: 22,
            color: colors.text,
            paddingVertical: spacing.md,
            fontFamily: fontFamily.body,
          },
          style,
        ]}
        {...rest}
      />
      {showPasswordToggle && secureTextEntry !== undefined ? (
        <Pressable
          onPress={() => setHidden((v) => !v)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Show password" : "Hide password"}
        >
          {hidden ? (
            <Eye size={18} color={iconColor} strokeWidth={2.25} />
          ) : (
            <EyeOff size={18} color={iconColor} strokeWidth={2.25} />
          )}
        </Pressable>
      ) : TrailingIcon ? (
        <Pressable
          onPress={onTrailingIconPress}
          disabled={!onTrailingIconPress}
          hitSlop={12}
        >
          <TrailingIcon size={18} color={iconColor} strokeWidth={2.25} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({});
