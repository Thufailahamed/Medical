// @ts-nocheck

import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  TestTube2,
  Package,
  Clock,
  MapPin,
  Calendar,
  Phone,
  User,
  CheckCircle2,
  XCircle,
  Truck,
  FlaskConical,
  Loader2,
  Home,
  Download,
  Share2,
  AlertCircle,
  FileText,
  ChevronRight,
  Ban,
  RefreshCw,
  Star,
} from "lucide-react-native";
import {
  useTestBookingDetail,
  useCancelTestBooking,
  useRescheduleTestBooking,
  useTestTimeSlots,
  type TestBooking,
} from "@/hooks/useApi";
import { api } from "@/lib/api";
import { runPayHereCheckout } from "@/lib/payhere";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  EmptyState,
  useToast,
} from "@/components/ui";

const STATUS_STEPS = [
  { key: "pending", label: "Booking Received", icon: Clock },
  { key: "confirmed", label: "Confirmed by Lab", icon: CheckCircle2 },
  { key: "phlebotomist_assigned", label: "Phlebotomist Assigned", icon: User },
  { key: "sample_collection_en_route", label: "En Route to You", icon: Truck },
  { key: "sample_collected", label: "Sample Collected", icon: FlaskConical },
  { key: "in_progress", label: "Testing in Progress", icon: Loader2 },
  { key: "completed", label: "Results Ready", icon: CheckCircle2 },
];

const STATUS_ORDER = STATUS_STEPS.map((s) => s.key);

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending: { color: "#D97706", bg: "#FEF3C7" },
  confirmed: { color: "#3B82F6", bg: "#EFF6FF" },
  phlebotomist_assigned: { color: "#8B5CF6", bg: "#F5F3FF" },
  sample_collection_en_route: { color: "#F97316", bg: "#FFF7ED" },
  sample_collected: { color: "#06B6D4", bg: "#ECFEFF" },
  in_progress: { color: "#8B5CF6", bg: "#F5F3FF" },
  completed: { color: "#059669", bg: "#ECFDF5" },
  cancelled: { color: "#EF4444", bg: "#FEF2F2" },
  rescheduled: { color: "#6B7280", bg: "#F9FAFB" },
};

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-LK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function TestBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const { data, isLoading, error } = useTestBookingDetail(id);
  const cancelBooking = useCancelTestBooking();
  const rescheduleBooking = useRescheduleTestBooking();
  const { data: timeSlotsData } = useTestTimeSlots();
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newSlot, setNewSlot] = useState("");
  const [paying, setPaying] = useState(false);

  const handleCancel = useCallback(() => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelBooking.mutateAsync({ id: id! });
              toast.show("Booking cancelled", "success");
            } catch (err: any) {
              toast.show(
                err?.message || "Failed to cancel booking",
                "error"
              );
            }
          },
        },
      ]
    );
  }, [id, cancelBooking, toast]);

  const handleCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`);
  }, []);

  if (isLoading) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Booking Details" back />
        <View style={{ padding: 16 }}>
          <Skeleton style={{ height: 200, borderRadius: 16, marginBottom: 16 }} />
          <Skeleton style={{ height: 300, borderRadius: 12 }} />
        </View>
      </Screen>
    );
  }

  if (error || !data?.booking) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Booking Details" back />
        <EmptyState
          icon={AlertCircle}
          title="Booking not found"
          description="This booking may have been removed."
        />
      </Screen>
    );
  }

  const booking = data.booking;
  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const currentStepIndex = STATUS_ORDER.indexOf(booking.status);
  const isCancelled = booking.status === "cancelled";
  const isRescheduled = booking.status === "rescheduled";
  const isCompleted = booking.status === "completed";
  const canCancel = ["pending", "confirmed", "phlebotomist_assigned", "sample_collection_en_route"].includes(
    booking.status
  );
  const canReschedule = ["pending", "confirmed", "phlebotomist_assigned"].includes(
    booking.status
  );
  const canPayRetry =
    (booking.paymentStatus === "pending" || (booking as any).paymentStatus === "failed") &&
    booking.paymentMethod !== "cash" &&
    !["cancelled", "completed", "rescheduled"].includes(booking.status);

  const handlePayRetry = useCallback(async () => {
    setPaying(true);
    try {
      const init: any = await api("/payments/initiate", {
        method: "POST",
        body: { testBookingId: id },
      });
      const result = await runPayHereCheckout({
        appointmentId: id!,
        fields: init.fields,
        checkoutUrl: init.checkoutUrl,
        pollStatus: async () => {
          const s: any = await api(`/payments/${id}`);
          return { status: s.status };
        },
      });
      toast.show(
        result.status === "paid" ? "Payment confirmed!" : "Payment pending.",
        result.status === "paid" ? "success" : "info"
      );
    } catch (err: any) {
      toast.show(err?.message || "Could not start payment.", "error");
    } finally {
      setPaying(false);
    }
  }, [id, toast]);

  const handleRescheduleConfirm = useCallback(async () => {
    if (!newDate || !newSlot) {
      toast.show("Pick a date and time slot", "error");
      return;
    }
    try {
      await rescheduleBooking.mutateAsync({
        id: id!,
        scheduledDate: newDate,
        scheduledTimeSlot: newSlot,
      });
      toast.show("Rescheduled — the lab will re-confirm.", "success");
      setShowReschedule(false);
    } catch (err: any) {
      toast.show(err?.message || "Failed to reschedule", "error");
    }
  }, [id, newDate, newSlot, rescheduleBooking, toast]);

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title="Booking Details" back />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Status Banner */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 12,
            backgroundColor: statusCfg.bg,
            borderRadius: 16,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {isCancelled ? (
            <XCircle size={28} color={statusCfg.color} />
          ) : isCompleted ? (
            <CheckCircle2 size={28} color={statusCfg.color} />
          ) : (
            <Loader2 size={28} color={statusCfg.color} />
          )}
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: statusCfg.color,
              }}
            >
              {isCancelled
                ? "Booking Cancelled"
                : isCompleted
                ? "Results Ready!"
                : isRescheduled
                ? "Booking Rescheduled"
                : "Booking Active"}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: statusCfg.color + "cc",
                marginTop: 2,
              }}
            >
              {isCancelled
                ? booking.cancellationReason || "This booking has been cancelled"
                : isCompleted
                ? "Your test results are available below"
                : `Status: ${booking.status.replace(/_/g, " ")}`}
            </Text>
          </View>
        </View>

        {/* Status Timeline (for active/completed bookings) */}
        {!isCancelled && !isRescheduled && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Progress
            </Text>

            {STATUS_STEPS.map((step, index) => {
              const isPast = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isFuture = index > currentStepIndex;
              const StepIcon = step.icon;

              return (
                <View
                  key={step.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    marginBottom: index < STATUS_STEPS.length - 1 ? 16 : 0,
                  }}
                >
                  {/* Icon + Line */}
                  <View
                    style={{
                      alignItems: "center",
                      width: 32,
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isPast || isCurrent
                          ? colors.primary
                          : colors.card,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: isFuture ? 2 : 0,
                        borderColor: colors.border,
                      }}
                    >
                      {isPast ? (
                        <CheckCircle2 size={16} color="#fff" />
                      ) : (
                        <StepIcon
                          size={14}
                          color={isCurrent ? "#fff" : colors.textSecondary}
                        />
                      )}
                    </View>
                    {index < STATUS_STEPS.length - 1 && (
                      <View
                        style={{
                          width: 2,
                          height: 24,
                          backgroundColor:
                            isPast || isCurrent
                              ? colors.primary
                              : colors.border,
                          marginTop: 4,
                        }}
                      />
                    )}
                  </View>

                  {/* Label */}
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: isCurrent ? "600" : "400",
                        color:
                          isPast || isCurrent
                            ? colors.text
                            : colors.textSecondary,
                      }}
                    >
                      {step.label}
                    </Text>
                    {isCurrent && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.primary,
                          marginTop: 2,
                        }}
                      >
                        Current status
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* Test/Package Info */}
        <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Test Details
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            {booking.bookingType === "single_test" ? (
              <TestTube2 size={22} color={colors.primary} />
            ) : (
              <Package size={22} color={colors.primary} />
            )}
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                {booking.itemName || "Test Booking"}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {booking.bookingType === "single_test"
                  ? "Single Test"
                  : "Health Package"}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              {formatPrice(booking.totalPrice)}
            </Text>
          </View>

          {/* Package tests */}
          {booking.itemDetails?.tests && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.textSecondary,
                  marginBottom: 8,
                }}
              >
                Included tests:
              </Text>
              {booking.itemDetails.tests.map((test: any) => (
                <View
                  key={test.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <CheckCircle2 size={14} color="#059669" />
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.text,
                      marginLeft: 8,
                    }}
                  >
                    {test.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Schedule & Address */}
        <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Collection Details
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <Calendar size={18} color={colors.textSecondary} />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 14,
                color: colors.text,
              }}
            >
              {formatDisplayDate(booking.scheduledDate)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <Clock size={18} color={colors.textSecondary} />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 14,
                color: colors.text,
              }}
            >
              {booking.scheduledTimeSlot}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
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
              {booking.collectionAddress?.line1}
              {booking.collectionAddress?.line2
                ? `, ${booking.collectionAddress.line2}`
                : ""}
              {"\n"}
              {booking.collectionAddress?.city},{" "}
              {booking.collectionAddress?.district}
              {booking.collectionAddress?.specialInstructions
                ? `\n📝 ${booking.collectionAddress.specialInstructions}`
                : ""}
            </Text>
          </View>
        </Card>

        {/* Phlebotomist Info */}
        {booking.phlebotomistName && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 12,
              }}
            >
              Phlebotomist
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.primary + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User size={22} color={colors.primary} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {booking.phlebotomistName}
                  </Text>
                  {booking.phlebotomistPhone && (
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                      }}
                    >
                      {booking.phlebotomistPhone}
                    </Text>
                  )}
                </View>
              </View>

              {booking.phlebotomistPhone && (
                <Pressable
                  onPress={() => handleCall(booking.phlebotomistPhone!)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "#059669",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Phone size={20} color="#fff" />
                </Pressable>
              )}
            </View>
          </Card>
        )}

        {/* Results */}
        {isCompleted && (booking.resultPdfUrl || booking.resultSummary) && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 12,
              }}
            >
              Results
            </Text>

            {booking.resultSummary && (
              <View
                style={{
                  backgroundColor: "#ECFDF5",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <FileText size={16} color="#059669" />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: "#059669",
                      marginLeft: 6,
                    }}
                  >
                    AI Summary
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#065F46",
                    lineHeight: 22,
                  }}
                >
                  {booking.resultSummary}
                </Text>
              </View>
            )}

            {booking.resultPdfUrl && (
              <Button
                variant="outline"
                onPress={() => Linking.openURL(booking.resultPdfUrl!)}
                style={{ width: "100%" }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Download size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, marginLeft: 8 }}>
                    Download Full Report (PDF)
                  </Text>
                </View>
              </Button>
            )}
          </Card>
        )}

        {/* Rating CTA (completed only, Lab Task 5) */}
        {isCompleted && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <Star size={16} color="#F59E0B" />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.text,
                      marginLeft: 6,
                    }}
                  >
                    Rate this experience
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Your feedback helps other patients choose the right lab.
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/rate-test/[bookingId]",
                    params: { bookingId: booking.id },
                  })
                }
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Star size={14} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: "600",
                    marginLeft: 6,
                  }}
                >
                  Rate
                </Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Payment Info */}
        <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Payment
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              Method
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.text,
                textTransform: "capitalize",
              }}
            >
              {booking.paymentMethod === "cash"
                ? "Cash on Collection"
                : booking.paymentMethod}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              Status
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color:
                  booking.paymentStatus === "paid"
                    ? "#059669"
                    : booking.paymentStatus === "refunded"
                    ? "#3B82F6"
                    : colors.text,
                textTransform: "capitalize",
              }}
            >
              {booking.paymentStatus.replace(/_/g, " ")}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 8,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
              Total
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              {formatPrice(booking.totalPrice)}
            </Text>
          </View>
        </Card>

        {/* Booking ID */}
        <Text
          style={{
            textAlign: "center",
            fontSize: 12,
            color: colors.textSecondary,
            marginTop: 8,
          }}
        >
          Booking ID: {booking.id.slice(0, 8).toUpperCase()}
        </Text>
      </ScrollView>

      {/* Bottom Actions */}
      {(canCancel || canReschedule || canPayRetry || isCompleted) && (
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
          {canPayRetry && (
            <View style={{ flex: 1 }}>
              <Button
                title={paying ? "Starting…" : "Pay now"}
                icon={CheckCircle2}
                onPress={handlePayRetry}
                style={{ width: "100%" }}
              />
            </View>
          )}
          {canCancel && (
            <View style={{ flex: 1 }}>
              <Button
                variant="outline"
                title="Cancel"
                icon={Ban}
                onPress={handleCancel}
                style={{ width: "100%" }}
              />
            </View>
          )}

          {canReschedule && (
            <View style={{ flex: 1 }}>
              <Button
                variant="outline"
                title="Reschedule"
                icon={RefreshCw}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setNewDate(d.toISOString().slice(0, 10));
                  setNewSlot((timeSlotsData?.slots?.[0] as any)?.id ?? booking.scheduledTimeSlot);
                  setShowReschedule(true);
                }}
                style={{ width: "100%" }}
              />
            </View>
          )}

          {isCompleted && booking.resultPdfUrl && (
            <View style={{ flex: 1 }}>
              <Button
                title="View Results"
                icon={Download}
                onPress={() => Linking.openURL(booking.resultPdfUrl!)}
                style={{ width: "100%" }}
              />
            </View>
          )}
        </View>
      )}

      {showReschedule && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 20,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              Reschedule visit
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Pick a new date and slot. The booking returns to pending for the lab to re-confirm.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {Array.from({ length: 14 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i + 1);
                const v = d.toISOString().slice(0, 10);
                const active = newDate === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setNewDate(v)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: active ? "#fff" : colors.text,
                      }}
                    >
                      {d.toLocaleDateString("en-LK", { day: "numeric", month: "short" })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(timeSlotsData?.slots ?? []).map((s: any) => {
                const active = newSlot === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setNewSlot(s.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: active ? "#fff" : colors.text,
                      }}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="outline"
                  title="Close"
                  onPress={() => setShowReschedule(false)}
                  style={{ width: "100%" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Confirm"
                  onPress={handleRescheduleConfirm}
                  style={{ width: "100%" }}
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}
