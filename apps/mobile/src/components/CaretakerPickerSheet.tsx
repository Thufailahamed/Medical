// Caretaker Profiles: bottom sheet for caretakers to pick which
// principal patient to manage. Mirror of FamilyPickerSheet.

import { View, Text, ScrollView, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { BottomSheet, Avatar } from "@/components/ui";
import { useMyPrincipals } from "@/hooks/useCaretaker";
import { useActivePrincipalStore } from "@/stores/activePrincipal";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onPick: (id: string | null) => void;
  title: string;
};

export function CaretakerPickerSheet({
  visible,
  onDismiss,
  onPick,
  title,
}: Props) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { data } = useMyPrincipals();
  const activeId = useActivePrincipalStore((s) => s.activePrincipalPatientId);

  const principals = data?.principals ?? [];

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title={title}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.lg, gap: spacing.xs }}
      >
        {principals.length === 0 ? (
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: "center",
              paddingVertical: spacing.lg,
            }}
          >
            {t("caretaker.noPrincipals")}
          </Text>
        ) : null}

        {principals.map((p) => {
          const selected = p.patientId === activeId;
          return (
            <Pressable
              key={p.patientId}
              onPress={() => onPick(p.patientId)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.sm,
                borderRadius: 12,
                backgroundColor: pressed
                  ? colors.surfaceMuted
                  : "transparent",
              })}
            >
              <Avatar
                uri={p.principalPhoto ?? undefined}
                name={p.principalName}
                size={36}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.text }}>
                  {p.principalName}
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                  }}
                >
                  {t(`caretaker.role.${p.careRole}`)}
                </Text>
              </View>
              {selected ? (
                <Check size={18} color={colors.primary} strokeWidth={2.25} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}