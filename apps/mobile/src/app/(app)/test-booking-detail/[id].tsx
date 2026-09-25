// @ts-nocheck

import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert, Linking, StyleSheet } from "react-native";
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
import { runPaymentsCheckout } from "@/lib/payments";
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
  // bg = tone colour at ~12% alpha → reads on light and dark surfaces.
  pending: { color: "#D97706", bg: "#D977061F" },
  confirmed: { color: "#3B82F6", bg: "#3B82F61F" },
  phlebotomist_assigned: { color: "#8B5CF6", bg: "#8B5CF61F" },
  sample_collection_en_route: { color: "#F97316", bg: "#F973161F" },
  sample_collected: { color: "#06B6D4", bg: "#06B6D41F" },
  in_progress: { color: "#8B5CF6", bg: "#8B5CF61F" },
  completed: { color: "#059669", bg: "#0596691F" },
  cancelled: { color: "#EF4444", bg: "#EF44441F" },
  rescheduled: { color: "#6B7280", bg: "#6B72801F" },
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
  const { colors, typography, radius } = useTheme();
  const router = useRouter();
  const sectionTitle = {
    ...typography.title.md,
    color: colors.text,
    marginBottom: 14,
  };
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
          <Skeleton style={{ height: 96, borderRadius: radius.card, marginBottom: 12 }} />
          <Skeleton style={{ height: 300, borderRadius: radius.card }} />
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

  // Plain handler (not useCallback): it is declared after the early returns above,
  // and hooks there would change the hook count between renders.
  const handlePayRetry = async () => {
    setPaying(true);
    try {
      const init: any = await api("/payments/initiate", {
        method: "POST",
        body: { testBookingId: id },
      });
      const result = await runPaymentsCheckout({
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
  };

  // Plain handler (not useCallback): it is declared after the early returns above,
  // and hooks there would change the hook count between renders.
  const handleRescheduleConfirm = async () => {
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
  };

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
            marginBottom: 16,
            backgroundColor: statusCfg.bg,
            borderRadius: radius.card,
            borderCurve: "continuous",
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: statusCfg.color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isCancelled ? (
              <XCircle size={24} color="#FFFFFF" strokeWidth={2.3} />
            ) : isCompleted ? (
              <CheckCircle2 size={24} color="#FFFFFF" strokeWidth={2.3} />
            ) : (
              <Loader2 size={24} color="#FFFFFF" strokeWidth={2.3} />
            )}
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text
              style={{
                ...typography.title.lg,
                color: colors.text,
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
                ...typography.body.sm,
                color: statusCfg.color,
                marginTop: 2,
                textTransform: "capitalize",
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
            <Text style={{ ...sectionTitle, marginBottom: 18 }}>
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
                    marginBottom: index < STATUS_STEPS.length - 1 ? 4 : 0,
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
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        borderCurve: "continuous",
                        backgroundColor: isPast
                          ? colors.primary
                          : isCurrent
                            ? colors.primary
                            : colors.fill,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: isCurrent ? 3 : 0,
                        borderColor: colors.primarySoft,
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
                          height: 22,
                          borderRadius: 1,
                          backgroundColor: isPast
                            ? colors.primary
                            : colors.separator,
                          marginVertical: 3,
                        }}
                      />
                    )}
                  </View>

                  {/* Label */}
                  <View style={{ marginLeft: 12, flex: 1, paddingTop: 5 }}>
                    <Text
                      style={{
                        ...(isCurrent ? typography.title.xs : typography.body.sm),
                        fontSize: 14,
                        color:
                          isPast || isCurrent
                            ? colors.text
                            : colors.textSubtle,
                      }}
                    >
                      {step.label}
                    </Text>
                    {isCurrent && (
                      <Text
                        style={{
                          ...typography.caption,
                          color: colors.primary,
                          marginTop: 1,
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
            style={sectionTitle}
          >
            Test Details
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {booking.bookingType === "single_test" ? (
                <TestTube2 size={20} color={colors.primary} strokeWidth={2.3} />
              ) : (
                <Package size={20} color={colors.primary} strokeWidth={2.3} />
              )}
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text
                style={{
                  ...typography.title.sm,
                  fontFamily: typography.title.md.fontFamily,
                  color: colors.text,
                }}
              >
                {booking.itemName || "Test Booking"}
              </Text>
              <Text style={{ ...typography.caption, color: colors.textSubtle, marginTop: 1 }}>
                {booking.bookingType === "single_test"
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
              {formatPrice(booking.totalPrice)}
            </Text>
          </View>

          {/* Package tests */}
          {booking.itemDetails?.tests && (
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: 16,
                borderCurve: "continuous",
                padding: 14,
              }}
            >
              <Text
                style={{
                  ...typography.label.sm,
                  color: colors.textMuted,
                  marginBottom: 10,
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
                    marginBottom: 8,
                  }}
                >
                  <CheckCircle2 size={15} color={colors.success} strokeWidth={2.3} />
                  <Text
                    style={{
                      ...typography.body.sm,
                      color: colors.text,
                      marginLeft: 10,
                      flex: 1,
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
            style={sectionTitle}
          >
            Collection Details
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingBottom: 12,
              marginBottom: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.separator,
            }}
          >
            <Calendar size={18} color={colors.textSubtle} />
            <Text
              style={{
                marginLeft: 12,
                ...typography.label.lg,
                color: colors.text,
              }}
            >
              {formatDisplayDate(booking.scheduledDate)}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingBottom: 12,
              marginBottom: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.separator,
            }}
          >
            <Clock size={18} color={colors.textSubtle} />
            <Text
              style={{
                marginLeft: 12,
                ...typography.body.md,
                color: colors.text,
              }}
            >
              {booking.scheduledTimeSlot}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <MapPin size={18} color={colors.textSubtle} />
            <Text
              style={{
                marginLeft: 12,
                ...typography.body.md,
                color: colors.text,
                flex: 1,
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
              style={sectionTitle}
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
                    borderCurve: "continuous",
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User size={20} color={colors.primary} strokeWidth={2.3} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text
                    style={{
                      ...typography.title.sm,
                      color: colors.text,
                    }}
                  >
                    {booking.phlebotomistName}
                  </Text>
                  {booking.phlebotomistPhone && (
                    <Text
                      style={{
                        ...typography.body.sm,
                        color: colors.textMuted,
                        marginTop: 1,
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
                    borderCurve: "continuous",
                    backgroundColor: colors.successSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Phone size={19} color={colors.success} strokeWidth={2.4} />
                </Pressable>
              )}
            </View>
          </Card>
        )}

        {/* Results */}
        {isCompleted && (booking.resultPdfUrl || booking.resultSummary) && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <Text
              style={sectionTitle}
            >
              Results
            </Text>

            {booking.resultSummary && (
              <View
                style={{
                  backgroundColor: colors.successSoft,
                  borderRadius: 16,
                  borderCurve: "continuous",
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
                  <FileText size={16} color={colors.success} strokeWidth={2.3} />
                  <Text
                    style={{
                      ...typography.label.md,
                      color: colors.success,
                      marginLeft: 6,
                    }}
                  >
                    AI Summary
                  </Text>
                </View>
                <Text
                  style={{
                    ...typography.body.md,
                    color: colors.text,
                  }}
                >
                  {booking.resultSummary}
                </Text>
              </View>
            )}

            {booking.resultPdfUrl && (
              <Button
                variant="secondary"
                title="Download Full Report (PDF)"
                icon={Download}
                onPress={() => Linking.openURL(booking.resultPdfUrl!)}
                style={{ width: "100%" }}
              />
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
                  <Star size={16} color={colors.warning} fill={colors.warning} />
                  <Text
                    style={{
                      ...typography.title.sm,
                      color: colors.text,
                      marginLeft: 6,
                    }}
                  >
                    Rate this experience
                  </Text>
                </View>
                <Text style={{ ...typography.body.sm, color: colors.textMuted }}>
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
                  backgroundColor: colors.primarySoft,
                  borderRadius: 999,
                  borderCurve: "continuous",
                  paddingHorizontal: 16,
                  height: 36,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Star size={14} color={colors.primary} strokeWidth={2.4} />
                <Text
                  style={{
                    ...typography.label.md,
                    color: colors.primary,
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
            style={sectionTitle}
          >
            Payment
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 12,
              marginBottom: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.separator,
            }}
          >
            <Text style={{ ...typography.body.md, color: colors.textMuted }}>
              Method
            </Text>
            <Text
              style={{
                ...typography.label.lg,
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
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text style={{ ...typography.body.md, color: colors.textMuted }}>
              Status
            </Text>
            <Text
              style={{
                ...typography.label.sm,
                overflow: "hidden",
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor:
                  booking.paymentStatus === "paid"
                    ? colors.successSoft
                    : booking.paymentStatus === "refunded"
                    ? colors.infoSoft
                    : colors.fill,
                color:
                  booking.paymentStatus === "paid"
                    ? colors.success
                    : booking.paymentStatus === "refunded"
                    ? colors.info
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
              alignItems: "center",
              backgroundColor: colors.surfaceMuted,
              borderRadius: 14,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginTop: 12,
            }}
          >
            <Text style={{ ...typography.title.sm, color: colors.text }}>
              Total
            </Text>
            <Text
              style={{
                ...typography.display.sm,
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
            ...typography.caption,
            color: colors.textSubtle,
            marginTop: 8,
            letterSpacing: 0.4,
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
                variant="danger"
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
                variant="secondary"
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
            backgroundColor: colors.scrim ?? "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              backgroundColor: colors.surface,
              borderRadius: radius.xxl,
              borderCurve: "continuous",
              padding: 22,
              gap: 14,
            }}
          >
            <Text style={{ ...typography.title.lg, color: colors.text }}>
              Reschedule visit
            </Text>
            <Text style={{ ...typography.body.sm, color: colors.textMuted, marginTop: -6 }}>
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
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      backgroundColor: active ? colors.primary : colors.fill,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.label.sm,
                        color: active ? colors.onPrimary : colors.text,
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
                      paddingHorizontal: 14,
                      minHeight: 36,
                      justifyContent: "center",
                      borderRadius: 999,
                      backgroundColor: active ? colors.primarySoft : colors.fill,
                      borderWidth: 1.5,
                      borderColor: active ? colors.primary : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        ...typography.label.md,
                        color: active ? colors.primary : colors.text,
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
                  variant="secondary"
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
