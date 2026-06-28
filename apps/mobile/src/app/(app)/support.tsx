import { useState } from "react";
import {
  View,
  Text,
  Linking,
  ScrollView,
  Pressable,
} from "react-native";
import {
  LifeBuoy,
  Mail,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  ListItem,
} from "@/components/ui";

const FAQ = [
  {
    q: "How do I book an appointment?",
    a: "Open Home → tap 'Book appointment', pick a doctor, choose a date and time slot, then confirm. You'll get an in-app notification when the doctor confirms.",
  },
  {
    q: "Where can I see my prescriptions?",
    a: "All prescriptions your doctor has issued appear in your medical records under the 'Prescription' filter. You can also tap any prescription to view attached medicines.",
  },
  {
    q: "How does medicine adherence work?",
    a: "Open the Medicines tab and tap 'Mark today's schedule' to generate dose reminders for each active medicine. Tap the dose ring when you take it. The history persists across sessions and devices.",
  },
  {
    q: "Can I share records with a new doctor?",
    a: "Each doctor you see via the app automatically gets access to records they created. To grant access to an outside doctor, use the QR Health ID on the Emergency screen — they can scan it once to view your critical info.",
  },
  {
    q: "What happens if I tap SOS?",
    a: "Your location, blood group, allergies, current medicines, and emergency contacts are sent to all your registered emergency contacts. A notification is created on their accounts and an audit log entry is written to your record.",
  },
  {
    q: "How do I export my data?",
    a: "All attachments stored in your records can be downloaded individually from the Records tab. A full data export is on the roadmap.",
  },
];

const CONTACT = {
  email: "support@healthhub.app",
  phone: "+94 11 234 5678",
  hours: "Mon–Fri, 9:00–18:00 IST",
};

export default function SupportScreen() {
  const { spacing, colors, typography } = useTheme();
  const [open, setOpen] = useState<number | null>(0);

  function openEmail() {
    Linking.openURL(`mailto:${CONTACT.email}?subject=HealthHub%20Support`);
  }

  function callPhone() {
    Linking.openURL(`tel:${CONTACT.phone.replace(/\s/g, "")}`);
  }

  function openChat() {
    Linking.openURL(`sms:${CONTACT.phone.replace(/\s/g, "")}`);
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader title="Help & Support" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        {/* Hero */}
        <Card padded={false}>
          <View
            style={{
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primarySoft,
              }}
            >
              <LifeBuoy size={28} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                How can we help?
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                Reach the team or browse common questions below.
              </Text>
            </View>
          </View>
        </Card>

        {/* Contact cards */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.label.md, { color: colors.textMuted }]}>
            CONTACT
          </Text>
          <Card padded={false}>
            <ListItem
              icon={Mail}
              iconTone="primary"
              title="Email support"
              subtitle={CONTACT.email}
              onPress={openEmail}
              trailing={<ExternalLink size={16} color={colors.textMuted} />}
            />
            <ListItem
              icon={MessageSquare}
              iconTone="accent2"
              title="Text us"
              subtitle={`${CONTACT.phone} · ${CONTACT.hours}`}
              onPress={openChat}
              trailing={<ExternalLink size={16} color={colors.textMuted} />}
            />
            <ListItem
              icon={Phone}
              iconTone="success"
              title="Call support"
              subtitle={CONTACT.hours}
              onPress={callPhone}
              trailing={<ExternalLink size={16} color={colors.textMuted} />}
            />
          </Card>
        </View>

        {/* FAQ */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.label.md, { color: colors.textMuted }]}>
            FREQUENTLY ASKED
          </Text>
          <Card padded={false}>
            {FAQ.map((item, idx) => {
              const isOpen = open === idx;
              return (
                <Pressable
                  key={idx}
                  onPress={() => setOpen(isOpen ? null : idx)}
                  accessibilityRole="button"
                  accessibilityLabel={item.q}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    borderBottomWidth: idx < FAQ.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: spacing.sm,
                    }}
                  >
                    <Text
                      style={[typography.title.sm, { color: colors.text, flex: 1 }]}
                    >
                      {item.q}
                    </Text>
                    {isOpen ? (
                      <ChevronUp size={18} color={colors.textMuted} />
                    ) : (
                      <ChevronDown size={18} color={colors.textMuted} />
                    )}
                  </View>
                  {isOpen ? (
                    <Text
                      style={[
                        typography.body.sm,
                        {
                          color: colors.textMuted,
                          marginTop: spacing.sm,
                          lineHeight: 20,
                        },
                      ]}
                    >
                      {item.a}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        </View>

        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, textAlign: "center" },
          ]}
        >
          HealthHub v0.1 · Healthcare Platform
        </Text>
      </ScrollView>
    </Screen>
  );
}