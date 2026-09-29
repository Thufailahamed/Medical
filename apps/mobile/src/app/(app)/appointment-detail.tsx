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
  // The records endpoint doesn't carry the list's `bucket`; fall back to the
  // cached list row / status so missed + upcoming states still resolve.
  const bucket = appt?.bucket ?? cachedAppt?.bucket;
  const isMissed = bucket === "missed" || appt?.status === "no_show";
  const isUpcomingVisit =
    ["scheduled", "confirmed"].includes(appt?.status) && !isMissed;
  const dateObj = (() => {
    const m = appt?.date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  })();
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
              {/* ─── Visit ticket: doctor, when, where ─── */}
              <Card padded={false} style={{ borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden" }}>
                <LinearGradient
                  colors={[withOpacity(colors.primary, scheme === "dark" ? 0.18 : 0.08), withOpacity(colors.primary, 0)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{ padding: spacing.lg, gap: spacing.lg }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <LinearGradient
                      colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={[typography.title.md, { color: "#FFFFFF", letterSpacing: 0.5 }]}>
                        {getInitials(doctorDisplayName)}
                      </Text>
                    </LinearGradient>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[typography.title.lg, { color: colors.text }]} numberOfLines={1}>
                        {doctorDisplayName}
                      </Text>
                      {specialization ? (
                        <Text style={[typography.label.md, { color: colors.primary }]} numberOfLines={1}>
                          {specialization}
                        </Text>
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
                    <PillCmp
                      label={
                        t(`appointments.statusLabel.${appt.status}`, {
                          defaultValue: appt.status.replace("_", " "),
                        }) as string
                      }
                      tone={STATUS_TONE[appt.status] || "neutral"}
                      size="sm"
                    />
                  </View>

                  {/* When: date · time · queue */}
                  <View
                    style={{
                      flexDirection: "row",
                      borderRadius: 16,
                      borderCurve: "continuous",
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.hairline,
                      paddingVertical: spacing.md,
                    }}
                  >
                    <TicketCell
                      label={dateObj ? dateObj.toLocaleDateString("en-GB", { weekday: "short" }) : t("appointmentDetail.dateLabel", { defaultValue: "Date" })}
                      value={dateObj ? dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : formattedDate}
                      first
                    />
                    <TicketCell
                      label={t("appointmentDetail.timeLabel", { defaultValue: "Time" })}
                      value={appt.time || "—"}
                    />
                    {appt.queueNumber ? (
                      <TicketCell
                        label={t("appointmentDetail.queueLabel", { defaultValue: "Queue" })}
                        value={`#${appt.queueNumber}`}
                        accent
                      />
                    ) : null}
                  </View>

                  {/* Where + contextual hint */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                    {appt.mode === "video" ? (
                      <Video size={18} color={colors.primary} strokeWidth={2.2} style={{ marginTop: 1 }} />
                    ) : (
                      <Building2 size={18} color={colors.textMuted} strokeWidth={2.1} style={{ marginTop: 1 }} />
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[typography.title.xs ?? typography.title.sm, { color: colors.text }]}>
                        {appt.mode === "video"
                          ? t("appointmentDetail.videoTitle", { defaultValue: "Video visit" })
                          : appt.hospitalName ||
                            t("appointmentDetail.inPersonTitle", { defaultValue: "In-person visit" })}
                      </Text>
                      {isUpcomingVisit ? (
                        <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                          {appt.mode === "video"
                            ? t("appointmentDetail.videoHint", {
                                defaultValue: "Join from this app when your doctor opens the call.",
                              })
                            : t("appointmentDetail.arriveHint", {
                                defaultValue: "Arrive 15 minutes early and show your queue number.",
                              })}
                        </Text>
                      ) : isMissed ? (
                        <Text style={[typography.body.sm, { color: colors.danger }]}>
                          {t("appointmentDetail.missedHint", {
                            defaultValue: "This visit was missed. You can book again below.",
                          })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </LinearGradient>
              </Card>

              {/* ─── Primary actions ─── */}
              {isMissed ? (
                <Button
                  title={t("appointments.bookAgain", { defaultValue: "Book again" })}
                  icon={CalendarPlus}
                  variant="primary"
                  size="lg"
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/book-appointment" as any,
                      params: { prefillDoctorId: appt.doctorId ?? cachedAppt?.doctorId ?? "" },
                    })
                  }
                />
              ) : null}

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
              {isUpcomingVisit ? (
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

              {/* ─── Records tied to this appointment ─── */}
              <View style={{ marginTop: spacing.sm, marginBottom: -spacing.xs }}>
                <SectionHeader
                  title={t("appointmentDetail.documentsTitle", { defaultValue: "Notes & documents" })}
                  count={records.length || undefined}
                />
              </View>

              {records.length === 0 ? (
                <Card variant="muted" padded={false} style={{ borderRadius: radius.card, borderCurve: "continuous", padding: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: colors.surface,
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
                    icon={Sparkles}
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
                    backgroundColor: pressed ? colors.fill : "transparent",
                    borderRadius: radius.card,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    padding: spacing.md,
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
                      backgroundColor: colors.successSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MessageCircle size={20} color={colors.success} strokeWidth={2.2} />
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
                  <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.2} />
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
function TicketCell({
  label,
  value,
  first,
  accent,
}: {
  label: string;
  value: string;
  first?: boolean;
  accent?: boolean;
}) {
  const { colors, typography } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        gap: 2,
        borderLeftWidth: first ? 0 : 1,
        borderLeftColor: colors.separator,
      }}
    >
      <Text style={[typography.caption, { color: colors.textSubtle, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }]}>
        {label}
      </Text>
      <Text style={[typography.title.md, { color: accent ? colors.primary : colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
