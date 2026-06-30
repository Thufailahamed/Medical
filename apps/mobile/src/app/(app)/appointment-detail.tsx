// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
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
} from "lucide-react-native";
import {
  useAppointmentRecords,
  useRescheduleAppointment,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  PillTone,
  EmptyState,
  Skeleton,
  Button,
  SectionHeader,
  BottomSheet,
  FormField,
  TextInput,
  useToast,
} from "@/components/ui";

const STATUS_TONE: Record<string, PillTone> = {
  scheduled: "primary",
  confirmed: "success",
  in_progress: "primary",
  completed: "info",
  cancelled: "danger",
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

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const { data, isLoading } = useAppointmentRecords(id || null);
  const reschedule = useRescheduleAppointment();
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const appt = data?.appointment;
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
    } catch (err: any) {
      toast.show(
        err?.message || t("appointmentDetail.rescheduleError"),
        "danger"
      );
    }
  }

  return (
    <Screen keyboard padded={false} bottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("appointmentDetail.title")}
        />

        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.lg,
            paddingBottom: spacing.xl * 2,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={120} radius={20} />
              <Skeleton height={180} radius={20} />
            </View>
          ) : !appt ? (
            <EmptyState
              icon={ClipboardList}
              title={t("appointmentDetail.notFoundTitle")}
              message={t("appointmentDetail.notFoundBody")}
            />
          ) : (
            <>
              {/* Summary card */}
              <Card>
                <View style={{ gap: spacing.md }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      flexWrap: "wrap",
                    }}
                  >
                    <PillCmp
                      label={appt.status.replace("_", " ")}
                      tone={STATUS_TONE[appt.status] || "neutral"}
                      size="sm"
                    />
                    <PillCmp
                      icon={Clock}
                      label={appt.time}
                      tone="neutral"
                      size="sm"
                    />
                    <PillCmp
                      icon={Hash}
                      label={t("appointmentDetail.queuePill", {
                        n: appt.queueNumber ?? "—",
                      })}
                      tone="neutral"
                      size="sm"
                    />
                  </View>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {appt.date}
                  </Text>
                  {appt.reason ? (
                    <Text
                      style={[typography.body.md, { color: colors.textMuted }]}
                    >
                      {appt.reason}
                    </Text>
                  ) : null}
                  {appt.notes ? (
                    <Text
                      style={[typography.caption, { color: colors.textSubtle }]}
                    >
                      {appt.notes}
                    </Text>
                  ) : null}

                  {["scheduled", "confirmed"].includes(appt.status) ? (
                    <Button
                      title={t("appointmentDetail.reschedule")}
                      icon={CalendarClock}
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      onPress={startReschedule}
                    />
                  ) : null}
                </View>
              </Card>

              {/* Records tied to this appointment */}
              <SectionHeader
                title={t("appointmentDetail.visitNotes", {
                  count: records.length,
                })}
              />

              {records.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={t("appointmentDetail.recordsEmptyTitle")}
                  message={t("appointmentDetail.recordsEmptyBody")}
                  tone="neutral"
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  {records.map((r: any) => {
                    const Icon = RECORD_ICONS[r.recordType] || Stethoscope;
                    const labelKey = `appointmentDetail.recordLabel.${r.recordType}`;
                    const label = t(labelKey, {
                      defaultValue: r.recordType,
                    });
                    return (
                      <Card key={r.id}>
                        <View style={{ gap: spacing.sm }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.sm,
                            }}
                          >
                            <Icon size={18} color={colors.primary} />
                            <Text
                              style={[
                                typography.title.sm,
                                { color: colors.text, flex: 1 },
                              ]}
                            >
                              {r.title || label}
                            </Text>
                            <PillCmp
                              label={label}
                              tone="primary"
                              size="sm"
                            />
                          </View>
                          {r.diagnosis ? (
                            <Text style={[typography.body.md, { color: colors.text }]}>
                              <Text style={{ fontWeight: "700" }}>
                                {t("appointmentDetail.dxPrefix")}
                              </Text>
                              {r.diagnosis}
                            </Text>
                          ) : null}
                          {r.summary ? (
                            <Text
                              style={[typography.body.sm, { color: colors.textMuted }]}
                              numberOfLines={6}
                            >
                              {r.summary}
                            </Text>
                          ) : null}
                          {r.notes ? (
                            <Text
                              style={[typography.caption, { color: colors.textSubtle }]}
                            >
                              {r.notes}
                            </Text>
                          ) : null}
                          {r.followUpDate ? (
                            <PillCmp
                              icon={CalendarClock}
                              label={t("appointmentDetail.followUpPill", {
                                date: r.followUpDate,
                              })}
                              tone="warning"
                              size="sm"
                            />
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <BottomSheet
          visible={reschedOpen}
          onDismiss={() => setReschedOpen(false)}
          title={t("appointmentDetail.rescheduleSheetTitle")}
        >
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
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