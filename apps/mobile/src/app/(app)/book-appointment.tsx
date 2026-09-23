// @ts-nocheck

import { useMemo, useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, BackHandler } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  Info,
  Heart,
  Brain,
  Baby,
  Bone,
  Eye,
  Activity,
} from "lucide-react-native";
import {
  useBookAppointment,
  useDoctorSearch,
  useSpecialties,
  useDoctorAvailability,
  useDoctor,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Screen,
  ScreenHeader,
  FormField,
  TextInput,
  Button,
  DateField,
  Avatar,
  Pill,
  Stepper,
  TimeSlots,
  EmptyState,
  ErrorState,
  Skeleton,
  BottomSheet,
  useToast,
  VerifiedBadge,
} from "@/components/ui";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
import { api } from "@/lib/api";
import { runPayHereCheckout } from "@/lib/payhere";

function getSpecialtyIcon(name: string) {
  const norm = name.trim().toLowerCase();
  if (norm.includes("cardio")) return Heart;
  if (norm.includes("neuro") || norm.includes("psych") || norm.includes("mental")) return Brain;
  if (norm.includes("pediatr") || norm.includes("child") || norm.includes("baby")) return Baby;
  if (norm.includes("ortho") || norm.includes("bone") || norm.includes("joint")) return Bone;
  if (norm.includes("ophthalm") || norm.includes("eye") || norm.includes("vision")) return Eye;
  if (norm.includes("derm") || norm.includes("skin")) return Sparkles;
  if (norm.includes("emerg") || norm.includes("urgent")) return AlertCircle;
  if (norm.includes("general") || norm.includes("practice") || norm.includes("physician") || norm.includes("family")) return Stethoscope;
  return Activity;
}

// Accent color for specialty icon wells (solid, high contrast on soft tint).
function getSpecialtyAccent(name: string): string {
  const norm = name.trim().toLowerCase();
  if (norm.includes("cardio")) return "#DC2626";
  if (norm.includes("neuro") || norm.includes("psych") || norm.includes("mental")) return "#7C3AED";
  if (norm.includes("pediatr") || norm.includes("child") || norm.includes("baby")) return "#D97706";
  if (norm.includes("ortho") || norm.includes("bone") || norm.includes("joint")) return "#0284C7";
  if (norm.includes("ophthalm") || norm.includes("eye") || norm.includes("vision")) return "#0891B2";
  if (norm.includes("derm") || norm.includes("skin")) return "#DB2777";
  if (norm.includes("emerg") || norm.includes("urgent")) return "#EA580C";
  if (norm.includes("general") || norm.includes("practice") || norm.includes("physician") || norm.includes("family")) return "#0D9488";
  return "#0284C7";
}

const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
  "17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30",
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
  const { spacing, colors, typography, shadow } = useTheme();
  const bookAppointment = useBookAppointment();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<typeof PERIOD_VALUES[number]>("morning");
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  // Doctor Booking (Round 6): telemedicine filter chip state. Mirrors
  // the `?telemedicine=1` server-side filter and is read by the
  // useDoctorSearch hook.
  const [telemedicineOnly, setTelemedicineOnly] = useState(false);
  // Doctor Booking (Round 7): step 1 view mode. `specialties` is the
  // default landing — patients who don't know which doctor they want
  // see a category grid first. Tapping a specialty drills into `doctors`.
  // Search input narrows the current view (specialty names in the grid,
  // doctor names in the filtered list) without losing the patient's place.
  type Step1View = "specialties" | "doctors";
  const [step1View, setStep1View] = useState<Step1View>("specialties");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const { data: specialtiesData } = useSpecialties();
  // Round 7: skip the doctor search network call when the patient is
  // staring at the specialty picker and hasn't typed anything or picked
  // a category yet. The query becomes enabled once any narrowing input
  // is present — query text, selected specialty, or telemedicine toggle.
  const doctorSearchEnabled =
    !!debouncedQuery.trim() || !!specialtyFilter || !!telemedicineOnly;
  const { data: doctorsData, isLoading: doctorsLoading, isError, refetch } = useDoctorSearch({
    query: debouncedQuery || undefined,
    specialization: specialtyFilter || undefined,
    telemedicine: telemedicineOnly || undefined,
    enabled: doctorSearchEnabled,
  });

  const doctors: any[] = doctorsData?.doctors || [];
  const specialties = useMemo<Array<{ name: string; count: number }>>(() => {
    const raw = specialtiesData?.specialties || [];
    return raw.map((s: any) => {
      if (typeof s === "string") {
        return { name: s, count: 0 };
      }
      return {
        name: s?.name || "",
        count: Number(s?.count) || 0,
      };
    });
  }, [specialtiesData]);

  // Filter specialty cards by current search query (case-insensitive).
  // Empty query shows the full grid.
  const filteredSpecialties = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return specialties;
    return specialties.filter((s) => s.name.toLowerCase().includes(q));
  }, [specialties, debouncedQuery]);

  // Filter doctor rows in the doctors view by the typed query. The API
  // already filters by `specialization` server-side; we narrow further
  // client-side so the UI is responsive within the same debounce window.
  // Server-side filter still wins for big lists — client-side only adds
  // a small refinement.
  const filteredDoctors = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => {
      const name = (d.name || "").toLowerCase();
      const spec = (d.specialization || "").toLowerCase();
      return name.includes(q) || spec.includes(q);
    });
  }, [doctors, debouncedQuery]);

  const schema = useMemo(() => buildSchema(t), [t]);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { hospitalId: "", doctorId: "", time: "", reason: "", mode: "in_person" },
    mode: "onChange",
  });

  const values = watch();
  const locale = useLocaleStore((s) => s.locale);

  useFocusEffect(
    useCallback(() => {
      // Don't reset if we are already in progress (e.g. have a doctorId or past step 1)
      if (!params.prefillDoctorId && !getValues("doctorId")) {
        reset({
          hospitalId: "",
          doctorId: "",
          time: "",
          reason: "",
          mode: "in_person",
        });
        setStep(1);
      }
    }, [params.prefillDoctorId, reset, getValues])
  );

  const docId =
    values.doctorId && values.doctorId !== "undefined" ? values.doctorId : "";
  const listDoctor = doctors.find(
    (d) =>
      (d.doctorId && d.doctorId === docId) || (d.id && d.id === docId)
  );
  const { data: detailData } = useDoctor(docId);
  const selectedDoctor = listDoctor || detailData?.doctor;

  const doctorDisplayName =
    selectedDoctor?.name ||
    (docId && docId !== "undefined" ? docId : "") ||
    t("bookAppointment.doctorFallback", "Doctor");

  const doctorHospitalName =
    selectedDoctor?.hospitalName ||
    selectedDoctor?.hospitalId ||
    (values.hospitalId && values.hospitalId !== "undefined"
      ? values.hospitalId
      : "") ||
    "Clinic";

  const formattedDate = values.date
    ? fmtDateLong(values.date, locale)
    : "—";

  // Doctor Booking (Round 6): when the doctor detail screen pushes back
  // with prefillDoctorId, seed the form + advance to step 2 so the
  // patient lands on the date picker. We use setValue (not reset)
  // because react-hook-form's reset would clobber user input on the
  // back-navigation re-mount. If the doctor lacks a hospitalId in the
  // payload, leave the form's hospitalId empty — the API falls back to
  // the doctor's hospitalId column at booking time.
  useEffect(() => {
    if (params.prefillDoctorId && params.prefillDoctorId !== "undefined") {
      setValue("doctorId", params.prefillDoctorId, { shouldValidate: true });
      if (params.prefillHospitalId && params.prefillHospitalId !== "undefined") {
        setValue("hospitalId", params.prefillHospitalId, {
          shouldValidate: true,
        });
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

  // Doctor Booking: automatically switch step 1 view when search query is entered
  useEffect(() => {
    if (query.trim().length > 0) {
      setStep1View("doctors");
    } else if (!specialtyFilter) {
      setStep1View("specialties");
    }
  }, [query, specialtyFilter]);

  const dateStr = values.date ? (() => {
    const y = values.date.getFullYear();
    const m = String(values.date.getMonth() + 1).padStart(2, "0");
    const d = String(values.date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })() : "";
  const { data: availabilityData } = useDoctorAvailability(
    values.doctorId,
    dateStr
  );

  const slots = useMemo(() => {
    const fromApi = availabilityData?.slots || [];
    const sourceSlots = fromApi.length > 0
      ? fromApi.filter((s) => s.available).map((s) => s.time)
      : TIME_SLOTS;

    return sourceSlots.filter((t) => {
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
        date: (() => {
          const y = data.date.getFullYear();
          const m = String(data.date.getMonth() + 1).padStart(2, "0");
          const d = String(data.date.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        })(),
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

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => s - 1);
      return;
    }
    // Step 1: if drilled into doctors view or searched, go back to specialties grid
    if (step1View === "doctors" || specialtyFilter || query.trim().length > 0) {
      setQuery("");
      setSpecialtyFilter(null);
      setStep1View("specialties");
      return;
    }
    // At root of booking flow (step 1 specialties view):
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)");
    }
  }, [step, step1View, specialtyFilter, query, router]);

  useEffect(() => {
    const onBackPress = () => {
      if (step > 1) {
        setStep((s) => s - 1);
        return true;
      }
      if (step1View === "doctors" || specialtyFilter || query.trim().length > 0) {
        setQuery("");
        setSpecialtyFilter(null);
        setStep1View("specialties");
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [step, step1View, specialtyFilter, query, router]);

  return (
    <Screen
      scroll
      keyboard
      padded={false}
      edges={["top"]}
      bottomInset={step > 1 ? false : true}
    >
      <ScreenHeader
        back
        onBack={handleBack}
        title={t("bookAppointment.title")}
        subtitle={
          step === 1 && step1View === "doctors" && specialtyFilter
            ? specialtyFilter
            : t(
                "bookAppointment.headerSubtitle",
                "A few quick steps to reserve your visit"
              )
        }
        variant="compact"
      />

      <View style={{ paddingTop: spacing.xs, paddingBottom: spacing.md }}>
        <Stepper
          steps={[
            t("bookAppointment.stepDoctor"),
            t("bookAppointment.stepSchedule"),
            t("bookAppointment.stepConfirm"),
          ]}
          current={step - 1}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl }}>
        {step === 1 ? (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: spacing.md,
                shadowColor: colors.text,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View style={{ gap: 4 }}>
                <View style={{ alignSelf: "flex-start", marginBottom: 2 }}>
                  <Pill
                    label={
                      step1View === "doctors"
                        ? t("bookAppointment.availableDoctors", { defaultValue: "AVAILABLE DOCTORS" })
                        : t("bookAppointment.findCare", { defaultValue: "FIND THE RIGHT CARE" })
                    }
                    tone="primary"
                    size="sm"
                  />
                </View>
                <Text
                  style={[
                    typography.title.lg,
                    {
                      color: colors.text,
                      fontWeight: "800",
                      fontSize: 20,
                      letterSpacing: -0.3,
                    },
                  ]}
                >
                  {step1View === "doctors" && specialtyFilter
                    ? t("bookAppointment.step1DoctorsTitle", {
                        specialty: specialtyFilter,
                      })
                    : t(
                        "bookAppointment.step1SpecialtiesTitle",
                        { defaultValue: "Choose a specialty" }
                      )}
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, lineHeight: 19 },
                  ]}
                >
                  {step1View === "doctors"
                    ? t(
                        "bookAppointment.step1DoctorsSubtitle",
                        { defaultValue: "Compare availability and choose the doctor who feels right for you." }
                      )
                    : t(
                        "bookAppointment.step1SpecialtiesSubtitle",
                        { defaultValue: "Browse doctors by what they treat. Tap a category to see who is available." }
                      )}
                </Text>
              </View>

              <TextInput
                placeholder={t("bookAppointment.searchPlaceholder", { defaultValue: "Search doctor or specialty..." })}
                value={query}
                onChangeText={setQuery}
                leadingIcon={Search}
                tone="soft"
                autoCapitalize="none"
              />

              {/* SPECIALTIES — 2-column grid */}
              {step1View === "specialties" ? (
                filteredSpecialties.length === 0 ? (
                  <EmptyState
                    icon={Stethoscope}
                    title={t("bookAppointment.emptyTitle")}
                    message={t("bookAppointment.emptyBodyEmpty")}
                    tone="neutral"
                  />
                ) : (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing.sm,
                    }}
                  >
                    {filteredSpecialties.map((s, i) => (
                      <View
                        key={`${s.name}-${i}`}
                        style={{ width: "48%", flexGrow: 1, maxWidth: "48.5%" }}
                      >
                        <SpecialtyCard
                          name={s.name}
                          count={s.count}
                          onPress={() => {
                            setSpecialtyFilter(s.name);
                            setStep1View("doctors");
                          }}
                          t={t}
                        />
                      </View>
                    ))}
                  </View>
                )
              ) : null}

              {/* DOCTORS VIEW */}
              {step1View === "doctors" ? (
                <View style={{ gap: spacing.md }}>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing.xs,
                      alignItems: "center",
                    }}
                  >
                    <Pill
                      label={t(
                        "bookAppointment.changeSpecialty",
                        "Change specialty"
                      )}
                      tone="neutral"
                      icon={ChevronLeft}
                      onPress={() => {
                        setQuery("");
                        setSpecialtyFilter(null);
                        setStep1View("specialties");
                      }}
                      testID="change-specialty"
                    />
                    {specialtyFilter ? (
                      <Pill
                        label={specialtyFilter}
                        tone="primary"
                        testID="active-specialty"
                      />
                    ) : null}
                    <Pill
                      label={t("bookAppointment.telemedicineToggle")}
                      tone={telemedicineOnly ? "primary" : "neutral"}
                      onPress={() => setTelemedicineOnly((v) => !v)}
                      icon={Video}
                      testID="telemedicine-toggle"
                    />
                  </View>

                  {doctorsLoading ? (
                    <View style={{ gap: spacing.sm }}>
                      <Skeleton height={88} radius={16} />
                      <Skeleton height={88} radius={16} />
                      <Skeleton height={88} radius={16} />
                    </View>
                  ) : isError ? (
                    <ErrorState
                      title={t(
                        "recordDetail.errorTitle",
                        "Couldn't load doctors"
                      )}
                      message={t(
                        "recordDetail.errorBody",
                        "Check your connection and try again."
                      )}
                      actionLabel={t("common.retry")}
                      onAction={() => refetch()}
                    />
                  ) : filteredDoctors.length === 0 ? (
                    <EmptyState
                      icon={Stethoscope}
                      title={t("bookAppointment.emptyTitle")}
                      message={t("bookAppointment.emptyBodyFiltered")}
                      tone="neutral"
                    />
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {filteredDoctors.map((d, i) => (
                        <DoctorRow
                          key={`${d.doctorId}-${i}`}
                          doctor={d}
                          selected={values.doctorId === d.doctorId}
                          t={t}
                          colors={colors}
                          typography={typography}
                          spacing={spacing}
                          onPick={() => {
                            const chosenId = d.doctorId || d.id || "";
                            setValue("doctorId", chosenId, {
                              shouldValidate: true,
                            });
                            setValue("hospitalId", d.hospitalId || "", {
                              shouldValidate: true,
                            });
                            setStep(2);
                          }}
                        />
                      ))}
                    </View>
                  )}

                  {errors.doctorId ? (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.danger },
                      ]}
                    >
                      {errors.doctorId.message}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.title.lg, { color: colors.text, fontWeight: "800" }]}>
                {t("bookAppointment.step2Heading", "Choose your visit time")}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {t(
                  "bookAppointment.step2Subtitle",
                  "Pick a date and an available slot that works for you."
                )}
              </Text>
            </View>

            {selectedDoctor ? (
              <View
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  padding: spacing.md + 4,
                  ...shadow.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <Avatar name={selectedDoctor.name} size="lg" tone="primary" />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text
                      numberOfLines={1}
                      style={[typography.title.md, { color: colors.text, fontWeight: "800", letterSpacing: -0.3 }]}
                    >
                      {selectedDoctor.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[typography.body.sm, { color: colors.textMuted }]}
                    >
                      {selectedDoctor.specialization}
                      {selectedDoctor.hospitalName ? ` · ${selectedDoctor.hospitalName}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/doctor/[id]",
                        params: { id: values.doctorId },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      "bookAppointment.viewDetailsA11y",
                      "View full doctor profile"
                    )}
                    style={({ pressed }) => ({
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: pressed ? colors.surfaceMuted : colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    })}
                  >
                    <Info size={18} color={colors.primary} strokeWidth={2.2} />
                  </Pressable>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                    marginTop: spacing.md,
                    paddingTop: spacing.sm + 2,
                    borderTopWidth: 1,
                    borderTopColor: colors.borderSoft,
                  }}
                >
                  {selectedDoctor.slmcVerifiedAt ? (
                    <VerifiedBadge verified={true} size="sm" />
                  ) : null}
                  {selectedDoctor.consultationFee ? (
                    <Pill
                      label={`LKR ${Number(selectedDoctor.consultationFee).toLocaleString()}`}
                      icon={Wallet}
                      tone="neutral"
                      size="sm"
                    />
                  ) : null}
                  {selectedDoctor.yearsExperience ? (
                    <Pill
                      label={`${selectedDoctor.yearsExperience}y exp`}
                      tone="neutral"
                      size="sm"
                    />
                  ) : null}
                  {selectedDoctor.telemedicineEnabled ? (
                    <Pill
                      label={t("bookAppointment.telemedicineAvailable")}
                      icon={Video}
                      tone="success"
                      size="sm"
                    />
                  ) : null}
                  {selectedDoctor.replyTimeMedianMinutes != null ? (
                    <Pill
                      label={`~${selectedDoctor.replyTimeMedianMinutes}m reply`}
                      tone="info"
                      size="sm"
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: spacing.lg,
                ...shadow.sm,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <CalendarIcon size={19} color={colors.primary} strokeWidth={2.3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.title.md,
                      { color: colors.text, fontWeight: "800" },
                    ]}
                  >
                    {t("bookAppointment.step2Title", "Pick a time")}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                    {t("bookAppointment.timezoneNote", "Times shown in your local timezone")}
                  </Text>
                </View>
              </View>

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
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: 12,
                    padding: 3,
                    gap: 2,
                  }}
                >
                  {PERIOD_VALUES.map((p) => (
                    <FilterPill
                      key={p}
                      label={t(`bookAppointment.periods.${p}`)}
                      active={period === p}
                      onPress={() => setPeriod(p)}
                      flex
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
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: spacing.md }}>
            {/* Unified Booking Summary Card */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: spacing.md,
                ...shadow.sm,
              }}
            >
              {/* Summary Header */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={20} color={colors.primary} strokeWidth={2.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.title.md,
                      { color: colors.text, fontWeight: "800", letterSpacing: -0.3 },
                    ]}
                  >
                    {t("bookAppointment.step3Title", "Appointment summary")}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                    {t("bookAppointment.step3Subtitle", "Review your visit details before submitting.")}
                  </Text>
                </View>
              </View>

              {/* Doctor Mini-Profile */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: 16,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.borderSoft,
                }}
              >
                <Avatar name={doctorDisplayName} size="md" tone="primary" />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}
                  >
                    {doctorDisplayName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[typography.caption, { color: colors.textMuted }]}
                  >
                    {selectedDoctor?.specialization || "Medical Specialist"}
                    {doctorHospitalName ? ` · ${doctorHospitalName}` : ""}
                  </Text>
                </View>
                {selectedDoctor?.slmcVerifiedAt ? (
                  <VerifiedBadge verified={true} size="sm" />
                ) : null}
              </View>

              {/* Appointment Schedule & Location Rows */}
              <View style={{ gap: spacing.sm }}>
                <SummaryRow
                  icon={CalendarIcon}
                  label={t("bookAppointment.summaryDate")}
                  value={formattedDate}
                />
                <View style={{ height: 1, backgroundColor: colors.borderSoft }} />
                <SummaryRow
                  icon={Clock}
                  label={t("bookAppointment.summaryTime")}
                  value={values.time || "—"}
                />
                <View style={{ height: 1, backgroundColor: colors.borderSoft }} />
                <SummaryRow
                  icon={Building2}
                  label={t("bookAppointment.summaryHospital")}
                  value={doctorHospitalName}
                />
                {selectedDoctor?.consultationFee ? (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.borderSoft }} />
                    <SummaryRow
                      icon={Wallet}
                      label={t("bookAppointment.summaryFee")}
                      value={`LKR ${Number(selectedDoctor.consultationFee).toLocaleString()}`}
                    />
                    <View style={{ height: 1, backgroundColor: colors.borderSoft }} />
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 4,
                      }}
                    >
                      <Text
                        style={[
                          typography.label.md,
                          { color: colors.text, fontWeight: "800" },
                        ]}
                      >
                        {t("bookAppointment.summaryTotal")}
                      </Text>
                      <Text
                        style={[
                          typography.title.md,
                          { color: colors.primary, fontWeight: "800" },
                        ]}
                      >
                        {`LKR ${Number(selectedDoctor.consultationFee).toLocaleString()}`}
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            </View>

            {/* Visit Preferences & Reason */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: spacing.md,
                ...shadow.sm,
              }}
            >
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
                      numberOfLines={2}
                      leadingIcon={FileText}
                      tone="soft"
                    />
                  )}
                />
              </FormField>

              <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                <Text style={[typography.label.md, { color: colors.text, fontWeight: "700" }]}>
                  {t("bookAppointment.step3ModeTitle")}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  {t("bookAppointment.step3ModeSubtitle")}
                </Text>
              </View>

              <View style={{ gap: spacing.sm }}>
                <Controller
                  control={control}
                  name="mode"
                  render={({ field: { value, onChange } }) => (
                    <>
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
                            gap: spacing.sm,
                            padding: spacing.sm + 2,
                            borderRadius: 12,
                            backgroundColor: colors.surfaceMuted,
                            borderWidth: 1,
                            borderColor: colors.borderSoft,
                          }}
                        >
                          <Info size={16} color={colors.textMuted} />
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textMuted, flex: 1, fontWeight: "500" },
                            ]}
                          >
                            {t("bookAppointment.videoUnavailableTitle")}: {t("bookAppointment.videoUnavailableBody")}
                          </Text>
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
          </View>
        ) : null}
      </View>

      {/* Footer — only needed for steps 2 & 3 */}
      {step > 1 ? (
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            marginTop: spacing.md,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.05,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Button
            title={t("bookAppointment.back")}
            variant="outline"
            onPress={handleBack}
            fullWidth={false}
            icon={ChevronLeft}
          />
          <View style={{ flex: 1 }}>
            {step === 2 ? (
              <Button
                title={t("bookAppointment.continue")}
                onPress={() => setStep(3)}
                disabled={
                  !values.date ||
                  !values.time ||
                  !!errors.date ||
                  !!errors.time
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
      ) : null}

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
          borderRadius: 12,
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
            typography.caption,
            { color: colors.textMuted, marginBottom: 2, fontWeight: "600" },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "700" },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// Specialty tile — compact card for the 2-column grid.
function SpecialtyCard({
  name,
  count,
  onPress,
  t,
}: {
  name: string;
  count: number;
  onPress: () => void;
  t: (k: string, opts?: any) => string;
}) {
  const { colors, spacing, typography } = useTheme();
  const IconComponent = getSpecialtyIcon(name);
  const accent = getSpecialtyAccent(name);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("bookAppointment.specialtyA11y", {
        specialty: name,
        count,
      })}
      testID={`specialty-${name}`}
      style={({ pressed }) => ({
        padding: spacing.md,
        borderRadius: 18,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderWidth: 1,
        borderColor: pressed ? colors.primary : colors.border,
        gap: spacing.sm,
        minHeight: 114,
        justifyContent: "space-between",
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          backgroundColor: withOpacity(accent, 0.12),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconComponent size={22} color={accent} strokeWidth={2.2} />
      </View>
      <View style={{ gap: 2 }}>
        <Text
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "700", letterSpacing: -0.2, fontSize: 14.5 },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "500" }]}>
          {count > 0
            ? `${count} doctor${count > 1 ? "s" : ""}`
            : t("bookAppointment.tapToChoose", { defaultValue: "Tap to view" })}
        </Text>
      </View>
    </Pressable>
  );
}

function FilterPill({
  label,
  active,
  onPress,
  flex,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  flex?: boolean;
}) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined,
        paddingHorizontal: flex ? 8 : 14,
        paddingVertical: 9,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active
          ? colors.surface
          : pressed
            ? "rgba(255,255,255,0.5)"
            : "transparent",
        borderWidth: active ? 1 : 0,
        borderColor: active ? colors.border : "transparent",
      })}
    >
      <Text
        style={[
          typography.label.md,
          {
            color: active ? colors.text : colors.textMuted,
            fontWeight: active ? "800" : "600",
            fontSize: 12.5,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active
          ? colors.primarySoft
          : pressed
            ? colors.surfaceMuted
            : colors.surface,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: active ? colors.primary : colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          size={20}
          color={active ? colors.onPrimary : colors.primary}
          strokeWidth={2.2}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
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
      ) : (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: colors.borderStrong,
          }}
        />
      )}
    </Pressable>
  );
}

function DoctorRow({
  doctor: d,
  selected,
  t,
  colors,
  typography,
  spacing,
  onPick,
}: {
  doctor: any;
  selected: boolean;
  t: (k: string, opts?: any) => string;
  colors: any;
  typography: any;
  spacing: any;
  onPick: () => void;
}) {
  const accent = getSpecialtyAccent(d.specialization || "");
  const Icon = getSpecialtyIcon(d.specialization || "");
  const feeStr =
    d.consultationFee != null
      ? t("bookAppointment.lkrFee", { fee: d.consultationFee })
      : null;
  const ratingStr = d.rating ? d.rating.toFixed(1) : null;

  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={d.name}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: 20,
        backgroundColor: selected
          ? colors.primarySoft
          : pressed
            ? colors.surfaceMuted
            : colors.surface,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.primary : colors.border,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: selected ? 0.1 : 0.05,
        shadowRadius: 10,
        elevation: selected ? 3 : 2,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} color="#FFFFFF" strokeWidth={2.3} />
      </View>
      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "800", letterSpacing: -0.2 },
          ]}
        >
          {d.name || t("bookAppointment.doctorFallback")}
        </Text>
        <Text
          numberOfLines={1}
          style={[typography.body.sm, { color: colors.textMuted }]}
        >
          {d.specialization || ""}
        </Text>
        {(feeStr || ratingStr) ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
            {ratingStr ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: colors.warningSoft,
                }}
              >
                <Text style={[typography.caption, { color: colors.warningMuted, fontWeight: "800" }]}>
                  {`★ ${ratingStr}`}
                </Text>
              </View>
            ) : null}
            {feeStr ? (
              <Text style={[typography.caption, { color: colors.text, fontWeight: "700" }]}>
                {feeStr}
              </Text>
            ) : null}
          </View>
        ) : null}
        {(d.slmcVerifiedAt || d.telemedicineEnabled || d.responseTime) ? (
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
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
          </View>
        ) : null}
      </View>
      {selected ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
          }}
        >
          <Check size={16} color={colors.onPrimary} strokeWidth={3} />
        </View>
      ) : (
        <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.25} />
      )}
    </Pressable>
  );
}