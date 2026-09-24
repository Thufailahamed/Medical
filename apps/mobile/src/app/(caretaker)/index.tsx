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
import { BadgeCheck, ChevronRight, Users } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Card, Pill, Avatar, EmptyState } from "@/components/ui";
import {
  useMyPrincipals,
  useSetActivePrincipal,
} from "@/hooks/useCaretaker";
import { useMyVerification } from "@/hooks/useCaretakerVerification";
import { useActivePrincipalStore } from "@/stores/activePrincipal";
import { useQueryClient } from "@tanstack/react-query";

export default function CaretakerIndex() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { data, isLoading } = useMyPrincipals();
  const { data: verification } = useMyVerification();
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
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 132, gap: spacing.md }}
      >
        <View style={{ gap: 6, marginBottom: spacing.sm }}>
          <Text style={{ ...typography.display.lg, color: colors.text }}>
            {t("caretaker.title")}
          </Text>
          <Text
            style={{ ...typography.body.md, color: colors.textMuted, lineHeight: 22 }}
          >
            {t("caretaker.subtitle")}
          </Text>
        </View>

        {/* Verified Caretaker Tier banner — caretakers see their own
            status at the top of the picker so it's visible the first
            time they open the app. Tap-through link to /profile. */}
        {verification?.verified ? (
          <Pill
            label={t("caretaker.verification.verified")}
            tone="success"
            icon={<BadgeCheck size={12} />}
            style={{ alignSelf: "flex-start" }}
          />
        ) : null}

        {(data?.principals ?? []).length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("caretaker.noPrincipals")}
            tone="primary"
            style={{ marginTop: spacing.xl }}
          />
        ) : null}

        {(data?.principals ?? []).map((p) => (
          <Card
            key={p.patientId}
            onPress={() => pick(p.patientId)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              minHeight: 76,
            }}
          >
            <Avatar
              uri={p.principalPhoto ?? undefined}
              name={p.principalName}
              size="md"
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ ...typography.title.md, color: colors.text }}>
                {p.principalName}
              </Text>
              <Text
                style={{
                  ...typography.body.sm,
                  color: colors.textMuted,
                }}
              >
                {t(`caretaker.role.${p.careRole}`)}
              </Text>
            </View>
            <Pill
              label={t("caretaker.link.active")}
              tone="primary"
              size="sm"
            />
            <ChevronRight size={18} color={colors.textSubtle} />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}