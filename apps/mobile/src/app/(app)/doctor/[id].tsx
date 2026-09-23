// @ts-nocheck

import { View, Text, ScrollView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Stethoscope,
  Video,
  GraduationCap,
  Building2,
  Wallet,
  Sparkles,
  Check,
  MapPin,
  BadgeCheck,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Avatar,
  Pill,
  Button,
  VerifiedBadge,
  VerifiedBadgeWithRegNo,
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
  const { spacing, colors, typography, shadow } = useTheme();
  const insets = useSafeAreaInsets();
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
          <Skeleton height={180} radius={24} />
          <Skeleton height={80} radius={20} />
          <Skeleton height={140} radius={20} />
          <Skeleton height={100} radius={20} />
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
    <Screen scroll={false} padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader back title={t("doctorDetail.title")} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl + 20,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Hero Doctor Card ── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            alignItems: "center",
            gap: spacing.sm + 2,
            ...shadow.sm,
          }}
        >
          <View style={{ position: "relative", marginBottom: 2 }}>
            <Avatar
              name={doctor.name}
              source={doctor.photo ? { uri: doctor.photo } : undefined}
              size="xl"
              tone="primary"
            />
            {doctor.slmcVerifiedAt ? (
              <View
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  backgroundColor: colors.surface,
                  borderRadius: 999,
                  padding: 2,
                }}
              >
                <BadgeCheck size={24} color={colors.primary} />
              </View>
            ) : null}
          </View>

          <View style={{ alignItems: "center", gap: 4 }}>
            <Text
              style={[
                typography.title.lg,
                { color: colors.text, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
              ]}
            >
              {doctor.name}
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 6,
                alignItems: "center",
                marginTop: 2,
              }}
            >
              {doctor.specialization ? (
                <Pill label={doctor.specialization} tone="primary" size="md" />
              ) : null}
              {doctor.slmcRegistrationNo ? (
                <VerifiedBadgeWithRegNo
                  verified={!!doctor.slmcVerifiedAt}
                  regNo={doctor.slmcRegistrationNo}
                />
              ) : doctor.slmcVerifiedAt ? (
                <VerifiedBadge verified={true} size="md" />
              ) : null}
            </View>

            {doctor.hospitalName ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <Building2 size={14} color={colors.textMuted} />
                <Text style={[typography.body.sm, { color: colors.textMuted, fontWeight: "500" }]}>
                  {doctor.hospitalName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── 2. Unified Key Highlights Bar (3 Stats) ── */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xs,
            ...shadow.sm,
          }}
        >
          {/* Stat 1: Experience */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={18} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text
              style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}
              numberOfLines={1}
            >
              {doctor.experience != null && Number(doctor.experience) > 0
                ? t("doctorDetail.experienceYears", { years: doctor.experience })
                : "Verified"}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]}>
              {t("doctorDetail.experience")}
            </Text>
          </View>

          <View style={{ width: 1, backgroundColor: colors.borderSoft, marginVertical: 4 }} />

          {/* Stat 2: Fee */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet size={18} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text
              style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}
              numberOfLines={1}
            >
              {doctor.consultationFee != null
                ? t("doctorDetail.feeLkr", {
                    amount: Number(doctor.consultationFee).toLocaleString(),
                  })
                : "At Clinic"}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]}>
              {t("doctorDetail.fee")}
            </Text>
          </View>

          <View style={{ width: 1, backgroundColor: colors.borderSoft, marginVertical: 4 }} />

          {/* Stat 3: Consultation Mode */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: telemedicineEnabled ? colors.successSoft : colors.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Video
                size={18}
                color={telemedicineEnabled ? colors.success : colors.textSubtle}
                strokeWidth={2.2}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                typography.title.sm,
                { color: telemedicineEnabled ? colors.success : colors.text, fontWeight: "800" },
              ]}
            >
              {telemedicineEnabled ? "Video & Visit" : "In-Person"}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]}>
              Consultation
            </Text>
          </View>
        </View>

        {/* ── 3. Consultation Options Card ── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.md,
            ...shadow.sm,
          }}
        >
          <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
            Consultation Options
          </Text>

          <View style={{ gap: spacing.sm }}>
            {/* Hospital Visit */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: 16,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.borderSoft,
                }}
              >
                <Building2 size={19} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label.md, { color: colors.text, fontWeight: "700" }]}>
                  Hospital Clinic Visit
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                  {doctor.hospitalName || "In-person clinical appointment"}
                </Text>
              </View>
              <Pill label="Available" tone="neutral" size="sm" />
            </View>

            {/* Video Consultation */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: 16,
                backgroundColor: telemedicineEnabled ? colors.successSoft : colors.surfaceMuted,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: telemedicineEnabled ? colors.success : colors.borderSoft,
                }}
              >
                <Video
                  size={19}
                  color={telemedicineEnabled ? colors.success : colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label.md, { color: colors.text, fontWeight: "700" }]}>
                  {telemedicineEnabled
                    ? t("doctorDetail.onlineAvailable")
                    : t("doctorDetail.onlineUnavailable")}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                  {telemedicineEnabled
                    ? "Secure video call directly in app"
                    : "Only in-person visits supported"}
                </Text>
              </View>
              <Pill
                label={telemedicineEnabled ? "Available" : "Unavailable"}
                tone={telemedicineEnabled ? "success" : "neutral"}
                size="sm"
                testID={telemedicineEnabled ? "doctor-detail-telemedicine-on" : "doctor-detail-telemedicine-off"}
              />
            </View>
          </View>
        </View>

        {/* ── 4. Hospital & Practice Location ── */}
        {doctor.hospitalName ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.lg,
              gap: spacing.sm,
              ...shadow.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600" }]}>
                  {t("doctorDetail.hospital")}
                </Text>
                <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700", marginTop: 2 }]}>
                  {doctor.hospitalName}
                </Text>
                {doctor.hospitalAddress ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <MapPin size={13} color={colors.textMuted} />
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {doctor.hospitalAddress}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* ── 5. Qualifications & Education ── */}
        {doctor.qualification ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.lg,
              gap: spacing.sm,
              ...shadow.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GraduationCap size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600" }]}>
                  {t("doctorDetail.qualifications")}
                </Text>
                <Text style={[typography.body.md, { color: colors.text, fontWeight: "600", marginTop: 2 }]}>
                  {doctor.qualification}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ── 6. Fixed Bottom Action Bar (Docked & Reachable) ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        }}
      >
        {doctor.consultationFee != null ? (
          <View style={{ gap: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600", fontSize: 11 }]}>
              {t("doctorDetail.fee")}
            </Text>
            <Text style={[typography.title.md, { color: colors.primary, fontWeight: "800" }]}>
              {`LKR ${Number(doctor.consultationFee).toLocaleString()}`}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            title={t("doctorDetail.chooseCta")}
            onPress={() => {
              const targetDocId =
                doctor?.doctorId ||
                doctor?.id ||
                (doctorId && doctorId !== "undefined" ? doctorId : "");
              router.replace({
                pathname: "/(app)/book-appointment",
                params: {
                  prefillDoctorId: targetDocId,
                  prefillHospitalId: doctor?.hospitalId ?? "",
                },
              });
            }}
            icon={Check}
            size="lg"
            variant="primary"
          />
        </View>
      </View>
    </Screen>
  );
}