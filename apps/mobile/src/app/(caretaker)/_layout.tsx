// @ts-nocheck

// Caretaker Profiles: caretaker route group. Same tab shape as (app)
// (Home, Records, Medicines, Profile) but mounted only when
// role === 'caretaker'. The ActivePrincipalPill in the home topbar
// lets the caretaker switch which patient they're viewing.

import { Tabs } from "expo-router";
import { Platform } from "react-native";
import {
  Home,
  ClipboardList,
  Pill,
  UserRound,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { TabIcon } from "@/components/ui";
import { useRealtime } from "@/hooks/useRealtime";

export default function CaretakerLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  useRealtime();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 88 : 72,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
          paddingTop: 10,
          elevation: 8,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.tabs.home"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Home} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: t("nav.tabs.records"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ClipboardList} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="medicines"
        options={{
          title: t("nav.tabs.medicines"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Pill} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.tabs.profile"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={UserRound} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}