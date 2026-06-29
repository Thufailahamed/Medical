// @ts-nocheck
import { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Users, UserMinus } from "lucide-react-native";
import { useFamilyMembers } from "@/hooks/useApi";
import { BottomSheet } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onPick: (familyMemberId: string | null) => void;
  title?: string;
};

export function FamilyPickerSheet({
  visible,
  onDismiss,
  onPick,
  title = "Move to family member",
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const { data, isLoading } = useFamilyMembers();
  const members: any[] = useMemo(
    () => (Array.isArray(data?.family) ? data!.family : []),
    [data]
  );

  function Row({
    label,
    sub,
    icon: Icon,
    onPress,
  }: any) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          borderTopWidth: 1,
          borderTopColor: colors.border,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "700" },
            ]}
          >
            {label}
          </Text>
          {sub ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {sub}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title={title}>
      <ScrollView
        style={{ maxHeight: 360 }}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
      >
        <Row
          icon={UserMinus}
          label="Unassign (back to you)"
          sub="Removes the family member association"
          onPress={() => {
            onPick(null);
            onDismiss();
          }}
        />
        {isLoading ? (
          <View style={{ padding: spacing.lg }}>
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>
              Loading…
            </Text>
          </View>
        ) : members.length === 0 ? (
          <View style={{ padding: spacing.lg }}>
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>
              No family members yet. Add one from the Family screen first.
            </Text>
          </View>
        ) : (
          members.map((m: any) => (
            <Row
              key={m.id}
              icon={Users}
              label={m.name}
              sub={m.relationship || ""}
              onPress={() => {
                onPick(m.id);
                onDismiss();
              }}
            />
          ))
        )}
      </ScrollView>
    </BottomSheet>
  );
}