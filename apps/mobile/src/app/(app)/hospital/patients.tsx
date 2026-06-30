// @ts-nocheck

import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";
import {
  UserRound,
  Bed,
  ChevronRight,
  Clock4,
  Droplet,
} from "lucide-react-native";
import { useHospitalPatients } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Pill as PillCmp,
  EmptyState,
  Skeleton,
} from "@/components/ui";

export default function HospitalPatients() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading } = useHospitalPatients();
  const list = data?.patients || [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("hospitalPatients.title")}
        subtitle={t("hospitalPatients.subtitle", { count: list.length })}
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={88} radius={20} />
          ))}
        </View>
      ) : list.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={UserRound}
            title={t("hospitalPatients.emptyTitle")}
            message={t("hospitalPatients.emptyBody")}
            tone="neutral"
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {list.map((p: any) => (
            <Card
              key={p.assignmentId}
              onPress={() =>
                router.push({
                  pathname: "/hospital/patient-detail",
                  params: { id: p.patientId },
                })
              }
              padded={false}
              accessibilityLabel={t("hospitalPatients.patientA11y", { name: p.patientName })}
            >
              <View
                style={{
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Avatar
                  name={p.patientName}
                  size="md"
                  tone="primary"
                  source={p.patientPhoto ? { uri: p.patientPhoto } : undefined}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {p.patientName}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {p.patientPhone || t("hospitalPatients.noPhone")}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      marginTop: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <PillCmp
                      icon={Bed}
                      label={`${p.wardName} · ${p.bedNumber}`}
                      tone="primary"
                      size="sm"
                    />
                    {p.bloodGroup ? (
                      <PillCmp
                        icon={Droplet}
                        label={p.bloodGroup}
                        tone="danger"
                        size="sm"
                      />
                    ) : null}
                    <PillCmp
                      icon={Clock4}
                      label={fmtDate(new Date(p.assignedAt), locale)}
                      tone="neutral"
                      size="sm"
                    />
                  </View>
                </View>
                <ChevronRight
                  size={18}
                  color={colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}