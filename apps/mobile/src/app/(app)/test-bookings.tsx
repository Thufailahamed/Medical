// @ts-nocheck

import { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
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
  // bg = status colour at ~12% alpha → tinted badge that works in dark mode.
  pending: { label: "Pending", color: "#D97706", bg: "#D977061F", icon: Clock },
  confirmed: { label: "Confirmed", color: "#2563EB", bg: "#2563EB1F", icon: CheckCircle2 },
  phlebotomist_assigned: { label: "Assigned", color: "#7C3AED", bg: "#7C3AED1F", icon: Home },
  sample_collection_en_route: { label: "En Route", color: "#EA580C", bg: "#EA580C1F", icon: Truck },
  sample_collected: { label: "Collected", color: "#0891B2", bg: "#0891B21F", icon: FlaskConical },
  in_progress: { label: "In Progress", color: "#7C3AED", bg: "#7C3AED1F", icon: Loader2 },
  completed: { label: "Completed", color: "#059669", bg: "#0596691F", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#DC26261F", icon: XCircle },
  rescheduled: { label: "Rescheduled", color: "#64748B", bg: "#64748B1F", icon: Calendar },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status] || {
      label: status,
      color: "#64748B",
      bg: "#64748B1F",
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
  const { colors, spacing, fontFamily, typography, radius, shadow, scheme } = useTheme();
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
            marginBottom: spacing.md,
            borderRadius: radius.card,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
            padding: spacing.lg,
            gap: 14,
            opacity: pressed ? 0.94 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
            ...(scheme === "dark" ? {} : shadow.sm),
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
                  ...typography.label.sm,
                  color: statusCfg.color,
                }}
              >
                {statusCfg.label}
              </Text>
            </View>

            <Text
              style={{
                ...typography.title.md,
                letterSpacing: -0.4,
                color: colors.text,
              }}
            >
              {formatPrice(item.totalPrice)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
              {item.bookingType === "single_test" ? (
                <TestTube2 size={18} color={colors.primary} strokeWidth={2.3} />
              ) : (
                <Package size={18} color={colors.primary} strokeWidth={2.3} />
              )}
            </View>
            <Text
              numberOfLines={2}
              style={{
                ...typography.title.sm,
                fontFamily: typography.title.md.fontFamily,
                color: colors.text,
                flex: 1,
              }}
            >
              {item.itemName || "Test Booking"}
            </Text>
          </View>

          <View
            style={{
              gap: 8,
              paddingTop: 12,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Calendar size={14} color={colors.textSubtle} strokeWidth={2.3} />
              <Text style={{ ...typography.body.sm, color: colors.textMuted, flex: 1 }}>
                {formatDisplayDate(item.scheduledDate)} · {item.scheduledTimeSlot}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MapPin size={14} color={colors.textSubtle} strokeWidth={2.3} />
              <Text
                style={{ ...typography.body.sm, color: colors.textMuted, flex: 1 }}
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
    [colors, fontFamily, router, spacing, typography, radius, shadow, scheme]
  );

  return (
    <Screen padded={false} bottomInset={false} edges={["top"]}>
      <ScreenHeader title="My Test Bookings" back />

      <View
        style={{
          flexDirection: "row",
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          backgroundColor: colors.fill,
          borderRadius: 12,
          borderCurve: "continuous",
          padding: 3,
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
                minHeight: 34,
                justifyContent: "center",
                borderRadius: 10,
                borderCurve: "continuous",
                backgroundColor: active ? colors.surface : "transparent",
                alignItems: "center",
                ...(active && scheme !== "dark" ? shadow.xs : {}),
              }}
            >
              <Text
                style={{
                  ...typography.label.md,
                  color: active ? colors.text : colors.textMuted,
                  fontFamily: active ? fontFamily.bodyBold : fontFamily.bodyMedium,
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
            <Skeleton key={i} height={150} radius={radius.card} />
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
