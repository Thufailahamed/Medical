// @ts-nocheck
import React, { useState } from "react";
import {
  View,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Eye, Target, Sparkles, CheckCircle2 } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { AppText } from "@/components/ui";

export interface DocumentHotspot {
  id: string;
  label: string;
  value: string;
  // Percentage coordinates (0..100) on document image
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentHotspotViewerProps {
  documentUrl: string;
  hotspots: DocumentHotspot[];
  selectedHotspotId?: string | null;
  onSelectHotspot?: (id: string) => void;
}

export function DocumentHotspotViewer({
  documentUrl,
  hotspots,
  selectedHotspotId,
  onSelectHotspot,
}: DocumentHotspotViewerProps) {
  const { colors, spacing, radius } = useTheme();
  const [activeId, setActiveId] = useState<string | null>(selectedHotspotId || null);

  const handlePressHotspot = (id: string) => {
    setActiveId(id);
    onSelectHotspot?.(id);
  };

  const activeHotspot = hotspots.find((h) => h.id === activeId);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header bar */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Target size={16} color={colors.primary} />
          <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
            Interactive Document Hotspots
          </AppText>
        </View>
        <AppText style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted }}>
          Tap item to locate on scan
        </AppText>
      </View>

      {/* Chip strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
      >
        {hotspots.map((spot) => {
          const isSelected = spot.id === activeId;
          return (
            <Pressable
              key={spot.id}
              onPress={() => handlePressHotspot(spot.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <AppText
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: isSelected ? "#FFFFFF" : colors.text,
                }}
              >
                {spot.label}: {spot.value}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Document View with Hotspot Bounding Box overlays */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: documentUrl }}
          style={styles.documentImage}
          resizeMode="contain"
        />

        {/* Hotspot Box Overlays */}
        {hotspots.map((spot) => {
          const isSelected = spot.id === activeId;
          return (
            <Pressable
              key={spot.id}
              onPress={() => handlePressHotspot(spot.id)}
              style={[
                styles.hotspotOverlay,
                {
                  left: `${spot.x}%`,
                  top: `${spot.y}%`,
                  width: `${spot.width}%`,
                  height: `${spot.height}%`,
                  borderColor: isSelected ? "#EF4444" : "#3B82F6",
                  backgroundColor: isSelected
                    ? "rgba(239, 68, 68, 0.25)"
                    : "rgba(59, 130, 246, 0.15)",
                },
              ]}
            >
              {isSelected ? (
                <View style={styles.hotspotBadge}>
                  <AppText style={{ fontSize: 9, fontWeight: "800", color: "#FFFFFF" }}>
                    {spot.label}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Active Hotspot Banner */}
      {activeHotspot ? (
        <View style={[styles.activeBanner, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
          <Target size={14} color="#DC2626" />
          <AppText style={{ fontSize: 12, fontWeight: "700", color: "#991B1B" }}>
            Highlighted: {activeHotspot.label} ({activeHotspot.value})
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  imageContainer: {
    width: "100%",
    height: 240,
    position: "relative",
    backgroundColor: "#000000",
  },
  documentImage: {
    width: "100%",
    height: "100%",
  },
  hotspotOverlay: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 4,
  },
  hotspotBadge: {
    position: "absolute",
    top: -16,
    left: 0,
    backgroundColor: "#DC2626",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
});
