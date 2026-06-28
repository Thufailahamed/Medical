import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  spacing?: number;
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Divider({ spacing: s = 0, vertical, style }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        vertical
          ? {
              width: 1,
              alignSelf: "stretch",
              backgroundColor: colors.border,
              marginHorizontal: s,
            }
          : {
              height: 1,
              alignSelf: "stretch",
              backgroundColor: colors.border,
              marginVertical: s,
            },
        style,
      ]}
    />
  );
}
