import { View, Text, Pressable, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Users, ChevronRight } from "lucide-react-native";
import { useDoctorCareTeamPatients } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Avatar,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import type { PillTone } from "@/components/ui/Pill";
import { parseDob } from "@/lib/format";

const ROLE_TONE: Record<string, PillTone> = {
  primary_care: "success",
  specialist: "primary",
  covering: "warning",
  on_call: "info",
  family_view: "danger",
};

export default function DoctorCareTeamScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { data, isLoading } = useDoctorCareTeamPatients();
  const patients: any[] = data?.patients ?? [];

  return (
    <Screen>
      <ScreenHeader
        title={t("careTeam.doctorTitle")}
        subtitle={t("careTeam.doctorSubtitle", { count: patients.length })}
        back
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {isLoading ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Skeleton height={80} />
            <Skeleton height={80} />
          </View>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("careTeam.doctorEmptyTitle")}
            message={t("careTeam.doctorEmptyBody")}
          />
        ) : (
          patients.map((p) => {
            const dob = parseDob(p.patientDob);
            const age = dob
              ? Math.floor(
                  (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                )
              : null;
            return (
              <Pressable
                key={p.careTeamId}
                onPress={() =>
                  router.push({
                    pathname: "/(doctor)/patient-detail",
                    params: { id: p.patientId },
                  })
                }
                style={{ marginHorizontal: 16, marginBottom: 10 }}
              >
                <Card>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Avatar
                      name={p.patientName ?? "Patient"}
                      source={p.patientPhoto ?? undefined}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "600",
                          color: colors.text,
                        }}
                      >
                        {p.patientName}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {[
                          age != null ? `${age}y` : null,
                          p.patientGender,
                          p.patientNic,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                        <Pill
                          label={t(`careTeam.role.${p.role}`)}
                          tone={ROLE_TONE[p.role] ?? "primary"}
                        />
                        {p.scope !== "full" && (
                          <Pill
                            label={t(`careTeam.scope.${p.scope}`)}
                            tone="neutral"
                          />
                        )}
                      </View>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}