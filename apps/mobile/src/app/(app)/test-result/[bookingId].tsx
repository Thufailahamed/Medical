// @ts-nocheck

import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
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
  const { colors, typography, radius } = useTheme();
  const router = useRouter();
  const sectionTitle = { ...typography.title.md, color: colors.text, marginBottom: 14 };

  const { data, isLoading, error } = useTestBookingDetail(bookingId);

  if (isLoading) {
    return (
      <Screen padded={false} bottomInset={false}>
        <ScreenHeader title="Test Results" back />
        <View style={{ padding: 16 }}>
          <Skeleton style={{ height: 180, borderRadius: radius.card, marginBottom: 12 }} />
          <Skeleton style={{ height: 200, borderRadius: radius.card }} />
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
            backgroundColor: colors.successSoft,
            borderRadius: radius.card,
            borderCurve: "continuous",
            paddingVertical: 28,
            paddingHorizontal: 20,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.success,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={34} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text
            style={{
              ...typography.display.sm,
              color: colors.text,
              marginTop: 14,
            }}
          >
            Results Ready!
          </Text>
          <Text
            style={{
              ...typography.body.md,
              color: colors.textMuted,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {booking.itemName || "Your test"} results are available
          </Text>
          {booking.resultReadyAt && (
            <Text
              style={{
                ...typography.label.sm,
                color: colors.success,
                marginTop: 10,
              }}
            >
              {formatDisplayDate(booking.resultReadyAt)}
            </Text>
          )}
        </View>

        {/* AI Summary */}
        {booking.resultSummary && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 18 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  borderCurve: "continuous",
                  backgroundColor: colors.infoSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Info size={16} color={colors.info} strokeWidth={2.4} />
              </View>
              <Text
                style={{
                  ...typography.title.md,
                  color: colors.text,
                  marginLeft: 10,
                }}
              >
                AI Summary
              </Text>
            </View>
            <Text
              style={{
                ...typography.body.md,
                color: colors.text,
                lineHeight: 23,
              }}
            >
              {booking.resultSummary}
            </Text>
          </Card>
        )}

        {/* Test Info */}
        <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 18 }}>
          <Text style={sectionTitle}>
            Test Information
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
            <TestTube2 size={18} color={colors.primary} strokeWidth={2.3} />
            <Text
              style={{
                marginLeft: 12,
                ...typography.label.lg,
                color: colors.text,
                flex: 1,
              }}
            >
              {booking.itemName}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Calendar size={18} color={colors.textSubtle} />
            <Text
              style={{
                marginLeft: 12,
                ...typography.body.md,
                color: colors.textMuted,
              }}
            >
              Sample collected on{" "}
              {formatDisplayDate(booking.createdAt)}
            </Text>
          </View>
        </Card>

        {/* Download Actions */}
        {booking.resultPdfUrl && (
          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 18 }}>
            <Text style={sectionTitle}>
              Full Report
            </Text>

            <Pressable
              onPress={() => Linking.openURL(booking.resultPdfUrl!)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.primarySoft,
                borderRadius: 16,
                borderCurve: "continuous",
                padding: 14,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText size={22} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text
                  style={{
                    ...typography.title.sm,
                    color: colors.text,
                  }}
                >
                  Download PDF Report
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  Full detailed lab report
                </Text>
              </View>
              <Download size={20} color={colors.primary} strokeWidth={2.3} />
            </Pressable>

            <Button
              variant="secondary"
              title="Share with Doctor"
              icon={Share2}
              onPress={() => Linking.openURL(booking.resultPdfUrl!)}
              style={{ width: "100%" }}
            />
          </Card>
        )}

        {/* Disclaimer */}
        <Card
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            padding: 16,
            backgroundColor: colors.warningSoft,
            borderWidth: 0,
          }}
          elevated={false}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <AlertCircle size={18} color={colors.warning} strokeWidth={2.3} style={{ marginTop: 1 }} />
            <Text
              style={{
                flex: 1,
                marginLeft: 10,
                ...typography.body.sm,
                color: colors.text,
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
            ...typography.caption,
            color: colors.textSubtle,
            marginTop: 8,
            letterSpacing: 0.4,
          }}
        >
          Booking ID: {booking.id.slice(0, 8).toUpperCase()}
        </Text>
      </ScrollView>
    </Screen>
  );
}
