import { useMemo, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Users,
  Bell,
  Stethoscope,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Palette,
  Droplet,
  Ruler,
  Weight,
  ChevronRight,
  Activity,
  StickyNote,
  KeyRound,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { usePatientProfile, useUnreadCount } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  Screen,
  Card,
  Avatar,
  Pill,
  ListItem,
  Skeleton,
  Button,
} from "@/components/ui";

function calcBmi(height?: number | null, weight?: number | null) {
  if (!height || !weight) return null;
  const m = height / 100;
  return weight / (m * m);
}

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: "Underweight", tone: "info" as const };
  if (bmi < 25) return { label: "Healthy", tone: "success" as const };
  if (bmi < 30) return { label: "Elevated", tone: "warning" as const };
  return { label: "High", tone: "danger" as const };
}

export default function ProfileScreen() {
  const { user, logout, authFailureCount } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { spacing, colors, typography, radius, shadow } = useTheme();
  const { data: profileData, isLoading: profileLoading } = usePatientProfile();
  const { data: unread } = useUnreadCount();

  // If the API layer reports an unrecoverable 401, sign the user out.
  useEffect(() => {
    if (authFailureCount > 0) {
      // Best-effort local cleanup; the user lands back on login.
      logout();
      router.replace("/(auth)/login");
    }
  }, [authFailureCount]);

  const patient = profileData?.patient?.patients;
  const userRow = profileData?.patient?.users;
  const photoUri = userRow?.photo;
  const role = (user?.role || userRow?.role || "patient").toString();

  const bmi = useMemo(() => calcBmi(patient?.height, patient?.weight), [patient]);
  const bmiInfo = bmi ? bmiCategory(bmi) : null;

  const menuItems: {
    label: string;
    description?: string;
    icon: any;
    tone: "primary" | "accent" | "warning" | "info" | "neutral";
    onPress: () => void;
  }[] = [
    {
      label: "Edit Profile",
      description: "Name, blood group, height, weight",
      icon: Pencil,
      tone: "primary",
      onPress: () => router.push("/(app)/edit-profile" as any),
    },
    {
      label: "Family Members",
      description: "Manage care for loved ones",
      icon: Users,
      tone: "accent",
      onPress: () => router.push("/(app)/family" as any),
    },
    {
      label: "Vitals",
      description: "BP, glucose, weight trends",
      icon: Activity,
      tone: "info",
      onPress: () => router.push("/(app)/vitals" as any),
    },
    {
      label: "Notes",
      description: "Personal journal & questions",
      icon: StickyNote,
      tone: "info",
      onPress: () => router.push("/(app)/notes" as any),
    },
    {
      label: "Activity log",
      description: "Who accessed your records",
      icon: ShieldCheck,
      tone: "warning",
      onPress: () => router.push("/(app)/activity" as any),
    },
    {
      label: "Notifications",
      description: "Reminders and updates",
      icon: Bell,
      tone: "warning",
      onPress: () => router.push("/(app)/notifications" as any),
    },
    {
      label: "Doctor Portal",
      description: "Switch role if you are a provider",
      icon: Stethoscope,
      tone: "info",
      onPress: () => router.push("/(app)/doctor" as any),
    },
    {
      label: "Appearance",
      description: "Light, dark, or system theme",
      icon: Palette,
      tone: "primary",
      onPress: () => router.push("/(app)/appearance" as any),
    },
    {
      label: "Change password",
      description: "Update your sign-in password",
      icon: KeyRound,
      tone: "neutral",
      onPress: () => router.push("/(app)/change-password" as any),
    },
    {
      label: "Help & Support",
      description: "FAQs and contact",
      icon: HelpCircle,
      tone: "neutral",
      onPress: () => router.push("/(app)/support" as any),
    },
  ];

  function confirmLogout() {
    Alert.alert(
      "Sign out?",
      "You'll need to sign back in to view your records.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: handleLogout,
        },
      ]
    );
  }

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Continue with local logout even if backend call fails
    }
    try {
      await supabase.auth.signOut();
    } catch {}
    // Clear all react-query caches so the next user starts fresh.
    queryClient.clear();
    logout();
    router.replace("/(auth)/login" as any);
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        {/* App header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <Text
            style={[
              typography.display.sm,
              { color: colors.text, fontWeight: "800", letterSpacing: -0.5 },
            ]}
          >
            Profile
          </Text>
          <Pressable
            onPress={() => router.push("/(app)/notifications")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <Bell size={18} color={colors.text} strokeWidth={2.25} />
            {unread?.count ? (
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.danger,
                }}
              />
            ) : null}
          </Pressable>
        </View>

        {/* Identity hero */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.sm,
            padding: spacing.xl,
            borderRadius: radius.xxl,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadow.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.lg,
            }}
          >
            <Avatar
              name={userRow?.name || user?.name}
              source={photoUri ? { uri: photoUri } : undefined}
              size="2xl"
              ring
              tone={role === "doctor" ? "info" : "primary"}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              {profileLoading ? (
                <>
                  <Skeleton width="80%" height={20} />
                  <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
                </>
              ) : (
                <>
                  <Text
                    style={[
                      typography.title.lg,
                      { color: colors.text, fontWeight: "800", letterSpacing: -0.4 },
                    ]}
                    numberOfLines={1}
                  >
                    {userRow?.name || user?.name || "—"}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {userRow?.email || user?.email || userRow?.phone || " "}
                  </Text>
                </>
              )}
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.xs,
                  marginTop: spacing.sm,
                  flexWrap: "wrap",
                }}
              >
                <Pill
                  label={role.replace("_", " ")}
                  tone={role === "doctor" ? "info" : "primary"}
                  size="sm"
                />
                {userRow?.verified || user?.verified ? (
                  <Pill
                    icon={ShieldCheck}
                    label="Verified"
                    tone="success"
                    size="sm"
                  />
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Vitals row */}
        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            marginTop: spacing.md,
          }}
        >
          <VitalsCard
            label="Blood"
            value={patient?.bloodGroup || "—"}
            icon={Droplet}
            tone="danger"
          />
          <VitalsCard
            label="Height"
            value={patient?.height ? `${patient.height}` : "—"}
            unit={patient?.height ? "cm" : undefined}
            icon={Ruler}
            tone="info"
          />
          <VitalsCard
            label="Weight"
            value={patient?.weight ? `${patient.weight}` : "—"}
            unit={patient?.weight ? "kg" : undefined}
            icon={Weight}
            tone="warning"
          />
        </View>

        {/* BMI summary card */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.md,
          }}
        >
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: bmiInfo ? bmiToneBg(bmiInfo.tone, colors) : colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: bmiInfo ? bmiToneFg(bmiInfo.tone, colors) : colors.textMuted,
                    fontWeight: "900",
                    fontSize: 18,
                  }}
                >
                  {bmi ? bmi.toFixed(1) : "—"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
                  BMI
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                  {bmi
                    ? `${bmiInfo?.label} range`
                    : "Add height and weight in Edit Profile to see your BMI"}
                </Text>
              </View>
              {bmiInfo ? (
                <Pill label={bmiInfo.label} tone={bmiInfo.tone} size="sm" />
              ) : (
                <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.25} />
              )}
            </View>
          </Card>
        </View>

        {/* Menu */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md }}>
          <Text
            style={[
              typography.overline,
              { color: colors.textMuted, letterSpacing: 1.2, paddingHorizontal: spacing.xs },
            ]}
          >
            Settings
          </Text>
          <Card padded={false}>
            <View style={{ paddingVertical: spacing.xs }}>
              {menuItems.map((item, i) => (
                <View key={item.label}>
                  {i > 0 ? (
                    <View
                      style={{
                        marginHorizontal: spacing.lg,
                        height: 1,
                        backgroundColor: colors.border,
                        opacity: 0.6,
                      }}
                    />
                  ) : null}
                  <ListItem
                    icon={item.icon}
                    iconTone={item.tone}
                    title={item.label}
                    subtitle={item.description}
                    onPress={item.onPress}
                    showChevron
                  />
                </View>
              ))}
            </View>
          </Card>

          <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              title="Sign out"
              variant="outline"
              icon={LogOut}
              onPress={confirmLogout}
              fullWidth={false}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function VitalsCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: any;
  tone: "primary" | "accent" | "warning" | "info" | "danger";
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${tColor(tone, colors)}15`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={14} color={tColor(tone, colors)} strokeWidth={2.5} />
      </View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          marginTop: 2,
        }}
      >
        <Text
          style={[
            typography.title.md,
            { color: colors.text, fontWeight: "800", fontSize: 20 },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, marginLeft: 4, fontWeight: "600" },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function tColor(tone: string, colors: any) {
  switch (tone) {
    case "primary":
      return colors.primary;
    case "accent":
      return colors.accent;
    case "warning":
      return colors.warning;
    case "info":
      return colors.info;
    case "danger":
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

function bmiToneBg(tone: string, colors: any) {
  return `${tColor(tone, colors)}15`;
}
function bmiToneFg(tone: string, colors: any) {
  return tColor(tone, colors);
}