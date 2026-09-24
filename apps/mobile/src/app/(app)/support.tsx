// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  Linking,
  ScrollView,
  Pressable,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import {
  LifeBuoy,
  Mail,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
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
  ArrowRight,
  Headphones,
  Sparkles,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
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

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();

  const [open, setOpen] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("all");
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});

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

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader
        title={t("support.title", { defaultValue: "Help & Support" })}
        back={true}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Hero Card with Search & Availability Indicator ── */}
        <Card
          style={{
            padding: spacing.lg,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                borderCurve: "continuous",
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Headphones size={22} color={colors.onPrimary} />
            </View>

            {/* Live Support Indicator */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.successSoft,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 20,
                borderCurve: "continuous",
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.success,
                }}
              />
              <Text
                style={[typography.label.sm, { color: colors.success }]}
              >
                Support Online
              </Text>
            </View>
          </View>

          <Text
            style={[
              typography.display.sm,
              { color: colors.text, marginBottom: 4 },
            ]}
          >
            {t("support.heroTitle", { defaultValue: "How can we help?" })}
          </Text>
          <Text
            style={[typography.body.sm, { color: colors.textMuted, marginBottom: spacing.lg }]}
          >
            {t("support.heroSubtitle", {
              defaultValue: "Reach our care team or search common questions below.",
            })}
          </Text>

          {/* Integrated Search Input */}
          <TextInput
            leadingIcon={Search}
            placeholder="Search help articles or questions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            tone="soft"
            trailingIcon={searchQuery ? X : undefined}
            onTrailingIconPress={() => setSearchQuery("")}
          />
        </Card>

        {/* ── 2. Emergency Notice (Safety First) ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            backgroundColor: colors.dangerSoft,
            padding: spacing.md,
            borderRadius: 18,
            borderCurve: "continuous",
          }}
        >
          <AlertTriangle size={18} color={colors.danger} />
          <Text
            style={[typography.body.sm, { color: colors.text, flex: 1 }]}
          >
            <Text style={[typography.label.md, { color: colors.danger }]}>
              Medical Emergency?
            </Text>{" "}
            Call emergency services (1990 / 911) or visit the nearest emergency room immediately.
          </Text>
        </View>

        {/* ── 3. Contact Channels ── */}
        <View style={{ gap: spacing.md }}>
          <Text
            style={[typography.title.lg, { color: colors.text, marginLeft: 2 }]}
          >
            {t("support.contactHeading", { defaultValue: "Contact Us" })}
          </Text>

          <Card padded={false}>
            {/* Email Support */}
            <Pressable
              onPress={openEmail}
              accessibilityRole="button"
              accessibilityLabel={t("support.contactEmailLabel")}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                minHeight: 64,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.separator,
                backgroundColor: pressed ? colors.fill : "transparent",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              })}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mail size={18} color={colors.onPrimary} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[typography.title.sm, { color: colors.text, marginBottom: 2 }]}
                >
                  {t("support.contactEmailLabel", { defaultValue: "Email support" })}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {CONTACT.email}
                </Text>
              </View>

              <ExternalLink size={16} color={colors.textSubtle} />
            </Pressable>

            {/* WhatsApp Support (if configured) */}
            {WA_SUPPORT_PHONE ? (
              <Pressable
                onPress={openWhatsApp}
                accessibilityRole="button"
                accessibilityLabel={t("support.contactChatLabel")}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  minHeight: 64,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.separator,
                  backgroundColor: pressed ? colors.fill : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                })}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: colors.success,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MessageCircle size={18} color="#FFFFFF" />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <Text
                      style={[typography.title.sm, { color: colors.text }]}
                    >
                      {t("support.contactChatLabel", { defaultValue: "Chat on WhatsApp" })}
                    </Text>
                    <Pill label="Fastest" tone="success" size="sm" />
                  </View>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {t("support.contactChatSubtitle", {
                      defaultValue: "Mon–Fri, 9:00–18:00 IST · Instant reply",
                    })}
                  </Text>
                </View>

                <ExternalLink size={16} color={colors.textSubtle} />
              </Pressable>
            ) : null}

            {/* Phone Support */}
            <Pressable
              onPress={callPhone}
              accessibilityRole="button"
              accessibilityLabel={t("support.contactCallLabel")}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                minHeight: 64,
                backgroundColor: pressed ? colors.fill : "transparent",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              })}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Phone size={18} color="#FFFFFF" />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[typography.title.sm, { color: colors.text, marginBottom: 2 }]}
                >
                  {t("support.contactCallLabel", { defaultValue: "Call support" })}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {CONTACT.phone} · {t("support.hoursLabel", { defaultValue: "Mon–Fri, 9:00–18:00 IST" })}
                </Text>
              </View>

              <ExternalLink size={16} color={colors.textSubtle} />
            </Pressable>
          </Card>
        </View>

        {/* ── 4. Frequently Asked Questions (FAQ) ── */}
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginLeft: 2,
            }}
          >
            <Text
              style={[typography.title.lg, { color: colors.text }]}
            >
              {t("support.faqHeading", { defaultValue: "Frequently Asked" })}
            </Text>
            {searchQuery ? (
              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                {filteredFaqs.length} results
              </Text>
            ) : null}
          </View>

          {/* Topic Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <Chip
                  key={cat.id}
                  label={cat.label}
                  selected={isSelected}
                  onPress={() => setActiveCategory(cat.id)}
                  size="sm"
                />
              );
            })}
          </ScrollView>

          {/* FAQ Accordion List */}
          {filteredFaqs.length === 0 ? (
            <Card
              style={{
                padding: spacing.xl,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={[typography.title.md, { color: colors.text, marginBottom: 6 }]}
              >
                No matching questions found
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg },
                ]}
              >
                Try searching with different keywords or contact our support team.
              </Text>
              <Button
                title="Clear Search"
                variant="outline"
                size="sm"
                onPress={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
                fullWidth={false}
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.sm + 2 }}>
              {filteredFaqs.map((item, idx) => {
                const isOpen = open === idx;
                const questionKey = `support.faq.${item.key}.question`;
                const answerKey = `support.faq.${item.key}.answer`;
                const Icon = item.icon;
                const userRating = feedback[item.key];

                return (
                  <Card
                    key={item.key}
                    padded={false}
                    style={{
                      borderRadius: 18,
                      borderCurve: "continuous",
                      ...(isOpen ? { borderWidth: 1, borderColor: withOpacity(colors.primary, 0.35) } : null),
                      overflow: "hidden",
                    }}
                  >
                    <Pressable
                      onPress={() => setOpen(isOpen ? null : idx)}
                      accessibilityRole="button"
                      accessibilityLabel={t(questionKey)}
                      style={{
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md + 2,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            borderCurve: "continuous",
                            backgroundColor: isOpen ? colors.primarySoft : colors.fill,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon
                            size={16}
                            color={isOpen ? colors.primary : colors.textMuted}
                          />
                        </View>

                        <Text
                          style={[
                            typography.title.sm,
                            {
                              color: colors.text,
                              flex: 1,
                            },
                          ]}
                        >
                          {t(questionKey)}
                        </Text>

                        {isOpen ? (
                          <ChevronUp size={18} color={colors.primary} />
                        ) : (
                          <ChevronDown size={18} color={colors.textSubtle} />
                        )}
                      </View>

                      {isOpen ? (
                        <View
                          style={{
                            marginTop: spacing.md,
                            paddingTop: spacing.md,
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.separator,
                          }}
                        >
                          <Text
                            style={[
                              typography.body.sm,
                              { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
                            ]}
                          >
                            {t(answerKey)}
                          </Text>

                          {/* Was this helpful feedback strip */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: colors.fill,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 12,
                              borderCurve: "continuous",
                            }}
                          >
                            <Text style={[typography.caption, { color: colors.textMuted }]}>
                              {userRating
                                ? "Thanks for your feedback!"
                                : "Was this answer helpful?"}
                            </Text>

                            {!userRating ? (
                              <View style={{ flexDirection: "row", gap: 10 }}>
                                <Pressable
                                  onPress={() => handleFeedback(item.key, "yes")}
                                  hitSlop={6}
                                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                                >
                                  <ThumbsUp size={13} color={colors.primary} />
                                  <Text style={[typography.label.sm, { color: colors.primary }]}>Yes</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => handleFeedback(item.key, "no")}
                                  hitSlop={6}
                                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                                >
                                  <ThumbsDown size={13} color={colors.textMuted} />
                                  <Text style={[typography.label.sm, { color: colors.textMuted }]}>No</Text>
                                </Pressable>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* ── 5. Reassuring Footer ── */}
        <View style={{ alignItems: "center", gap: 4, marginTop: 4 }}>
          <Text
            style={[typography.label.sm, { color: colors.textSubtle }]}
          >
            HealthHub Patient Care • Version 1.0
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: colors.textSubtle,
            }}
          >
            End-to-End Encrypted & HIPAA/GDPR Compliant
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}