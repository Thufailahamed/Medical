// @ts-nocheck

import { View, Text, ScrollView, Platform, StyleSheet } from "react-native";
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
  const { spacing, colors, typography, shadow, scheme } = useTheme();
  const cardShadow = scheme === "dark" ? null : shadow.sm;
  const cardEdge = scheme === "dark" ? colors.borderStrong : colors.separator;
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
          <Skeleton height={220} radius={28} />
          <Skeleton height={96} radius={22} />
          <Skeleton height={160} radius={22} />
          <Skeleton height={100} radius={22} />
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
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Hero Doctor Card ── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 28,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: cardEdge,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xxl,
            paddingBottom: spacing.xl,
            alignItems: "center",
            gap: spacing.md,
            ...cardShadow,
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
                typography.display.sm,
                { color: colors.text, textAlign: "center" },
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
                <Building2 size={14} color={colors.textSubtle} />
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
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
            borderRadius: 22,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: cardEdge,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.xs,
            ...cardShadow,
          }}
        >
          {/* Stat 1: Experience */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={18} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text
              style={[typography.title.md, { color: colors.text, marginTop: 2 }]}
              numberOfLines={1}
            >
              {doctor.experience != null && Number(doctor.experience) > 0
                ? t("doctorDetail.experienceYears", { years: doctor.experience })
                : "Verified"}
            </Text>
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              {t("doctorDetail.experience")}
            </Text>
          </View>

          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: 6 }} />

          {/* Stat 2: Fee */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet size={18} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text
              style={[typography.title.md, { color: colors.text, marginTop: 2 }]}
              numberOfLines={1}
            >
              {doctor.consultationFee != null
                ? t("doctorDetail.feeLkr", {
                    amount: Number(doctor.consultationFee).toLocaleString(),
                  })
                : "At Clinic"}
            </Text>
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              {t("doctorDetail.fee")}
            </Text>
          </View>

          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: 6 }} />

          {/* Stat 3: Consultation Mode */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                borderCurve: "continuous",
                backgroundColor: telemedicineEnabled ? colors.successSoft : colors.fill,
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
                typography.title.md,
                { color: telemedicineEnabled ? colors.success : colors.text, marginTop: 2 },
              ]}
            >
              {telemedicineEnabled ? "Video & Visit" : "In-Person"}
            </Text>
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              Consultation
            </Text>
          </View>
        </View>

        {/* ── 3. Consultation Options Card ── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 22,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: cardEdge,
            padding: spacing.lg,
            gap: spacing.md,
            ...cardShadow,
          }}
        >
          <Text style={[typography.title.md, { color: colors.text }]}>
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
                borderCurve: "continuous",
                backgroundColor: colors.fill,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={19} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.xs, { color: colors.text }]}>
                  Hospital Clinic Visit
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}>
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
                borderCurve: "continuous",
                backgroundColor: telemedicineEnabled ? colors.successSoft : colors.fill,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: telemedicineEnabled ? colors.success : colors.fillStrong,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Video
                  size={19}
                  color={telemedicineEnabled ? colors.onPrimary : colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.xs, { color: colors.text }]}>
                  {telemedicineEnabled
                    ? t("doctorDetail.onlineAvailable")
                    : t("doctorDetail.onlineUnavailable")}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}>
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
              borderRadius: 22,
              borderCurve: "continuous",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: cardEdge,
              padding: spacing.lg,
              gap: spacing.sm,
              ...cardShadow,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textSubtle }]}>
                  {t("doctorDetail.hospital")}
                </Text>
                <Text style={[typography.title.md, { color: colors.text, marginTop: 2 }]}>
                  {doctor.hospitalName}
                </Text>
                {doctor.hospitalAddress ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <MapPin size={13} color={colors.textSubtle} />
                    <Text style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}>
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
              borderRadius: 22,
              borderCurve: "continuous",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: cardEdge,
              padding: spacing.lg,
              gap: spacing.sm,
              ...cardShadow,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GraduationCap size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textSubtle }]}>
                  {t("doctorDetail.qualifications")}
                </Text>
                <Text style={[typography.body.md, { color: colors.text, marginTop: 2 }]}>
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
          backgroundColor: scheme === "dark" ? colors.bgElevated : colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          ...(scheme === "dark"
            ? null
            : Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -3 },
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                },
                android: {
                  elevation: 8,
                },
              })),
        }}
      >
        {doctor.consultationFee != null ? (
          <View style={{ gap: 1 }}>
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              {t("doctorDetail.fee")}
            </Text>
            <Text style={[typography.display.sm, { color: colors.text, fontSize: 20, lineHeight: 25 }]}>
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