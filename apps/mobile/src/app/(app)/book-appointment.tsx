// @ts-nocheck

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, BackHandler, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Lock,
  Star,
  Sunrise,
  Sun,
  Moon,
  BadgeCheck,
  CalendarX,
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
  Avatar,
  Pill,
  Stepper,
  EmptyState,
  ErrorState,
  Skeleton,
  BottomSheet,
  useToast,
  VerifiedBadge,
  Card,
  IconTile,
} from "@/components/ui";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong, fmtWeekdayShort, fmtMonthShort, fmtMonthYear } from "@/lib/format";
import { api } from "@/lib/api";
import { runPaymentsCheckout } from "@/lib/payments";

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
  const { spacing, colors, typography, shadow, scheme } = useTheme();
  const cardShadow = scheme === "dark" ? null : shadow.sm;
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

  const slotsByPeriod = useMemo(() => {
    const fromApi = availabilityData?.slots || [];
    const sourceSlots: string[] = fromApi.length > 0
      ? fromApi.filter((s) => s.available).map((s) => s.time)
      : TIME_SLOTS;
    const out = { morning: [] as string[], afternoon: [] as string[], evening: [] as string[] };
    for (const s of sourceSlots) {
      const h = parseInt(s.split(":")[0], 10);
      out[h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"].push(s);
    }
    return out;
  }, [availabilityData]);
  const slots = slotsByPeriod[period];

  // Rolling 30-day strip for the schedule step.
  const upcomingDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [step, step1View]);

  const shortDate = values.date
    ? `${fmtWeekdayShort(values.date, locale)}, ${values.date.getDate()} ${fmtMonthShort(values.date, locale)}`
    : "";
  const feeLabel = selectedDoctor?.consultationFee
    ? `LKR ${Number(selectedDoctor.consultationFee).toLocaleString()}`
    : null;

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
        // Initiate payment + open payments.lk checkout.
        try {
          setPaying(true);
          const init: any = await api.post("/payments/initiate", {
            appointmentId,
          });
          const result = await runPaymentsCheckout({
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

  const isDark = scheme === "dark";
  const stepKicker = [
    step1View === "doctors"
      ? t("bookAppointment.availableDoctors", { defaultValue: "Available doctors" })
      : t("bookAppointment.findCare", { defaultValue: "Find the right care" }),
    t("bookAppointment.step2Kicker", { defaultValue: "Schedule" }),
    t("bookAppointment.step3Kicker", { defaultValue: "Almost done" }),
  ][step - 1];

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false} keyboard>
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

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: step > 1 ? spacing.xxl : insets.bottom + spacing.xxl,
        }}
      >
        <View style={{ paddingTop: spacing.xs, paddingBottom: spacing.xl }}>
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
          <IntroBlock
            kicker={stepKicker}
            title={
              step === 1
                ? step1View === "doctors" && specialtyFilter
                  ? t("bookAppointment.step1DoctorsTitle", { specialty: specialtyFilter })
                  : step1View === "doctors"
                    ? t("bookAppointment.step1SearchTitle", { defaultValue: "Search results" })
                    : t("bookAppointment.step1SpecialtiesTitle", { defaultValue: "Choose a specialty" })
                : step === 2
                  ? t("bookAppointment.step2Heading", "Choose your visit time")
                  : t("bookAppointment.step3Heading", "Review & confirm")
            }
            subtitle={
              step === 1
                ? step1View === "doctors"
                  ? t("bookAppointment.step1DoctorsSubtitle", {
                      defaultValue: "Compare availability and choose the doctor who feels right for you.",
                    })
                  : t("bookAppointment.step1SpecialtiesSubtitle", {
                      defaultValue: "Browse doctors by what they treat. Tap a category to see who is available.",
                    })
                : step === 2
                  ? t("bookAppointment.step2Subtitle", "Pick a date and an available slot that works for you.")
                  : t("bookAppointment.step3Subtitle", "Review your booking before submitting.")
            }
          />

          {step === 1 ? (
            <View style={{ gap: spacing.lg }}>
              <TextInput
                placeholder={t("bookAppointment.searchPlaceholder", { defaultValue: "Search doctor or specialty..." })}
                value={query}
                onChangeText={setQuery}
                leadingIcon={Search}
                autoCapitalize="none"
              />

              {step1View === "specialties" ? (
                <>
                  <TrustStrip t={t} />

                  {filteredSpecialties.length === 0 ? (
                    <EmptyState
                      icon={Stethoscope}
                      title={t("bookAppointment.emptyTitle")}
                      message={t("bookAppointment.emptyBodyEmpty")}
                      tone="neutral"
                    />
                  ) : (
                    <View style={{ gap: spacing.md }}>
                      <SectionLabel
                        label={t("bookAppointment.browseSpecialties", { defaultValue: "Browse specialties" })}
                        trailing={t("bookAppointment.specialtiesCount", {
                          count: filteredSpecialties.length,
                          defaultValue: `${filteredSpecialties.length}`,
                        })}
                      />
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                        {filteredSpecialties.map((s, i) => (
                          <View key={`${s.name}-${i}`} style={{ width: "48%", flexGrow: 1, maxWidth: "48.5%" }}>
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
                    </View>
                  )}
                </>
              ) : (
                <View style={{ gap: spacing.md }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -spacing.lg }}
                    contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
                  >
                    <FilterChip
                      label={t("bookAppointment.changeSpecialty", "Change specialty")}
                      icon={ChevronLeft}
                      onPress={() => {
                        setQuery("");
                        setSpecialtyFilter(null);
                        setStep1View("specialties");
                      }}
                      testID="change-specialty"
                    />
                    {specialtyFilter ? (
                      <FilterChip label={specialtyFilter} active testID="active-specialty" />
                    ) : null}
                    <FilterChip
                      label={t("bookAppointment.telemedicineToggle")}
                      icon={Video}
                      active={telemedicineOnly}
                      onPress={() => setTelemedicineOnly((v) => !v)}
                      testID="telemedicine-toggle"
                    />
                  </ScrollView>

                  {doctorsLoading ? (
                    <View style={{ gap: spacing.md }}>
                      <Skeleton height={148} radius={22} />
                      <Skeleton height={148} radius={22} />
                      <Skeleton height={148} radius={22} />
                    </View>
                  ) : isError ? (
                    <ErrorState
                      title={t("recordDetail.errorTitle", "Couldn't load doctors")}
                      message={t("recordDetail.errorBody", "Check your connection and try again.")}
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
                    <View style={{ gap: spacing.md }}>
                      <SectionLabel
                        label={t("bookAppointment.searchDoctorsLabel", "Doctors")}
                        trailing={t("bookAppointment.specialtyCount", { count: filteredDoctors.length })}
                      />
                      {filteredDoctors.map((d, i) => (
                        <DoctorRow
                          key={`${d.doctorId}-${i}`}
                          doctor={d}
                          selected={values.doctorId === d.doctorId}
                          t={t}
                          onPick={() => {
                            const chosenId = d.doctorId || d.id || "";
                            setValue("doctorId", chosenId, { shouldValidate: true });
                            setValue("hospitalId", d.hospitalId || "", { shouldValidate: true });
                            setStep(2);
                          }}
                        />
                      ))}
                    </View>
                  )}

                  {errors.doctorId ? (
                    <Text style={[typography.caption, { color: colors.danger }]}>
                      {errors.doctorId.message}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: spacing.lg }}>
              {selectedDoctor ? (
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <DoctorAvatar name={selectedDoctor.name} specialization={selectedDoctor.specialization} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase" }]}>
                        {t("bookAppointment.yourDoctor", "Your doctor")}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text numberOfLines={1} style={[typography.title.md, { color: colors.text, flexShrink: 1 }]}>
                          {selectedDoctor.name}
                        </Text>
                        {selectedDoctor.slmcVerifiedAt ? (
                          <BadgeCheck size={16} color={colors.primary} strokeWidth={2.4} />
                        ) : null}
                      </View>
                      <Text numberOfLines={1} style={[typography.body.sm, { color: colors.textMuted }]}>
                        {selectedDoctor.specialization}
                        {selectedDoctor.hospitalName ? ` · ${selectedDoctor.hospitalName}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: "/(app)/doctor/[id]", params: { id: values.doctorId } })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t("bookAppointment.viewDetailsA11y", "View full doctor profile")}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.well,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <ArrowUpRight size={18} color={colors.text} strokeWidth={2.2} />
                    </Pressable>
                  </View>

                  {(feeLabel || selectedDoctor.yearsExperience || selectedDoctor.telemedicineEnabled || selectedDoctor.replyTimeMedianMinutes != null) ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: spacing.md,
                        paddingTop: spacing.md,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.separator,
                      }}
                    >
                      {feeLabel ? <Pill label={feeLabel} icon={Wallet} tone="neutral" size="sm" /> : null}
                      {selectedDoctor.yearsExperience ? (
                        <Pill
                          label={t("bookAppointment.experience", { years: selectedDoctor.yearsExperience })}
                          tone="neutral"
                          size="sm"
                        />
                      ) : null}
                      {selectedDoctor.telemedicineEnabled ? (
                        <Pill label={t("bookAppointment.telemedicineAvailable")} icon={Video} tone="success" size="sm" />
                      ) : null}
                      {selectedDoctor.replyTimeMedianMinutes != null ? (
                        <Pill label={`~${selectedDoctor.replyTimeMedianMinutes}m reply`} tone="info" size="sm" />
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              ) : null}

              {/* Date strip */}
              <Card>
                <CardHead
                  icon={CalendarIcon}
                  title={t("bookAppointment.selectDate", "Select a date")}
                  caption={fmtMonthYear(values.date ?? upcomingDays[0], locale)}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -spacing.lg, marginTop: spacing.lg }}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: 6 }}
                >
                  {upcomingDays.map((d, i) => (
                    <DateChip
                      key={d.toISOString()}
                      date={d}
                      weekday={i === 0 ? t("bookAppointment.today", "Today") : fmtWeekdayShort(d, locale)}
                      selected={!!values.date && values.date.toDateString() === d.toDateString()}
                      onPress={() => {
                        setValue("date", d, { shouldValidate: true });
                        setValue("time", "", { shouldValidate: false });
                      }}
                    />
                  ))}
                </ScrollView>
                {errors.date?.message ? (
                  <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.sm }]}>
                    {errors.date.message}
                  </Text>
                ) : null}
              </Card>

              {/* Time slots */}
              <Card>
                <CardHead
                  icon={Clock}
                  title={t("bookAppointment.step2Title", "Pick a time")}
                  caption={t("bookAppointment.timezoneNote", "Times shown in your local timezone")}
                />

                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: colors.fill,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    padding: 4,
                    gap: 4,
                    marginTop: spacing.lg,
                  }}
                >
                  {PERIOD_VALUES.map((p) => (
                    <PeriodTab
                      key={p}
                      icon={p === "morning" ? Sunrise : p === "afternoon" ? Sun : Moon}
                      label={t(`bookAppointment.periods.${p}`)}
                      count={slotsByPeriod[p].length}
                      active={period === p}
                      onPress={() => setPeriod(p)}
                    />
                  ))}
                </View>

                <View style={{ marginTop: spacing.lg }}>
                  {slots.length === 0 ? (
                    <View
                      style={{
                        alignItems: "center",
                        gap: spacing.sm,
                        paddingVertical: spacing.xl,
                        paddingHorizontal: spacing.lg,
                        borderRadius: 18,
                        borderCurve: "continuous",
                        backgroundColor: colors.well,
                      }}
                    >
                      <IconTile icon={CalendarX} tone="neutral" appearance="surface" size={44} />
                      <Text style={[typography.title.sm, { color: colors.text, textAlign: "center" }]}>
                        {t("bookAppointment.noSlotsTitle", "No slots in this period")}
                      </Text>
                      <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
                        {t("bookAppointment.noSlotsBody", "Try another time of day or pick a different date.")}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                      {slots.map((s) => (
                        <SlotChip
                          key={s}
                          label={s}
                          selected={values.time === s}
                          onPress={() => setValue("time", s, { shouldValidate: true })}
                        />
                      ))}
                    </View>
                  )}
                  {errors.time?.message ? (
                    <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.sm }]}>
                      {errors.time.message}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={{ gap: spacing.lg }}>
              {/* Ticket-style booking summary */}
              <Card padded={false} variant="elevated">
                <View style={{ padding: spacing.lg, gap: spacing.lg }}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.7, y: 0.8 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(255,255,255,0.18)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.35)",
                      }}
                    >
                      <Text style={[typography.title.md, { color: "#FFFFFF" }]}>
                        {initialsOf(doctorDisplayName)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text numberOfLines={1} style={[typography.title.md, { color: "#FFFFFF", flexShrink: 1 }]}>
                          {doctorDisplayName}
                        </Text>
                        {selectedDoctor?.slmcVerifiedAt ? (
                          <BadgeCheck size={16} color="#FFFFFF" strokeWidth={2.4} />
                        ) : null}
                      </View>
                      <Text numberOfLines={1} style={[typography.body.sm, { color: "rgba(255,255,255,0.82)" }]}>
                        {selectedDoctor?.specialization || "Medical Specialist"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <GlassStat icon={CalendarIcon} label={t("bookAppointment.summaryDate")} value={shortDate || formattedDate} />
                    <GlassStat icon={Clock} label={t("bookAppointment.summaryTime")} value={values.time || "—"} />
                  </View>
                </View>

                {/* Perforation */}
                <View style={{ height: 22, justifyContent: "center" }}>
                  <View
                    style={{
                      marginHorizontal: spacing.xl,
                      borderTopWidth: 1.5,
                      borderStyle: "dashed",
                      borderColor: colors.separator,
                    }}
                  />
                  <View style={[styles.notch, { left: -11, backgroundColor: colors.bg }]} />
                  <View style={[styles.notch, { right: -11, backgroundColor: colors.bg }]} />
                </View>

                <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
                  <SummaryRow icon={Building2} label={t("bookAppointment.summaryHospital")} value={doctorHospitalName} />
                  <SummaryRow
                    icon={values.mode === "video" ? Video : User}
                    label={t("bookAppointment.step3ModeTitle")}
                    value={
                      values.mode === "video"
                        ? t("bookAppointment.modeVideoLabel")
                        : t("bookAppointment.modeInPersonLabel")
                    }
                  />
                  {feeLabel ? (
                    <>
                      <SummaryRow icon={Wallet} label={t("bookAppointment.summaryFee")} value={feeLabel} />
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: spacing.xs,
                          paddingVertical: spacing.md,
                          paddingHorizontal: spacing.lg,
                          borderRadius: 16,
                          borderCurve: "continuous",
                          backgroundColor: colors.primarySoft,
                        }}
                      >
                        <Text style={[typography.title.sm, { color: colors.text }]}>
                          {t("bookAppointment.summaryTotal")}
                        </Text>
                        <Text style={[typography.title.lg, { color: colors.primary }]}>{feeLabel}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </Card>

              {/* Consultation mode */}
              <Card>
                <View style={{ gap: 2, marginBottom: spacing.md }}>
                  <Text style={[typography.title.md, { color: colors.text }]}>
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
                        <ModeOptionCard
                          active={value === "in_person"}
                          onPress={() => onChange("in_person")}
                          icon={User}
                          label={t("bookAppointment.modeInPersonLabel")}
                          body={t("bookAppointment.modeInPersonBody")}
                        />
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
                              padding: spacing.md,
                              borderRadius: 14,
                              borderCurve: "continuous",
                              backgroundColor: colors.well,
                            }}
                          >
                            <Info size={16} color={colors.textSubtle} />
                            <Text style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}>
                              {t("bookAppointment.videoUnavailableTitle")}: {t("bookAppointment.videoUnavailableBody")}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  />
                </View>
              </Card>

              {/* Reason */}
              <Card>
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
              </Card>

              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xs }}>
                <ShieldCheck size={16} color={colors.success} strokeWidth={2.3} />
                <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                  {t("bookAppointment.policyFull")}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky summary footer — steps 2 & 3 */}
      {step > 1 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? colors.borderStrong : colors.hairline,
            backgroundColor: isDark ? colors.bgElevated : colors.surface,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase" }]}>
              {step === 2
                ? t("bookAppointment.footerSlot", "Your slot")
                : t("bookAppointment.summaryTotal")}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                typography.title.md,
                {
                  color:
                    step === 2 && !(values.date && values.time) ? colors.textSubtle : colors.text,
                  marginTop: 2,
                },
              ]}
            >
              {step === 2
                ? values.date && values.time
                  ? `${shortDate} · ${values.time}`
                  : t("bookAppointment.footerPickSlot", "Choose a time")
                : feeLabel || t("bookAppointment.noUpfrontFee", "No upfront fee")}
            </Text>
          </View>
          {step === 2 ? (
            <Button
              title={t("bookAppointment.continue")}
              onPress={() => setStep(3)}
              fullWidth={false}
              disabled={!values.date || !values.time || !!errors.date || !!errors.time}
              iconRight={ChevronRight}
            />
          ) : (
            <Button
              title={t("bookAppointment.confirmBooking")}
              onPress={handleSubmit(onSubmit)}
              fullWidth={false}
              loading={bookAppointment.isPending || paying}
              iconRight={Check}
            />
          )}
        </View>
      ) : null}

      {/* Cancellation policy modal — gates the final confirm. */}
      <BottomSheet
        visible={policyOpen}
        onDismiss={() => setPolicyOpen(false)}
        title={t("bookAppointment.policyTitle")}
      >
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {t("bookAppointment.policyIntro")}
          </Text>
          <View
            style={{
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: colors.well,
              padding: spacing.md,
              gap: spacing.md,
            }}
          >
            <PolicyRow tone="success" text={t("bookAppointment.policyFull")} />
            <PolicyRow tone="warning" text={t("bookAppointment.policyHalf")} />
            <PolicyRow tone="danger" text={t("bookAppointment.policyNone")} />
          </View>
          {feeLabel ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Lock size={14} color={colors.textSubtle} strokeWidth={2.3} />
              <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                {t("bookAppointment.policyPayNote", { amount: feeLabel })}
              </Text>
            </View>
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

function initialsOf(name: string) {
  return (name || "?")
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function IntroBlock({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[typography.kicker, { color: colors.primary, textTransform: "uppercase" }]}>{kicker}</Text>
      <Text style={[typography.display.md, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body.md, { color: colors.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

function SectionLabel({ label, trailing }: { label: string; trailing?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={[typography.title.sm, { color: colors.text }]}>{label}</Text>
      {trailing ? <Text style={[typography.caption, { color: colors.textSubtle }]}>{trailing}</Text> : null}
    </View>
  );
}

function TrustStrip({ t }: { t: (k: string, o?: any) => string }) {
  const { colors, spacing, typography } = useTheme();
  const items = [
    { icon: ShieldCheck, label: t("bookAppointment.trustVerified", "Verified doctors") },
    { icon: Zap, label: t("bookAppointment.trustInstant", "Instant booking") },
    { icon: Lock, label: t("bookAppointment.trustSecure", "Secure payments") },
  ];
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {items.map(({ icon: Icon, label }) => (
        <View
          key={label}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm + 2,
            borderRadius: 14,
            borderCurve: "continuous",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon size={14} color={colors.primary} strokeWidth={2.4} />
          <Text numberOfLines={2} style={[typography.label.xs, { color: colors.primaryMuted, flex: 1 }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CardHead({ icon, title, caption }: { icon: any; title: string; caption?: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <IconTile icon={icon} tone="primary" size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title.md, { color: colors.text }]}>{title}</Text>
        {caption ? (
          <Text numberOfLines={1} style={[typography.caption, { color: colors.textSubtle, marginTop: 1 }]}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function FilterChip({
  label,
  icon: Icon,
  active,
  onPress,
  testID,
}: {
  label: string;
  icon?: any;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors, typography, scheme, shadow } = useTheme();
  const fg = active ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 38,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
        borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
        opacity: pressed ? 0.8 : 1,
        ...(scheme === "dark" ? null : active ? shadow.primary : shadow.xs),
      })}
    >
      {Icon ? <Icon size={15} color={fg} strokeWidth={2.4} /> : null}
      <Text style={[typography.label.md, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function DateChip({
  date,
  weekday,
  selected,
  onPress,
}: {
  date: Date;
  weekday: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, typography, shadow, scheme } = useTheme();
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={date.toDateString()}
      style={({ pressed }) => ({
        width: 60,
        paddingVertical: 12,
        alignItems: "center",
        gap: 4,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: selected ? colors.primary : colors.well,
        transform: [{ scale: pressed ? 0.95 : 1 }],
        ...(selected && scheme !== "dark" ? shadow.primary : null),
      })}
    >
      <Text
        numberOfLines={1}
        style={[
          typography.label.xs,
          { color: selected ? "rgba(255,255,255,0.85)" : weekend ? colors.accent2 : colors.textSubtle },
        ]}
      >
        {weekday}
      </Text>
      <Text style={[typography.title.lg, { color: selected ? colors.onPrimary : colors.text }]}>
        {date.getDate()}
      </Text>
    </Pressable>
  );
}

function PeriodTab({
  icon: Icon,
  label,
  count,
  active,
  onPress,
}: {
  icon: any;
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, typography, shadow, scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: 2,
        paddingVertical: 8,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: active ? (scheme === "dark" ? colors.surfaceElevated : colors.surface) : "transparent",
        ...(active && scheme !== "dark" ? shadow.xs : null),
        opacity: pressed && !active ? 0.6 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon size={14} color={active ? colors.primary : colors.textMuted} strokeWidth={2.4} />
        <Text numberOfLines={1} style={[typography.label.md, { color: active ? colors.text : colors.textMuted }]}>
          {label}
        </Text>
      </View>
      <Text style={[typography.caption, { fontSize: 11, color: count ? colors.textSubtle : colors.danger }]}>
        {count}
      </Text>
    </Pressable>
  );
}

function SlotChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, typography, shadow, scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexBasis: "22%",
        flexGrow: 1,
        maxWidth: "24%",
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        borderCurve: "continuous",
        backgroundColor: selected ? colors.primary : colors.well,
        borderWidth: selected ? 0 : StyleSheet.hairlineWidth,
        borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
        transform: [{ scale: pressed ? 0.95 : 1 }],
        ...(selected && scheme !== "dark" ? shadow.primary : null),
      })}
    >
      <Text style={[typography.title.sm, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function GlassStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  const { spacing, typography } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        gap: 4,
        padding: spacing.md,
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: "rgba(255,255,255,0.16)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.28)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon size={13} color="rgba(255,255,255,0.85)" strokeWidth={2.4} />
        <Text style={[typography.caption, { color: "rgba(255,255,255,0.85)" }]}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={[typography.title.md, { color: "#FFFFFF" }]}>
        {value}
      </Text>
    </View>
  );
}

function PolicyRow({ tone, text }: { tone: "success" | "warning" | "danger"; text: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: colors[tone] }} />
      <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>{text}</Text>
    </View>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.well,
        }}
      >
        <Icon size={17} color={colors.textMuted} strokeWidth={2.25} />
      </View>
      <Text numberOfLines={1} style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text, maxWidth: "55%", textAlign: "right" }]}>
        {value}
      </Text>
    </View>
  );
}

// Specialty tile — premium card for the 2-column grid.
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
    <Card
      onPress={onPress}
      accessibilityLabel={t("bookAppointment.specialtyA11y", { specialty: name, count })}
      style={{ minHeight: 138, justifyContent: "space-between", gap: spacing.lg }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -28,
          right: -28,
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: withOpacity(accent, 0.07),
        }}
      />
      <View testID={`specialty-${name}`} style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: "continuous",
            backgroundColor: withOpacity(accent, 0.13),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconComponent size={22} color={accent} strokeWidth={2.2} />
        </View>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.well,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowUpRight size={15} color={colors.textMuted} strokeWidth={2.4} />
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          {count > 0
            ? t("bookAppointment.specialtyCount", { count })
            : t("bookAppointment.tapToChoose", { defaultValue: "Tap to view" })}
        </Text>
      </View>
    </Card>
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
  const { colors, spacing, typography, scheme } = useTheme();
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
        minHeight: 72,
        borderRadius: 18,
        borderCurve: "continuous",
        borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
        borderColor: active ? colors.primary : scheme === "dark" ? colors.borderStrong : colors.hairline,
        backgroundColor: active ? colors.primarySoft : colors.well,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <IconTile icon={Icon} tone="primary" appearance={active ? "solid" : "surface"} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.title.sm, { color: colors.text }]}>{label}</Text>
        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>{body}</Text>
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: active ? 0 : 1.5,
          borderColor: colors.borderStrong,
          backgroundColor: active ? colors.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {active ? <Check size={13} color={colors.onPrimary} strokeWidth={3.2} /> : null}
      </View>
    </Pressable>
  );
}

function DoctorAvatar({ name, specialization }: { name?: string; specialization?: string }) {
  const { colors } = useTheme();
  const accent = getSpecialtyAccent(specialization || "");
  const Icon = getSpecialtyIcon(specialization || "");
  return (
    <View>
      <Avatar name={name} size="lg" tone="primary" />
      <View
        style={{
          position: "absolute",
          right: -3,
          bottom: -3,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: accent,
          borderWidth: 2,
          borderColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={11} color="#FFFFFF" strokeWidth={2.6} />
      </View>
    </View>
  );
}

function DoctorRow({
  doctor: d,
  selected,
  t,
  onPick,
}: {
  doctor: any;
  selected: boolean;
  t: (k: string, opts?: any) => string;
  onPick: () => void;
}) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const feeStr =
    d.consultationFee != null
      ? `LKR ${Number(d.consultationFee).toLocaleString()}`
      : null;
  const ratingStr = d.rating ? Number(d.rating).toFixed(1) : null;
  const meta = [
    d.yearsExperience ? t("bookAppointment.experience", { years: d.yearsExperience }) : null,
    d.responseTime === "fast"
      ? t("bookAppointment.responseFast")
      : d.responseTime === "quick"
        ? t("bookAppointment.responseQuick")
        : null,
  ].filter(Boolean);

  return (
    <Card
      onPress={onPick}
      accessibilityLabel={d.name}
      style={selected ? { borderWidth: 1.5, borderColor: colors.primary } : undefined}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <DoctorAvatar name={d.name} specialization={d.specialization} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text numberOfLines={1} style={[typography.title.md, { color: colors.text, flexShrink: 1 }]}>
              {d.name || t("bookAppointment.doctorFallback")}
            </Text>
            {d.slmcVerifiedAt ? <BadgeCheck size={16} color={colors.primary} strokeWidth={2.4} /> : null}
          </View>
          <Text numberOfLines={1} style={[typography.body.sm, { color: colors.textMuted }]}>
            {d.specialization || ""}
            {d.hospitalName ? ` · ${d.hospitalName}` : ""}
          </Text>
          {(ratingStr || meta.length) ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              {ratingStr ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Star size={12} color={colors.warning} fill={colors.warning} strokeWidth={2} />
                  <Text style={[typography.label.sm, { color: colors.text }]}>{ratingStr}</Text>
                </View>
              ) : null}
              {meta.map((m, i) => (
                <Text key={i} numberOfLines={1} style={[typography.caption, { color: colors.textSubtle, flexShrink: 1 }]}>
                  {ratingStr || i > 0 ? "· " : ""}
                  {m}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {feeStr ? (
            <>
              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                {t("bookAppointment.summaryFee")}
              </Text>
              <Text style={[typography.title.sm, { color: colors.text }]}>{feeStr}</Text>
            </>
          ) : d.slmcVerifiedAt ? (
            <VerifiedBadge verified regNo={d.slmcRegistrationNo} />
          ) : null}
        </View>
        {d.telemedicineEnabled ? (
          <Pill tone="success" icon={Video} size="sm" testID="card-online">
            {t("bookAppointment.telemedicineAvailable")}
          </Pill>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            height: 34,
            paddingLeft: 14,
            paddingRight: 10,
            borderRadius: 999,
            backgroundColor: colors.primary,
            ...(scheme === "dark" ? null : shadow.primary),
          }}
        >
          <Text style={[typography.label.md, { color: colors.onPrimary }]}>
            {selected ? t("bookAppointment.selected", "Selected") : t("bookAppointment.book", "Book")}
          </Text>
          {selected ? (
            <Check size={14} color={colors.onPrimary} strokeWidth={3} />
          ) : (
            <ChevronRight size={15} color={colors.onPrimary} strokeWidth={2.6} />
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  notch: {
    position: "absolute",
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
  },
});
