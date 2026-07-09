// @ts-nocheck
//
// Round 3 P1: 1-tap rate screen. Reached via deep link from the
// post-visit summary email (`healthhub://rate-visit/<id>`) or by
// tapping the "Rate your visit" prompt on the appointment detail.

import { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react-native";
import {
  useAppointmentRating,
  useRateAppointment,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  useToast,
} from "@/components/ui";

export default function RateVisitScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();

  const { data: existing, isLoading } = useAppointmentRating(appointmentId);
  const rate = useRateAppointment();
  const [stars, setStars] = useState<number>(0);
  const [comment, setComment] = useState<string>("");

  useEffect(() => {
    if (existing?.rating) {
      setStars(existing.rating.stars);
      setComment(existing.rating.comment ?? "");
    }
  }, [existing?.rating?.stars, existing?.rating?.comment]);

  async function onSubmit() {
    if (!appointmentId || stars < 1 || stars > 5) {
      toast.show(t("rateVisit.needStars"), "danger");
      return;
    }
    try {
      await rate.mutateAsync({
        appointmentId,
        stars,
        comment: comment.trim() || undefined,
      });
      toast.show(t("rateVisit.thankYou"), "success");
      router.back();
    } catch (err: any) {
      const msg =
        err?.message && err.message !== "{}" && err.message !== "[object Object]"
          ? err.message
          : t("rateVisit.error");
      toast.show(msg, "danger");
    }
  }

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("rateVisit.title")}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: spacing.xxl,
        }}
      >
        <Card>
          <Text
            style={[
              typography.overline,
              { color: colors.textMuted, marginBottom: spacing.xs },
            ]}
          >
            {t("rateVisit.subtitle").toUpperCase()}
          </Text>
          <Text style={[typography.body.md, { color: colors.text }]}>
            {t("rateVisit.body")}
          </Text>
        </Card>

        <Card>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, marginBottom: spacing.sm, fontWeight: "700" },
            ]}
          >
            {t("rateVisit.tapStars")}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = n <= stars;
              return (
                <View
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={t("rateVisit.starA11y", { n })}
                  onTouchEnd={() => setStars(n)}
                  style={{
                    padding: 4,
                    borderRadius: radius.md,
                  }}
                >
                  <Star
                    size={42}
                    color={active ? colors.warning : colors.border}
                    fill={active ? colors.warning : "transparent"}
                    strokeWidth={1.8}
                  />
                </View>
              );
            })}
          </View>
          {stars > 0 ? (
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: spacing.sm },
              ]}
            >
              {t(`rateVisit.label.${stars}`)}
            </Text>
          ) : null}
        </Card>

        <Card>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, marginBottom: spacing.xs, fontWeight: "700" },
            ]}
          >
            {t("rateVisit.optionalComment")}
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t("rateVisit.commentPlaceholder")}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={500}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              minHeight: 96,
              color: colors.text,
              textAlignVertical: "top",
              fontSize: 15,
            }}
          />
        </Card>

        <Button
          title={
            existing?.rating
              ? t("rateVisit.update")
              : t("rateVisit.submit")
          }
          onPress={onSubmit}
          loading={rate.isPending}
          disabled={isLoading || stars < 1 || rate.isPending}
          size="lg"
          fullWidth
        />
        {existing?.rating ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, textAlign: "center" },
            ]}
          >
            {t("rateVisit.alreadyRated", {
              date: existing.rating.createdAt,
            })}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}