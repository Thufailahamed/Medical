// @ts-nocheck
import React, { useState } from "react";
import {
  View,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
} from "react-native";
import { X, Check, Edit2, AlertCircle, Sparkles } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { AppText, Button } from "@/components/ui";

export interface ExtractedResultItem {
  id: string;
  name: string;
  value: string | number;
  unit?: string;
  flag?: string;
  refRange?: string;
}

export interface ReviewCorrectionSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (updatedItems: ExtractedResultItem[]) => Promise<void>;
  initialItems: ExtractedResultItem[];
  title?: string;
}

export function ReviewCorrectionSheet({
  visible,
  onClose,
  onConfirm,
  initialItems,
  title = "Review Extracted Data",
}: ReviewCorrectionSheetProps) {
  const { colors, spacing, radius, fontFamily } = useTheme();
  const [items, setItems] = useState<ExtractedResultItem[]>(initialItems || []);
  const [saving, setSaving] = useState(false);

  const handleUpdateItem = (id: string, field: keyof ExtractedResultItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onConfirm(items);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.sparkleBadge, { backgroundColor: "#FEF3C7" }]}>
                <Sparkles size={16} color="#D97706" />
              </View>
              <View>
                <AppText style={[styles.title, { color: colors.text, fontFamily: fontFamily.bodyBold }]}>
                  {title}
                </AppText>
                <AppText style={[styles.subtitle, { color: colors.textMuted, fontFamily: fontFamily.body }]}>
                  Single-tap to edit values or fix scan ambiguities
                </AppText>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* List of Extracted Items */}
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
            {items.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
                    TEST / MEDICATION NAME
                  </AppText>
                  <TextInput
                    value={item.name}
                    onChangeText={(text) => handleUpdateItem(item.id, "name", text)}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
                      VALUE
                    </AppText>
                    <TextInput
                      value={String(item.value ?? "")}
                      onChangeText={(text) => handleUpdateItem(item.id, "value", text)}
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted }}>
                      UNIT
                    </AppText>
                    <TextInput
                      value={item.unit || ""}
                      onChangeText={(text) => handleUpdateItem(item.id, "unit", text)}
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. mg/dL"
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderColor: colors.border }]}>
            <Button variant="outline" onPress={onClose} disabled={saving} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button variant="primary" onPress={handleSave} loading={saving} style={{ flex: 1 }}>
              Confirm & Save
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  container: {
    maxHeight: "85%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  sparkleBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
  },
  itemCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
});
