import { View, Text, Pressable } from "react-native";
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

          {options.map((opt) => {
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
                  padding: spacing.md,
                  borderRadius: radius.xl,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected
                    ? withOpacity(colors.primary, 0.06)
                    : colors.surface,
                  opacity: pressed ? 0.95 : 1,
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: selected
                      ? colors.primary
                      : colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    size={20}
                    color={selected ? colors.onPrimary : colors.text}
                    strokeWidth={2.25}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      typography.title.sm,
                      { color: selected ? colors.primary : colors.text },
                    ]}
                  >
                    {t(opt.labelKey)}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted },
                    ]}
                  >
                    {t(opt.descriptionKey)}
                  </Text>
                </View>

                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: selected ? colors.primary : colors.textSubtle,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected ? (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.primary,
                      }}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
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
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                backgroundColor: colors.surfaceMuted,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
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
                padding: spacing.md,
                gap: spacing.md,
                backgroundColor: colors.bg,
                borderBottomLeftRadius: radius.xl,
                borderBottomRightRadius: radius.xl,
              }}
            >
              {/* Mock hero */}
              <View
                style={{
                  height: 64,
                  backgroundColor: colors.primarySoft,
                  borderRadius: radius.md,
                  padding: spacing.sm,
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
                  padding: spacing.sm,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
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