// @ts-nocheck
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { Card } from "@/components/ui";
import { useAuthStore } from "@/stores/auth";

// Caretaker-side profile — shows the caretaker's own account info + a
// note that they're managing someone else's data. Caretakers don't
// own a patients row so the rich principal-style profile is not
// applicable here.

export default function CaretakerProfile() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { user } = useAuthStore();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ ...typography.h2, color: colors.text }}>
          {user?.name ?? ""}
        </Text>
        <Card>
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
            }}
          >
            {t("caretaker.subtitle")}
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}