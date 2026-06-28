import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  Pencil,
  Users,
  Bell,
  Stethoscope,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  MapPin,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { supabase } from "@/lib/supabase";
import {
  Screen,
  Card,
  Avatar,
  Pill,
  ListItem,
  BottomSheet,
  ChipGroup,
  Button,
  useToast,
} from "@/components/ui";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const toast = useToast();
  const { spacing, colors, typography, radius } = useTheme();
  const scheme = useThemeStore((s) => s.scheme);
  const setScheme = useThemeStore((s) => s.setScheme);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  const role = (user?.role || "patient").toString();

  const initials = (user?.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() || "")
    .join("") || "?";

  const menuItems: {
    label: string;
    icon: any;
    tone: "primary" | "accent" | "warning" | "info" | "neutral";
    onPress: () => void;
  }[] = [
    {
      label: "Edit profile",
      icon: Pencil,
      tone: "primary",
      onPress: () => router.push("/(app)/edit-profile" as any),
    },
    {
      label: "Family members",
      icon: Users,
      tone: "accent",
      onPress: () => router.push("/(app)/family" as any),
    },
    {
      label: "Notifications",
      icon: Bell,
      tone: "warning",
      onPress: () => router.push("/(app)/notifications" as any),
    },
    {
      label: "Doctor portal",
      icon: Stethoscope,
      tone: "info",
      onPress: () => router.push("/(app)/doctor" as any),
    },
    {
      label: "Appearance",
      icon: scheme === "dark" ? Moon : Sun,
      tone: "primary",
      onPress: () => setAppearanceOpen(true),
    },
    {
      label: "Help & support",
      icon: HelpCircle,
      tone: "neutral",
      onPress: () => toast.show("Help center coming soon", "info"),
    },
  ];

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {}
    logout();
    router.replace("/(auth)/login" as any);
  }

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      {/* Hero with initials numeral */}
      <View
        style={{
          marginHorizontal: spacing.lg,
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
          padding: spacing.xl,
          borderRadius: radius.glass,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <Avatar
          name={user?.name}
          size="2xl"
          ring
          tone={role === "doctor" ? "info" : "primary"}
        />
        <Text
          style={[
            typography.display.md,
            { color: colors.text, textAlign: "center", letterSpacing: -0.5 },
          ]}
          numberOfLines={1}
        >
          {user?.name || "Patient"}
        </Text>
        <Text
          style={[typography.body.md, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {user?.email}
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: spacing.xs,
            marginTop: spacing.sm,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Pill
            label={role.replace("_", " ")}
            tone={role === "doctor" ? "info" : "primary"}
            size="md"
          />
          <Pill icon={ShieldCheck} label="Verified" tone="success" size="md" />
          <Pill icon={MapPin} label="Sri Lanka" tone="accent" size="md" />
        </View>
      </View>

      {/* Menu */}
      <View
        style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}
      >
        <Card padded={false}>
          <View style={{ paddingVertical: spacing.xs }}>
            {menuItems.map((item, i) => (
              <View key={item.label}>
                {i > 0 ? (
                  <View style={{ marginHorizontal: spacing.lg }}>
                    <View
                      style={{
                        height: 1,
                        backgroundColor: colors.border,
                        opacity: 0.6,
                      }}
                    />
                  </View>
                ) : null}
                <ListItem
                  icon={item.icon}
                  iconTone={item.tone}
                  title={item.label}
                  onPress={item.onPress}
                  showChevron
                />
              </View>
            ))}
          </View>
        </Card>

        <Button
          title="Sign out"
          variant="outline"
          icon={LogOut}
          onPress={handleLogout}
          fullWidth={false}
        />

        <Text
          style={[
            typography.caption,
            { color: colors.textSubtle, textAlign: "center" },
          ]}
        >
          HealthHub v1.0.0
        </Text>

        <View style={{ height: spacing.xl }} />
      </View>

      <BottomSheet
        visible={appearanceOpen}
        onDismiss={() => setAppearanceOpen(false)}
        title="Appearance"
      >
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.body.md, { color: colors.textMuted }]}>
            Choose how the app looks. System follows your device setting.
          </Text>
          <ChipGroup
            options={[
              { value: "system", label: "System", icon: Smartphone },
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
            ]}
            value={scheme}
            onChange={(v) => setScheme(v as any)}
          />
          <Button
            title="Done"
            onPress={() => setAppearanceOpen(false)}
            variant="primary"
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
