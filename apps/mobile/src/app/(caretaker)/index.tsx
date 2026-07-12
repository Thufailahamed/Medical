// @ts-nocheck

// Caretaker Profiles: caretaker home landing. Two states:
//   - No active principal → picker screen (list of linked patients).
//   - Active principal selected → redirect into (app)/index so the
//     existing principal-facing screens render (Caretaker has full
//     management per Phase 4, so writes still work).

import { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Card, Pill, Avatar } from "@/components/ui";
import {
  useMyPrincipals,
  useSetActivePrincipal,
} from "@/hooks/useCaretaker";
import { useActivePrincipalStore } from "@/stores/activePrincipal";
import { useQueryClient } from "@tanstack/react-query";

export default function CaretakerIndex() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { data, isLoading } = useMyPrincipals();
  const setActive = useActivePrincipalStore(
    (s) => s.setActivePrincipalPatientId
  );
  const setServer = useSetActivePrincipal();
  const active = useActivePrincipalStore((s) => s.activePrincipalPatientId);
  const qc = useQueryClient();

  // If user has an active principal + at least one row, jump into the
  // principal's home screen.
  if (!isLoading && active && data?.principals?.some((p) => p.patientId === active)) {
    return <Redirect href={"/(app)/index" as any} />;
  }

  async function pick(patientId: string) {
    setActive(patientId);
    try {
      await setServer.mutateAsync(patientId);
    } catch {
      // ignore
    }
    qc.invalidateQueries();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        <Text style={{ ...typography.h2, color: colors.text }}>
          {t("caretaker.title")}
        </Text>
        <Text
          style={{ ...typography.body, color: colors.textSecondary }}
        >
          {t("caretaker.subtitle")}
        </Text>

        {(data?.principals ?? []).length === 0 ? (
          <Card>
            <Text
              style={{
                ...typography.body,
                color: colors.textMuted,
              }}
            >
              {t("caretaker.noPrincipals")}
            </Text>
          </Card>
        ) : null}

        {(data?.principals ?? []).map((p) => (
          <Card
            key={p.patientId}
            onPress={() => pick(p.patientId)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Avatar
              uri={p.principalPhoto ?? undefined}
              name={p.principalName}
              size={42}
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
            <Pill
              label={t("caretaker.link.active")}
              tone="primary"
            />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}