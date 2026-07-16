// @ts-nocheck

import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Stethoscope,
  Video,
  GraduationCap,
  Building2,
  Wallet,
  Sparkles,
  Check,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Pill,
  Button,
  VerifiedBadgeWithRegNo,
  StatCard,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { useDoctor } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";

// Doctor Booking (Round 6): patient-facing doctor detail screen.
//
// Renders the full doctor profile (specialization, qualification,
// SLMC verification, fee, experience, hospital, telemedicine
// availability) reachable from the booking flow so the patient can
// make an informed choice before committing to a slot.
//
// "Choose this doctor" pops back to /book-appointment with the id
// pre-filled via the `prefill` param. The booking screen reads it
// (see `book-appointment.tsx` for the reader) and advances to step 2.

export default function DoctorDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const doctorId = id || "";

  const { data, isLoading, isError, refetch } = useDoctor(doctorId);
  const doctor = data?.doctor;

  if (isLoading) {
    return (
      <Screen scroll padded={false} edges={["top"]}>
        <ScreenHeader back title={t("doctorDetail.title")} />
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
            paddingTop: spacing.md,
          }}
        >
          <Skeleton height={120} radius={20} />
          <Skeleton height={80} radius={16} />
          <Skeleton height={140} radius={20} />
        </View>
      </Screen>
    );
  }

  if (isError || !doctor) {
    return (
      <Screen scroll padded={false} edges={["top"]}>
        <ScreenHeader back title={t("doctorDetail.title")} />
        <View style={{ padding: spacing.lg }}>
          {isError ? (
            <ErrorState
              title={t("common.error", "Something went wrong")}
              message={t("common.retryHint", "Check your connection and try again.")}
              actionLabel={t("common.retry")}
              onAction={() => refetch()}
            />
          ) : (
            <EmptyState
              icon={Stethoscope}
              title={t("doctorDetail.notFound")}
              tone="neutral"
            />
          )}
        </View>
      </Screen>
    );
  }

  const telemedicineEnabled = !!doctor.telemedicineEnabled;

  return (
    <Screen scroll padded={false} edges={["top"]} bottomInset tabBarOffset>
      <ScreenHeader back title={t("doctorDetail.title")} />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          paddingBottom: spacing.xl,
        }}
      >
        {/* Header card: avatar + name + verified badge */}
        <Card padded tone="primary">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <Avatar name={doctor.name} size="lg" tone="primary" />
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {doctor.name}
              </Text>
              <Text
                style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}
              >
                {doctor.specialization}
              </Text>
              {doctor.slmcRegistrationNo ? (
                <View style={{ marginTop: spacing.xs }}>
                  <VerifiedBadgeWithRegNo
                    verified={!!doctor.slmcVerifiedAt}
                    regNo={doctor.slmcRegistrationNo}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Telemedicine availability — gating chip the booking screen reads */}
        <Card padded>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: telemedicineEnabled
                  ? colors.primarySoft
                  : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Video
                size={20}
                color={telemedicineEnabled ? colors.primary : colors.textSubtle}
                strokeWidth={2.2}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {telemedicineEnabled
                  ? t("doctorDetail.onlineAvailable")
                  : t("doctorDetail.onlineUnavailable")}
              </Text>
              {telemedicineEnabled ? (
                <Pill tone="success" testID="doctor-detail-telemedicine-on">
                  {t("bookAppointment.telemedicineAvailable")}
                </Pill>
              ) : (
                <Pill tone="neutral" testID="doctor-detail-telemedicine-off">
                  {t("bookAppointment.telemedicineOnly")}
                </Pill>
              )}
            </View>
          </View>
        </Card>

        {/* Fee + experience stat row */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <StatCard
              icon={Wallet}
              label={t("doctorDetail.fee")}
              value={
                doctor.consultationFee != null
                  ? t("doctorDetail.feeLkr", {
                      amount: Number(doctor.consultationFee).toLocaleString(),
                    })
                  : "—"
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard
              icon={Sparkles}
              label={t("doctorDetail.experience")}
              value={
                doctor.experience != null
                  ? t("doctorDetail.experienceYears", { years: doctor.experience })
                  : "—"
              }
            />
          </View>
        </View>

        {/* Hospital */}
        {doctor.hospitalName ? (
          <Card padded>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[typography.overline, { color: colors.textMuted, marginBottom: 2 }]}
                >
                  {t("doctorDetail.hospital")}
                </Text>
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  {doctor.hospitalName}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Qualifications */}
        {doctor.qualification ? (
          <Card padded>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GraduationCap
                  size={20}
                  color={colors.primary}
                  strokeWidth={2.2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[typography.overline, { color: colors.textMuted, marginBottom: 2 }]}
                >
                  {t("doctorDetail.qualifications")}
                </Text>
                <Text style={[typography.body.md, { color: colors.text }]}>
                  {doctor.qualification}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* CTA — pops back to booking with the doctor pre-filled */}
        <Button
          title={t("doctorDetail.chooseCta")}
          onPress={() => {
            router.replace({
              pathname: "/(app)/book-appointment",
              params: { prefillDoctorId: doctorId, prefillHospitalId: doctor.hospitalId ?? "" },
            });
          }}
          icon={Check}
          fullWidth
        />
      </View>
    </Screen>
  );
}