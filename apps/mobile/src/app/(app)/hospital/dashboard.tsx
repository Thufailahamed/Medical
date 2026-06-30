// @ts-nocheck

import { useEffect } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Hospital as HospitalIcon,
  Bed,
  Users,
  UserRound,
  Activity,
  ChevronRight,
  Sparkles,
  Plus,
} from "lucide-react-native";
import { useHospitalDashboard } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/stores/auth";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  Avatar,
  Skeleton,
  EmptyState,
  StatCard,
  Button,
} from "@/components/ui";

export default function HospitalDashboard() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (
      user &&
      user.role !== "hospital_admin" &&
      user.role !== "hospital_staff"
    ) {
      router.replace("/");
    }
  }, [user, router]);

  const { data, isLoading } = useHospitalDashboard();
  const occ = data?.occupancy;
  const staff = data?.staffOnShift || [];
  const admissions = data?.admissions || [];

  const isHospital =
    user?.role === "hospital_admin" || user?.role === "hospital_staff";

  if (user && !isHospital) {
    return (
      <Screen padded>
        <EmptyState
          icon={HospitalIcon}
          title={t("hospitalDashboard.portalTitle")}
          message={t("hospitalDashboard.portalBody")}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        title={t("hospitalDashboard.title")}
        subtitle={data?.hospital?.name || t("hospitalDashboard.subtitleFallback")}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {isLoading ? (
          <Skeleton height={140} radius={24} />
        ) : (
          <Card padded={false}>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HospitalIcon
                    size={28}
                    color={colors.primary}
                    strokeWidth={2.2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.md, { color: colors.text }]}>
                    {t("hospitalDashboard.occupied", { rate: occ?.occupancyRate ?? 0 })}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {t("hospitalDashboard.bedsShift", {
                      occupied: occ?.occupied ?? 0,
                      total: occ?.totalBeds ?? 0,
                      shift: data?.shift ?? "",
                    })}
                  </Text>
                </View>
                <PillCmp
                  label={data?.shift || ""}
                  tone="primary"
                  size="sm"
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  flexWrap: "wrap",
                }}
              >
                <PillCmp
                  label={t("hospitalDashboard.availableN", { count: occ?.available ?? 0 })}
                  tone="success"
                  size="sm"
                />
                <PillCmp
                  label={t("hospitalDashboard.cleaningN", { count: occ?.cleaning ?? 0 })}
                  tone="warning"
                  size="sm"
                />
                <PillCmp
                  label={t("hospitalDashboard.maintenanceN", { count: occ?.maintenance ?? 0 })}
                  tone="neutral"
                  size="sm"
                />
              </View>
            </View>
          </Card>
        )}

        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
          }}
        >
          <StatCard
            icon={Bed}
            label={t("hospitalDashboard.statBeds")}
            value={String(occ?.totalBeds ?? 0)}
            tone="primary"
          />
          <StatCard
            icon={Users}
            label={t("hospitalDashboard.statStaff")}
            value={String(staff.length)}
            tone="accent"
          />
          <StatCard
            icon={UserRound}
            label={t("hospitalDashboard.statAdmitted")}
            value={String(admissions.length)}
            tone="info"
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.title.sm, { color: colors.text }]}>
            {t("hospitalDashboard.quickActions")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            <Button
              title={t("hospitalDashboard.actionWards")}
              icon={Bed}
              variant="primary"
              size="sm"
              fullWidth={false}
              onPress={() => router.push("/hospital/wards" as any)}
            />
            <Button
              title={t("hospitalDashboard.actionPatients")}
              icon={UserRound}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => router.push("/hospital/patients" as any)}
            />
            <Button
              title={t("hospitalDashboard.actionStaff")}
              icon={Users}
              variant="outline"
              size="sm"
              fullWidth={false}
              onPress={() => router.push("/hospital/staff" as any)}
            />
          </View>
        </View>

        {admissions.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("hospitalDashboard.currentlyAdmitted")}
            </Text>
            {admissions.slice(0, 5).map((a: any) => (
              <Card
                key={a.assignmentId}
                onPress={() =>
                  router.push({
                    pathname: "/hospital/patient-detail",
                    params: { id: a.patientId },
                  })
                }
                padded={false}
                accessibilityLabel={t("hospitalDashboard.admittedA11y", { name: a.patientName })}
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
                    name={a.patientName}
                    size="md"
                    tone="primary"
                    source={
                      a.patientPhoto ? { uri: a.patientPhoto } : undefined
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[typography.title.sm, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {a.patientName}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                      numberOfLines={1}
                    >
                      {a.wardName} · Bed {a.bedNumber}
                    </Text>
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
        ) : null}

        {staff.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("hospitalDashboard.staffOnShift", { shift: data?.shift ?? "" })}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {staff.map((s: any) => (
                <PillCmp
                  key={s.id}
                  label={`${s.fullName} · ${s.role}`}
                  tone="neutral"
                  size="sm"
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
