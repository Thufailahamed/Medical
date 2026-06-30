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
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  ListItem,
} from "@/components/ui";

// FAQ keyset pulls from i18n; the hard-coded "q/a" object becomes key paths
// so translators can swap all content per-locale without code changes.
const FAQ_KEYS = [
  "bookAppointment",
  "seePrescriptions",
  "medicineAdherence",
  "shareRecords",
  "sos",
  "exportData",
] as const;

const CONTACT = {
  email: "support@healthhub.app",
  phone: "+94 11 234 5678",
};

export default function SupportScreen() {
  const { t } = useTranslation();
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
      <ScreenHeader title={t("support.title")} />
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
                {t("support.heroTitle")}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                {t("support.heroSubtitle")}
              </Text>
            </View>
          </View>
        </Card>

        {/* Contact cards */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.label.md, { color: colors.textMuted }]}>
            {t("support.contactHeading")}
          </Text>
          <Card padded={false}>
            <ListItem
              icon={Mail}
              iconTone="primary"
              title={t("support.contactEmailLabel")}
              subtitle={CONTACT.email}
              onPress={openEmail}
              trailing={<ExternalLink size={16} color={colors.textMuted} />}
            />
            <ListItem
              icon={MessageSquare}
              iconTone="accent2"
              title={t("support.contactChatLabel")}
              subtitle={`${CONTACT.phone} · ${t("support.hoursLabel")}`}
              onPress={openChat}
              trailing={<ExternalLink size={16} color={colors.textMuted} />}
            />
            <ListItem
              icon={Phone}
              iconTone="success"
              title={t("support.contactCallLabel")}
              subtitle={t("support.hoursLabel")}
              onPress={callPhone}
              trailing={<ExternalLink size={16} color={colors.textMuted} />}
            />
          </Card>
        </View>

        {/* FAQ */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.label.md, { color: colors.textMuted }]}>
            {t("support.faqHeading")}
          </Text>
          <Card padded={false}>
            {FAQ_KEYS.map((key, idx) => {
              const isOpen = open === idx;
              const questionKey = `support.faq.${key}.question`;
              const answerKey = `support.faq.${key}.answer`;
              return (
                <Pressable
                  key={key}
                  onPress={() => setOpen(isOpen ? null : idx)}
                  accessibilityRole="button"
                  accessibilityLabel={t(questionKey)}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    borderBottomWidth: idx < FAQ_KEYS.length - 1 ? 1 : 0,
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
                      {t(questionKey)}
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
                      {t(answerKey)}
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
          {t("support.footer")}
        </Text>
      </ScrollView>
    </Screen>
  );
}