import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Home, ClipboardList, Pill, Siren, UserRound, MessageCircle, ScanLine } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useUnreadCount, usePatientConversations } from "@/hooks/useApi";
import { useRealtime } from "@/hooks/useRealtime";
import { useTheme } from "@/theme/ThemeProvider";
import { TabIcon } from "@/components/ui";
import { useLocaleStore } from "@/stores/locale";

// Sinhala + Tamil glyphs render ~1.3x wider than Latin at the same font size.
// Trim fontSize + letterSpacing for those locales to keep the 5 labels from
// overlapping under the icon. Latin (en) keeps the original 10/0.4 spec.
const NARROW_TAB_LABEL = {
  fontSize: 9,
  fontWeight: "700" as const,
  letterSpacing: 0,
  marginTop: 4,
};
const WIDE_TAB_LABEL = {
  fontSize: 10,
  fontWeight: "700" as const,
  letterSpacing: 0.4,
  marginTop: 4,
};

export default function AppLayout() {
  const { colors } = useTheme();
  const { data: unread } = useUnreadCount();
  const unreadN = unread?.count ?? 0;
  const { data: msgData } = usePatientConversations();
  const msgUnread = msgData?.totalUnread ?? 0;
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const isWideScript = locale === "si" || locale === "ta";
  const labelStyle = isWideScript ? NARROW_TAB_LABEL : WIDE_TAB_LABEL;

  // SSE-driven notifications: server pushes → invalidate React Query.
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
        tabBarLabelStyle: labelStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.tabs.home"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Home} focused={focused} badge={unreadN} />
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
        name="emergency"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
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
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("nav.tabs.messages"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={MessageCircle} focused={focused} badge={msgUnread} />
          ),
        }}
      />
      <Tabs.Screen
        name="health-id"
        options={{
          title: t("nav.tabs.healthId"),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ScanLine} focused={focused} />
          ),
        }}
      />

      {/* Hidden sub-pages — pushed, not tabs */}
      <Tabs.Screen
        name="appointments"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="book-appointment"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="add-medicine"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="add-record"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="email-import"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="family"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="caretakers"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="hospital/dashboard"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="hospital/wards"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="hospital/ward-detail"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="hospital/staff"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="hospital/staff-invites"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="hospital/patients"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="hospital/patient-detail"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="hospital/walk-ins"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="ai/summary"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="ai/lab-explain"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="ai/drug-check"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="ai/chat"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="ai/ocr"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="record-detail"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="edit-record"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="edit-medicine"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="medicines-history"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="notes"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="vitals"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="support"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="activity"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="appearance"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="change-password"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="share"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="timeline"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="allergies"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="vaccinations"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="health-summary"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="export"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="appointment-detail"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="notification-preferences"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="app-lock"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="verify/[id]"
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
        name="care-team"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="care-team-add"
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
        name="hospital/doctors"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="records/[id]/files"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="records/[id]/history"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="records/[id]/share"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="inbox/[id]"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="audit"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="rate-visit/[appointmentId]"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="refill"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="ai/clinical-note"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="ai/lab-trend"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
    </Tabs>
  );
}