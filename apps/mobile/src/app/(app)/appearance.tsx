import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Smartphone,
  Sun,
  Moon,
  Heart,
  Pill,
  Check,
} from "lucide-react-native";
import { useThemeStore } from "@/stores/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen, Card, Button, useToast } from "@/components/ui";

export default function AppearanceScreen() {
  const router = useRouter();
  const toast = useToast();
  const { spacing, colors, typography, radius } = useTheme();
  const scheme = useThemeStore((s) => s.scheme);
  const setScheme = useThemeStore((s) => s.setScheme);

  const handleApply = () => {
    toast.show("Appearance settings applied", "success");
    router.back();
  };

  const options = [
    {
      value: "system" as const,
      label: "System Default",
      icon: Smartphone,
      description: "Follows your device system settings",
    },
    {
      value: "light" as const,
      label: "Light Mode",
      icon: Sun,
      description: "Bright clean interface for daylight",
    },
    {
      value: "dark" as const,
      label: "Dark Mode",
      icon: Moon,
      description: "Sleek low-light experience",
    },
  ];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      {/* Top Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          })}
        >
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text
          style={[
            typography.title.md,
            { color: colors.text, fontWeight: "800", fontSize: 18 },
          ]}
        >
          Appearance
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Page Header */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md }}>
          <Text
            style={[
              typography.title.lg,
              { color: colors.text, fontWeight: "900", fontSize: 24 },
            ]}
          >
            Customize Theme
          </Text>
          <Text
            style={[
              typography.body.md,
              { color: colors.textMuted, marginTop: 4 },
            ]}
          >
            Customize how HealthHub looks on your device.
          </Text>
        </View>

        {/* Radio Option cards */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.xl }}>
          <Text
            style={[
              typography.overline,
              { color: colors.textMuted, letterSpacing: 0.5, fontWeight: "700", marginBottom: 4 },
            ]}
          >
            APPEARANCE MODE
          </Text>

          {options.map((opt) => {
            const selected = scheme === opt.value;
            const Icon = opt.icon;

            return (
              <Pressable
                key={opt.value}
                onPress={() => setScheme(opt.value)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  padding: spacing.md,
                  borderRadius: radius.xl,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? `${colors.primarySoft}20` : colors.surface,
                  opacity: pressed ? 0.95 : 1,
                })}
              >
                {/* Icon Container */}
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: spacing.md,
                  }}
                >
                  <Icon size={20} color={selected ? colors.onPrimary : colors.text} />
                </View>

                {/* Details */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: selected ? colors.primary : colors.text, fontWeight: "800" },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {opt.description}
                  </Text>
                </View>

                {/* Radio selection circle indicator */}
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: selected ? colors.primary : colors.textMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.primary,
                      }}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Visual Preview Card (Stitch layout copy) */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <Text
            style={[
              typography.overline,
              { color: colors.textMuted, letterSpacing: 0.5, fontWeight: "700", marginBottom: spacing.md },
            ]}
          >
            PREVIEW
          </Text>

          <Card padded={false} style={{ overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
            {/* Mock top bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                backgroundColor: colors.surfaceMuted,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Heart size={14} color={colors.primary} />
              <View style={{ flexDirection: "row", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted }} />
                <View style={{ width: 14, height: 8, borderRadius: 2, backgroundColor: colors.textMuted }} />
              </View>
            </View>

            {/* Mock Content */}
            <View style={{ padding: spacing.md, gap: spacing.md, backgroundColor: colors.bg }}>
              {/* Mock Hero card */}
              <View
                style={{
                  height: 60,
                  backgroundColor: colors.primarySoft,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                  justifyContent: "center",
                }}
              >
                <View style={{ width: 40, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: 0.4 }} />
                <View style={{ width: 80, height: 14, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 }} />
              </View>

              {/* Mock list item */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: spacing.sm,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.successSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: spacing.sm,
                  }}
                >
                  <Pill size={14} color={colors.success} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ width: 70, height: 8, borderRadius: 4, backgroundColor: colors.text, opacity: 0.8 }} />
                  <View style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: colors.textMuted, opacity: 0.5 }} />
                </View>
                <Check size={16} color={colors.success} strokeWidth={3} />
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Bottom Footer Actions */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing.lg,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button title="Apply Changes" onPress={handleApply} variant="primary" />
      </View>
    </Screen>
  );
}
