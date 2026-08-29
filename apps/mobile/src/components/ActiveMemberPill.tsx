// Phase 2.3: pill rendered on the home topbar when the user is "acting
// as" a family member. Tapping opens the FamilyPickerSheet so they can
// switch. Selecting "Unassign" clears the active member.

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { UserCircle2 } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useActiveFamilyMemberStore } from "@/stores/activeFamilyMember";
import { useFamilyMembers } from "@/hooks/useApi";
import { FamilyPickerSheet } from "./FamilyPickerSheet";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export function ActiveMemberPill() {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius } = useTheme();
  const activeId = useActiveFamilyMemberStore((s) => s.activeFamilyMemberId);
  const setActive = useActiveFamilyMemberStore((s) => s.setActiveFamilyMemberId);
  const clear = useActiveFamilyMemberStore((s) => s.clear);
  const { data } = useFamilyMembers();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Don't render at all when no active FM.
  if (!activeId) return null;

  const member = (data?.family || []).find((m: any) => m.id === activeId);
  const label = member?.name || t("home.activeMemberFallback");

  async function pick(id: string | null) {
    const previousId = activeId;
    if (id) setActive(id);
    else clear();
    setOpen(false);
    try {
      await api("/family/active", {
        method: "PATCH",
        body: { memberId: id },
      });
      qc.invalidateQueries();
    } catch {
      if (previousId) setActive(previousId);
      else clear();
    }
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("home.activeMemberA11y", { name: label })}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingVertical: 6,
          paddingHorizontal: spacing.sm,
          borderRadius: 999,
          backgroundColor: pressed ? colors.primarySoft : colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.primary,
        })}
      >
        <UserCircle2 size={14} color={colors.primary} strokeWidth={2.25} />
        <Text
          numberOfLines={1}
          style={[
            typography.label.md,
            { color: colors.primary, fontWeight: "700" },
          ]}
        >
          {label}
        </Text>
      </Pressable>
      <FamilyPickerSheet
        visible={open}
        onDismiss={() => setOpen(false)}
        onPick={pick}
        title={t("home.activeMemberPickerTitle")}
      />
    </>
  );
}
