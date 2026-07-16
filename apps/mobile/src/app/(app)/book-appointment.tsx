// @ts-nocheck

import { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Stethoscope,
  Calendar as CalendarIcon,
  Clock,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Building2,
  Search,
  Wallet,
  AlertCircle,
  Video,
  User,
} from "lucide-react-native";
import {
  useBookAppointment,
  useDoctorSearch,
  useSpecialties,
  useDoctorAvailability,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  ScreenHeader,
  FormField,
  TextInput,
  Button,
  DateField,
  Card,
  Avatar,
  Pill,
  Stepper,
  TimeSlots,
  NextActionCard,
  EmptyState,
  ErrorState,
  Skeleton,
  BottomSheet,
  useToast,
  VerifiedBadge,
} from "@/components/ui";
import { api } from "@/lib/api";
import { runPayHereCheckout } from "@/lib/payhere";

const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
  "17:30","18:00","18:30","19:00",
];

const PERIOD_VALUES = ["morning", "afternoon", "evening"] as const;

function buildSchema(t: (k: string) => string) {
  return z.object({
    doctorId: z.string().min(1, t("bookAppointment.errors.doctorRequired")),
    hospitalId: z.string().min(1, t("bookAppointment.errors.hospitalRequired")),
    date: z.date({ required_error: t("bookAppointment.errors.dateRequired") }),
    time: z.string().min(1, t("bookAppointment.errors.timeRequired")),
    reason: z.string().max(500).optional(),
    // Round 5: patient-requested consultation mode. Validated locally so
    // the doctor-side queue + CTA pick it up at submission time. Server
    // re-validates via Zod (lib/validators.ts).
    mode: z.enum(["in_person", "video"]).default("in_person"),
  });
}

export default function BookAppointmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    // Set when the user navigates here from the doctor detail screen
    // via "Choose this doctor" — pre-fills doctorId + hospitalId and
    // advances straight to step 2 (date + time).
    prefillDoctorId?: string;
    prefillHospitalId?: string;
  }>();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const bookAppointment = useBookAppointment();
  const toast = useToast();

  const [period, setPeriod] = useState<typeof PERIOD_VALUES[number]>("morning");
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  // Doctor Booking (Round 6): telemedicine filter chip state. Mirrors
  // the `?telemedicine=1` server-side filter and is read by the
  // useDoctorSearch hook.
  const [telemedicineOnly, setTelemedicineOnly] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const { data: specialtiesData } = useSpecialties();
  const { data: doctorsData, isLoading: doctorsLoading, isError, refetch } = useDoctorSearch({
    query: debouncedQuery || undefined,
    specialization: specialtyFilter || undefined,
    telemedicine: telemedicineOnly || undefined,
  });

  const doctors: any[] = doctorsData?.doctors || [];
  const specialties: string[] = specialtiesData?.specialties || [];

  const schema = useMemo(() => buildSchema(t), [t]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { hospitalId: "", doctorId: "", time: "", reason: "", mode: "in_person" },
    mode: "onChange",
  });

  const values = watch();
  const selectedDoctor = doctors.find((d) => d.doctorId === values.doctorId);

  // Doctor Booking (Round 6): when the doctor detail screen pushes back
  // with prefillDoctorId, seed the form + advance to step 2 so the
  // patient lands on the date picker. We use setValue (not reset)
  // because react-hook-form's reset would clobber user input on the
  // back-navigation re-mount.
  useEffect(() => {
    if (params.prefillDoctorId) {
      setValue("doctorId", params.prefillDoctorId, { shouldValidate: true });
      if (params.prefillHospitalId) {
        setValue("hospitalId", params.prefillHospitalId, { shouldValidate: true });
      }
      setStep(2);
      // Clear the param so a hot reload / re-mount doesn't loop back
      // to step 2 unexpectedly.
      router.setParams({ prefillDoctorId: undefined, prefillHospitalId: undefined });
    }
  }, [params.prefillDoctorId, params.prefillHospitalId, router, setValue]);

  // Doctor Booking (Round 6): if the selected doctor doesn't offer
  // video (e.g. the patient flipped the telemedicine filter off and
  // re-picked, or the server returned a row with telemedicineEnabled
  // changed), force the mode back to in_person so the booking can't
  // slip through with a stale "video" selection.
  useEffect(() => {
    if (
      values.mode === "video" &&
      selectedDoctor &&
      !selectedDoctor.telemedicineEnabled
    ) {
      setValue("mode", "in_person", { shouldValidate: false });
    }
  }, [values.mode, selectedDoctor, setValue]);

  const dateStr = values.date ? values.date.toISOString().slice(0, 10) : "";
  const { data: availabilityData } = useDoctorAvailability(
    values.doctorId,
    dateStr
  );

  const slots = useMemo(() => {
    const fromApi = availabilityData?.slots || [];
    if (fromApi.length > 0) {
      return fromApi.map((s) => s.time);
    }
    return TIME_SLOTS.filter((t) => {
      const h = parseInt(t.split(":")[0], 10);
      if (period === "morning") return h < 12;
      if (period === "afternoon") return h >= 12 && h < 17;
      return h >= 17;
    });
  }, [availabilityData, period]);

  const onSubmit = async (data: any) => {
    // Phase 5: gate confirm behind cancellation policy modal.
    setPolicyOpen(true);
  };

  const acceptAndBook = async () => {
    setPolicyOpen(false);
    const data = getValues();
    try {
      const booked = await bookAppointment.mutateAsync({
        hospitalId: data.hospitalId,
        doctorId: data.doctorId,
        date: data.date.toISOString().slice(0, 10),
        time: data.time,
        reason: data.reason || undefined,
        mode: data.mode,
      });

      const appointmentId = booked?.id || booked?.appointment?.id;
      const fee = selectedDoctor?.consultationFee ?? booked?.paymentAmount ?? 0;

      if (appointmentId && fee > 0) {
        // Initiate payment + open PayHere checkout.
        try {
          setPaying(true);
          const init: any = await api.post("/payments/initiate", {
            appointmentId,
          });
          const result = await runPayHereCheckout({
            appointmentId,
            fields: init.fields,
            checkoutUrl: init.checkoutUrl,
            pollStatus: async () => {
              const s: any = await api.get(`/payments/${appointmentId}`);
              return { status: s.status };
            },
          });
          if (result.status === "paid") {
            toast.show(t("bookAppointment.toast.paid"), "success");
          } else if (result.status === "cancelled") {
            toast.show(t("bookAppointment.toast.paymentCancelled"), "info");
          } else {
            toast.show(t("bookAppointment.toast.paymentFailed"), "danger");
          }
        } catch (payErr: any) {
          toast.show(
            payErr?.message || t("bookAppointment.toast.paymentError"),
            "danger"
          );
        } finally {
          setPaying(false);
        }
      } else {
        toast.show(t("bookAppointment.toast.booked"), "success");
      }

      router.back();
    } catch (err: any) {
      toast.show(
        err?.message || t("bookAppointment.toast.bookError"),
        "danger"
      );
    }
  };

  return (
    <Screen
      scroll
      keyboard
      padded={false}
      edges={["top"]}
      bottomInset
      tabBarOffset
    >
      <ScreenHeader
        back
        title={t("bookAppointment.title")}
      />

      <View style={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}>
        <Stepper
          steps={[
            t("bookAppointment.stepDoctor"),
            t("bookAppointment.stepSchedule"),
            t("bookAppointment.stepConfirm"),
          ]}
          current={step - 1}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {step === 1 ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {t("bookAppointment.step1Title")}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {t("bookAppointment.step1Subtitle")}
              </Text>
            </View>

            <TextInput
              placeholder={t("bookAppointment.searchPlaceholder")}
              value={query}
              onChangeText={setQuery}
              leadingIcon={Search}
              tone="soft"
              autoCapitalize="none"
            />

            {/* Specialty chips + telemedicine toggle */}
            {specialties.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.xs,
                }}
              >
                <Pill
                  label={t("bookAppointment.specialtyAll")}
                  tone={specialtyFilter === null ? "primary" : "neutral"}
                  onPress={() => setSpecialtyFilter(null)}
                />
                {/* Doctor Booking (Round 6): "Online consultation" filter
                    chip. Toggling adds telemedicine=1 to the search
                    query, narrowing the list to doctors who offer video.
                    Independent from the specialty filter so a patient can
                    combine "Cardiology" + "Online only". */}
                <Pill
                  label={t("bookAppointment.telemedicineToggle")}
                  tone={telemedicineOnly ? "primary" : "neutral"}
                  onPress={() => setTelemedicineOnly((v) => !v)}
                  icon={Video}
                />
                {specialties.map((s) => (
                  <Pill
                    key={s}
                    label={s}
                    tone={specialtyFilter === s ? "primary" : "neutral"}
                    onPress={() =>
                      setSpecialtyFilter(specialtyFilter === s ? null : s)
                    }
                  />
                ))}
              </View>
            ) : null}

            {doctorsLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={84} radius={16} />
                <Skeleton height={84} radius={16} />
                <Skeleton height={84} radius={16} />
              </View>
            ) : isError ? (
              <ErrorState
                title={t("recordDetail.errorTitle", "Couldn't load doctors")}
                message={t("recordDetail.errorBody", "Check your connection and try again.")}
                actionLabel={t("common.retry")}
                onAction={() => refetch()}
              />
            ) : doctors.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title={t("bookAppointment.emptyTitle")}
                message={
                  query || specialtyFilter
                    ? t("bookAppointment.emptyBodyFiltered")
                    : t("bookAppointment.emptyBodyEmpty")
                }
                tone="neutral"
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {doctors.map((d) => {
                  const selected = values.doctorId === d.doctorId;
                  const ratingStr = d.rating
                    ? t("bookAppointment.rating", { rating: d.rating.toFixed(1) })
                    : "";
                  const feeStr =
                    d.consultationFee != null
                      ? t("bookAppointment.lkrFee", {
                          fee: d.consultationFee,
                        })
                      : "";
                  const expStr = t("bookAppointment.experience", {
                    years: d.experience || 0,
                  });
                  const context =
                    ratingStr && feeStr
                      ? t("bookAppointment.contextRich", {
                          rating: d.rating.toFixed(1),
                          fee: d.consultationFee,
                          years: d.experience || 0,
                        })
                      : feeStr
                      ? t("bookAppointment.contextFee", {
                          fee: d.consultationFee,
                          years: d.experience || 0,
                        })
                      : t("bookAppointment.tapToChoose");
                  return (
                    <NextActionCard
                      key={d.doctorId}
                      subject={d.name || t("bookAppointment.doctorFallback")}
                      verb={d.specialization || ""}
                      context={context}
                      icon={Stethoscope}
                      iconTone="primary"
                      meta={
                        d.slmcVerifiedAt || d.responseTime || d.telemedicineEnabled ? (
                          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                            {d.slmcVerifiedAt ? (
                              <VerifiedBadge
                                verified={!!d.slmcVerifiedAt}
                                regNo={d.slmcRegistrationNo}
                              />
                            ) : null}
                            {d.telemedicineEnabled ? (
                              <Pill tone="success" icon={Video} testID="card-online">
                                {t("bookAppointment.telemedicineAvailable")}
                              </Pill>
                            ) : null}
                            {d.responseTime === "fast" ? (
                              <Pill tone="success" testID="rt-fast">
                                {t("bookAppointment.responseFast")}
                              </Pill>
                            ) : null}
                            {d.responseTime === "quick" ? (
                              <Pill tone="info" testID="rt-quick">
                                {t("bookAppointment.responseQuick")}
                              </Pill>
                            ) : null}
                            {d.responseTime === "normal" ? (
                              <Pill tone="muted" testID="rt-normal">
                                {t("bookAppointment.responseNormal")}
                              </Pill>
                            ) : null}
                          </View>
                        ) : undefined
                      }
                      trailing={
                        selected ? (
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 999,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: colors.primary,
                            }}
                          >
                            <Check
                              size={18}
                              color={colors.onPrimary}
                              strokeWidth={3}
                            />
                          </View>
                        ) : undefined
                      }
                      onPress={() => {
                        // Doctor Booking (Round 6): tap pushes to the
                        // doctor detail screen so the patient can read
                        // bio + SLMC + telemedicine availability before
                        // committing. The detail screen's "Choose this
                        // doctor" CTA pops back here with prefill params
                        // and advances the stepper.
                        router.push({
                          pathname: "/(app)/doctor/[id]",
                          params: { id: d.doctorId },
                        });
                      }}
                    />
                  );
                })}
              </View>
            )}
            {errors.doctorId ? (
              <Text style={[typography.caption, { color: colors.danger }]}>
                {errors.doctorId.message}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: spacing.md }}>
            {selectedDoctor ? (
              <Card padded tone="primary">
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <Avatar
                    name={selectedDoctor.name}
                    size="md"
                    tone="primary"
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text },
                      ]}
                    >
                      {selectedDoctor.name}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted },
                      ]}
                    >
                      {selectedDoctor.specialization}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            <FormField
              label={t("bookAppointment.step2DateLabel")}
              required
              error={errors.date?.message}
            >
              <Controller
                control={control}
                name="date"
                render={({ field: { value, onChange } }) => (
                  <DateField
                    value={value}
                    onChange={(d) => onChange(d)}
                    placeholder={t("bookAppointment.step2DatePlaceholder")}
                    minimumDate={new Date()}
                  />
                )}
              />
            </FormField>

            <FormField label={t("bookAppointment.step2PeriodLabel")}>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  flexWrap: "wrap",
                }}
              >
                {PERIOD_VALUES.map((p) => (
                  <FilterPill
                    key={p}
                    label={t(`bookAppointment.periods.${p}`)}
                    active={period === p}
                    onPress={() => setPeriod(p)}
                  />
                ))}
              </View>
            </FormField>

            <FormField
              label={t("bookAppointment.step2TimeLabel")}
              required
              error={errors.time?.message}
            >
              <TimeSlots
                slots={slots.map((t) => ({ value: t, label: t }))}
                value={values.time}
                onChange={(v) =>
                  setValue("time", v, { shouldValidate: true })
                }
                columns={4}
              />
            </FormField>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {t("bookAppointment.step3Title")}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {t("bookAppointment.step3Subtitle")}
              </Text>
            </View>

            <Card>
              <View style={{ gap: spacing.md }}>
                <SummaryRow
                  icon={Stethoscope}
                  label={t("bookAppointment.summaryDoctor")}
                  value={selectedDoctor?.name || values.doctorId || "—"}
                />
                <SummaryRow
                  icon={Building2}
                  label={t("bookAppointment.summaryHospital")}
                  value={
                    selectedDoctor?.hospitalName ||
                    selectedDoctor?.hospitalId ||
                    "—"
                  }
                />
                <SummaryRow
                  icon={CalendarIcon}
                  label={t("bookAppointment.summaryDate")}
                  value={values.date ? values.date.toDateString() : "—"}
                />
                <SummaryRow
                  icon={Clock}
                  label={t("bookAppointment.summaryTime")}
                  value={values.time || "—"}
                />
                {selectedDoctor?.consultationFee ? (
                  <SummaryRow
                    icon={Wallet}
                    label={t("bookAppointment.summaryFee")}
                    value={`LKR ${Number(selectedDoctor.consultationFee).toLocaleString()}`}
                  />
                ) : null}
              </View>
            </Card>

            <FormField
              label={t("bookAppointment.step3ReasonLabel")}
              helper={t("bookAppointment.step3ReasonHelper")}
            >
              <Controller
                control={control}
                name="reason"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t("bookAppointment.step3ReasonPlaceholder")}
                    multiline
                    numberOfLines={3}
                    leadingIcon={FileText}
                    tone="soft"
                  />
                )}
              />
            </FormField>

            {/* Round 5: video vs in-person selector. Two cards side-by-side
                (stacked on narrow screens); selected card highlights with
                primary tint + check icon. Persisted as `mode` on the
                appointment row so the doctor's queue can filter + the
                patient's "Join video visit" CTA can fire earlier. */}
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.label.md, { color: colors.text }]}>
                {t("bookAppointment.step3ModeTitle")}
              </Text>
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                {t("bookAppointment.step3ModeSubtitle")}
              </Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Controller
                control={control}
                name="mode"
                render={({ field: { value, onChange } }) => (
                  <>
                    {/* Doctor Booking (Round 6): video card is hidden
                        when the selected doctor hasn't opted in to
                        telemedicine. The useEffect above also forces
                        `mode` back to "in_person" if the doctor changes
                        under us — this is the user-visible part of that
                        contract. */}
                    {selectedDoctor?.telemedicineEnabled ? (
                      <ModeOptionCard
                        active={value === "video"}
                        onPress={() => onChange("video")}
                        icon={Video}
                        label={t("bookAppointment.modeVideoLabel")}
                        body={t("bookAppointment.modeVideoBody")}
                      />
                    ) : (
                      <View
                        testID="video-unavailable"
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.md,
                          padding: spacing.md,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 14,
                            backgroundColor: colors.surface,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Video
                            size={20}
                            color={colors.textSubtle}
                            strokeWidth={2.2}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              typography.title.sm,
                              { color: colors.text, fontWeight: "700" },
                            ]}
                          >
                            {t("bookAppointment.videoUnavailableTitle")}
                          </Text>
                          <Text
                            style={[
                              typography.body.sm,
                              { color: colors.textMuted, marginTop: 2 },
                            ]}
                          >
                            {t("bookAppointment.videoUnavailableBody")}
                          </Text>
                        </View>
                      </View>
                    )}
                    <ModeOptionCard
                      active={value === "in_person"}
                      onPress={() => onChange("in_person")}
                      icon={User}
                      label={t("bookAppointment.modeInPersonLabel")}
                      body={t("bookAppointment.modeInPersonBody")}
                    />
                  </>
                )}
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.md,
          padding: spacing.lg,
        }}
      >
        {step > 1 ? (
          <Button
            title={t("bookAppointment.back")}
            variant="outline"
            onPress={() => setStep((s) => s - 1)}
            fullWidth={false}
            icon={ChevronLeft}
          />
        ) : (
          <View style={{ flex: 0 }} />
        )}
        <View style={{ flex: 1 }}>
          {step < 3 ? (
            <Button
              title={t("bookAppointment.continue")}
              onPress={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 &&
                  (!values.doctorId ||
                    !!errors.doctorId ||
                    !!errors.hospitalId)) ||
                (step === 2 &&
                  (!values.date ||
                    !values.time ||
                    !!errors.date ||
                    !!errors.time))
              }
              iconRight={ChevronRight}
            />
          ) : (
            <Button
              title={t("bookAppointment.confirmBooking")}
              onPress={handleSubmit(onSubmit)}
              loading={bookAppointment.isPending || paying}
              icon={Sparkles}
            />
          )}
        </View>
      </View>

      {/* Cancellation policy modal — gates the final confirm. */}
      <BottomSheet
        visible={policyOpen}
        onDismiss={() => setPolicyOpen(false)}
        title={t("bookAppointment.policyTitle")}
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
            <AlertCircle size={20} color={colors.warning || "#FF9500"} strokeWidth={2} />
            <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
              {t("bookAppointment.policyIntro")}
            </Text>
          </View>
          <View style={{ gap: spacing.xs, paddingLeft: spacing.lg }}>
            <Text style={[typography.body.sm, { color: colors.text }]}>
              {t("bookAppointment.policyFull")}
            </Text>
            <Text style={[typography.body.sm, { color: colors.text }]}>
              {t("bookAppointment.policyHalf")}
            </Text>
            <Text style={[typography.body.sm, { color: colors.text }]}>
              {t("bookAppointment.policyNone")}
            </Text>
          </View>
          {selectedDoctor?.consultationFee ? (
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>
              {t("bookAppointment.policyPayNote", {
                amount: `LKR ${Number(selectedDoctor.consultationFee).toLocaleString()}`,
              })}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
            <Button
              title={t("bookAppointment.policyDecline")}
              variant="outline"
              onPress={() => setPolicyOpen(false)}
              fullWidth={false}
            />
            <View style={{ flex: 1 }}>
              <Button
                title={t("bookAppointment.policyAccept")}
                onPress={acceptAndBook}
                loading={bookAppointment.isPending || paying}
              />
            </View>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
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
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <Icon size={18} color={colors.primary} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.overline,
            { color: colors.textMuted, marginBottom: 2 },
          ]}
        >
          {label}
        </Text>
        <Text style={[typography.title.sm, { color: colors.text }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onTouchEnd={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={[
          typography.label.md,
          {
            color: active ? colors.onPrimary : colors.text,
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// Mode-option card used in step 3 of the booking form. Selected card
// highlights with primary tint + check icon. Tapping sets `mode` on the
// form via react-hook-form's Controller.
function ModeOptionCard({
  active,
  onPress,
  icon: Icon,
  label,
  body,
}: {
  active: boolean;
  onPress: () => void;
  icon: any;
  label: string;
  body: string;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySoft : colors.surface,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={colors.primary} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
          {label}
        </Text>
        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
          {body}
        </Text>
      </View>
      {active ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={14} color={colors.onPrimary} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}