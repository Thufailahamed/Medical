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
} from "lucide-react-native";
import {
  useTestBookingDetail,
  useCancelTestBooking,
  type TestBooking,
} from "@/hooks/useApi";
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
      <Screen>
        <ScreenHeader title="Booking Details" showBack />
        <View style={{ padding: 16 }}>
          <Skeleton style={{ height: 200, borderRadius: 16, marginBottom: 16 }} />
          <Skeleton style={{ height: 300, borderRadius: 12 }} />
        </View>
      </Screen>
    );
  }

  if (error || !data?.booking) {
    return (
      <Screen>
        <ScreenHeader title="Booking Details" showBack />
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
  const canCancel = ["pending", "confirmed", "phlebotomist_assigned"].includes(
    booking.status
  );
  const canReschedule = canCancel;

  return (
    <Screen>
      <ScreenHeader title="Booking Details" showBack />

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
      {(canCancel || canReschedule || isCompleted) && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
            paddingHorizontal: 16,
            paddingVertical: 16,
            paddingBottom: 32,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: "row",
            gap: 12,
          }}
        >
          {canCancel && (
            <Button
              variant="outline"
              onPress={handleCancel}
              style={{ flex: 1 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ban size={16} color="#EF4444" />
                <Text style={{ color: "#EF4444", marginLeft: 6 }}>
                  Cancel
                </Text>
              </View>
            </Button>
          )}

          {canReschedule && (
            <Button
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: "/book-test",
                  params: {
                    bookingType: booking.bookingType,
                    testId: booking.testId || undefined,
                    testName: booking.itemName,
                    packageId: booking.packageId || undefined,
                    testPrice: String(booking.totalPrice),
                  },
                })
              }
              style={{ flex: 1 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <RefreshCw size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, marginLeft: 6 }}>
                  Reschedule
                </Text>
              </View>
            </Button>
          )}

          {isCompleted && booking.resultPdfUrl && (
            <Button
              onPress={() => Linking.openURL(booking.resultPdfUrl!)}
              style={{ flex: 1 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Download size={16} color="#fff" />
                <Text style={{ color: "#fff", marginLeft: 6 }}>
                  View Results
                </Text>
              </View>
            </Button>
          )}
        </View>
      )}
    </Screen>
  );
}
