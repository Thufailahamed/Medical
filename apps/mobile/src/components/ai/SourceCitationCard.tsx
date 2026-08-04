import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { FileText, ChevronRight } from "lucide-react-native";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/theme/ThemeProvider";

export interface Citation {
  recordId: string;
  title: string;
  kind?: string;
  date?: string;
}

interface Props {
  citation: Citation;
}

export function SourceCitationCard({ citation }: Props) {
  const router = useRouter();
  const { colors, fontFamily } = useTheme();

  if (!citation?.recordId) return null;

  return (
    <Pressable
      onPress={() => router.push(`/record-detail?id=${citation.recordId}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: pressed ? "#E0F2FE" : "#F0F9FF",
        borderWidth: 1,
        borderColor: "#BAE6FD",
        marginTop: 6,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          backgroundColor: "#0284C7",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FileText size={12} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <AppText
          style={{
            fontSize: 11.5,
            fontWeight: "700",
            color: "#0369A1",
            fontFamily: fontFamily.bodyBold,
          }}
          numberOfLines={1}
        >
          Source: {citation.title}
        </AppText>
        {citation.date ? (
          <AppText style={{ fontSize: 10, color: "#0284C7" }}>
            Recorded on {citation.date}
          </AppText>
        ) : null}
      </View>

      <ChevronRight size={14} color="#0284C7" strokeWidth={2.5} />
    </Pressable>
  );
}
