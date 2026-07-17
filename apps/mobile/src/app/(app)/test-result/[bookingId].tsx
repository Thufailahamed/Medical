// @ts-nocheck

import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Download,
  Share2,
  User,
  AlertCircle,
  CheckCircle2,
  Info,
  TestTube2,
  Calendar,
  Clock,
} from "lucide-react-native";
import { useTestBookingDetail } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  EmptyState,
} from "@/components/ui";

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-LK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function TestResultScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, isLoading, error } = useTestBookingDetail(bookingId);

  if (isLoading) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Test Results" back />
        <View style={{ padding: 16 }}>
          <Skeleton style={{ height: 160, borderRadius: 16, marginBottom: 16 }} />
          <Skeleton style={{ height: 200, borderRadius: 12 }} />
        </View>
      </Screen>
    );
  }

  if (error || !data?.booking) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Test Results" back />
        <EmptyState
          icon={AlertCircle}
          title="Results not found"
          description="This booking may not have results yet."
        />
      </Screen>
    );
  }

  const booking = data.booking;

  if (booking.status !== "completed") {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Test Results" back />
        <EmptyState
          icon={Clock}
          title="Results Pending"
          description="Your test is still being processed. You'll be notified when results are ready."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title="Test Results" back />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Success Banner */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 16,
            backgroundColor: "#ECFDF5",
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
          }}
        >
          <CheckCircle2 size={40} color="#059669" />
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#059669",
              marginTop: 12,
            }}
          >
            Results Ready!
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#065F46",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {booking.itemName || "Your test"} results are available
          </Text>
          {booking.resultReadyAt && (
            <Text
              style={{
                fontSize: 12,
                color: "#059669",
                marginTop: 8,
              }}
            >
              {formatDisplayDate(booking.resultReadyAt)}
            </Text>
          )}
        </View>

        {/* AI Summary */}
        {booking.resultSummary && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Info size={18} color="#3B82F6" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.text,
                  marginLeft: 8,
                }}
              >
                AI Summary
              </Text>
            </View>
            <Text
              style={{
                fontSize: 15,
                color: colors.text,
                lineHeight: 24,
              }}
            >
              {booking.resultSummary}
            </Text>
          </Card>
        )}

        {/* Test Info */}
        <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Test Information
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <TestTube2 size={18} color={colors.primary} />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 15,
                color: colors.text,
                flex: 1,
              }}
            >
              {booking.itemName}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Calendar size={18} color={colors.textSecondary} />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              Sample collected on{" "}
              {formatDisplayDate(booking.createdAt)}
            </Text>
          </View>
        </Card>

        {/* Download Actions */}
        {booking.resultPdfUrl && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 12,
              }}
            >
              Full Report
            </Text>

            <Pressable
              onPress={() => Linking.openURL(booking.resultPdfUrl!)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.primary + "10",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <FileText size={24} color={colors.primary} />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.primary,
                  }}
                >
                  Download PDF Report
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Full detailed lab report
                </Text>
              </View>
              <Download size={20} color={colors.primary} />
            </Pressable>

            <Button
              variant="outline"
              onPress={() => Linking.openURL(booking.resultPdfUrl!)}
              style={{ width: "100%" }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Share2 size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, marginLeft: 8 }}>
                  Share with Doctor
                </Text>
              </View>
            </Button>
          </Card>
        )}

        {/* Disclaimer */}
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
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <AlertCircle size={18} color="#D97706" style={{ marginTop: 2 }} />
            <Text
              style={{
                flex: 1,
                marginLeft: 10,
                fontSize: 13,
                color: "#92400E",
                lineHeight: 20,
              }}
            >
              This report is for informational purposes. Please consult your
              doctor for medical interpretation and advice. Do not
              self-diagnose or self-medicate based on these results.
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
    </Screen>
  );
}
