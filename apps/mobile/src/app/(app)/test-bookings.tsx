// @ts-nocheck

import { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  TestTube2,
  Package,
  Clock,
  MapPin,
  Calendar,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Truck,
  FlaskConical,
  Loader2,
  Home,
  AlertCircle,
} from "lucide-react-native";
import { useMyTestBookings, type TestBooking } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  EmptyState,
  Skeleton,
} from "@/components/ui";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  pending: { label: "Pending", color: "#D97706", bg: "#FEF3C7", icon: Clock },
  confirmed: { label: "Confirmed", color: "#2563EB", bg: "#DBEAFE", icon: CheckCircle2 },
  phlebotomist_assigned: { label: "Assigned", color: "#7C3AED", bg: "#EDE9FE", icon: Home },
  sample_collection_en_route: { label: "En Route", color: "#EA580C", bg: "#FFEDD5", icon: Truck },
  sample_collected: { label: "Collected", color: "#0891B2", bg: "#CFFAFE", icon: FlaskConical },
  in_progress: { label: "In Progress", color: "#7C3AED", bg: "#EDE9FE", icon: Loader2 },
  completed: { label: "Completed", color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2", icon: XCircle },
  rescheduled: { label: "Rescheduled", color: "#64748B", bg: "#F1F5F9", icon: Calendar },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status] || {
      label: status,
      color: "#64748B",
      bg: "#F1F5F9",
      icon: Clock,
    }
  );
}

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-LK", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const TABS = [
  { key: "active", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function TestBookingsScreen() {
  const { colors, spacing, fontFamily } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("active");

  const { data, isLoading, error } = useMyTestBookings(activeTab);

  const renderBookingCard = useCallback(
    ({ item }: { item: TestBooking }) => {
      const statusCfg = getStatusConfig(item.status);
      const StatusIcon = statusCfg.icon;

      return (
        <Pressable
          onPress={() => router.push(`/test-booking-detail/${item.id}`)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            borderRadius: 18,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: pressed ? colors.primary : colors.border,
            padding: spacing.md,
            gap: 12,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          })}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: statusCfg.bg,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                gap: 6,
              }}
            >
              <StatusIcon size={13} color={statusCfg.color} strokeWidth={2.4} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: statusCfg.color,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {statusCfg.label}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {formatPrice(item.totalPrice)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.bookingType === "single_test" ? (
                <TestTube2 size={18} color={colors.primary} strokeWidth={2.3} />
              ) : (
                <Package size={18} color={colors.primary} strokeWidth={2.3} />
              )}
            </View>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
                flex: 1,
                letterSpacing: -0.2,
              }}
            >
              {item.itemName || "Test Booking"}
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Calendar size={14} color={colors.textMuted} strokeWidth={2.3} />
              <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600", flex: 1 }}>
                {formatDisplayDate(item.scheduledDate)} · {item.scheduledTimeSlot}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MapPin size={14} color={colors.textMuted} strokeWidth={2.3} />
              <Text
                style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600", flex: 1 }}
                numberOfLines={1}
              >
                {item.collectionAddress?.line1}, {item.collectionAddress?.city}
              </Text>
              <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, fontFamily, router, spacing]
  );

  return (
    <Screen padded={false} bottomInset={false} edges={["top"]}>
      <ScreenHeader title="My Test Bookings" back />

      <View
        style={{
          flexDirection: "row",
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 4,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 11,
                backgroundColor: active ? colors.primary : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? "800" : "600",
                  color: active ? colors.onPrimary : colors.textMuted,
                  fontFamily: active ? fontFamily.bodyBold : fontFamily.bodySemibold,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={130} radius={18} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Failed to load bookings"
          message="Please check your connection and try again."
        />
      ) : data?.bookings.length === 0 ? (
        <EmptyState
          icon={TestTube2}
          title={
            activeTab === "active"
              ? "No upcoming bookings"
              : activeTab === "completed"
                ? "No completed bookings"
                : "No cancelled bookings"
          }
          message={
            activeTab === "active"
              ? "Book a diagnostic test and we'll come to your home."
              : undefined
          }
          actionLabel={activeTab === "active" ? "Browse Tests" : undefined}
          onAction={
            activeTab === "active"
              ? () => router.push("/test-catalog")
              : undefined
          }
        />
      ) : (
        <FlatList
          data={data?.bookings || []}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingCard}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
