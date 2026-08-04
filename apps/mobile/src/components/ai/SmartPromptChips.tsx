import React from "react";
import { ScrollView, Pressable } from "react-native";
import { TrendingUp, Search, Calendar, Stethoscope, FlaskConical, Pill, FileText } from "lucide-react-native";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  onSelectPrompt: (prompt: string) => void;
}

export function SmartPromptChips({ onSelectPrompt }: Props) {
  const { fontFamily } = useTheme();

  const prompts = [
    { label: "📈 HbA1c 3-Year Trend", icon: TrendingUp, text: "How has my HbA1c changed over the last three years?" },
    { label: "🔬 Find Cholesterol Tests", icon: Search, text: "Find all my cholesterol tests" },
    { label: "📋 Summary for Cardiologist", icon: Stethoscope, text: "Prepare a summary of my records for my cardiologist" },
    { label: "💊 Medications From Last Year", icon: Calendar, text: "Which medications appear in my records from last year?" },
    { label: "🧪 Explain Latest Blood Test", icon: FlaskConical, text: "Can you explain my latest blood test report and highlight any abnormal values?" },
    { label: "📄 Export Records PDF", icon: FileText, text: "How do I export my health records as a PDF file?" },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}
    >
      {prompts.map((item, i) => {
        const IconComp = item.icon;
        return (
          <Pressable
            key={i}
            onPress={() => onSelectPrompt(item.text)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: pressed ? "#E0F2FE" : "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E2E8F0",
              shadowColor: "rgba(0,0,0,0.03)",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 1,
              shadowRadius: 4,
              elevation: 1,
            })}
          >
            <IconComp size={13} color="#0284C7" strokeWidth={2.25} />
            <AppText
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: "#0F172A",
                fontFamily: fontFamily.bodySemibold,
              }}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
