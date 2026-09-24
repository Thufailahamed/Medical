import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  spacing?: number;
  /** Left inset in px — e.g. to align with row text after an icon tile (iOS grouped lists). */
  inset?: number;
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Divider({ spacing: s = 0, inset, vertical, style }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        vertical
          ? {
              width: StyleSheet.hairlineWidth,
              alignSelf: "stretch",
              backgroundColor: colors.separator,
              marginHorizontal: s,
            }
          : {
              height: StyleSheet.hairlineWidth,
              alignSelf: "stretch",
              backgroundColor: colors.separator,
              marginVertical: s,
              marginLeft: inset,
            },
        style,
      ]}
    />
  );
}
