import React from "react";
import { View, Pressable } from "react-native";
import {
  ArrowUpRight,
  FlaskConical,
  Pill,
  Stethoscope,
  TrendingUp,
} from "lucide-react-native";
import { AppText } from "@/components/ui/AppText";
import { palette } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  onSelectPrompt: (prompt: string) => void;
}

const prompts = [
  {
    label: "Review my latest labs",
    detail: "Explain results and unusual values",
    icon: FlaskConical,
    text: "Can you explain my latest blood test report and highlight any abnormal values?",
    color: palette.sky[600],
    tint: palette.sky[100],
  },
  {
    label: "Show health trends",
    detail: "Compare changes across recent years",
    icon: TrendingUp,
    text: "How has my HbA1c and cholesterol changed over the last three years?",
    color: palette.coral[600],
    tint: palette.coral[100],
  },
  {
    label: "Review medications",
    detail: "See doses, timing, and instructions",
    icon: Pill,
    text: "Which medications appear in my records and what are the key instructions?",
    color: palette.emerald[600],
    tint: palette.emerald[100],
  },
  {
    label: "Prepare for a visit",
    detail: "Create a concise doctor summary",
    icon: Stethoscope,
    text: "Prepare a concise summary of my recent health records for my next doctor visit.",
    color: palette.amber[600],
    tint: palette.amber[100],
  },
];

export function SmartPromptChips({ onSelectPrompt }: Props) {
  const { colors, fontFamily, spacing } = useTheme();

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {prompts.map((item) => {
        const IconComp = item.icon;
        return (
          <Pressable
            key={item.label}
            onPress={() => onSelectPrompt(item.text)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexBasis: "48%",
              flexGrow: 1,
              minHeight: 124,
              justifyContent: "space-between",
              padding: spacing.md,
              borderRadius: 20,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderWidth: 1,
              borderColor: pressed ? item.color : colors.border,
              shadowColor: palette.slate[900],
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: item.tint,
                }}
              >
                <IconComp size={19} color={item.color} strokeWidth={2.2} />
              </View>
              <ArrowUpRight size={16} color={item.color} strokeWidth={2.2} />
            </View>
            <View style={{ gap: 3 }}>
              <AppText
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  fontWeight: "700",
                  color: colors.text,
                  fontFamily: fontFamily.bodySemibold,
                }}
              >
                {item.label}
              </AppText>
              <AppText
                numberOfLines={2}
                style={{
                  fontSize: 10.5,
                  lineHeight: 15,
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                }}
              >
                {item.detail}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
