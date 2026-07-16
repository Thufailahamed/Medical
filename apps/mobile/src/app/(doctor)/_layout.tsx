// @ts-nocheck

import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import {
  LayoutDashboard,
  CalendarDays,
  Inbox,
  FilePenLine,
  UserRound,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  useUnreadCount,
  useDoctorConversations,
} from "@/hooks/useApi";
import { useRealtime } from "@/hooks/useRealtime";
import { useTheme } from "@/theme/ThemeProvider";
import { TabIcon } from "@/components/ui";
import { useLocaleStore } from "@/stores/locale";
import DoctorWaitingBanner from "@/components/teleconsult/DoctorWaitingBanner";

// Sinhala + Tamil glyphs render ~1.3x wider than Latin at the same font size.
// Trim fontSize + letterSpacing for those locales so the 5 labels do not
// overlap. Latin (en) keeps the original 10/0.4 spec.
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

export default function DoctorLayout() {
  const { colors } = useTheme();
  useRealtime();
  const { data: unread } = useUnreadCount();
  const { data: convs } = useDoctorConversations();
  const unreadN = unread?.count ?? 0;
  const inboxUnread = convs?.totalUnread ?? 0;
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const isWideScript = locale === "si" || locale === "ta";
  const labelStyle = isWideScript ? NARROW_TAB_LABEL : WIDE_TAB_LABEL;

  // Premium floating pill — sits above the bottom safe area with a frosted
  // glass background, hairline border, and a top inner highlight.
  return (
    <View style={{ flex: 1 }}>
      <DoctorWaitingBanner />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: Platform.OS === "ios" ? 28 : 18,
          height: 72,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          paddingBottom: 6,
          paddingTop: 4,
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView
              intensity={Platform.OS === "ios" ? 90 : 60}
              tint="default"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor:
                    Platform.OS === "android"
                      ? colors.bgElevated
                      : "rgba(255,255,255,0.55)",
                },
              ]}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 32,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              }}
            />
            <View
              style={{
                position: "absolute",
                top: StyleSheet.hairlineWidth,
                left: 1,
                right: 1,
                height: 1,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                backgroundColor: "rgba(255,255,255,0.6)",
                opacity: Platform.OS === "android" ? 0 : 0.45,
              }}
            />
          </View>
        ),
        tabBarLabelStyle: labelStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.tabs.doctorHome"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={LayoutDashboard} focused={focused} badge={unreadN} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t("nav.tabs.doctorSchedule"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={CalendarDays} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("nav.tabs.doctorInbox"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Inbox} focused={focused} badge={inboxUnread} />
          ),
        }}
      />
      <Tabs.Screen
        name="prescription"
        options={{
          title: t("nav.tabs.doctorPrescribe"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={FilePenLine} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.tabs.doctorProfile"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={UserRound} focused={focused} />
          ),
        }}
      />

      {/* Hidden sub-pages — pushed, not tabs */}
      <Tabs.Screen
        name="care-team"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="patient-detail"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="clinical-note"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="clinical-notes"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="prescriptions"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="prescription-detail"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="lab-order"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="lab-orders"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="follow-ups"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="follow-up-new"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="availability"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="visit-summary"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="queue"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="records"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="records-v2"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="rx-templates"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="rx-templates/new"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="rx-templates/[id]"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="inbox/[id]"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="clinics/new"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="tenants/index"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="tenants/[id]"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="relationships/index"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="vital-record"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="teleconsult/[roomId]"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
    </Tabs>
    </View>
  );
}