// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
} from "react-native";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import {
  Stethoscope,
  Pill,
  FlaskConical,
  CalendarClock,
  ClipboardList,
  Activity,
  FileText,
  Hash,
  Clock,
  Building2,
  Sparkles,
  MessageCircle,
  ChevronRight,
  Video,
  XCircle,
  CalendarPlus,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react-native";
import {
  useAppointmentRecords,
  useMyAppointments,
  useRescheduleAppointment,
  useCancelAppointment,
  useActiveTeleconsultSession,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  PillTone,
  EmptyState,
  Skeleton,
  ErrorState,
  Button,
  SectionHeader,
  BottomSheet,
  FormField,
  TextInput,
  useToast,
  VerifiedBadgeWithRegNo,
} from "@/components/ui";

const STATUS_TONE: Record<string, PillTone> = {
  scheduled: "primary",
  confirmed: "success",
  in_progress: "primary",
  completed: "info",
  cancelled: "neutral",
  no_show: "danger",
};

const RECORD_ICONS: Record<string, any> = {
  clinical_note: Stethoscope,
  prescription: Pill,
  lab_order: FlaskConical,
  follow_up: CalendarClock,
  lab_report: FlaskConical,
  hospital_visit: Building2,
};

function formatAppointmentDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split(/[-/]/).map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts[0] > 1000 ? parts : [parts[2], parts[1], parts[0]];
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getInitials(name?: string | null) {
  if (!name) return "DR";
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (cleaned.slice(0, 2) || "DR").toUpperCase();
}

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, scheme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const waSupportPhone: string =
    (Constants.expoConfig?.extra as any)?.waSupportPhone || "";

  function openSupportChat() {
    if (!waSupportPhone) return;
    const text = encodeURIComponent(
      `Hi HealthHub, I need help with my appointment${id ? ` (${id})` : ""}.`
    );
    Linking.openURL(`https://wa.me/${waSupportPhone}?text=${text}`);
  }

  // 1. Check cached appointments from the list to avoid showing an error/spinner
  const { data: myApptsData } = useMyAppointments();
  const cachedAppt = useMemo(() => {
    return (myApptsData?.appointments || []).find(
      (a: any) => String(a.id) === String(id)
    );
  }, [myApptsData, id]);

  // 2. Fetch full records
  const { data, isLoading, isError, refetch } = useAppointmentRecords(id || null);
  const reschedule = useRescheduleAppointment();
  const { data: activeSession } = useActiveTeleconsultSession();
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const appt = data?.appointment || cachedAppt;
  const doctor = data?.doctor || (appt ? {
    name: appt.doctorName,
    specialization: appt.doctorSpecialization,
    slmcRegistrationNo: appt.slmcRegistrationNo,
    slmcVerifiedAt: appt.slmcVerifiedAt,
  } : null);
  const records: any[] = data?.records || [];

  function startReschedule() {
    if (!appt) return;
    setNewDate(appt.date);
    setNewTime(appt.time);
    setReschedOpen(true);
  }

  async function submitReschedule() {
    if (!id || !newDate || !newTime) {
      toast.show(t("appointmentDetail.dateTimeRequired"), "warning");
      return;
    }
    try {
      await reschedule.mutateAsync({ id, date: newDate, time: newTime });
      toast.show(t("appointmentDetail.rescheduleSuccess"), "success");
      setReschedOpen(false);
      refetch();
    } catch (err: any) {
      toast.show(
        err?.message || t("appointmentDetail.rescheduleError"),
        "danger"
      );
    }
  }

  const cancelMutation = useCancelAppointment();

  function confirmCancel() {
    if (!id) return;
    Alert.alert(
      t("appointmentDetail.cancelConfirmTitle"),
      t("appointmentDetail.cancelConfirmMessage"),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("appointmentDetail.cancelConfirmAction"),
          style: "destructive",
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(id);
              toast.show(t("appointmentDetail.cancelSuccess"), "success");
              refetch();
            } catch (err: any) {
              toast.show(
                err?.message || t("appointmentDetail.cancelError"),
                "danger"
              );
            }
          },
        },
      ]
    );
  }

  const doctorDisplayName =
    (doctor?.firstName
      ? `${doctor.firstName} ${doctor.lastName ?? ""}`.trim()
      : doctor?.name) ||
    appt?.doctorName ||
    t("appointments.fallbackTitle", { defaultValue: "Doctor" });

  const specialization =
    doctor?.specialization || appt?.doctorSpecialization || appt?.specialty || null;

  const hospitalName =
    appt?.hospitalName || (appt?.mode === "video" ? t("appointments.mode.video") : null);

  const formattedDate = formatAppointmentDate(appt?.date);
  const isLiveVideo =
    activeSession?.session?.appointmentId === id &&
    activeSession?.session?.roomId;

  return (
    <Screen keyboard padded={false} bottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("appointmentDetail.title", { defaultValue: "Appointment" })}
        />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            gap: spacing.lg,
            paddingBottom: spacing.xxl * 2,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isLoading && !appt ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={160} radius={radius.card} />
              <Skeleton height={180} radius={radius.card} />
            </View>
          ) : isError && !appt ? (
            <ErrorState
              title={t("appointmentDetail.errorTitle", { defaultValue: "Couldn't load appointment" })}
              message={t("appointmentDetail.errorBody", { defaultValue: "Check your connection and try again." })}
              actionLabel={t("common.retry", { defaultValue: "Retry" })}
              onAction={() => refetch()}
            />
          ) : !appt ? (
            <EmptyState
              icon={ClipboardList}
              title={t("appointmentDetail.notFoundTitle")}
              message={t("appointmentDetail.notFoundBody")}
            />
          ) : (
            <>
              {/* ─── Hero Doctor & Status Card ─── */}
              <Card padded={false} style={{ borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden" }}>
                <LinearGradient
                  colors={[withOpacity(colors.primary, scheme === "dark" ? 0.2 : 0.1), withOpacity(colors.primary, 0)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.6, y: 1 }}
                  style={{ padding: spacing.xl, gap: spacing.lg }}
                >
                  {/* Status & Mode badges row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: spacing.xs,
                      flexWrap: "wrap",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" }}>
                      <PillCmp
                        label={
                          t(`appointments.statusLabel.${appt.status}`, {
                            defaultValue: appt.status.replace("_", " "),
                          }) as string
                        }
                        tone={STATUS_TONE[appt.status] || "neutral"}
                        size="sm"
                      />
                      {appt.mode === "video" ? (
                        <PillCmp
                          icon={Video}
                          label={t("appointments.mode.video")}
                          tone="primary"
                          size="sm"
                        />
                      ) : appt.mode === "in_person" ? (
                        <PillCmp
                          icon={Stethoscope}
                          label={t("appointments.mode.inPerson")}
                          tone="neutral"
                          size="sm"
                        />
                      ) : null}
                    </View>

                    {appt.queueNumber ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: spacing.md,
                          paddingVertical: 5,
                          borderRadius: radius.full,
                          backgroundColor: colors.primarySoft,
                        }}
                      >
                        <Hash size={12} color={colors.primary} strokeWidth={2.5} />
                        <Text style={[typography.label.sm, { color: colors.primary }]}>
                          Queue #{appt.queueNumber}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Doctor Profile Banner */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <LinearGradient
                      colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={[
                          typography.title.lg,
                          { color: "#FFFFFF", letterSpacing: 0.5 },
                        ]}
                      >
                        {getInitials(doctorDisplayName)}
                      </Text>
                    </LinearGradient>

                    <View style={{ flex: 1, gap: 3 }}>
                      <Text
                        style={[
                          typography.display.sm,
                          { color: colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {doctorDisplayName}
                      </Text>

                      {specialization ? (
                        <Text
                          style={[typography.label.lg, { color: colors.primary }]}
                          numberOfLines={1}
                        >
                          {specialization}
                        </Text>
                      ) : null}

                      {hospitalName ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                          <Building2 size={13} color={colors.textSubtle} strokeWidth={2} />
                          <Text
                            style={[typography.body.sm, { color: colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {hospitalName}
                          </Text>
                        </View>
                      ) : null}

                      {doctor?.slmcRegistrationNo || doctor?.slmcVerifiedAt ? (
                        <View style={{ marginTop: 2 }}>
                          <VerifiedBadgeWithRegNo
                            verified={!!doctor.slmcVerifiedAt}
                            regNo={doctor.slmcRegistrationNo}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                </LinearGradient>
              </Card>

              {/* ─── Schedule Details Card ─── */}
              <Card padded={false} style={{ borderRadius: radius.card, borderCurve: "continuous", padding: spacing.lg }}>
                <View style={{ gap: spacing.md }}>
                  <Text style={[typography.title.md, { color: colors.text }]}>
                    Visit Schedule
                  </Text>

                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    {/* Date Block */}
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        padding: spacing.md,
                        backgroundColor: colors.fill,
                        borderRadius: 16,
                        borderCurve: "continuous",
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          borderCurve: "continuous",
                          backgroundColor: colors.primarySoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Calendar size={18} color={colors.primary} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.caption, { color: colors.textSubtle }]}>Date</Text>
                        <Text
                          style={[typography.title.xs, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {formattedDate}
                        </Text>
                      </View>
                    </View>

                    {/* Time Block */}
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        padding: spacing.md,
                        backgroundColor: colors.fill,
                        borderRadius: 16,
                        borderCurve: "continuous",
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          borderCurve: "continuous",
                          backgroundColor: colors.primarySoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Clock size={18} color={colors.primary} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.caption, { color: colors.textSubtle }]}>Time</Text>
                        <Text
                          style={[typography.title.xs, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {appt.time || "—"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Mode / Location Info Banner */}
                  {appt.mode === "video" ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        padding: spacing.md,
                        backgroundColor: colors.primarySoft,
                        borderRadius: 16,
                        borderCurve: "continuous",
                      }}
                    >
                      <Video size={18} color={colors.primary} strokeWidth={2.2} />
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.title.xs, { color: colors.primary }]}>
                          Online Video Visit
                        </Text>
                        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                          Consult directly from your phone. Join when doctor opens the call.
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        padding: spacing.md,
                        backgroundColor: colors.fill,
                        borderRadius: 16,
                        borderCurve: "continuous",
                      }}
                    >
                      <Building2 size={18} color={colors.textMuted} strokeWidth={2} />
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.title.xs, { color: colors.text }]}>
                          {appt.hospitalName || "Hospital Consultation Desk"}
                        </Text>
                        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                          Please arrive 15 minutes before your slot and present queue #{appt.queueNumber || "1"}.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </Card>

              {/* ─── Live Video Call CTA (if applicable) ─── */}
              {isLiveVideo ? (
                <Button
                  title={t("consult.joinVideoVisit", { defaultValue: "Join Video Visit Now" })}
                  icon={Video}
                  variant="primary"
                  size="lg"
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/teleconsult/[roomId]" as any,
                      params: { roomId: activeSession.session!.roomId },
                    })
                  }
                />
              ) : appt.mode === "video" && (appt.bucket === "today" || appt.isLive) ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.sm,
                    minHeight: 52,
                    padding: spacing.md,
                    backgroundColor: colors.fill,
                    borderRadius: radius.button,
                    borderCurve: "continuous",
                  }}
                >
                  <Video size={18} color={colors.textMuted} strokeWidth={2.2} />
                  <Text style={[typography.label.md, { color: colors.textMuted }]}>
                    {appt.isLive
                      ? t("appointments.waitingForDoctor")
                      : t("appointments.startsSoon")}
                  </Text>
                </View>
              ) : null}

              {/* ─── Reason & Notes ─── */}
              {appt.reason || appt.notes ? (
                <Card padded={false} style={{ borderRadius: radius.card, borderCurve: "continuous", padding: spacing.lg }}>
                  <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.title.md, { color: colors.text }]}>
                      Visit Notes & Reason
                    </Text>
                    {appt.reason ? (
                      <Text style={[typography.body.md, { color: colors.text, marginTop: 4 }]}>
                        {appt.reason}
                      </Text>
                    ) : null}
                    {appt.notes ? (
                      <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                        {appt.notes}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ) : null}

              {/* ─── Actions Row (Reschedule, Cancel, Book Again) ─── */}
              {["scheduled", "confirmed"].includes(appt.status) ? (
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("appointmentDetail.reschedule", { defaultValue: "Reschedule" })}
                      icon={CalendarClock}
                      variant="secondary"
                      size="md"
                      onPress={startReschedule}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("appointmentDetail.cancel", { defaultValue: "Cancel visit" })}
                      icon={XCircle}
                      variant="danger"
                      size="md"
                      loading={cancelMutation.isPending}
                      onPress={confirmCancel}
                    />
                  </View>
                </View>
              ) : null}

              {appt.bucket === "missed" ? (
                <Button
                  title={t("appointments.bookAgain", { defaultValue: "Book Again with Doctor" })}
                  icon={CalendarPlus}
                  variant="primary"
                  size="lg"
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/book-appointment" as any,
                      params: { prefillDoctorId: appt.doctorId ?? "" },
                    })
                  }
                />
              ) : null}

              {/* ─── Records tied to this appointment ─── */}
              <View style={{ marginTop: spacing.sm, marginBottom: -spacing.xs }}>
                <SectionHeader
                  title={t("appointmentDetail.visitNotes", {
                    count: records.length,
                    defaultValue: `Visit Notes & Documents (${records.length})`,
                  })}
                />
              </View>

              {records.length === 0 ? (
                <Card padded={false} style={{ borderRadius: radius.card, borderCurve: "continuous", padding: spacing.lg }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: colors.fill,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FileText size={18} color={colors.textMuted} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.title.sm, { color: colors.text }]}>
                        {t("appointmentDetail.recordsEmptyTitle", { defaultValue: "No records yet" })}
                      </Text>
                      <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                        {t("appointmentDetail.recordsEmptyBody", { defaultValue: "Prescriptions and notes from this consultation will appear here." })}
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {records.map((r: any) => {
                    const Icon = RECORD_ICONS[r.recordType] || Stethoscope;
                    const labelKey = `appointmentDetail.recordLabel.${r.recordType}`;
                    const label = t(labelKey, {
                      defaultValue: r.recordType.replace("_", " "),
                    });
                    return (
                      <Card key={r.id} padded={false} style={{ borderRadius: radius.card, borderCurve: "continuous", padding: spacing.lg }}>
                        <View style={{ gap: spacing.sm }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, marginRight: spacing.sm }}>
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 10,
                                  borderCurve: "continuous",
                                  backgroundColor: colors.primarySoft,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Icon size={16} color={colors.primary} />
                              </View>
                              <Text
                                style={[
                                  typography.title.sm,
                                  { color: colors.text, flex: 1 },
                                ]}
                                numberOfLines={1}
                              >
                                {r.title || label}
                              </Text>
                            </View>
                            <PillCmp label={label} tone="primary" size="sm" />
                          </View>

                          {r.diagnosis ? (
                            <Text style={[typography.body.md, { color: colors.text, marginTop: 2 }]}>
                              <Text style={typography.label.lg}>
                                {t("appointmentDetail.dxPrefix", { defaultValue: "Dx: " })}
                              </Text>
                              {r.diagnosis}
                            </Text>
                          ) : null}

                          {r.summary ? (
                            <Text
                              style={[typography.body.sm, { color: colors.textMuted }]}
                              numberOfLines={4}
                            >
                              {r.summary}
                            </Text>
                          ) : null}

                          {r.followUpDate ? (
                            <View style={{ alignSelf: "flex-start", marginTop: 4 }}>
                              <PillCmp
                                icon={CalendarClock}
                                label={t("appointmentDetail.followUpPill", {
                                  date: r.followUpDate,
                                  defaultValue: `Follow-up: ${r.followUpDate}`,
                                })}
                                tone="warning"
                                size="sm"
                              />
                            </View>
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}

              {/* ─── Rate Visit (Completed) ─── */}
              {appt?.status === "completed" && !data?.rating ? (
                <Card style={{ borderRadius: radius.card, borderCurve: "continuous" }}>
                  <Text
                    style={[
                      typography.title.md,
                      { color: colors.text, marginBottom: spacing.xs },
                    ]}
                  >
                    {t("appointmentDetail.rateTitle")}
                  </Text>
                  <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                    {t("appointmentDetail.rateBody", {
                      name: doctorDisplayName,
                    })}
                  </Text>
                  <Button
                    title={t("appointmentDetail.rateCta")}
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/rate-visit/[appointmentId]" as any,
                        params: { appointmentId: id as string },
                      })
                    }
                    variant="secondary"
                    size="md"
                    style={{ marginTop: spacing.md }}
                    iconLeft={Sparkles}
                  />
                </Card>
              ) : null}

              {appt?.status === "completed" && data?.rating ? (
                <Card style={{ borderRadius: radius.card, borderCurve: "continuous" }}>
                  <Text
                    style={[
                      typography.title.md,
                      { color: colors.text, marginBottom: spacing.xs },
                    ]}
                  >
                    {t("appointmentDetail.youRated", {
                      stars: data.rating.stars,
                    })}
                  </Text>
                  {data.rating.comment ? (
                    <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                      {data.rating.comment}
                    </Text>
                  ) : null}
                </Card>
              ) : null}

              {/* ─── Support Banner ─── */}
              {waSupportPhone ? (
                <Pressable
                  onPress={openSupportChat}
                  accessibilityRole="link"
                  accessibilityLabel={t("appointmentDetail.helpCta")}
                  style={({ pressed }) => ({
                    backgroundColor: colors.primarySoft,
                    opacity: pressed ? 0.75 : 1,
                    borderRadius: radius.card,
                    borderCurve: "continuous",
                    padding: spacing.lg,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MessageCircle size={20} color={colors.onPrimary} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text },
                      ]}
                    >
                      {t("appointmentDetail.helpCta")}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                    >
                      {t("appointmentDetail.helpBody")}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.primary} strokeWidth={2.5} />
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>

        <BottomSheet
          visible={reschedOpen}
          onDismiss={() => setReschedOpen(false)}
          title={t("appointmentDetail.rescheduleSheetTitle")}
        >
          <View style={{ paddingVertical: spacing.sm, gap: spacing.lg }}>
            <FormField label={t("appointmentDetail.newDateLabel")}>
              <TextInput
                value={newDate}
                onChangeText={setNewDate}
                placeholder={t("appointmentDetail.newDatePlaceholder")}
              />
            </FormField>
            <FormField label={t("appointmentDetail.newTimeLabel")}>
              <TextInput
                value={newTime}
                onChangeText={setNewTime}
                placeholder={t("appointmentDetail.newTimePlaceholder")}
              />
            </FormField>
            <Button
              title={t("appointmentDetail.save")}
              icon={Sparkles}
              onPress={submitReschedule}
              loading={reschedule.isPending}
            />
          </View>
        </BottomSheet>
      </KeyboardAvoidingView>
    </Screen>
  );
}