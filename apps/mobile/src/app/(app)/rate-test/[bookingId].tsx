// @ts-nocheck

import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Star, CheckCircle2 } from "lucide-react-native";
import {
  useTestBookingDetail,
  useTestBookingRating,
  useRateTestBooking,
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

export default function RateTestScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const { colors, typography, radius } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const { data: bookingData, isLoading: bookingLoading } =
    useTestBookingDetail(bookingId);
  const { data: ratingData } = useTestBookingRating(bookingId);
  const rateBooking = useRateTestBooking();

  const existingRating = ratingData?.rating;
  const [stars, setStars] = useState(existingRating?.stars || 0);
  const [comment, setComment] = useState(existingRating?.comment || "");

  const handleSubmit = async () => {
    if (stars === 0) {
      toast.show("Please select a rating", "error");
      return;
    }

    try {
      await rateBooking.mutateAsync({
        bookingId: bookingId!,
        stars,
        comment: comment || undefined,
      });
      toast.show(
        existingRating ? "Rating updated!" : "Thank you for your feedback!",
        "success"
      );
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Failed to submit rating", "error");
    }
  };

  if (bookingLoading) {
    return (
      <Screen>
        <ScreenHeader title="Rate Experience" back />
        <View style={{ padding: 16 }}>
          <Skeleton style={{ height: 200, borderRadius: radius.card }} />
        </View>
      </Screen>
    );
  }

  if (!bookingData?.booking) {
    return (
      <Screen>
        <ScreenHeader title="Rate Experience" back />
        <EmptyState
          icon="alert-circle"
          title="Booking not found"
          description="This booking may have been removed."
        />
      </Screen>
    );
  }

  const booking = bookingData.booking;

  return (
    <Screen>
      <ScreenHeader title="Rate Experience" back />

      <View style={{ paddingVertical: 12 }}>
        {/* Booking Info */}
        <Card style={{ padding: 18, marginBottom: 14 }}>
          <Text
            style={{
              ...typography.title.md,
              color: colors.text,
              marginBottom: 4,
            }}
          >
            {booking.itemName || "Test Booking"}
          </Text>
          <Text style={{ ...typography.body.sm, color: colors.textMuted }}>
            {booking.scheduledDate} • {booking.scheduledTimeSlot}
          </Text>
        </Card>

        {/* Star Rating */}
        <Card style={{ paddingVertical: 28, paddingHorizontal: 20, marginBottom: 14, alignItems: "center" }}>
          <Text
            style={{
              ...typography.title.lg,
              color: colors.text,
              marginBottom: 18,
            }}
          >
            How was your experience?
          </Text>

          <View
            style={{
              flexDirection: "row",
              gap: 12,
              marginBottom: 8,
            }}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable
                key={i}
                onPress={() => setStars(i)}
                style={{ padding: 4 }}
              >
                <Star
                  size={40}
                  color={i <= stars ? "#F59E0B" : colors.borderStrong}
                  fill={i <= stars ? "#F59E0B" : "transparent"}
                  strokeWidth={1.8}
                />
              </Pressable>
            ))}
          </View>

          <Text style={{ ...typography.label.md, color: stars === 0 ? colors.textSubtle : colors.warning }}>
            {stars === 0
              ? "Tap to rate"
              : stars === 1
              ? "Poor"
              : stars === 2
              ? "Fair"
              : stars === 3
              ? "Good"
              : stars === 4
              ? "Very Good"
              : "Excellent"}
          </Text>
        </Card>

        {/* Comment */}
        <Card style={{ padding: 18, marginBottom: 24 }}>
          <Text
            style={{
              ...typography.title.sm,
              color: colors.text,
              marginBottom: 10,
            }}
          >
            Additional Comments (optional)
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us about your experience..."
            placeholderTextColor={colors.textSubtle}
            multiline
            numberOfLines={4}
            maxLength={500}
            style={{
              backgroundColor: colors.fill,
              borderRadius: radius.field,
              borderCurve: "continuous",
              padding: 14,
              ...typography.body.md,
              color: colors.text,
              minHeight: 110,
              textAlignVertical: "top",
            }}
          />
          <Text
            style={{
              ...typography.caption,
              color: colors.textSubtle,
              textAlign: "right",
              marginTop: 6,
            }}
          >
            {comment.length}/500
          </Text>
        </Card>

        {/* Submit Button */}
        <Button
          title={
            rateBooking.isPending
              ? "Submitting..."
              : existingRating
              ? "Update Rating"
              : "Submit Rating"
          }
          size="lg"
          onPress={handleSubmit}
          disabled={stars === 0 || rateBooking.isPending}
          style={{ width: "100%" }}
        />

        {existingRating && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 12,
            }}
          >
            <CheckCircle2 size={16} color={colors.success} />
            <Text
              style={{
                ...typography.label.md,
                color: colors.success,
                marginLeft: 6,
              }}
            >
              You previously rated this {existingRating.stars}/5
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
