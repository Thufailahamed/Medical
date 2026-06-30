// @ts-nocheck

import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
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
  Skeleton,
  useToast,
} from "@/components/ui";

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
  });
}

export default function BookAppointmentScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const bookAppointment = useBookAppointment();
  const toast = useToast();

  const [period, setPeriod] = useState<typeof PERIOD_VALUES[number]>("morning");
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data: specialtiesData } = useSpecialties();
  const { data: doctorsData, isLoading: doctorsLoading } = useDoctorSearch({
    query: debouncedQuery || undefined,
    specialization: specialtyFilter || undefined,
  });

  const doctors: any[] = doctorsData?.doctors || [];
  const specialties: string[] = specialtiesData?.specialties || [];

  const schema = useMemo(() => buildSchema(t), [t]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { hospitalId: "", doctorId: "", time: "", reason: "" },
    mode: "onChange",
  });

  const values = watch();
  const selectedDoctor = doctors.find((d) => d.doctorId === values.doctorId);

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
    try {
      await bookAppointment.mutateAsync({
        hospitalId: data.hospitalId,
        doctorId: data.doctorId,
        date: data.date.toISOString().slice(0, 10),
        time: data.time,
        reason: data.reason || undefined,
      });
      toast.show(t("bookAppointment.toast.booked"), "success");
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

            {/* Specialty chips */}
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
                        setValue("doctorId", d.doctorId, {
                          shouldValidate: true,
                        });
                        setValue("hospitalId", d.hospitalId || "", {
                          shouldValidate: true,
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
              loading={bookAppointment.isPending}
              icon={Sparkles}
            />
          )}
        </View>
      </View>
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