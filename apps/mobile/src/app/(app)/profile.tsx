import { useMemo, useEffect } from "react";
import {
  View,
  Text,
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
  Activity,
  StickyNote,
  KeyRound,
  HeartPulse,
  AlertTriangle,
  ChevronRight,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  usePatientProfile,
  useUnreadCount,
  useFamilyMembers,
  useMyMedicines,
} from "@/hooks/useApi";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  Screen,
  Card,
  Avatar,
  Pill,
  Skeleton,
  Button,
  IconButton,
  StatCard,
  ListItem,
  SectionHeader,
  Divider,
  Chip,
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

function parseList(v: string | null | undefined): string[] {
  if (!v) return [];
  try {
    const out = JSON.parse(v);
    return Array.isArray(out) ? out.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseContacts(v: string | null | undefined): { name: string; phone?: string }[] {
  if (!v) return [];
  try {
    const out = JSON.parse(v);
    return Array.isArray(out) ? out.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function ProfileScreen() {
  const { user, logout, authFailureCount } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { spacing, colors, typography, radius, shadow } = useTheme();
  const { data: profileData, isLoading: profileLoading } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { data: familyData } = useFamilyMembers();
  const { data: medicinesData } = useMyMedicines();

  // If the API layer reports an unrecoverable 401, sign the user out.
  useEffect(() => {
    if (authFailureCount > 0) {
      logout();
      router.replace("/(auth)/login");
    }
  }, [authFailureCount]);

  const patient = profileData?.patient?.patients;
  const userRow = profileData?.patient?.users;
  const photoUri = userRow?.photo;
  const role = (user?.role || userRow?.role || "patient").toString();
  const isDoctor = role === "doctor";

  const bmi = useMemo(() => calcBmi(patient?.height, patient?.weight), [patient]);
  const bmiInfo = bmi ? bmiCategory(bmi) : null;

  const allergies = useMemo(() => parseList(patient?.allergies), [patient?.allergies]);
  const conditions = useMemo(
    () => parseList(patient?.medicalConditions),
    [patient?.medicalConditions]
  );
  const emergencyContacts = useMemo(
    () => parseContacts(patient?.emergencyContacts),
    [patient?.emergencyContacts]
  );

  const familyCount: number = familyData?.family?.length ?? 0;
  const activeMeds: any[] = (medicinesData?.medicines || []).filter(
    (m: any) => m.active !== false
  );
  const medCount = activeMeds.length;
  const unreadCount: number = unread?.count ?? 0;

  function confirmLogout() {
    Alert.alert(
      "Sign out?",
      "You'll need to sign back in to view your records.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: handleLogout },
      ]
    );
  }

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    queryClient.clear();
    logout();
    router.replace("/(auth)/login" as any);
  }

  const accountItems = [
    {
      label: "Edit profile",
      subtitle: "Name, blood group, height, weight, allergies",
      icon: Pencil,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/edit-profile" as any),
    },
    {
      label: "Family members",
      subtitle:
        familyCount === 0
          ? "Add your first family member"
          : `${familyCount} ${familyCount === 1 ? "member" : "members"} on file`,
      icon: Users,
      tone: "accent" as const,
      onPress: () => router.push("/(app)/family" as any),
    },
    {
      label: "Notifications",
      subtitle: unreadCount > 0 ? `${unreadCount} unread` : "Reminders and updates",
      icon: Bell,
      tone: "warning" as const,
      onPress: () => router.push("/(app)/notifications" as any),
    },
    {
      label: "Appearance",
      subtitle: "Light, dark, or system theme",
      icon: Palette,
      tone: "primary" as const,
      onPress: () => router.push("/(app)/appearance" as any),
    },
    {
      label: "Change password",
      subtitle: "Update your sign-in password",
      icon: KeyRound,
      tone: "neutral" as const,
      onPress: () => router.push("/(app)/change-password" as any),
    },
  ];

  const healthItems = [
    {
      label: "Vitals",
      subtitle: medCount > 0 ? `${medCount} active ${medCount === 1 ? "medicine" : "medicines"}` : "BP, glucose, weight trends",
      icon: Activity,
      tone: "info" as const,
      onPress: () => router.push("/(app)/vitals" as any),
    },
    {
      label: "Notes",
      subtitle: "Personal journal & questions",
      icon: StickyNote,
      tone: "info" as const,
      onPress: () => router.push("/(app)/notes" as any),
    },
    {
      label: "Activity log",
      subtitle: "Who accessed your records",
      icon: ShieldCheck,
      tone: "warning" as const,
      onPress: () => router.push("/(app)/activity" as any),
    },
    {
      label: "Doctor portal",
      subtitle: isDoctor ? "Manage your practice" : "Switch role if you are a provider",
      icon: Stethoscope,
      tone: "info" as const,
      onPress: () => router.push("/(app)/doctor" as any),
    },
  ];

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        {/* ─── Top bar ─── */}
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
          <IconButton
            icon={Bell}
            variant="ghost"
            size="md"
            onPress={() => router.push("/(app)/notifications" as any)}
            accessibilityLabel="Notifications"
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
        </View>

        {/* ─── Hero identity card ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xs,
          }}
        >
          <Card padded={false}>
            <View
              style={{
                padding: spacing.xl,
                gap: spacing.lg,
              }}
            >
              {/* Identity row */}
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
                  tone={isDoctor ? "info" : "primary"}
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
                          {
                            color: colors.text,
                            fontWeight: "800",
                            letterSpacing: -0.4,
                          },
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
                        {userRow?.email ||
                          user?.email ||
                          userRow?.phone ||
                          user?.phone ||
                          " "}
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
                      tone={isDoctor ? "info" : "primary"}
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

              {/* 3-col stats grid */}
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                }}
              >
                <StatCard
                  icon={Droplet}
                  tone="danger"
                  size="sm"
                  label="Blood"
                  value={patient?.bloodGroup || "—"}
                />
                <StatCard
                  icon={HeartPulse}
                  tone={bmiInfo?.tone ?? "info"}
                  size="sm"
                  label="BMI"
                  value={bmi ? bmi.toFixed(1) : "—"}
                  hint={bmiInfo?.label}
                />
                <StatCard
                  icon={Activity}
                  tone="primary"
                  size="sm"
                  label="Active"
                  value={String(medCount)}
                  hint={medCount === 1 ? "medicine" : "medicines"}
                />
              </View>
            </View>
          </Card>
        </View>

        {/* ─── Health profile card ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
          }}
        >
          <Card
            padded={false}
            onPress={() => router.push("/(app)/edit-profile" as any)}
            accessibilityLabel="Edit health profile"
          >
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.warningSoft,
                }}
              >
                <AlertTriangle
                  size={20}
                  color={colors.warning}
                  strokeWidth={2.25}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  Health profile
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                  numberOfLines={2}
                >
                  Allergies & conditions visible to your doctors
                </Text>
              </View>
              <ChevronRight
                size={18}
                color={colors.textSubtle}
                strokeWidth={2.25}
              />
            </View>
            <Divider />
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <SummaryRow
                label="ALLERGIES"
                empty="None recorded"
                items={allergies}
                tone="danger"
                icon={AlertTriangle}
              />
              <SummaryRow
                label="CONDITIONS"
                empty="None recorded"
                items={conditions}
                tone="warning"
                icon={Activity}
              />
              <View style={{ gap: spacing.xs }}>
                <Text
                  style={[
                    typography.overline,
                    { color: colors.textMuted, letterSpacing: 1.2 },
                  ]}
                >
                  EMERGENCY CONTACTS
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                  }}
                >
                  <Text
                    style={[
                      typography.body.md,
                      { color: colors.text, fontWeight: "600" },
                    ]}
                  >
                    {emergencyContacts.length > 0
                      ? `${emergencyContacts.length} on file`
                      : "None recorded"}
                  </Text>
                  <Text
                    onPress={() => router.push("/(app)/family" as any)}
                    style={[
                      typography.label.md,
                      { color: colors.primary, fontWeight: "700" },
                    ]}
                    accessibilityRole="link"
                  >
                    Manage in Family
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* ─── Account section ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Account" />
          <View style={{ marginHorizontal: spacing.lg }}>
            <Card padded={false}>
              {accountItems.map((item, i) => (
                <View key={item.label}>
                  <ListItem
                    icon={item.icon}
                    iconTone={item.tone}
                    title={item.label}
                    subtitle={item.subtitle}
                    onPress={item.onPress}
                    showChevron
                  />
                  {i < accountItems.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </Card>
          </View>
        </View>

        {/* ─── Health section ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Health" />
          <View style={{ marginHorizontal: spacing.lg }}>
            <Card padded={false}>
              {healthItems.map((item, i) => (
                <View key={item.label}>
                  <ListItem
                    icon={item.icon}
                    iconTone={item.tone}
                    title={item.label}
                    subtitle={item.subtitle}
                    onPress={item.onPress}
                    showChevron
                  />
                  {i < healthItems.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </Card>
          </View>
        </View>

        {/* ─── Support section ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Support" />
          <View style={{ marginHorizontal: spacing.lg }}>
            <Card padded={false}>
              <ListItem
                icon={HelpCircle}
                iconTone="neutral"
                title="Help & Support"
                subtitle="FAQs and contact options"
                onPress={() => router.push("/(app)/support" as any)}
                showChevron
              />
            </Card>
          </View>
        </View>

        {/* ─── Sign out + app info ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xxl,
            gap: spacing.lg,
            alignItems: "center",
          }}
        >
          <Button
            title="Sign out"
            variant="outline"
            icon={LogOut}
            onPress={confirmLogout}
            fullWidth
          />
          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, textAlign: "center" },
            ]}
          >
            HealthHub v0.1 · Patient Foundation
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function SummaryRow({
  label,
  empty,
  items,
  tone,
  icon: Icon,
}: {
  label: string;
  empty: string;
  items: string[];
  tone: "danger" | "warning";
  icon: any;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text
        style={[
          typography.overline,
          { color: colors.textMuted, letterSpacing: 1.2 },
        ]}
      >
        {label}
      </Text>
      {items.length === 0 ? (
        <Text
          style={[
            typography.body.md,
            { color: colors.textSubtle, fontWeight: "500" },
          ]}
        >
          {empty}
        </Text>
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.xs,
          }}
        >
          {items.map((it, i) => (
            <Chip key={`${label}-${i}`} label={it} size="sm" tone={tone} icon={Icon} />
          ))}
        </View>
      )}
    </View>
  );
}
