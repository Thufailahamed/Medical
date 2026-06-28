import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Home, ClipboardList, Pill, Siren, UserRound } from "lucide-react-native";
import { useUnreadCount } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { TabIcon } from "@/components/ui";

export default function AppLayout() {
  const { colors, typography, shadow } = useTheme();
  const { data: unread } = useUnreadCount();
  const unreadN = unread?.count ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 88,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          paddingBottom: Platform.OS === "ios" ? 28 : 18,
          paddingTop: 10,
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView
              intensity={Platform.OS === "ios" ? 80 : 60}
              tint="default"
              style={StyleSheet.absoluteFill}
            />
            {/* Fallback / Android tint */}
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
            {/* Top hairline */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.border,
              }}
            />
            {/* Inner highlight */}
            <View
              style={{
                position: "absolute",
                top: StyleSheet.hairlineWidth,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.6)",
                opacity: Platform.OS === "android" ? 0 : 0.5,
              }}
            />
          </View>
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.4,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Home} focused={focused} badge={unreadN} />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "Records",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ClipboardList} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="medicines"
        options={{
          title: "Medicines",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Pill} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          title: "Emergency",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={Siren}
              focused={focused}
              tint={focused ? colors.danger : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={UserRound} focused={focused} />
          ),
        }}
      />
      {/* Hidden routes — these are sub-pages, not tabs */}
      <Tabs.Screen name="appointments" options={{ href: null }} />
      <Tabs.Screen name="book-appointment" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="add-medicine" options={{ href: null }} />
      <Tabs.Screen name="add-record" options={{ href: null }} />
      <Tabs.Screen name="doctor" options={{ href: null }} />
      <Tabs.Screen name="doctor/queue" options={{ href: null }} />
      <Tabs.Screen name="doctor/patient-detail" options={{ href: null }} />
      <Tabs.Screen name="doctor/clinical-note" options={{ href: null }} />
      <Tabs.Screen name="doctor/prescription" options={{ href: null }} />
      <Tabs.Screen name="doctor/lab-order" options={{ href: null }} />
      <Tabs.Screen name="doctor/lab-orders" options={{ href: null }} />
      <Tabs.Screen name="doctor/follow-ups" options={{ href: null }} />
      <Tabs.Screen name="doctor/follow-up-new" options={{ href: null }} />
      <Tabs.Screen name="doctor/availability" options={{ href: null }} />
      <Tabs.Screen name="hospital/dashboard" options={{ href: null }} />
      <Tabs.Screen name="hospital/wards" options={{ href: null }} />
      <Tabs.Screen name="hospital/ward-detail" options={{ href: null }} />
      <Tabs.Screen name="hospital/staff" options={{ href: null }} />
      <Tabs.Screen name="hospital/patients" options={{ href: null }} />
      <Tabs.Screen name="hospital/patient-detail" options={{ href: null }} />
      <Tabs.Screen name="ai/summary" options={{ href: null }} />
      <Tabs.Screen name="ai/lab-explain" options={{ href: null }} />
      <Tabs.Screen name="ai/drug-check" options={{ href: null }} />
      <Tabs.Screen name="ai/chat" options={{ href: null }} />
      <Tabs.Screen name="ai/ocr" options={{ href: null }} />
      <Tabs.Screen name="record-detail" options={{ href: null }} />
      <Tabs.Screen name="family" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="notes" options={{ href: null }} />
      <Tabs.Screen name="vitals" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="appearance" options={{ href: null }} />
      <Tabs.Screen name="change-password" options={{ href: null }} />
    </Tabs>
  );
}
