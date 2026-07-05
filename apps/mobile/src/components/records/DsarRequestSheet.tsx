// DsarRequestSheet: triggers DSAR verbs (export / erasure / rectification).

import React from "react";
import { View, StyleSheet, Alert, Pressable } from "react-native";
import { Download, Trash2, Pencil, ChevronRight } from "lucide-react-native";
import { useDsarExport, useDsarErasure, useDsarRectification } from "@/hooks/useApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AppText } from "@/components/ui/AppText";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DsarRequestSheet({ open, onClose }: Props) {
  const exportMutation = useDsarExport();
  const erasureMutation = useDsarErasure();
  const rectMutation = useDsarRectification();
  const toast = useToast();
  const { colors, spacing, fontFamily } = useTheme();

  const doExport = async () => {
    try {
      const res = await exportMutation.mutateAsync();
      toast({ title: "Export ready", body: `Job ${res.id} complete`, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: "Export failed", body: (err as Error).message, tone: "error" });
    }
  };

  const doErase = () => {
    Alert.alert(
      "Erase my data?",
      "This will anonymise your profile. Family-context records are preserved under tombstone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: async () => {
            try {
              await erasureMutation.mutateAsync(undefined);
              toast({ title: "Erasure complete", tone: "success" });
              onClose();
            } catch (err) {
              toast({ title: "Erasure failed", body: (err as Error).message, tone: "error" });
            }
          },
        },
      ],
    );
  };

  const doRectify = () => {
    Alert.prompt
      ? Alert.prompt(
          "Request correction",
          "Describe what needs to be corrected (1 per request).",
          async (note) => {
            if (!note) return;
            try {
              await rectMutation.mutateAsync({ fields: [], notes: note });
              toast({ title: "Request received", tone: "success" });
              onClose();
            } catch (err) {
              toast({ title: "Failed", body: (err as Error).message, tone: "error" });
            }
          },
        )
      : Alert.alert("Unavailable on this platform");
  };

  return (
    <BottomSheet visible={open} onDismiss={onClose} title="Data rights">
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 10 }}>
        {/* Export Option */}
        <Pressable
          onPress={doExport}
          disabled={exportMutation.isPending}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            padding: spacing.md,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.md,
            opacity: exportMutation.isPending ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#FEF3C7", // Amber
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Download size={16} color="#D97706" strokeWidth={2.25} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              style={{
                fontSize: 14.5,
                fontWeight: "800",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              Export my data
            </AppText>
            <AppText
              style={{
                fontSize: 12,
                fontWeight: "500",
                color: colors.textMuted,
                fontFamily: fontFamily.body,
              }}
              numberOfLines={2}
            >
              Receive a portable, encrypted copy of all your data.
            </AppText>
          </View>
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
        </Pressable>

        {/* Erase Option */}
        <Pressable
          onPress={doErase}
          disabled={erasureMutation.isPending}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            padding: spacing.md,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.md,
            opacity: erasureMutation.isPending ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#FEF2F2", // Red
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 size={16} color="#EF4444" strokeWidth={2.25} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              style={{
                fontSize: 14.5,
                fontWeight: "800",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              Erase my data
            </AppText>
            <AppText
              style={{
                fontSize: 12,
                fontWeight: "500",
                color: colors.textMuted,
                fontFamily: fontFamily.body,
              }}
              numberOfLines={2}
            >
              Permanently anonymise your profile.
            </AppText>
          </View>
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
        </Pressable>

        {/* Rectify Option */}
        <Pressable
          onPress={doRectify}
          disabled={rectMutation.isPending}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            padding: spacing.md,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.md,
            opacity: rectMutation.isPending ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#E0E7FF", // Indigo/Teal
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={16} color="#4F46E5" strokeWidth={2.25} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              style={{
                fontSize: 14.5,
                fontWeight: "800",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              Request a correction
            </AppText>
            <AppText
              style={{
                fontSize: 12,
                fontWeight: "500",
                color: colors.textMuted,
                fontFamily: fontFamily.body,
              }}
              numberOfLines={2}
            >
              We'll review your request and respond within 30 days.
            </AppText>
          </View>
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}