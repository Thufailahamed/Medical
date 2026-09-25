// @ts-nocheck

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  BackHandler,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Phone,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  FileText,
  Banknote,
  Wallet,
  TestTube2,
  Package,
  Info,
  Sunrise,
  Sun,
  Sunset,
} from "lucide-react-native";
import {
  useBookTest,
  useTestTimeSlots,
  type TimeSlot,
} from "@/hooks/useApi";
import { api } from "@/lib/api";
import { runPaymentsCheckout } from "@/lib/payments";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Stepper,
  FormField,
  TextInput as TextField,
  useToast,
  SelectField,
} from "@/components/ui";

const DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Mullaitivu", "Vavuniya", "Trincomalee", "Batticaloa", "Ampara",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

const TIME_SLOT_ICONS: Record<string, any> = {
  sunrise: Sunrise,
  sun: Sun,
  sunset: Sunset,
};

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

// Section title with a tinted icon tile — presentation only.
function StepTitle({ icon: Icon, children }: { icon?: any; children: any }) {
  const { colors, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
      }}
    >
      {Icon ? (
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            borderCurve: "continuous",
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} color={colors.primary} strokeWidth={2.3} />
        </View>
      ) : null}
      <Text style={{ ...typography.title.md, color: colors.text, flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-LK", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const buildSchema = (t: (k: string) => string) =>
  z.object({
    scheduledDate: z.string().min(1, "Please select a date"),
    scheduledTimeSlot: z.string().min(1, "Please select a time slot"),
    addressLine1: z.string().min(1, "Address is required").max(200),
    addressLine2: z.string().max(200).optional(),
    city: z.string().min(1, "City is required").max(100),
    district: z.string().min(1, "District is required"),
    contactPhone: z
      .string()
      .min(7, "Phone number is required")
      .max(16),
    specialInstructions: z.string().max(500).optional(),
    paymentMethod: z.enum(["cash", "card", "online"]),
  });

export default function BookTestScreen() {
  const params = useLocalSearchParams<{
    bookingType: string;
    testId?: string;
    testName?: string;
    packageId?: string;
    packageName?: string;
    testPrice?: string;
    labPartnerId?: string;
    labName?: string;
    fastingRequired?: string;
    fastingHours?: string;
  }>();

  const { t } = useTranslation();
  const { colors, typography, radius, shadow, scheme } = useTheme();
  const router = useRouter();
  const hairline = scheme === "dark" ? colors.borderStrong : colors.separator;
  const toast = useToast();

  const [step, setStep] = useState(0);
  const bookTest = useBookTest();
  const { data: timeSlotsData } = useTestTimeSlots();

  const bookingType = (params.bookingType as "single_test" | "package") || "single_test";
  const itemName = params.testName || params.packageName || "Test";
  const price = Number(params.testPrice) || 0;
  const isFasting = params.fastingRequired === "1";
  const fastingHours = Number(params.fastingHours) || 0;

  const schema = useMemo(() => buildSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      scheduledDate: "",
      scheduledTimeSlot: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      district: "",
      contactPhone: "",
      specialInstructions: "",
      paymentMethod: "cash" as const,
    },
  });

  const formValues = watch();

  // Generate next 14 days
  const dates = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      result.push({
        value: formatDate(d),
        label: d.toLocaleDateString("en-LK", { weekday: "short" }),
        day: d.getDate(),
        month: d.toLocaleDateString("en-LK", { month: "short" }),
        isWeekend: d.getDay() === 0,
      });
    }
    return result;
  }, []);

  const timeSlots = timeSlotsData?.slots || [
    { id: "morning_early", label: "Early Morning", time: "06:00-08:00", icon: "sunrise" },
    { id: "morning", label: "Morning", time: "08:00-10:00", icon: "sun" },
    { id: "morning_late", label: "Late Morning", time: "10:00-12:00", icon: "sun" },
    { id: "afternoon", label: "Afternoon", time: "12:00-14:00", icon: "sun" },
    { id: "afternoon_late", label: "Late Afternoon", time: "14:00-16:00", icon: "sun" },
    { id: "evening", label: "Evening", time: "16:00-18:00", icon: "sunset" },
  ];

  const canProceed = useCallback(() => {
    if (step === 0) {
      return formValues.scheduledDate && formValues.scheduledTimeSlot;
    }
    if (step === 1) {
      return (
        formValues.addressLine1 &&
        formValues.city &&
        formValues.district &&
        formValues.contactPhone
      );
    }
    return true;
  }, [step, formValues]);

  const handleNext = useCallback(async () => {
    if (step === 0) {
      if (!formValues.scheduledDate || !formValues.scheduledTimeSlot) {
        toast.show("Please select a date and time slot", "error");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      const valid = await trigger([
        "addressLine1",
        "city",
        "district",
        "contactPhone",
      ]);
      if (valid) setStep(2);
    }
  }, [step, formValues, trigger, toast]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)");
    }
  }, [step, router]);

  useEffect(() => {
    const onBackPress = () => {
      if (step > 0) {
        setStep(step - 1);
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
  }, [step, router]);

  const onSubmit = useCallback(
    async (data: any) => {
      try {
        const res: any = await bookTest.mutateAsync({
          bookingType,
          testId: params.testId,
          packageId: params.packageId,
          ...(params.labPartnerId ? { labPartnerId: params.labPartnerId } : {}),
          scheduledDate: data.scheduledDate,
          scheduledTimeSlot: data.scheduledTimeSlot,
          collectionAddress: {
            line1: data.addressLine1,
            line2: data.addressLine2 || undefined,
            city: data.city,
            district: data.district,
            contactPhone: data.contactPhone,
            specialInstructions: data.specialInstructions || undefined,
          },
          paymentMethod: data.paymentMethod,
        });

        const bookingId = res?.booking?.id;
        const method = data.paymentMethod as "cash" | "card" | "online";

        // Cash on collection: done (no online charge).
        if (method === "cash" || !bookingId) {
          toast.show("Booking confirmed!", "success");
          router.replace("/test-bookings");
          return;
        }

        // Lab flow: card/online now charged via payments.lk TB- order.
        // Book created pending + bookingId → initiate → checkout → pending
        // polling to booking detail (GET /payments/:id → test_booking_detail).
        try {
          const init: any = await api("/payments/initiate", {
            method: "POST",
            body: { testBookingId: bookingId },
          });
          const result = await runPaymentsCheckout({
            checkoutUrl: init.checkoutUrl,
            pollStatus: async () => {
              const s: any = await api(`/payments/${bookingId}`);
              return { status: s.status };
            },
          });
          if (result.status === "paid") {
            toast.show("Payment confirmed!", "success");
          } else if (result.status === "cancelled") {
            toast.show("Booking created — payment pending.", "info");
          } else {
            toast.show("Booking created — payment pending.", "info");
          }
          router.replace(`/test-booking-detail/${bookingId}`);
        } catch (payErr: any) {
          // Booking exists; payment can be retried from booking detail.
          toast.show("Booking created — payment pending.", "info");
          router.replace(`/test-booking-detail/${bookingId}`);
        }
      } catch (err: any) {
        toast.show(
          err?.message || "Failed to book. Please try again.",
          "error"
        );
      }
    },
    [bookTest, bookingType, params, router, toast]
  );

  const steps = ["Schedule", "Address", "Confirm"];

  return (
    <Screen padded={false} bottomInset={false} edges={["top"]}>
      <ScreenHeader
        title="Book a Test"
        back
        onBack={handleBack}
      />

      <View style={{ marginBottom: 16 }}>
        <Stepper steps={steps} current={step} />
      </View>

      {/* Selected item chip */}
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: radius.card,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: hairline,
          ...(scheme === "dark" ? {} : shadow.sm),
        }}
      >
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
          {bookingType === "single_test" ? (
            <TestTube2 size={18} color={colors.primary} strokeWidth={2.3} />
          ) : (
            <Package size={18} color={colors.primary} strokeWidth={2.3} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ ...typography.title.sm, fontFamily: typography.title.md.fontFamily, color: colors.text }}
          >
            {itemName}
          </Text>
        </View>
        <Text style={{ ...typography.title.md, letterSpacing: -0.4, color: colors.text }}>
          {formatPrice(price)}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ─── Step 0: Schedule ─────────────────────────── */}
        {step === 0 && (
          <View>
            {/* Fasting Warning */}
            {isFasting && (
              <Card
                style={{
                  marginHorizontal: 16,
                  marginBottom: 12,
                  padding: 14,
                  backgroundColor: colors.warningSoft,
                  borderWidth: 0,
                }}
                elevated={false}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <AlertCircle size={18} color={colors.warning} strokeWidth={2.3} />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 10,
                      ...typography.body.sm,
                      color: colors.text,
                    }}
                  >
                    This test requires {fastingHours} hours of fasting. Please
                    select an early morning slot for best results.
                  </Text>
                </View>
              </Card>
            )}

            {/* Date Selection */}
            <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
              <StepTitle icon={CalendarIcon}>Select Date</StepTitle>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {dates.map((d) => {
                  const selected = formValues.scheduledDate === d.value;
                  return (
                    <Pressable
                      key={d.value}
                      onPress={() => setValue("scheduledDate", d.value)}
                      style={{
                        width: 58,
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: 16,
                        borderCurve: "continuous",
                        marginRight: 8,
                        backgroundColor: selected
                          ? colors.primary
                          : colors.fill,
                        ...(selected && scheme !== "dark" ? shadow.primary : {}),
                      }}
                    >
                      <Text
                        style={{
                          ...typography.label.xs,
                          color: selected ? "rgba(255,255,255,0.85)" : colors.textMuted,
                        }}
                      >
                        {d.label}
                      </Text>
                      <Text
                        style={{
                          ...typography.title.lg,
                          color: selected ? "#fff" : colors.text,
                          marginVertical: 2,
                        }}
                      >
                        {d.day}
                      </Text>
                      <Text
                        style={{
                          ...typography.caption,
                          fontSize: 11,
                          color: selected ? "rgba(255,255,255,0.8)" : colors.textSubtle,
                        }}
                      >
                        {d.month}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Card>

            {/* Time Slot Selection */}
            <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
              <StepTitle icon={Clock}>Select Time Slot</StepTitle>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {timeSlots.map((slot) => {
                  const selected =
                    formValues.scheduledTimeSlot === slot.time;
                  const SlotIcon = TIME_SLOT_ICONS[slot.icon] || Clock;

                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() =>
                        setValue("scheduledTimeSlot", slot.time)
                      }
                      style={{
                        width: "47%",
                        flexGrow: 1,
                        padding: 14,
                        borderRadius: 16,
                        borderCurve: "continuous",
                        backgroundColor: selected
                          ? colors.primarySoft
                          : colors.fill,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : "transparent",
                        gap: 4,
                      }}
                    >
                      <SlotIcon
                        size={18}
                        color={selected ? colors.primary : colors.textMuted}
                        strokeWidth={2.3}
                      />
                      <Text
                        style={{
                          ...typography.title.xs,
                          color: colors.text,
                          marginTop: 4,
                        }}
                      >
                        {slot.label}
                      </Text>
                      <Text
                        style={{
                          ...typography.caption,
                          color: selected ? colors.primary : colors.textMuted,
                        }}
                      >
                        {slot.time}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* ─── Step 1: Address ──────────────────────────── */}
        {step === 1 && (
          <View>
            <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
              <StepTitle icon={MapPin}>Collection Address</StepTitle>

              <Controller
                control={control}
                name="addressLine1"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField label="Address Line 1" error={errors.addressLine1?.message} style={{ marginBottom: 16 }}>
                    <TextField
                      placeholder="House number, street name"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="addressLine2"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField label="Address Line 2 (optional)" style={{ marginBottom: 16 }}>
                    <TextField
                      placeholder="Apartment, suite, floor"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="city"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField label="City" error={errors.city?.message} style={{ marginBottom: 16 }}>
                    <TextField
                      placeholder="e.g. Colombo, Kandy"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="district"
                render={({ field: { onChange, value } }) => (
                  <SelectField
                    label="District"
                    placeholder="Select district"
                    value={value}
                    onChange={onChange}
                    options={DISTRICTS}
                    error={errors.district?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="contactPhone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField
                    label="Contact Phone"
                    error={errors.contactPhone?.message}
                    style={{ marginBottom: 16 }}
                  >
                    <TextField
                      placeholder="07X XXX XXXX"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="phone-pad"
                    />
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="specialInstructions"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField label="Special Instructions (optional)" style={{ marginBottom: 16 }}>
                    <TextField
                      placeholder="Landmark, gate code, etc."
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={3}
                    />
                  </FormField>
                )}
              />
            </Card>
          </View>
        )}

        {/* ─── Step 2: Confirm & Pay ────────────────────── */}
        {step === 2 && (
          <View>
            {/* Booking Summary */}
            <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
              <StepTitle>Booking Summary</StepTitle>

              {/* Test/Package */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor: colors.surfaceMuted,
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
                  {bookingType === "single_test" ? (
                    <TestTube2 size={18} color={colors.primary} strokeWidth={2.3} />
                  ) : (
                    <Package size={18} color={colors.primary} strokeWidth={2.3} />
                  )}
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text
                    style={{
                      ...typography.title.sm,
                      color: colors.text,
                    }}
                  >
                    {itemName}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.textSubtle, marginTop: 1 }}>
                    {bookingType === "single_test"
                      ? "Single Test"
                      : "Health Package"}
                  </Text>
                </View>
                <Text
                  style={{
                    ...typography.title.lg,
                    color: colors.text,
                  }}
                >
                  {formatPrice(price)}
                </Text>
              </View>

              {/* Date & Time */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  minHeight: 48,
                }}
              >
                <CalendarIcon size={18} color={colors.textSubtle} />
                <Text
                  style={{
                    marginLeft: 12,
                    ...typography.label.lg,
                    color: colors.text,
                  }}
                >
                  {formatDisplayDate(formValues.scheduledDate)}
                </Text>
                <Text
                  style={{
                    marginLeft: 12,
                    ...typography.body.md,
                    color: colors.textMuted,
                  }}
                >
                  {formValues.scheduledTimeSlot}
                </Text>
              </View>

              {/* Address */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  paddingVertical: 12,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.separator,
                }}
              >
                <MapPin size={18} color={colors.textSubtle} />
                <Text
                  style={{
                    marginLeft: 12,
                    ...typography.body.md,
                    color: colors.text,
                    flex: 1,
                  }}
                >
                  {formValues.addressLine1}
                  {formValues.addressLine2
                    ? `, ${formValues.addressLine2}`
                    : ""}
                  {"\n"}
                  {formValues.city}, {formValues.district}
                </Text>
              </View>

              {/* Contact */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.separator,
                }}
              >
                <Phone size={18} color={colors.textSubtle} />
                <Text
                  style={{
                    marginLeft: 12,
                    ...typography.body.md,
                    color: colors.text,
                  }}
                >
                  {formValues.contactPhone}
                </Text>
              </View>
            </Card>

            {/* Payment Method */}
            <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
              <StepTitle icon={CreditCard}>Payment Method</StepTitle>

              {[
                {
                  value: "cash",
                  label: "Cash on Collection",
                  desc: "Pay when the phlebotomist arrives",
                  icon: <Banknote size={18} color={colors.success} strokeWidth={2.3} />,
                },
                {
                  value: "card",
                  label: "Card Payment",
                  desc: "Pay now with your debit/credit card",
                  icon: <CreditCard size={18} color={colors.info} strokeWidth={2.3} />,
                },
                {
                  value: "online",
                  label: "Online Payment",
                  desc: "Pay via PayHere gateway",
                  icon: <Wallet size={18} color={colors.primary} strokeWidth={2.3} />,
                },
              ].map((method) => (
                <Pressable
                  key={method.value}
                  onPress={() =>
                    setValue(
                      "paymentMethod",
                      method.value as "cash" | "card" | "online"
                    )
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    minHeight: 64,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    backgroundColor:
                      formValues.paymentMethod === method.value
                        ? colors.primarySoft
                        : colors.surfaceMuted,
                    borderWidth: 1.5,
                    borderColor:
                      formValues.paymentMethod === method.value
                        ? colors.primary
                        : "transparent",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      backgroundColor: colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {method.icon}
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={{
                        ...typography.title.xs,
                        fontSize: 14,
                        color: colors.text,
                      }}
                    >
                      {method.label}
                    </Text>
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textMuted,
                        marginTop: 2,
                      }}
                    >
                      {method.desc}
                    </Text>
                  </View>
                  {formValues.paymentMethod === method.value && (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: colors.primary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={14} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </Card>

            {/* Fasting Reminder */}
            {isFasting && (
              <Card
                style={{
                  marginHorizontal: 16,
                  marginBottom: 12,
                  padding: 14,
                  backgroundColor: colors.warningSoft,
                  borderWidth: 0,
                }}
                elevated={false}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Info size={18} color={colors.warning} strokeWidth={2.3} />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 10,
                      ...typography.body.sm,
                      color: colors.text,
                    }}
                  >
                    Remember: Do not eat or drink anything (except water) for{" "}
                    {fastingHours} hours before your sample collection.
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.bgElevated ?? colors.surface,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 32,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {step > 0 && (
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              title="Back"
              icon={ChevronLeft}
              onPress={handleBack}
              style={{ width: "100%" }}
            />
          </View>
        )}

        <View style={{ flex: 1 }}>
          {step < 2 ? (
            <Button
              title="Continue"
              iconRight={ChevronRight}
              onPress={handleNext}
              disabled={!canProceed()}
              style={{ width: "100%" }}
            />
          ) : (
            <Button
              title={bookTest.isPending ? "Booking..." : `Confirm — ${formatPrice(price)}`}
              loading={bookTest.isPending}
              onPress={handleSubmit(onSubmit)}
              style={{ width: "100%" }}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
