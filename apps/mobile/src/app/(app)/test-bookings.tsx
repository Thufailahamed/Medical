// @ts-nocheck

import { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
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
  Card,
  EmptyState,
  Skeleton,
} from "@/components/ui";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  pending: {
    label: "Pending",
    color: "#D97706",
    bg: "#FEF3C7",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    color: "#3B82F6",
    bg: "#EFF6FF",
    icon: CheckCircle2,
  },
  phlebotomist_assigned: {
    label: "Phlebotomist Assigned",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    icon: Home,
  },
  sample_collection_en_route: {
    label: "En Route",
    color: "#F97316",
    bg: "#FFF7ED",
    icon: Truck,
  },
  sample_collected: {
    label: "Sample Collected",
    color: "#06B6D4",
    bg: "#ECFEFF",
    icon: FlaskConical,
  },
  in_progress: {
    label: "In Progress",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    icon: Loader2,
  },
  completed: {
    label: "Completed",
    color: "#059669",
    bg: "#ECFDF5",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    bg: "#FEF2F2",
    icon: XCircle,
  },
  rescheduled: {
    label: "Rescheduled",
    color: "#6B7280",
    bg: "#F9FAFB",
    icon: Calendar,
  },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status] || {
      label: status,
      color: "#6B7280",
      bg: "#F9FAFB",
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
  const { t } = useTranslation();
  const { colors } = useTheme();
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
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Card
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              padding: 16,
            }}
          >
            {/* Status Badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: statusCfg.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <StatusIcon size={14} color={statusCfg.color} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: statusCfg.color,
                    marginLeft: 6,
                  }}
                >
                  {statusCfg.label}
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                {formatPrice(item.totalPrice)}
              </Text>
            </View>

            {/* Test/Package Name */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              {item.bookingType === "single_test" ? (
                <TestTube2 size={18} color={colors.primary} />
              ) : (
                <Package size={18} color={colors.primary} />
              )}
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                  marginLeft: 10,
                  flex: 1,
                }}
              >
                {item.itemName || "Test Booking"}
              </Text>
            </View>

            {/* Date & Time */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <Calendar size={14} color={colors.textSecondary} />
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginLeft: 8,
                }}
              >
                {formatDisplayDate(item.scheduledDate)} •{" "}
                {item.scheduledTimeSlot}
              </Text>
            </View>

            {/* Address */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <MapPin size={14} color={colors.textSecondary} />
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginLeft: 8,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {item.collectionAddress?.line1},{" "}
                {item.collectionAddress?.city}
              </Text>
              <ChevronRight size={16} color={colors.textSecondary} />
            </View>
          </Card>
        </Pressable>
      );
    },
    [colors, router]
  );

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title="My Test Bookings" back />

      {/* Tabs */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 4,
        }}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor:
                activeTab === tab.key ? colors.primary : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: activeTab === tab.key ? "600" : "400",
                color: activeTab === tab.key ? "#fff" : colors.textSecondary,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Bookings List */}
      {isLoading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              style={{
                height: 140,
                borderRadius: 16,
                marginBottom: 12,
              }}
            />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Failed to load bookings"
          description="Please check your connection and try again."
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
          description={
            activeTab === "active"
              ? "Book a diagnostic test and we'll come to your home!"
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
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
