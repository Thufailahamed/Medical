// Caretaker Profiles: caretaker-side pill rendered on the home topbar
// when role=caretaker and a principal is selected. Tapping opens
// CaretakerPickerSheet so the user can switch which patient's data
// they are viewing. Mirror of ActiveMemberPill for the caretaker
// surface.

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { UserCircle2 } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useActivePrincipalStore } from "@/stores/activePrincipal";
import { useMyPrincipals, useSetActivePrincipal } from "@/hooks/useCaretaker";
import { CaretakerPickerSheet } from "./CaretakerPickerSheet";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export function ActivePrincipalPill() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const activeId = useActivePrincipalStore((s) => s.activePrincipalPatientId);
  const setActive = useActivePrincipalStore(
    (s) => s.setActivePrincipalPatientId
  );
  const clear = useActivePrincipalStore((s) => s.clear);
  const { data } = useMyPrincipals();
  const setServer = useSetActivePrincipal();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // On first mount, if we have a local id but the server returns a
  // different active principal, accept the server's truth.
  const serverActive = data?.principals?.[0]?.patientId ?? null;
  useEffect(() => {
    if (!activeId && serverActive) setActive(serverActive);
  }, [serverActive, activeId]);

  if (!activeId) return null;

  const principal = (data?.principals || []).find(
    (p) => p.patientId === activeId
  );
  const label = principal?.principalName ?? t("caretaker.pickerTitle");

  async function pick(id: string | null) {
    if (id) setActive(id);
    else clear();
    setOpen(false);
    try {
      await setServer.mutateAsync(id);
    } catch {
      // ignore; subsequent requests revalidate against server column
    }
    qc.invalidateQueries();
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("caretaker.footerActingOnBehalfOf", { name: label })}
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
          style={{
            ...typography.label,
            color: colors.primary,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
      </Pressable>
      <CaretakerPickerSheet
        visible={open}
        onDismiss={() => setOpen(false)}
        onPick={pick}
        title={t("caretaker.pickerTitle")}
      />
    </>
  );
}