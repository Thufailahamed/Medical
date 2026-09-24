import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Smartphone, Sun, Moon, Heart, Pill, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/stores/theme";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  SectionHeader,
  useToast,
} from "@/components/ui";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { withOpacity } from "@/constants/theme";

export default function AppearanceScreen() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const scheme = useThemeStore((s) => s.scheme);
  const setScheme = useThemeStore((s) => s.setScheme);

  const handleApply = () => {
    toast.show(t("appearance.toast.applied"), "success");
    router.back();
  };

  const options = [
    {
      value: "system" as const,
      labelKey: "appearance.mode.system.label",
      descriptionKey: "appearance.mode.system.description",
      icon: Smartphone,
    },
    {
      value: "light" as const,
      labelKey: "appearance.mode.light.label",
      descriptionKey: "appearance.mode.light.description",
      icon: Sun,
    },
    {
      value: "dark" as const,
      labelKey: "appearance.mode.dark.label",
      descriptionKey: "appearance.mode.dark.description",
      icon: Moon,
    },
  ];

  return (
    <Screen padded={false} edges={["top"]} bottomInset scroll>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("appearance.title")}
        subtitle={t("appearance.subtitle")}
      />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
      >
        {/* ─── Appearance mode ───────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("appearance.appearanceModeHeading")} />

          <Card padded={false}>
          {options.map((opt, idx) => {
            const selected = scheme === opt.value;
            const Icon = opt.icon;

            return (
              <Pressable
                key={opt.value}
                onPress={() => setScheme(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  minHeight: 64,
                  paddingLeft: spacing.lg,
                  backgroundColor: pressed
                    ? colors.fill
                    : selected
                    ? withOpacity(colors.primary, 0.06)
                    : "transparent",
                })}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: selected
                      ? colors.primary
                      : colors.fillStrong,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    size={18}
                    color={selected ? colors.onPrimary : colors.text}
                    strokeWidth={2.25}
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    alignSelf: "stretch",
                    paddingVertical: spacing.md,
                    paddingRight: spacing.lg,
                    borderBottomWidth: idx < options.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.separator,
                  }}
                >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      typography.title.sm,
                      { color: colors.text },
                    ]}
                  >
                    {t(opt.labelKey)}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      typography.caption,
                      { color: colors.textMuted },
                    ]}
                  >
                    {t(opt.descriptionKey)}
                  </Text>
                </View>

                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: selected ? 0 : 1.5,
                    borderColor: colors.textSubtle,
                    backgroundColor: selected ? colors.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected ? (
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: colors.onPrimary,
                      }}
                    />
                  ) : null}
                </View>
                </View>
              </Pressable>
            );
          })}
          </Card>
        </View>

        {/* ─── Language ──────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title={t("appearance.languageHeading")}
          />
          <Card>
            <LocaleSwitcher />
          </Card>
        </View>

        {/* ─── Preview ───────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("appearance.previewHeading")} />

          <Card padded={false}>
            {/* Mock top bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm + 2,
                backgroundColor: colors.surface,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.separator,
              }}
            >
              <Heart size={14} color={colors.primary} strokeWidth={2.25} />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.textMuted,
                  }}
                />
                <View
                  style={{
                    width: 14,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: colors.textMuted,
                  }}
                />
              </View>
            </View>

            {/* Mock content */}
            <View
              style={{
                padding: spacing.lg,
                gap: spacing.md,
                backgroundColor: colors.bg,
              }}
            >
              {/* Mock hero */}
              <View
                style={{
                  height: 72,
                  backgroundColor: colors.primarySoft,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  padding: spacing.md,
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                    opacity: 0.4,
                  }}
                />
                <View
                  style={{
                    width: 96,
                    height: 12,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                    marginTop: 6,
                    opacity: 0.7,
                  }}
                />
              </View>

              {/* Mock list row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.separator,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: colors.successSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Pill
                    size={16}
                    color={colors.success}
                    strokeWidth={2.25}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View
                    style={{
                      width: 80,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.text,
                      opacity: 0.8,
                    }}
                  />
                  <View
                    style={{
                      width: 48,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: colors.textMuted,
                      opacity: 0.5,
                    }}
                  />
                </View>
                <Check size={16} color={colors.success} strokeWidth={2.5} />
              </View>
            </View>
          </Card>
        </View>

        {/* ─── Apply ─────────────────────────────────────── */}
        <Button
          title={t("appearance.applyButton")}
          onPress={handleApply}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}