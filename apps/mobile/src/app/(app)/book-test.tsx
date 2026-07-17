// @ts-nocheck

import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
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
} from "lucide-react-native";
import {
  useBookTest,
  useTestTimeSlots,
  type TimeSlot,
} from "@/hooks/useApi";
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

const TIME_SLOT_ICONS: Record<string, string> = {
  sunrise: "🌅",
  sun: "☀️",
  sunset: "🌇",
};

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
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
    fastingRequired?: string;
    fastingHours?: string;
  }>();

  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
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
    if (step > 0) setStep(step - 1);
    else router.back();
  }, [step, router]);

  const onSubmit = useCallback(
    async (data: any) => {
      try {
        await bookTest.mutateAsync({
          bookingType,
          testId: params.testId,
          packageId: params.packageId,
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

        toast.show("Booking confirmed!", "success");
        router.replace("/test-bookings");
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
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader
        title="Book a Test"
        back
        onBack={handleBack}
      />

      {/* Stepper */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <Stepper steps={steps} current={step} />
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
                  backgroundColor: "#FEF3C7",
                  borderColor: "#FCD34D",
                  borderWidth: 1,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <AlertCircle size={18} color="#D97706" />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 10,
                      fontSize: 13,
                      color: "#92400E",
                      lineHeight: 20,
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
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                <CalendarIcon size={16} color={colors.primary} /> Select Date
              </Text>

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
                        width: 60,
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: 12,
                        marginRight: 8,
                        backgroundColor: selected
                          ? colors.primary
                          : d.isWeekend
                          ? colors.card + "80"
                          : colors.card,
                        borderWidth: selected ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "500",
                          color: selected ? "#fff" : colors.textSecondary,
                        }}
                      >
                        {d.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: "700",
                          color: selected ? "#fff" : colors.text,
                          marginVertical: 2,
                        }}
                      >
                        {d.day}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: selected ? "#ffffffcc" : colors.textSecondary,
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
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                <Clock size={16} color={colors.primary} /> Select Time Slot
              </Text>

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
                  const icon = TIME_SLOT_ICONS[slot.icon] || "⏰";

                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() =>
                        setValue("scheduledTimeSlot", slot.time)
                      }
                      style={{
                        width: "47%",
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: selected
                          ? colors.primary
                          : colors.card,
                        borderWidth: selected ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 18, marginBottom: 4 }}>
                        {icon}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: selected ? "#fff" : colors.text,
                        }}
                      >
                        {slot.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: selected ? "#ffffffcc" : colors.textSecondary,
                          marginTop: 2,
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
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 16,
                }}
              >
                <MapPin size={16} color={colors.primary} /> Collection Address
              </Text>

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
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 14,
                }}
              >
                Booking Summary
              </Text>

              {/* Test/Package */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                {bookingType === "single_test" ? (
                  <TestTube2 size={20} color={colors.primary} />
                ) : (
                  <Package size={20} color={colors.primary} />
                )}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {itemName}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {bookingType === "single_test"
                      ? "Single Test"
                      : "Health Package"}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
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
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <CalendarIcon size={18} color={colors.textSecondary} />
                <Text
                  style={{
                    marginLeft: 10,
                    fontSize: 14,
                    color: colors.text,
                  }}
                >
                  {formatDisplayDate(formValues.scheduledDate)}
                </Text>
                <Text
                  style={{
                    marginLeft: 16,
                    fontSize: 14,
                    color: colors.textSecondary,
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
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <MapPin size={18} color={colors.textSecondary} />
                <Text
                  style={{
                    marginLeft: 10,
                    fontSize: 14,
                    color: colors.text,
                    flex: 1,
                    lineHeight: 20,
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
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Phone size={18} color={colors.textSecondary} />
                <Text
                  style={{
                    marginLeft: 10,
                    fontSize: 14,
                    color: colors.text,
                  }}
                >
                  {formValues.contactPhone}
                </Text>
              </View>
            </Card>

            {/* Payment Method */}
            <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Payment Method
              </Text>

              {[
                {
                  value: "cash",
                  label: "Cash on Collection",
                  desc: "Pay when the phlebotomist arrives",
                  icon: <Banknote size={20} color="#059669" />,
                },
                {
                  value: "card",
                  label: "Card Payment",
                  desc: "Pay now with your debit/credit card",
                  icon: <CreditCard size={20} color="#3B82F6" />,
                },
                {
                  value: "online",
                  label: "Online Payment",
                  desc: "Pay via PayHere gateway",
                  icon: <Wallet size={20} color="#8B5CF6" />,
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
                    borderRadius: 12,
                    backgroundColor:
                      formValues.paymentMethod === method.value
                        ? colors.primary + "10"
                        : colors.card,
                    borderWidth: 1,
                    borderColor:
                      formValues.paymentMethod === method.value
                        ? colors.primary
                        : colors.border,
                    marginBottom: 8,
                  }}
                >
                  {method.icon}
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.text,
                      }}
                    >
                      {method.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {method.desc}
                    </Text>
                  </View>
                  {formValues.paymentMethod === method.value && (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
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
                  backgroundColor: "#FEF3C7",
                  borderColor: "#FCD34D",
                  borderWidth: 1,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Info size={18} color="#D97706" />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 10,
                      fontSize: 13,
                      color: "#92400E",
                      lineHeight: 20,
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
          backgroundColor: colors.surface,
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: 32,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {step > 0 && (
          <View style={{ flex: 1 }}>
            <Button
              variant="outline"
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
