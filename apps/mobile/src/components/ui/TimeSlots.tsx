import React, { useEffect } from "react";
import { View, Text, StyleSheet, type DimensionValue } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";

export type TimeSlot = {
  value: string;
  label: string;
};

type Props = {
  slots: TimeSlot[];
  value?: string | null;
  onChange: (v: string) => void;
  columns?: number;
};

export function TimeSlots({ slots, value, onChange, columns = 4 }: Props) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={[styles.grid, { gap: spacing.sm }]}>
      {slots.map((slot, index) => (
        <TimeSlotButton
          key={`${slot.value}-${index}`}
          slot={slot}
          selected={value === slot.value}
          onPress={() => onChange(slot.value)}
          flexBasis={(`${100 / columns}%` as unknown) as DimensionValue}
        />
      ))}
    </View>
  );
}

function TimeSlotButton({
  slot,
  selected,
  onPress,
  flexBasis,
}: {
  slot: TimeSlot;
  selected: boolean;
  onPress: () => void;
  flexBasis: DimensionValue;
}) {
  const { colors, spacing, radius, typography, motion: motionTokens } = useTheme();
  const scale = useSharedValue(selected ? 1.04 : 1);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.04 : 1, motionTokens.spring.snappy as any);
  }, [selected, scale, motionTokens.spring.snappy]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ flexBasis, flexGrow: 1 }, animStyle]}>
      <AnimatedButton
        onPress={onPress}
        label={slot.label}
        selected={selected}
      />
    </Animated.View>
  );
}

function AnimatedButton({
  onPress,
  label,
  selected,
}: {
  onPress: () => void;
  label: string;
  selected: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onTouchEnd={onPress}
      style={[
        styles.slot,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radius.lg,
          paddingVertical: spacing.md,
        },
      ]}
    >
      <Text
        style={[
          typography.title.sm,
          {
            color: selected ? colors.onPrimary : colors.text,
            fontWeight: "700",
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  slot: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    margin: 4,
    minHeight: 52,
  },
});
