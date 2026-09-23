// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  Linking,
  ScrollView,
  Pressable,
  Platform,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: spacing.md,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Headphones size={22} color={colors.primary} />
            </View>

            {/* Live Support Indicator */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: withOpacity(colors.success || "#059669", 0.08),
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: withOpacity(colors.success || "#059669", 0.2),
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.success || "#059669",
                }}
              />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: "700",
                  color: colors.success || "#059669",
                }}
              >
                Support Online
              </Text>
            </View>
          </View>

          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "700", fontSize: 17, marginBottom: 3 },
            ]}
          >
            {t("support.heroTitle", { defaultValue: "How can we help?" })}
          </Text>
          <Text
            style={{
              fontSize: 12.5,
              color: colors.textMuted,
              lineHeight: 18,
              marginBottom: 14,
            }}
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
            style={{ fontSize: 13.5 }}
          />
        </Card>

        {/* ── 2. Emergency Notice (Safety First) ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: withOpacity(colors.danger || "#EF4444", 0.06),
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withOpacity(colors.danger || "#EF4444", 0.2),
          }}
        >
          <AlertTriangle size={18} color={colors.danger || "#EF4444"} />
          <Text
            style={{
              fontSize: 11.5,
              color: colors.text,
              flex: 1,
              lineHeight: 16,
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.danger || "#EF4444" }}>
              Medical Emergency?
            </Text>{" "}
            Call emergency services (1990 / 911) or visit the nearest emergency room immediately.
          </Text>
        </View>

        {/* ── 3. Contact Channels ── */}
        <View style={{ gap: spacing.xs + 2 }}>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: "700",
              color: colors.textMuted,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginLeft: 2,
            }}
          >
            {t("support.contactHeading", { defaultValue: "Contact Us" })}
          </Text>

          <View style={{ gap: 10 }}>
            {/* Email Support */}
            <Pressable
              onPress={openEmail}
              accessibilityRole="button"
              accessibilityLabel={t("support.contactEmailLabel")}
              style={({ pressed }) => ({
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mail size={20} color={colors.primary} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 14.5,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 2,
                  }}
                >
                  {t("support.contactEmailLabel", { defaultValue: "Email support" })}
                </Text>
                <Text
                  style={{ fontSize: 12, color: colors.textMuted }}
                  numberOfLines={1}
                >
                  {CONTACT.email}
                </Text>
              </View>

              <ExternalLink size={16} color={colors.textMuted} />
            </Pressable>

            {/* WhatsApp Support (if configured) */}
            {WA_SUPPORT_PHONE ? (
              <Pressable
                onPress={openWhatsApp}
                accessibilityRole="button"
                accessibilityLabel={t("support.contactChatLabel")}
                style={({ pressed }) => ({
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: withOpacity("#10B981", 0.3),
                  backgroundColor: withOpacity("#10B981", 0.04),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: "#DCFCE7",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MessageCircle size={20} color="#15803D" />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <Text
                      style={{
                        fontSize: 14.5,
                        fontWeight: "700",
                        color: colors.text,
                      }}
                    >
                      {t("support.contactChatLabel", { defaultValue: "Chat on WhatsApp" })}
                    </Text>
                    <Pill label="Fastest" tone="success" size="sm" />
                  </View>
                  <Text
                    style={{ fontSize: 12, color: colors.textMuted }}
                    numberOfLines={1}
                  >
                    {t("support.contactChatSubtitle", {
                      defaultValue: "Mon–Fri, 9:00–18:00 IST · Instant reply",
                    })}
                  </Text>
                </View>

                <ExternalLink size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}

            {/* Phone Support */}
            <Pressable
              onPress={callPhone}
              accessibilityRole="button"
              accessibilityLabel={t("support.contactCallLabel")}
              style={({ pressed }) => ({
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: "#E0F2FE",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Phone size={20} color="#0284C7" />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 14.5,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 2,
                  }}
                >
                  {t("support.contactCallLabel", { defaultValue: "Call support" })}
                </Text>
                <Text
                  style={{ fontSize: 12, color: colors.textMuted }}
                  numberOfLines={1}
                >
                  {CONTACT.phone} · {t("support.hoursLabel", { defaultValue: "Mon–Fri, 9:00–18:00 IST" })}
                </Text>
              </View>

              <ExternalLink size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* ── 4. Frequently Asked Questions (FAQ) ── */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginLeft: 2,
            }}
          >
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: "700",
                color: colors.textMuted,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              {t("support.faqHeading", { defaultValue: "Frequently Asked" })}
            </Text>
            {searchQuery ? (
              <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                {filteredFaqs.length} results
              </Text>
            ) : null}
          </View>

          {/* Topic Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
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
                borderRadius: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                No matching questions found
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  textAlign: "center",
                  marginBottom: 12,
                }}
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
            <View style={{ gap: 8 }}>
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
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isOpen ? colors.primary : colors.border,
                      backgroundColor: isOpen
                        ? withOpacity(colors.primary, 0.02)
                        : colors.surface,
                      overflow: "hidden",
                    }}
                  >
                    <Pressable
                      onPress={() => setOpen(isOpen ? null : idx)}
                      accessibilityRole="button"
                      accessibilityLabel={t(questionKey)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: 14,
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
                            backgroundColor: isOpen ? colors.primarySoft : colors.bg,
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
                            typography.title.xs,
                            {
                              color: isOpen ? colors.primary : colors.text,
                              fontWeight: "700",
                              fontSize: 14,
                              flex: 1,
                            },
                          ]}
                        >
                          {t(questionKey)}
                        </Text>

                        {isOpen ? (
                          <ChevronUp size={18} color={colors.primary} />
                        ) : (
                          <ChevronDown size={18} color={colors.textMuted} />
                        )}
                      </View>

                      {isOpen ? (
                        <View
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.borderSoft,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12.5,
                              color: colors.textMuted,
                              lineHeight: 19,
                              marginBottom: 12,
                            }}
                          >
                            {t(answerKey)}
                          </Text>

                          {/* Was this helpful feedback strip */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: colors.bg,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>
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
                                  <ThumbsUp size={12} color={colors.textMuted} />
                                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Yes</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => handleFeedback(item.key, "no")}
                                  hitSlop={6}
                                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                                >
                                  <ThumbsDown size={12} color={colors.textMuted} />
                                  <Text style={{ fontSize: 11, color: colors.textMuted }}>No</Text>
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
            style={{
              fontSize: 11.5,
              fontWeight: "600",
              color: colors.textMuted,
            }}
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