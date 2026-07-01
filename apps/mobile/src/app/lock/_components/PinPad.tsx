// PinPad — shared by /lock (unlock) and /lock/setup (create + confirm).
// A classic iOS-style 6-dot indicator + 3×4 numeric keypad with
// backspace. Length is configurable so setup screens can confirm a
// 6-digit PIN while leaving room for 4–6 digit pins.
//
// Props:
//   value:          digits collected so far
//   onChange:       receives the new value after each digit/backspace
//   length:         target length (default 6)
//   error:          when true, renders dots in danger tone and shakes
//   disabled:       keypad ignores taps while parent is processing
//   hint:           optional small text under the dots (e.g. "weak PIN")
//
// The component is self-contained — no state, fully controlled. The
// parent owns the value and decides what to do with a complete PIN.

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Vibration,
} from "react-native";
import { Delete } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  hint?: string;
}

export function PinPad({
  value,
  onChange,
  length = 6,
  error = false,
  disabled = false,
  hint,
}: Props) {
  const { colors, fontFamily } = useTheme();
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;
    Vibration.vibrate(40);
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [error, shake]);

  function press(digit: string) {
    if (disabled) return;
    if (value.length >= length) return;
    onChange(value + digit);
  }
  function back() {
    if (disabled) return;
    if (!value.length) return;
    onChange(value.slice(0, -1));
  }

  const dotSize = 14;
  const dotGap = 16;

  return (
    <View style={{ alignItems: "center", gap: 32 }}>
      {/* Dot indicator */}
      <Animated.View
        style={{
          flexDirection: "row",
          gap: dotGap,
          transform: [{ translateX: shake }],
        }}
      >
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              style={{
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                borderWidth: 1.5,
                borderColor: error
                  ? colors.danger
                  : filled
                    ? colors.primary
                    : colors.border,
                backgroundColor: filled
                  ? error
                    ? colors.danger
                    : colors.primary
                  : "transparent",
              }}
            />
          );
        })}
      </Animated.View>

      {hint ? (
        <Text
          style={{
            color: colors.danger,
            fontSize: 13,
            fontFamily: fontFamily.body,
          }}
        >
          {hint}
        </Text>
      ) : (
        <View style={{ height: 18 }} />
      )}

      {/* Keypad */}
      <View style={{ gap: 14 }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ].map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", gap: 24 }}>
            {row.map((d) => (
              <KeyButton
                key={d}
                label={d}
                onPress={() => press(d)}
                disabled={disabled}
              />
            ))}
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 24, justifyContent: "center" }}>
          <View style={{ width: 72 }} />
          <KeyButton label="0" onPress={() => press("0")} disabled={disabled} />
          <Pressable
            onPress={back}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Backspace"
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: "center",
              justifyContent: "center",
              opacity: value.length === 0 || disabled ? 0.3 : 1,
            }}
          >
            <Delete size={26} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function KeyButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors, fontFamily } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`Digit ${label}`}
      style={({ pressed }) => [
        {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "600",
          color: colors.text,
          fontFamily: fontFamily.displayBold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true; // 1111, 222222
  if ("0123456789".includes(pin)) return true; // 0123456789
  if ("9876543210".includes(pin)) return true; // 9876543210
  return false;
}

// Avoid the styles helper being tree-shaken away on some setups.
const _styles = StyleSheet.create({});