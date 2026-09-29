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
//   leftAction:     optional key in the empty bottom-left slot (e.g. Face ID)
//
// The component is self-contained — no state, fully controlled. The
// parent owns the value and decides what to do with a complete PIN.

import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { Delete } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  hint?: string;
  leftAction?: {
    icon: React.ReactNode;
    onPress: () => void;
    accessibilityLabel: string;
  };
}

const LETTERS: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
};

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function PinPad({
  value,
  onChange,
  length = 6,
  error = false,
  disabled = false,
  hint,
  leftAction,
}: Props) {
  const { colors, fontFamily } = useTheme();
  const { height, width } = useWindowDimensions();
  const keySize = height < 700 || width < 340 ? 64 : height < 850 ? 72 : 78;
  const colGap = width < 360 ? 18 : 26;
  const rowGap = height < 700 ? 10 : height < 850 ? 14 : 16;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Animated.sequence(
      [14, -12, 9, -6, 3, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 55, useNativeDriver: true }),
      ),
    ).start();
  }, [error, shake]);

  function press(digit: string) {
    if (disabled || value.length >= length) return;
    tap();
    onChange(value + digit);
  }
  function back() {
    if (disabled || !value.length) return;
    tap();
    onChange(value.slice(0, -1));
  }

  const dotSize = 14;
  const dotColor = error ? colors.danger : colors.primary;
  const showBack = value.length > 0;

  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View
        accessibilityRole="progressbar"
        accessibilityLabel={`${value.length} of ${length} digits entered`}
        style={{
          flexDirection: "row",
          gap: 18,
          height: 24,
          alignItems: "center",
          transform: [{ translateX: shake }],
        }}
      >
        {Array.from({ length }).map((_, i) => (
          <Dot
            key={i}
            filled={i < value.length}
            size={dotSize}
            color={dotColor}
            emptyColor={error ? colors.danger : colors.borderStrong}
          />
        ))}
      </Animated.View>

      <Text
        numberOfLines={2}
        style={{
          color: error ? colors.danger : colors.textMuted,
          fontSize: 13,
          lineHeight: 18,
          fontFamily: fontFamily.bodyMedium,
          textAlign: "center",
          minHeight: 36,
          paddingTop: 10,
          maxWidth: keySize * 3 + colGap * 2,
        }}
      >
        {hint ?? ""}
      </Text>

      <View style={{ gap: rowGap, marginTop: height < 700 ? 4 : 12 }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ].map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", gap: colGap }}>
            {row.map((d) => (
              <KeyButton key={d} label={d} onPress={() => press(d)} disabled={disabled} size={keySize} />
            ))}
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: colGap }}>
          {leftAction ? (
            <GhostKey
              size={keySize}
              onPress={leftAction.onPress}
              disabled={disabled}
              accessibilityLabel={leftAction.accessibilityLabel}
            >
              {leftAction.icon}
            </GhostKey>
          ) : (
            <View style={{ width: keySize }} />
          )}
          <KeyButton label="0" onPress={() => press("0")} disabled={disabled} size={keySize} />
          <GhostKey
            size={keySize}
            onPress={back}
            disabled={disabled || !showBack}
            accessibilityLabel="Backspace"
            hidden={!showBack}
          >
            <Delete size={26} color={colors.text} strokeWidth={1.6} />
          </GhostKey>
        </View>
      </View>
    </View>
  );
}

function KeyButton({
  label,
  onPress,
  disabled,
  size,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  size: number;
}) {
  const { colors, fontFamily, shadow, scheme } = useTheme();
  const letters = LETTERS[label];
  const dark = scheme === "dark";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.primary : dark ? colors.surfaceElevated : colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: pressed ? colors.primary : colors.hairline,
        opacity: disabled ? 0.45 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
        ...(dark ? shadow.none : shadow.sm),
      })}
    >
      {({ pressed }) => (
        <>
          <Text
            style={{
              fontSize: size < 70 ? 27 : 32,
              lineHeight: size < 70 ? 31 : 36,
              color: pressed ? colors.onPrimary : colors.text,
              fontFamily: fontFamily.bodyMedium,
              letterSpacing: -0.5,
              fontVariant: ["tabular-nums"],
            }}
          >
            {label}
          </Text>
          {letters ? (
            <Text
              style={{
                fontSize: 9,
                lineHeight: 11,
                letterSpacing: 1.8,
                color: pressed ? colors.onPrimary : colors.textSubtle,
                fontFamily: fontFamily.bodyBold,
                marginTop: 0,
              }}
            >
              {letters}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function Dot({
  filled,
  size,
  color,
  emptyColor,
}: {
  filled: boolean;
  size: number;
  color: string;
  emptyColor: string;
}) {
  const scale = useRef(new Animated.Value(filled ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: filled ? 1 : 0,
      damping: 12,
      stiffness: 320,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [filled, scale]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: filled ? color : emptyColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
        }}
      />
    </View>
  );
}

function GhostKey({
  size,
  onPress,
  disabled,
  accessibilityLabel,
  hidden = false,
  children,
}: {
  size: number;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.fill : "transparent",
        opacity: hidden ? 0 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true; // 1111, 222222
  if ("0123456789".includes(pin)) return true; // 0123456789
  if ("9876543210".includes(pin)) return true; // 9876543210
  return false;
}
