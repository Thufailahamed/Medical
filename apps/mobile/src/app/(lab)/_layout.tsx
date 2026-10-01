// @ts-nocheck

import { Tabs } from "expo-router";
import { View } from "react-native";
import {
  LayoutDashboard,
  ClipboardList,
  FlaskConical,
  Users,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useRealtime } from "@/hooks/useRealtime";
import { useTheme } from "@/theme/ThemeProvider";
import { TabIcon } from "@/components/ui";
import { IslandTabBar, useFloatingTabBarOptions } from "@/components/ui/FloatingTabBar";
import { useLocaleStore } from "@/stores/locale";

// Sinhala + Tamil glyphs render ~1.3x wider than Latin at the same font size.
const NARROW_TAB_LABEL = {
  fontSize: 9,
  fontWeight: "700" as const,
  letterSpacing: 0,
  marginTop: 6,
};
const WIDE_TAB_LABEL = {
  fontSize: 10,
  fontWeight: "700" as const,
  letterSpacing: 0.4,
  marginTop: 6,
};

export default function LabLayout() {
  const { colors } = useTheme();
  useRealtime();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const isWideScript = locale === "si" || locale === "ta";
  const labelStyle = isWideScript ? NARROW_TAB_LABEL : WIDE_TAB_LABEL;
  const tabOptions = useFloatingTabBarOptions({ fontSize: labelStyle.fontSize });

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={tabOptions}
        tabBar={(props) => <IslandTabBar {...props} />}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("nav.tabs.labHome"),
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={LayoutDashboard} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: t("nav.tabs.labBookings"),
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={ClipboardList} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="catalog"
          options={{
            title: t("nav.tabs.labCatalog"),
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={FlaskConical} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="team"
          options={{
            title: t("nav.tabs.labTeam"),
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={Users} focused={focused} />
            ),
          }}
        />

        {/* Hidden sub-pages — pushed, not tabs */}
        <Tabs.Screen
          name="booking-detail"
          options={{ href: null, tabBarStyle: { display: "none" } }}
        />
      </Tabs>
    </View>
  );
}
