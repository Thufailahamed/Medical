import React, { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Calendar as CalendarIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/format";

type Props = {
  value?: Date;
  onChange: (date: Date) => void;
  label?: string;
  helper?: string;
  error?: string;
  placeholder?: string;
  mode?: "date" | "datetime" | "time";
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
};

function formatDate(d: Date, mode: "date" | "datetime" | "time", locale: ReturnType<typeof useLocaleStore.getState>["locale"]) {
  if (mode === "time") return fmtTime(d, locale);
  if (mode === "datetime") return fmtDateTime(d, locale);
  return fmtDate(d, locale);
}

export function DateField({
  value,
  onChange,
  label,
  helper,
  error,
  placeholder = "Select date",
  mode = "date",
  minimumDate,
  maximumDate,
  disabled,
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const [show, setShow] = useState(false);

  const handleChange = (_e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (date) onChange(date);
  };

  const borderColor = error
    ? colors.danger
    : show
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
        onPress={() => !disabled && setShow(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? "Date picker"}
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
        <CalendarIcon
          size={18}
          color={show ? colors.primary : colors.textSubtle}
          strokeWidth={2.25}
        />
        <Text
          style={[
            typography.body.md,
            { color: value ? colors.text : colors.textSubtle, flex: 1 },
          ]}
        >
          {value ? formatDate(value, mode, locale) : placeholder}
        </Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          themeVariant={undefined}
        />
      ) : null}
      {error ? (
        <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>
      ) : helper ? (
        <Text style={[typography.caption, { color: colors.textSubtle }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});
