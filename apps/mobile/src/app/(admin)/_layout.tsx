import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Stethoscope,
  Grid3x3,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { TabIcon } from "@/components/ui";
import { useFloatingTabBarOptions } from "@/components/ui/FloatingTabBar";
import { AdminStepUpSheet } from "@/components/admin/AdminStepUpSheet";
import { useAdminApprovals, useAdminDoctors } from "@/hooks/useAdminApi";

const TAB_LABEL = {
  fontSize: 10,
  fontWeight: "700" as const,
  letterSpacing: 0.4,
  marginTop: 6,
};

const HIDDEN: [string, object][] = [
  ["user-detail", { href: null, tabBarStyle: { display: "none" } }],
  ["tenants", { href: null, tabBarStyle: { display: "none" } }],
  ["tenant-detail", { href: null, tabBarStyle: { display: "none" } }],
  ["audit", { href: null, tabBarStyle: { display: "none" } }],
  ["payouts", { href: null, tabBarStyle: { display: "none" } }],
  ["claims", { href: null, tabBarStyle: { display: "none" } }],
  ["dsar", { href: null, tabBarStyle: { display: "none" } }],
  ["demo-requests", { href: null, tabBarStyle: { display: "none" } }],
  ["waitlist", { href: null, tabBarStyle: { display: "none" } }],
  ["verifications", { href: null, tabBarStyle: { display: "none" } }],
  ["broadcast", { href: null, tabBarStyle: { display: "none" } }],
  ["medicines", { href: null, tabBarStyle: { display: "none" } }],
  ["admins", { href: null, tabBarStyle: { display: "none" } }],
  ["settings", { href: null, tabBarStyle: { display: "none" } }],
  ["system-health", { href: null, tabBarStyle: { display: "none" } }],
  ["security", { href: null, tabBarStyle: { display: "none" } }],
  ["inbox", { href: null, tabBarStyle: { display: "none" } }],
  ["insurance-mkt", { href: null, tabBarStyle: { display: "none" } }],
  ["diagnostics", { href: null, tabBarStyle: { display: "none" } }],
  ["operators", { href: null, tabBarStyle: { display: "none" } }],
  ["export", { href: null, tabBarStyle: { display: "none" } }],
  ["impersonate", { href: null, tabBarStyle: { display: "none" } }],
];

export default function AdminLayout() {
  const { colors } = useTheme();
  const { data: approvals } = useAdminApprovals("pending");
  const { data: doctors } = useAdminDoctors("unverified");
  const pendingN = approvals?.total ?? 0;
  const unverifiedDoctors = doctors?.total ?? 0;
  const tabOptions = useFloatingTabBarOptions();

  return (
    <View style={{ flex: 1 }}>
      <AdminStepUpSheet />
      <Tabs
        screenOptions={tabOptions}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Overview",
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={LayoutDashboard} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="approvals"
          options={{
            title: "Approvals",
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={UserCheck} focused={focused} badge={pendingN} />
            ),
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: "Users",
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={Users} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="doctors"
          options={{
            title: "Doctors",
            tabBarIcon: ({ focused }) => (
              <TabIcon
                icon={Stethoscope}
                focused={focused}
                badge={unverifiedDoctors}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "More",
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={Grid3x3} focused={focused} />
            ),
          }}
        />
        {HIDDEN.map(([name, options]) => (
          <Tabs.Screen key={name} name={name} options={options as any} />
        ))}
      </Tabs>
    </View>
  );
}
