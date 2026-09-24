// @ts-nocheck

import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Phone,
  Mail,
  Building2,
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  Briefcase,
  Languages,
  Clock4,
  ChevronRight,
  Edit3,
  FlaskConical,
  CalendarDays,
  FileText,
  Bell,
  Stethoscope,
  LogOut,
  Users,
  Coins,
  DollarSign,
  Layers,
  Moon,
  Sun,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  Check,
  UserCheck,
} from "lucide-react-native";
import {
  useDoctorMe,
  useDoctorQueue,
  useDoctorDashboard,
  useDoctorPrescriptions,
  useDoctorClinicalNotes,
  useLabOrders,
  useFollowUps,
  useUnreadCount,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { Screen, Skeleton, ErrorState, Button, Pill } from "@/components/ui";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore, type Locale } from "@/stores/locale";
import { useThemeStore } from "@/stores/theme";
import { api } from "@/lib/api";
import { withOpacity } from "@/constants/theme";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ marginBottom: 2, paddingHorizontal: 4 }}>
      <Text
        numberOfLines={1}
        style={[typography.title.lg, { color: colors.text }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Interactive quick-metric card */
function ActivityTile({
  icon: Icon,
  label,
  value,
  tone = "primary",
  onPress,
}: {
  icon: any;
  label: string;
  value: number | string;
  tone?: Tone;
  onPress: () => void;
}) {
  const { colors, typography, shadow, scheme } = useTheme();
  const palette = useTone(tone);
  const isDark = scheme === "dark";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: "30%",
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.separator,
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        ...(isDark ? {} : shadow.sm),
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          borderCurve: "continuous",
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={15} color={palette.fg} strokeWidth={2.4} />
      </View>
      <View>
        <Text
          style={[
            typography.display.sm,
            {
              fontSize: 26,
              lineHeight: 30,
              letterSpacing: -0.9,
              color: colors.text,
              fontVariant: ["tabular-nums"],
            },
          ]}
        >
          {value}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function ProfileInfoRow({
  icon: Icon,
  label,
  value,
  href,
  last,
}: {
  icon: any;
  label: string;
  value?: string | null;
  href?: string;
  last?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
  const open = () => {
    if (href && value) Linking.openURL(href).catch(() => {});
  };
  const isInteractive = Boolean(href && value);

  const inner = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 60,
        paddingVertical: 11,
        paddingHorizontal: spacing.lg,
      }}
    >
      {!last ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            left: spacing.lg + 32 + spacing.md,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
        />
      ) : null}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          borderCurve: "continuous",
          backgroundColor: colors.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={colors.textMuted} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          {label}
        </Text>
        <Text
          style={[typography.label.lg, { color: colors.text, marginTop: 1 }]}
          numberOfLines={2}
        >
          {value || "—"}
        </Text>
      </View>
      {isInteractive ? (
        <ChevronRight size={17} color={colors.textSubtle} strokeWidth={2.4} />
      ) : null}
    </View>
  );

  if (isInteractive) {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.fill : "transparent",
        })}
      >
        {inner}
      </Pressable>
    );
  }

  return inner;
}

function NavigationLinkRow({
  icon: Icon,
  title,
  subtitle,
  tone = "primary",
  badge,
  last,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  tone?: Tone;
  badge?: number;
  last?: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const palette = useTone(tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <View
        style={{
          minHeight: 60,
          paddingVertical: 11,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        {!last ? (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              left: spacing.lg + 32 + spacing.md,
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.separator,
            }}
          />
        ) : null}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            borderCurve: "continuous",
            backgroundColor: palette.bgStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={17} color={palette.onBgStrong} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text
            numberOfLines={1}
            style={[typography.title.sm, { color: colors.text }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[typography.body.sm, { color: colors.textMuted }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              paddingHorizontal: 6,
              borderRadius: 11,
              borderCurve: "continuous",
              backgroundColor: colors.danger,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[typography.label.xs, { color: colors.onDanger }]}>
              {badge}
            </Text>
          </View>
        ) : null}
        <ChevronRight size={17} color={colors.textSubtle} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

export default function DoctorProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { spacing, colors, typography, fontFamily, radius, shadow, scheme: themeScheme } = useTheme();
  const isDarkUI = themeScheme === "dark";
  const groupCard = {
    borderRadius: radius.card,
    borderCurve: "continuous" as const,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDarkUI ? colors.borderStrong : colors.separator,
    ...(isDarkUI ? {} : shadow.sm),
  };
  const { user, logout } = useAuthStore();
  const currentLocale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { scheme, toggle: toggleTheme } = useThemeStore();

  function handleLanguageChange(newLocale: Locale) {
    setLocale(newLocale);
    i18n.changeLanguage(newLocale);
  }

  function confirmLogout() {
    Alert.alert(
      t("profile.logout.title", { defaultValue: "Sign Out" }),
      t("profile.logout.body", { defaultValue: "Are you sure you want to sign out of your doctor portal?" }),
      [
        { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
        {
          text: t("profile.logout.confirm", { defaultValue: "Sign Out" }),
          style: "destructive",
          onPress: handleLogout,
        },
      ]
    );
  }

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    queryClient.clear();
    logout();
    router.replace("/(auth)/login" as any);
  }

  const { data, isLoading, isError, refetch } = useDoctorMe();
  const { data: queue } = useDoctorQueue();
  const { data: rxData } = useDoctorPrescriptions();
  const { data: notesData } = useDoctorClinicalNotes();
  const { data: labData } = useLabOrders();
  const { data: followData } = useFollowUps({ upcoming: true });
  const { data: unread } = useUnreadCount();

  const doctor = data?.doctor?.doctors;
  const dbUser = data?.doctor?.users;

  const queueCount = useMemo(() => {
    const list = queue?.queue || [];
    return list.filter(
      (q: any) =>
        q.status !== "completed" &&
        q.status !== "cancelled" &&
        q.status !== "no_show"
    ).length;
  }, [queue]);

  const rxCount = rxData?.prescriptions?.length ?? 0;
  const notesCount = notesData?.count ?? notesData?.notes?.length ?? 0;
  const labCount = labData?.orders?.length ?? 0;
  const followCount = followData?.followUps?.length ?? 0;
  const unreadN = unread?.count ?? 0;

  if (isError) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load profile")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry", "Try Again")}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  if (isLoading || !doctor || !dbUser) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset={false}>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.lg }}>
          <Skeleton height={200} radius={24} />
          <Skeleton height={140} radius={20} />
          <Skeleton height={220} radius={20} />
        </View>
      </Screen>
    );
  }

  const rawName = (dbUser?.name || "").replace(/^dr\.?\s+/i, "").trim();
  const displayName = rawName || t("doctorProfile.fallbackName");
  const heroName = /^doctor$/i.test(displayName)
    ? t("doctorProfile.fallbackHeroName")
    : t("doctorProfile.doctorName", { name: displayName });

  const initials = heroName
    .replace(/^dr\.?\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "DR";

  const phoneHref = dbUser?.phone ? `tel:${dbUser.phone}` : undefined;
  const emailHref = dbUser?.email ? `mailto:${dbUser.email}` : undefined;
  const verified = dbUser?.verified;

  const practiceRows = [
    doctor?.specialization
      ? {
          icon: Stethoscope,
          label: t("doctorProfile.rows.specialization", { defaultValue: "Specialization" }),
          value: doctor.specialization,
        }
      : null,
    doctor?.yearsOfExperience != null
      ? {
          icon: Briefcase,
          label: t("doctorProfile.rows.years", { defaultValue: "Clinical Experience" }),
          value: t("doctorProfile.rows.yearsValue", {
            count: doctor.yearsOfExperience,
          }),
        }
      : null,
    doctor?.qualifications
      ? {
          icon: GraduationCap,
          label: t("doctorProfile.rows.qualifications", { defaultValue: "Qualifications" }),
          value: doctor.qualifications,
        }
      : null,
    doctor?.languages
      ? {
          icon: Languages,
          label: t("doctorProfile.rows.languages", { defaultValue: "Languages" }),
          value: doctor.languages,
        }
      : null,
    doctor?.hospitalName
      ? {
          icon: Building2,
          label: t("doctorProfile.rows.hospital", { defaultValue: "Primary Hospital" }),
          value: doctor.hospitalName,
        }
      : null,
    doctor?.consultationFee != null
      ? {
          icon: Clock4,
          label: t("doctorProfile.rows.fee", { defaultValue: "Consultation Fee" }),
          value: t("doctorProfile.rows.feeValue", {
            amount: Number(doctor.consultationFee).toLocaleString(),
          }),
        }
      : null,
  ].filter(Boolean) as Array<{ icon: any; label: string; value: string }>;

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset={false} bottomInset={false} style={{ backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 160, // Clearance for floating bottom nav!
          gap: spacing.xl,
        }}
      >
        {/* ─── Top Screen Bar ─── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: 2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserCheck size={18} color={colors.primary} strokeWidth={2.4} />
            </View>
            <View>
              <Text style={[typography.display.md, { color: colors.text }]}>
                {t("doctorProfile.title", { defaultValue: "Doctor Profile" })}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {t("doctorProfile.subtitle")}
              </Text>
            </View>
          </View>

          {/* Quick Notification Bell */}
          <Pressable
            onPress={() => router.push("/(doctor)/notifications" as any)}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: "continuous",
              backgroundColor: pressed ? colors.fillStrong : colors.fill,
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            })}
          >
            <Bell size={18} color={colors.text} strokeWidth={2.2} />
            {unreadN > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.danger,
                }}
              />
            )}
          </Pressable>
        </View>

        {/* ─── Hero Credential Identity Card ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            borderRadius: radius.xxl,
            borderCurve: "continuous",
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.22)",
            ...(isDarkUI ? {} : shadow.hero),
          }}
        >
          <LinearGradient
            colors={["#062247", "#0A4E7A", "#0E7490"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Decorative ambient glowing orbs */}
          <View
            style={{
              position: "absolute",
              top: -40,
              right: -30,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -50,
              left: -30,
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: "rgba(255,255,255,0.05)",
            }}
          />

          <View style={{ padding: 20 }}>
            {/* Top row: Avatar + Name + Verified Badge */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              {dbUser?.photo ? (
                <Image
                  source={{ uri: dbUser.photo }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    borderCurve: "continuous",
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.4)",
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.18)",
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "800",
                      color: "#FFFFFF",
                      fontFamily: fontFamily.displayBold,
                      letterSpacing: 0.5,
                    }}
                  >
                    {initials}
                  </Text>
                </View>
              )}

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      lineHeight: 25,
                      fontWeight: "800",
                      color: "#FFFFFF",
                      fontFamily: fontFamily.displayBold,
                      letterSpacing: -0.3,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {heroName}
                  </Text>
                  {verified !== false ? (
                    <BadgeCheck size={18} color="#5EEAD4" strokeWidth={2.4} />
                  ) : null}
                </View>

                <Text
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 13.5,
                    fontWeight: "600",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {doctor.specialization || t("doctorProfile.generalPractice", { defaultValue: "Consultant Physician" })}
                </Text>

                {doctor.hospitalName ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Building2 size={12} color="rgba(255,255,255,0.75)" />
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontSize: 12,
                        fontWeight: "500",
                      }}
                      numberOfLines={1}
                    >
                      {doctor.hospitalName}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Credential Tags Bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 16,
                paddingTop: 14,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: "rgba(255,255,255,0.22)",
              }}
            >
              {doctor.licenseNumber ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: "rgba(255,255,255,0.18)",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: "rgba(255,255,255,0.28)",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    borderCurve: "continuous",
                  }}
                >
                  <ShieldCheck size={12} color="#5EEAD4" strokeWidth={2.4} />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 0.3,
                    }}
                  >
                    {t("doctorProfile.slmcNumber", {
                    number: doctor.licenseNumber,
                  })}
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.28)",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 20,
                  borderCurve: "continuous",
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#34D399",
                  }}
                />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {t("doctorProfile.activePractice")}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Clinical Activity Grid (Interactive Shortcuts) ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SectionHeader
            title={t("doctorProfile.sections.activity", { defaultValue: "Clinical Activity" })}
            subtitle={t("doctorProfile.sections.activitySubtitle")}
          />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <ActivityTile
              icon={CalendarDays}
              label={t("doctorProfile.stats.todayQueue", { defaultValue: "Today's queue" })}
              value={queueCount}
              tone="primary"
              onPress={() => router.push("/(doctor)/schedule" as any)}
            />
            <ActivityTile
              icon={FlaskConical}
              label={t("doctorProfile.stats.labOrders", { defaultValue: "Lab orders" })}
              value={labCount}
              tone="info"
              onPress={() => router.push("/(doctor)/lab-orders" as any)}
            />
            <ActivityTile
              icon={CalendarClock}
              label={t("doctorProfile.stats.followUps", { defaultValue: "Follow-ups" })}
              value={followCount}
              tone="warning"
              onPress={() => router.push("/(doctor)/follow-ups" as any)}
            />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <ActivityTile
              icon={FileText}
              label={t("doctorProfile.stats.prescriptions", { defaultValue: "Prescriptions" })}
              value={rxCount}
              tone="success"
              onPress={() => router.push("/(doctor)/prescriptions" as any)}
            />
            <ActivityTile
              icon={Edit3}
              label={t("doctorProfile.stats.clinicalNotes", { defaultValue: "Clinical notes" })}
              value={notesCount}
              tone="accent"
              onPress={() => router.push("/(doctor)/clinical-notes" as any)}
            />
            <ActivityTile
              icon={Bell}
              label={t("doctorProfile.stats.unread", { defaultValue: "Unread alerts" })}
              value={unreadN}
              tone="danger"
              onPress={() => router.push("/(doctor)/notifications" as any)}
            />
          </View>
        </View>

        {/* ─── Practice & Qualifications Card ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SectionHeader
            title={t("doctorProfile.sections.practice", { defaultValue: "Practice & Credentials" })}
            subtitle={t("doctorProfile.sections.practiceSubtitle")}
          />

          <View
            style={{
              ...groupCard,
              overflow: "hidden",
            }}
          >
            {practiceRows.length > 0 ? (
              practiceRows.map((row, idx) => (
                <ProfileInfoRow
                  key={row.label}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  last={idx === practiceRows.length - 1}
                />
              ))
            ) : (
              <ProfileInfoRow
                icon={Stethoscope}
                label={t("doctorProfile.rows.specialization", { defaultValue: "Specialization" })}
                value={t("doctorProfile.generalPractitioner")}
                last
              />
            )}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: spacing.lg,
                paddingVertical: 12,
                backgroundColor: colors.primarySoft,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
              }}
            >
              <ShieldCheck size={16} color={colors.primary} strokeWidth={2.2} />
              <Text
                style={[typography.body.xs, { flex: 1, color: colors.textMuted }]}
              >
                {t("doctorProfile.verifiedNote")}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Contact Information Card ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SectionHeader
            title={t("doctorProfile.sections.contact", { defaultValue: "Contact Information" })}
            subtitle={t("doctorProfile.sections.contactSubtitle")}
          />

          <View
            style={{
              ...groupCard,
              overflow: "hidden",
            }}
          >
            <ProfileInfoRow
              icon={Phone}
              label={t("doctorProfile.rows.phone", { defaultValue: "Phone Number" })}
              value={dbUser?.phone}
              href={phoneHref}
            />
            <ProfileInfoRow
              icon={Mail}
              label={t("doctorProfile.rows.email", { defaultValue: "Email Address" })}
              value={dbUser?.email}
              href={emailHref}
              last
            />
          </View>
        </View>

        {/* ─── Practice Management Tools ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SectionHeader
            title={t("doctorProfile.sections.manage", { defaultValue: "Practice Management" })}
            subtitle={t("doctorProfile.sections.manageSubtitle")}
          />

          <View
            style={{
              ...groupCard,
              overflow: "hidden",
            }}
          >
            <NavigationLinkRow
              icon={CalendarClock}
              title={t("doctorProfile.availabilityTitle", { defaultValue: "Availability & Clinic Hours" })}
              subtitle={t("doctorProfile.availabilitySubtitle", { defaultValue: "Set consultation slots and buffer times" })}
              tone="primary"
              onPress={() => router.push("/(doctor)/availability" as any)}
            />
            <NavigationLinkRow
              icon={Building2}
              title={t("doctorProfile.links.workspaces")}
              subtitle={t("doctorProfile.links.workspacesSubtitle")}
              tone="info"
              onPress={() => router.push("/tenants" as any)}
            />
            <NavigationLinkRow
              icon={Layers}
              title={t("doctorProfile.links.rxTemplates")}
              subtitle={t("doctorProfile.links.rxTemplatesSubtitle")}
              tone="accent"
              onPress={() => router.push("/(doctor)/rx-templates" as any)}
            />
            <NavigationLinkRow
              icon={Users}
              title={t("doctorProfile.relationshipsTitle", { defaultValue: "Care Team & Patients" })}
              subtitle={t("doctorProfile.relationshipsSubtitle", { defaultValue: "Assigned patients and active consent links" })}
              tone="info"
              onPress={() => router.push("/(doctor)/relationships" as any)}
            />
            <NavigationLinkRow
              icon={DollarSign}
              title={t("doctorProfile.links.earnings")}
              subtitle={t("doctorProfile.links.earningsSubtitle")}
              tone="success"
              last
              onPress={() => router.push("/(doctor)/earnings" as any)}
            />
          </View>
        </View>

        {/* ─── App Preferences (Language & Theme) ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SectionHeader
            title={t("doctorProfile.sections.preferences")}
            subtitle={t("doctorProfile.sections.preferencesSubtitle")}
          />

          <View
            style={{
              ...groupCard,
              padding: spacing.lg,
              gap: spacing.lg,
            }}
          >
            {/* Language Selector */}
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Languages size={17} color={colors.primary} strokeWidth={2.2} />
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  {t("doctorProfile.languageTitle")}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                  padding: 3,
                  gap: 2,
                }}
              >
                {(
                  [
                    { code: "en", label: "English" },
                    { code: "si", label: "සිංහල" },
                    { code: "ta", label: "தமிழ்" },
                  ] as const
                ).map((lang) => {
                  const active = currentLocale === lang.code;
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => handleLanguageChange(lang.code)}
                      style={{
                        flex: 1,
                        height: 34,
                        borderRadius: 9,
                        borderCurve: "continuous",
                        backgroundColor: active ? colors.surface : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        ...(active ? shadow.xs : shadow.none),
                      }}
                    >
                      <Text
                        style={[
                          active ? typography.label.md : typography.body.sm,
                          { color: active ? colors.text : colors.textMuted },
                        ]}
                      >
                        {lang.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Dark Mode Toggle */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: spacing.lg,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    borderCurve: "continuous",
                    backgroundColor: scheme === "dark" ? colors.primary : colors.warning,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {scheme === "dark" ? (
                    <Moon size={17} color={colors.onPrimary} strokeWidth={2.2} />
                  ) : (
                    <Sun size={17} color={colors.onWarning} strokeWidth={2.2} />
                  )}
                </View>
                <View>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("doctorProfile.darkMode")}
                  </Text>
                  <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                    {scheme === "dark"
                      ? t("doctorProfile.darkModeActive")
                      : t("doctorProfile.lightModeActive")}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={toggleTheme}
                style={({ pressed }) => ({
                  height: 34,
                  paddingHorizontal: 14,
                  justifyContent: "center",
                  borderRadius: 999,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={[typography.label.md, { color: colors.primary }]}>
                  {t("doctorProfile.toggle")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ─── Sign Out & Footer ─── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.xs,
            gap: spacing.md,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={confirmLogout}
            accessibilityRole="button"
            accessibilityLabel={t("doctorProfile.signOutA11y")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              height: 54,
              borderRadius: radius.button,
              borderCurve: "continuous",
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDarkUI ? colors.borderStrong : colors.separator,
              ...(isDarkUI ? {} : shadow.xs),
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <LogOut size={18} color={colors.danger} strokeWidth={2.2} />
            <Text style={[typography.title.sm, { color: colors.danger }]}>
              {t("profile.logout.confirm", { defaultValue: "Sign Out" })}
            </Text>
          </Pressable>

          <View style={{ alignItems: "center", gap: 3, marginTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <ShieldCheck size={13} color={colors.textSubtle} />
              <Text style={[typography.label.sm, { color: colors.textSubtle }]}>
                {t("doctorProfile.compliance")}
              </Text>
            </View>
            <Text
              style={[
                typography.caption,
                { color: colors.textSubtle, fontSize: 11, textAlign: "center" },
              ]}
            >
              {t("doctorProfile.versionFooter", { version: "2.4" })}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}