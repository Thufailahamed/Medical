import React from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Building2,
  ClipboardList,
  ScrollText,
  Wallet,
  ShieldAlert,
  FileLock2,
  CalendarClock,
  BadgeCheck,
  Megaphone,
  Pill as PillIcon,
  ShieldCheck,
  Settings,
  HeartPulse,
  KeyRound,
  LogOut,
  Inbox,
  Layers,
  FlaskConical,
  Ambulance,
  Download,
  UserCog,
  ChevronRight,
  type LucideIcon,
} from "lucide-react-native";
import {
  Screen,
  Pressable,
  useToast,
  Avatar,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { useAuthStore } from "@/stores/auth";
import { useAdminStepUpStore } from "@/stores/adminStepUp";
import { api } from "@/lib/api";
import {
  AdminHero,
  AdminSection,
  AdminCard,
} from "@/components/admin/ui";

type Module = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  route: string;
  tone: Tone;
};

const MODULES: { section: string; items: Module[] }[] = [
  {
    section: "Operations",
    items: [
      {
        icon: Inbox,
        title: "Inbox",
        subtitle: "Everything needing attention",
        route: "/(admin)/inbox",
        tone: "warning",
      },
      {
        icon: BadgeCheck,
        title: "Verifications",
        subtitle: "Caretaker identity reviews",
        route: "/(admin)/verifications",
        tone: "accent",
      },
      {
        icon: ShieldAlert,
        title: "Insurance claims",
        subtitle: "Approve or reject claims",
        route: "/(admin)/claims",
        tone: "info",
      },
      {
        icon: Wallet,
        title: "Payouts",
        subtitle: "Doctor payout batches",
        route: "/(admin)/payouts",
        tone: "success",
      },
      {
        icon: FileLock2,
        title: "Data requests",
        subtitle: "DSAR privacy queue",
        route: "/(admin)/dsar",
        tone: "danger",
      },
      {
        icon: Ambulance,
        title: "Operators",
        subtitle: "Ambulance & insurance desks",
        route: "/(admin)/operators",
        tone: "primary",
      },
    ],
  },
  {
    section: "Directory",
    items: [
      {
        icon: Building2,
        title: "Tenants",
        subtitle: "Hospitals & clinics",
        route: "/(admin)/tenants",
        tone: "primary",
      },
      {
        icon: Layers,
        title: "Insurance mkt",
        subtitle: "Providers, plans, enrollments",
        route: "/(admin)/insurance-mkt",
        tone: "info",
      },
      {
        icon: FlaskConical,
        title: "Diagnostics",
        subtitle: "Lab test packages",
        route: "/(admin)/diagnostics",
        tone: "accent",
      },
      {
        icon: PillIcon,
        title: "Medicines",
        subtitle: "Master catalogue",
        route: "/(admin)/medicines",
        tone: "accent2",
      },
      {
        icon: ShieldCheck,
        title: "Admins",
        subtitle: "Super admin accounts",
        route: "/(admin)/admins",
        tone: "danger",
      },
    ],
  },
  {
    section: "Growth",
    items: [
      {
        icon: CalendarClock,
        title: "Waitlist",
        subtitle: "Marketing signups",
        route: "/(admin)/waitlist",
        tone: "accent2",
      },
      {
        icon: ClipboardList,
        title: "Demo requests",
        subtitle: "Clinic & doctor demos",
        route: "/(admin)/demo-requests",
        tone: "info",
      },
      {
        icon: Megaphone,
        title: "Broadcast",
        subtitle: "Notify users at scale",
        route: "/(admin)/broadcast",
        tone: "warning",
      },
    ],
  },
  {
    section: "System",
    items: [
      {
        icon: ScrollText,
        title: "Audit log",
        subtitle: "Full activity trail",
        route: "/(admin)/audit",
        tone: "neutral",
      },
      {
        icon: Settings,
        title: "Settings",
        subtitle: "Runtime configuration",
        route: "/(admin)/settings",
        tone: "primary",
      },
      {
        icon: HeartPulse,
        title: "System health",
        subtitle: "Counts, storage, errors",
        route: "/(admin)/system-health",
        tone: "success",
      },
      {
        icon: KeyRound,
        title: "Security",
        subtitle: "Step-up & session",
        route: "/(admin)/security",
        tone: "danger",
      },
      {
        icon: Download,
        title: "Exports",
        subtitle: "CSV / NDJSON downloads",
        route: "/(admin)/export",
        tone: "accent2",
      },
      {
        icon: UserCog,
        title: "Impersonate",
        subtitle: "Step into a user's view",
        route: "/(admin)/impersonate",
        tone: "warning",
      },
    ],
  },
];

export default function AdminMore() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const signOut = () => {
    Alert.alert("Sign out", "End this admin session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            await api("/auth/logout", { method: "POST", silent401: true });
          } catch {
            // best effort — local logout proceeds regardless
          }
          useAdminStepUpStore.getState().clear();
          logout();
          toast.show("Signed out", "success");
        },
      },
    ]);
  };

  return (
    <Screen scroll padded={false} tabBarOffset edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          eyebrow="Admin console"
          title={user?.name ?? "Administrator"}
          subtitle={user?.email ?? user?.phone ?? "All admin modules"}
          right={
            <Pressable
              onPress={signOut}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              <LogOut size={19} color="#FFFFFF" strokeWidth={2.25} />
            </Pressable>
          }
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginTop: spacing.md,
            }}
          >
            <Avatar name={user?.name ?? "Admin"} size="md" />
            <View
              style={{
                paddingHorizontal: 12,
                height: 28,
                justifyContent: "center",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              <Text style={[typography.label.sm, { color: "#FFFFFF" }]}>
                Super admin
              </Text>
            </View>
          </View>
        </AdminHero>
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xxl + 4,
          marginTop: spacing.xxl,
          paddingBottom: spacing.xl,
        }}
      >
        {MODULES.map((group) => (
          <View key={group.section}>
            <AdminSection title={group.section} count={group.items.length} />
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
            >
              {group.items.map((m) => (
                <ModuleTile
                  key={m.route}
                  module={m}
                  onPress={() => router.push(m.route as any)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function ModuleTile({
  module: m,
  onPress,
}: {
  module: Module;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const { bg, fg } = useTone(m.tone);
  const Icon = m.icon;
  return (
    <AdminCard
      onPress={onPress}
      style={{ flexBasis: "47%", flexGrow: 1, minHeight: 124 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
          }}
        >
          <Icon size={19} color={fg} strokeWidth={2.2} />
        </View>
        <ChevronRight size={16} color={colors.textSubtle} />
      </View>
      <View style={{ marginTop: "auto", paddingTop: spacing.md }}>
        <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
          {m.title}
        </Text>
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted, marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          {m.subtitle}
        </Text>
      </View>
    </AdminCard>
  );
}
