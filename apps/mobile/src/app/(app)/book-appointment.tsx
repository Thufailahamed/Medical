import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Users,
} from "lucide-react-native";
import {
  useBookAppointment,
  useDoctorSearch,
  useSpecialties,
  useDoctorAvailability,
  useHospitals,
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
  Chip,
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

const PERIODS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

const schema = z.object({
  doctorId: z.string().min(1, "Doctor is required"),
  hospitalId: z.string().min(1, "Hospital is required"),
  date: z.date({ required_error: "Date is required" }),
  time: z.string().min(1, "Pick a time slot"),
  reason: z.string().max(500).optional(),
});
type FormData = z.infer<typeof schema>;

export default function BookAppointmentScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const bookAppointment = useBookAppointment();
  const toast = useToast();

  const [period, setPeriod] = useState("morning");
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

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
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
      // Flatten to time strings; mark unavailable by prefixing the row in future.
      return fromApi.map((s) => s.time);
    }
    // Fallback: derive from TIME_SLOTS based on period
    return TIME_SLOTS.filter((t) => {
      const h = parseInt(t.split(":")[0], 10);
      if (period === "morning") return h < 12;
      if (period === "afternoon") return h >= 12 && h < 17;
      return h >= 17;
    });
  }, [availabilityData, period]);

  const onSubmit = async (data: FormData) => {
    try {
      await bookAppointment.mutateAsync({
        hospitalId: data.hospitalId,
        doctorId: data.doctorId,
        date: data.date.toISOString().slice(0, 10),
        time: data.time,
        reason: data.reason || undefined,
      });
      toast.show("Appointment booked", "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Could not book appointment", "danger");
    }
  };

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title="Book appointment" />

      <View style={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}>
        <Stepper
          steps={["Doctor", "Schedule", "Confirm"]}
          current={step - 1}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {step === 1 ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                Choose a doctor
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                Filter by specialty or search by name.
              </Text>
            </View>

            <TextInput
              placeholder="Search doctor or specialty..."
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
                  label="All"
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
                title="No doctors yet"
                message={
                  query || specialtyFilter
                    ? "Try a different search or specialty"
                    : "Doctors will appear here once registered."
                }
                tone="neutral"
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {doctors.map((d) => {
                  const selected = values.doctorId === d.doctorId;
                  return (
                    <NextActionCard
                      key={d.doctorId}
                      subject={d.name || "Doctor"}
                      verb={d.specialization || ""}
                      context={
                        d.rating
                          ? `★ ${d.rating.toFixed(1)} · ${
                              d.consultationFee != null
                                ? `LKR ${d.consultationFee}`
                                : "Tap to choose"
                            } · ${d.experience || 0} yrs exp`
                          : d.consultationFee != null
                          ? `LKR ${d.consultationFee} · ${d.experience || 0} yrs exp`
                          : "Tap to choose"
                      }
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
                        setValue("doctorId", d.doctorId, { shouldValidate: true });
                        setValue(
                          "hospitalId",
                          d.hospitalId || "",
                          { shouldValidate: true }
                        );
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

            <FormField label="Date" required error={errors.date?.message}>
              <Controller
                control={control}
                name="date"
                render={({ field: { value, onChange } }) => (
                  <DateField
                    value={value}
                    onChange={(d) => onChange(d)}
                    placeholder="Select appointment date"
                    minimumDate={new Date()}
                  />
                )}
              />
            </FormField>

            <FormField label="Period">
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  flexWrap: "wrap",
                }}
              >
                {PERIODS.map((p) => (
                  <FilterPill
                    key={p.value}
                    label={p.label}
                    active={period === p.value}
                    onPress={() => setPeriod(p.value)}
                  />
                ))}
              </View>
            </FormField>

            <FormField
              label="Time slot"
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
                Confirm details
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                Review your booking before submitting.
              </Text>
            </View>

            <Card>
              <View style={{ gap: spacing.md }}>
                <SummaryRow
                  icon={Stethoscope}
                  label="Doctor"
                  value={selectedDoctor?.name || values.doctorId || "—"}
                />
                <SummaryRow
                  icon={Building2}
                  label="Hospital"
                  value={
                    selectedDoctor?.hospitalName ||
                    selectedDoctor?.hospitalId ||
                    "—"
                  }
                />
                <SummaryRow
                  icon={CalendarIcon}
                  label="Date"
                  value={values.date ? values.date.toDateString() : "—"}
                />
                <SummaryRow
                  icon={Clock}
                  label="Time"
                  value={values.time || "—"}
                />
              </View>
            </Card>

            <FormField
              label="Reason for visit"
              helper="Optional — short description"
            >
              <Controller
                control={control}
                name="reason"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g., annual checkup"
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
            title="Back"
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
              title="Continue"
              onPress={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && (!values.doctorId || !!errors.doctorId || !!errors.hospitalId)) ||
                (step === 2 && (!values.date || !values.time || !!errors.date || !!errors.time))
              }
              iconRight={ChevronRight}
            />
          ) : (
            <Button
              title="Confirm booking"
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