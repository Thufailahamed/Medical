import React, { useMemo, useState } from "react";
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
  SearchField,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { useAuthStore } from "@/stores/auth";
import { useAdminStepUpStore } from "@/stores/adminStepUp";
import { api } from "@/lib/api";
import { useAdminDashboard, useAdminVerifications } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  RowDivider,
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
        title: "Insurance marketplace",
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
  const [q, setQ] = useState("");

  // Live queue sizes so the Operations tiles say whether there's work waiting.
  const { data } = useAdminDashboard();
  const { data: verifs } = useAdminVerifications("pending");
  const counts = useMemo<Record<string, number | undefined>>(() => {
    if (!data) return {};
    const pendingVerifs = verifs?.verifications?.length ?? 0;
    const inbox =
      (data.users.pendingApprovals ?? 0) +
      (data.doctors.slmcUnverified ?? 0) +
      pendingVerifs +
      (data.operations.openInsuranceClaims ?? 0) +
      (data.operations.pendingPayouts ?? 0) +
      (data.operations.openDsarRequests ?? 0) +
      (data.operations.newDemoRequests ?? 0);
    return {
      "/(admin)/inbox": inbox,
      "/(admin)/verifications": pendingVerifs,
      "/(admin)/claims": data.operations.openInsuranceClaims ?? 0,
      "/(admin)/payouts": data.operations.pendingPayouts ?? 0,
      "/(admin)/dsar": data.operations.openDsarRequests ?? 0,
      "/(admin)/demo-requests": data.operations.newDemoRequests ?? 0,
    };
  }, [data, verifs]);

  const query = q.trim().toLowerCase();
  const groups = useMemo(
    () =>
      MODULES.map((g) => ({
        ...g,
        items: query
          ? g.items.filter(
              (m) =>
                m.title.toLowerCase().includes(query) ||
                m.subtitle.toLowerCase().includes(query)
            )
          : g.items,
      })).filter((g) => g.items.length > 0),
    [query]
  );

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

  const go = (route: string) => router.push(route as any);

  return (
    <Screen scroll padded={false} tabBarOffset edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero eyebrow="Admin console" title="More">
          {/* Signed-in identity */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              marginTop: spacing.lg,
              padding: spacing.md,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.24)",
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#FFFFFF",
              }}
            >
              <Text style={[typography.title.md, { color: "#0A4874" }]}>
                {initials(user?.name ?? "Admin")}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.title.md, { color: "#FFFFFF" }]} numberOfLines={1}>
                {user?.name ?? "Administrator"}
              </Text>
              <Text
                style={[typography.caption, { color: "rgba(255,255,255,0.75)", marginTop: 1 }]}
                numberOfLines={1}
              >
                {user?.email ?? user?.phone ?? ""}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                height: 26,
                borderRadius: 13,
                backgroundColor: "rgba(255,255,255,0.18)",
              }}
            >
              <ShieldCheck size={12} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={[typography.label.xs, { color: "#FFFFFF" }]}>Super admin</Text>
            </View>
          </View>
        </AdminHero>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <SearchField value={q} onChangeText={setQ} placeholder="Find a tool" />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
          marginTop: spacing.xl,
          paddingBottom: spacing.xl,
        }}
      >
        {groups.length === 0 ? (
          <Text style={[typography.body.md, { color: colors.textMuted, textAlign: "center", marginTop: spacing.lg }]}>
            No tools match “{q.trim()}”
          </Text>
        ) : null}

        {groups.map((group) => (
          <View key={group.section}>
            <Text
              style={[
                typography.overline,
                { color: colors.textSubtle, marginBottom: spacing.sm, marginLeft: 4 },
              ]}
            >
              {group.section.toUpperCase()}
            </Text>
            {group.section === "Operations" && !query ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                {group.items.map((m) => (
                  <ModuleTile key={m.route} module={m} count={counts[m.route]} onPress={() => go(m.route)} />
                ))}
              </View>
            ) : (
              <AdminCard style={{ padding: 0 }}>
                {group.items.map((m, i) => (
                  <React.Fragment key={m.route}>
                    {i > 0 ? <RowDivider inset={spacing.lg + 36 + spacing.md} /> : null}
                    <ModuleRow module={m} count={counts[m.route]} onPress={() => go(m.route)} />
                  </React.Fragment>
                ))}
              </AdminCard>
            )}
          </View>
        ))}

        {!query ? (
          <Pressable
            onPress={signOut}
            haptic="light"
            accessibilityRole="button"
            style={({ pressed }: { pressed: boolean }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              height: 52,
              borderRadius: 16,
              borderCurve: "continuous",
              backgroundColor: colors.dangerSoft,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <LogOut size={18} color={colors.danger} strokeWidth={2.3} />
            <Text style={[typography.label.lg, { color: colors.danger }]}>Sign out</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function QueueCount({ count }: { count?: number }) {
  const { colors, typography } = useTheme();
  if (count === undefined) return null;
  const hot = count > 0;
  return (
    <View
      style={{
        minWidth: 24,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 7,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: hot ? colors.danger : colors.fill,
      }}
    >
      <Text
        style={[
          typography.label.xs,
          { color: hot ? colors.onDanger : colors.textSubtle, fontVariant: ["tabular-nums"], letterSpacing: 0 },
        ]}
      >
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

function ModuleTile({
  module: m,
  count,
  onPress,
}: {
  module: Module;
  count?: number;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const { bg, fg } = useTone(m.tone);
  const Icon = m.icon;
  return (
    <AdminCard
      onPress={onPress}
      style={{ flexBasis: "47%", flexGrow: 1, minHeight: 118, padding: spacing.md + 2 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
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
        {count !== undefined ? <QueueCount count={count} /> : <ChevronRight size={16} color={colors.textSubtle} />}
      </View>
      <View style={{ marginTop: "auto", paddingTop: spacing.md }}>
        <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
          {m.title}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
          {m.subtitle}
        </Text>
      </View>
    </AdminCard>
  );
}

function ModuleRow({
  module: m,
  count,
  onPress,
}: {
  module: Module;
  count?: number;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const { bg, fg } = useTone(m.tone);
  const Icon = m.icon;
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={m.title}
      style={({ pressed }: { pressed: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md - 2,
        minHeight: 60,
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
        }}
      >
        <Icon size={18} color={fg} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
          {m.title}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]} numberOfLines={1}>
          {m.subtitle}
        </Text>
      </View>
      {count !== undefined && count > 0 ? <QueueCount count={count} /> : null}
      <ChevronRight size={16} color={colors.textSubtle} />
    </Pressable>
  );
}
