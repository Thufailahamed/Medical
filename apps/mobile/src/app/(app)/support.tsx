// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  Linking,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import {
  Mail,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  Calendar,
  Pill as PillIcon,
  Clock,
  FileText,
  Download,
  ThumbsUp,
  ThumbsDown,
  SearchX,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  IconTile,
  Chip,
  TextInput,
  Button,
} from "@/components/ui";

type FaqCategory = "all" | "appointments" | "medicines" | "records" | "emergency" | "data";

type FaqItem = {
  key: string;
  category: FaqCategory;
  categoryLabel: string;
  icon: any;
};

const FAQ_LIST: FaqItem[] = [
  {
    key: "bookAppointment",
    category: "appointments",
    categoryLabel: "Appointments",
    icon: Calendar,
  },
  {
    key: "seePrescriptions",
    category: "medicines",
    categoryLabel: "Prescriptions",
    icon: PillIcon,
  },
  {
    key: "medicineAdherence",
    category: "medicines",
    categoryLabel: "Medicines",
    icon: Clock,
  },
  {
    key: "shareRecords",
    category: "records",
    categoryLabel: "Health Records",
    icon: FileText,
  },
  {
    key: "sos",
    category: "emergency",
    categoryLabel: "Emergency",
    icon: AlertTriangle,
  },
  {
    key: "exportData",
    category: "data",
    categoryLabel: "Data Portability",
    icon: Download,
  },
];

const CATEGORIES = [
  { id: "all" as const, label: "All Topics" },
  { id: "appointments" as const, label: "Appointments" },
  { id: "medicines" as const, label: "Prescriptions" },
  { id: "records" as const, label: "Records" },
  { id: "emergency" as const, label: "Emergency" },
  { id: "data" as const, label: "Data" },
];

const CONTACT = {
  email: "support@healthhub.app",
  phone: "+94 11 234 5678",
};

const WA_SUPPORT_PHONE: string =
  (Constants.expoConfig?.extra as any)?.waSupportPhone || "";


/** Support desk hours: Mon–Fri 09:00–18:00 Sri Lanka time (UTC+5:30). */
function isSupportOpen(now = new Date()): boolean {
  const lk = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60_000);
  const day = lk.getDay();
  const hour = lk.getHours();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
}

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  const [openKey, setOpenKey] = useState<string | null>(FAQ_LIST[0].key);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("all");
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});
  const supportOpen = useMemo(() => isSupportOpen(), []);

  function openEmail() {
    Linking.openURL(`mailto:${CONTACT.email}?subject=HealthHub%20Support`);
  }

  function callPhone() {
    Linking.openURL(`tel:${CONTACT.phone.replace(/\s/g, "")}`);
  }

  function openWhatsApp() {
    if (!WA_SUPPORT_PHONE) return;
    const text = encodeURIComponent("Hi HealthHub support, ");
    Linking.openURL(`https://wa.me/${WA_SUPPORT_PHONE}?text=${text}`);
  }

  const filteredFaqs = useMemo(() => {
    return FAQ_LIST.filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category === activeCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const question = t(`support.faq.${item.key}.question`).toLowerCase();
      const answer = t(`support.faq.${item.key}.answer`).toLowerCase();
      const cat = item.categoryLabel.toLowerCase();

      return question.includes(q) || answer.includes(q) || cat.includes(q);
    });
  }, [activeCategory, searchQuery, t]);

  const handleFeedback = (key: string, type: "yes" | "no") => {
    setFeedback((prev) => ({ ...prev, [key]: type }));
  };

  const channels = [
    ...(WA_SUPPORT_PHONE
      ? [
          {
            key: "wa",
            icon: MessageCircle,
            tone: "success" as const,
            label: t("support.contactChatLabel", { defaultValue: "Chat on WhatsApp" }),
            detail: t("support.replyFastest", { defaultValue: "Usually replies within 4h" }),
            badge: t("support.badgeFastest", { defaultValue: "Fastest" }),
            onPress: openWhatsApp,
          },
        ]
      : []),
    {
      key: "call",
      icon: Phone,
      tone: "accent" as const,
      label: t("support.contactCallLabel", { defaultValue: "Call support" }),
      detail: CONTACT.phone,
      onPress: callPhone,
    },
    {
      key: "email",
      icon: Mail,
      tone: "primary" as const,
      label: t("support.contactEmailLabel", { defaultValue: "Email support" }),
      detail: CONTACT.email,
      badge: t("support.badge24h", { defaultValue: "Reply in 24h" }),
      onPress: openEmail,
    },
  ];

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("support.title", { defaultValue: "Help & Support" })}
        subtitle={t("support.heroTitle", { defaultValue: "How can we help?" })}
        back={true}
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Search ── */}
        <TextInput
          leadingIcon={Search}
          placeholder={t("support.searchPlaceholder", {
            defaultValue: "Search questions",
          })}
          value={searchQuery}
          onChangeText={setSearchQuery}
          trailingIcon={searchQuery ? X : undefined}
          onTrailingIconPress={() => setSearchQuery("")}
          returnKeyType="search"
        />

        {/* ── Emergency (tap to call) ── */}
        <Pressable
          onPress={() => Linking.openURL("tel:1990")}
          accessibilityRole="button"
          accessibilityLabel={t("support.emergencyA11y", {
            defaultValue: "Call Suwa Seriya ambulance, 1990",
          })}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.md,
            paddingLeft: spacing.md,
            paddingRight: spacing.sm + 2,
            borderRadius: 20,
            borderCurve: "continuous",
            backgroundColor: colors.dangerSoft,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <AlertTriangle size={20} color={colors.danger} strokeWidth={2.4} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.label.md, { color: colors.danger }]}>
              {t("support.emergencyTitle", { defaultValue: "Medical emergency?" })}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
              {t("support.emergencyBody", {
                defaultValue: "Call 1990 or go to the nearest ER",
              })}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 36,
              paddingHorizontal: 14,
              borderRadius: 18,
              backgroundColor: colors.danger,
            }}
          >
            <Phone size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={[typography.label.md, { color: "#FFFFFF" }]}>1990</Text>
          </View>
        </Pressable>

        {/* ── Contact ── */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 2,
            }}
          >
            <SectionTitle label={t("support.talkToUs", { defaultValue: "Talk to us" })} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: supportOpen ? colors.success : colors.textSubtle,
                }}
              />
              <Text
                style={[
                  typography.label.sm,
                  { color: supportOpen ? colors.success : colors.textMuted },
                ]}
              >
                {supportOpen
                  ? t("support.openNow", { defaultValue: "Open now" })
                  : t("support.closedNow", { defaultValue: "Closed now" })}
              </Text>
            </View>
          </View>

          <Card padded={false}>
            {channels.map((c, i) => (
              <Pressable
                key={c.key}
                onPress={c.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${c.label}, ${c.detail}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.separator,
                  backgroundColor: pressed ? colors.fill : "transparent",
                })}
              >
                <IconTile icon={c.icon} tone={c.tone} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
                    {c.label}
                  </Text>
                  <Text style={[typography.body.sm, { color: colors.textMuted }]} numberOfLines={1}>
                    {c.detail}
                  </Text>
                </View>
                {c.badge ? <Badge label={c.badge} tone={c.tone} /> : null}
                <ChevronRight size={18} color={colors.textSubtle} />
              </Pressable>
            ))}
          </Card>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }}>
            <Clock size={12} color={colors.textSubtle} />
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              {t("support.hoursLabel", { defaultValue: "Mon–Fri, 9:00–18:00 IST" })}
            </Text>
          </View>
        </View>

        {/* ── FAQ ── */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ paddingHorizontal: 2 }}>
            <SectionTitle
              label={t("support.faqTitle", { defaultValue: "Common questions" })}
              count={searchQuery ? filteredFaqs.length : undefined}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -spacing.lg }}
            contentContainerStyle={{
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: 6,
            }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <Chip
                  key={cat.id}
                  label={cat.label}
                  selected={isSelected}
                  tone={isSelected ? "primary" : "neutral"}
                  onPress={() => setActiveCategory(cat.id)}
                  size="sm"
                />
              );
            })}
          </ScrollView>

          {filteredFaqs.length === 0 ? (
            <Card style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
              <SearchX size={28} color={colors.textSubtle} />
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("support.noResults", { defaultValue: "No matching questions" })}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
                {t("support.noResultsBody", {
                  defaultValue: "Try other words, or contact us above.",
                })}
              </Text>
              <Button
                title={t("support.clearSearch", { defaultValue: "Clear search" })}
                variant="secondary"
                size="sm"
                onPress={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
                fullWidth={false}
                style={{ marginTop: spacing.xs }}
              />
            </Card>
          ) : (
            <Card padded={false}>
              {filteredFaqs.map((item, idx) => {
                const isOpen = openKey === item.key;
                const Icon = item.icon;
                const userRating = feedback[item.key];

                return (
                  <View
                    key={item.key}
                    style={{
                      borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    <Pressable
                      onPress={() => setOpenKey(isOpen ? null : item.key)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                      }}
                    >
                      <Icon size={18} color={isOpen ? colors.primary : colors.textMuted} strokeWidth={2.2} />
                      <Text
                        style={[
                          typography.label.lg,
                          { color: isOpen ? colors.primary : colors.text, flex: 1 },
                        ]}
                      >
                        {t(`support.faq.${item.key}.question`)}
                      </Text>
                      <ChevronDown
                        size={18}
                        color={isOpen ? colors.primary : colors.textSubtle}
                        style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
                      />
                    </Pressable>

                    {isOpen ? (
                      <View
                        style={{
                          paddingLeft: spacing.lg + 18 + spacing.md,
                          paddingRight: spacing.lg,
                          paddingBottom: spacing.md,
                          gap: spacing.md,
                        }}
                      >
                        <Text style={[typography.body.sm, { color: colors.textMuted, lineHeight: 21 }]}>
                          {t(`support.faq.${item.key}.answer`)}
                        </Text>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                          <Text style={[typography.caption, { color: colors.textSubtle, flex: 1 }]}>
                            {userRating
                              ? t("support.feedbackThanks", { defaultValue: "Thanks for the feedback" })
                              : t("support.feedbackAsk", { defaultValue: "Was this helpful?" })}
                          </Text>
                          {!userRating ? (
                            <>
                              <FeedbackButton icon={ThumbsUp} onPress={() => handleFeedback(item.key, "yes")} />
                              <FeedbackButton icon={ThumbsDown} onPress={() => handleFeedback(item.key, "no")} />
                            </>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          )}
        </View>

        {/* ── Footer ── */}
        <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center" }]}>
          {t("support.footer", { defaultValue: "HealthHub v0.1 · Healthcare Platform" })}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function SectionTitle({ label, count }: { label: string; count?: number }) {
  const { colors, typography } = useTheme();
  return (
    <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase" }]}>
      {label}
      {typeof count === "number" ? ` · ${count}` : ""}
    </Text>
  );
}

function Badge({ label, tone }: { label: string; tone: any }) {
  const { typography } = useTheme();
  const pal = useTone(tone);
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: pal.bg }}>
      <Text style={[typography.caption, { color: pal.fg, fontWeight: "700", fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

function FeedbackButton({ icon: Icon, onPress }: { icon: any; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.fillStrong : colors.fill,
      })}
    >
      <Icon size={14} color={colors.textMuted} />
    </Pressable>
  );
}
