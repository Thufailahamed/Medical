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
  const { colors, spacing, fontFamily } = useTheme();
  return (
    <View style={{ marginBottom: 2 }}>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 16,
          lineHeight: 22,
          fontWeight: "800",
          letterSpacing: -0.2,
          color: colors.text,
          fontFamily: fontFamily.displayBold,
          paddingHorizontal: 2,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: 12,
            color: colors.textMuted,
            fontFamily: fontFamily.body,
            paddingHorizontal: 2,
            marginTop: 1,
          }}
        >
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
  const { colors, fontFamily } = useTheme();
  const palette = useTone(tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: "30%",
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle ?? colors.border,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1.5,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 2,
        }}
      >
        <Icon size={18} color={palette.fg} strokeWidth={2.4} />
      </View>
      <Text
        style={{
          fontSize: 20,
          lineHeight: 24,
          fontWeight: "800",
          color: colors.text,
          fontFamily: fontFamily.displayBold,
          letterSpacing: -0.4,
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
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
  const { colors, spacing, typography, fontFamily } = useTheme();
  const open = () => {
    if (href && value) Linking.openURL(href).catch(() => {});
  };
  const isInteractive = Boolean(href && value);

  const inner = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 13,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderSubtle ?? colors.border,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={17} color={colors.textMuted} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            typography.caption,
            { color: colors.textSubtle, fontSize: 11.5, letterSpacing: 0.2 },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            typography.body.md,
            {
              color: colors.text,
              fontWeight: "600",
              marginTop: 1,
              fontFamily: fontFamily.bodyBold,
              fontSize: 14,
            },
          ]}
          numberOfLines={2}
        >
          {value || "—"}
        </Text>
      </View>
      {isInteractive ? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.4} />
        </View>
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
          backgroundColor: pressed ? colors.surfaceMuted : "transparent",
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
  const { colors, spacing, fontFamily } = useTheme();
  const palette = useTone(tone);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderSubtle ?? colors.border,
      })}
    >
      <View
        style={{
          paddingVertical: 13,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={palette.fg} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14.5,
              fontWeight: "700",
              color: colors.text,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: colors.textMuted, fontFamily: fontFamily.body }}
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
              backgroundColor: colors.danger,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>
              {badge}
            </Text>
          </View>
        ) : null}
        <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

export default function DoctorProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { spacing, colors, typography, fontFamily } = useTheme();
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
  const displayName = rawName || "Physician";
  const heroName = /^doctor$/i.test(displayName)
    ? "Dr. Practitioner"
    : `Dr. ${displayName}`;

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
          value: `${doctor.yearsOfExperience} Years Clinical Practice`,
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
          value: `LKR ${Number(doctor.consultationFee).toLocaleString()}`,
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
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserCheck size={18} color={colors.primary} strokeWidth={2.4} />
            </View>
            <View>
              <Text
                style={[
                  typography.display.sm,
                  {
                    color: colors.text,
                    fontWeight: "800",
                    fontFamily: fontFamily.displayBold,
                    fontSize: 24,
                    lineHeight: 28,
                  },
                ]}
              >
                {t("doctorProfile.title", { defaultValue: "Doctor Profile" })}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                }}
              >
                Clinical credentials & practice settings
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
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
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
            borderRadius: 26,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            elevation: 8,
            shadowColor: "#001B3F",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
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
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.15)",
              }}
            >
              {doctor.licenseNumber ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: "rgba(255,255,255,0.14)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
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
                    SLMC: #{doctor.licenseNumber}
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: "rgba(16,185,129,0.2)",
                  borderWidth: 1,
                  borderColor: "rgba(16,185,129,0.4)",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 20,
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
                    color: "#A7F3D0",
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  Active Practice
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Clinical Activity Grid (Interactive Shortcuts) ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SectionHeader
            title={t("doctorProfile.sections.activity", { defaultValue: "Clinical Activity" })}
            subtitle="Real-time queue and practice metrics"
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
            subtitle="Hospital affiliations and consultation rates"
          />

          <View
            style={{
              borderRadius: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.03,
              shadowRadius: 8,
              elevation: 2,
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
                value="General Practitioner"
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
                backgroundColor: withOpacity(colors.primary, 0.04),
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.borderSubtle ?? colors.border,
              }}
            >
              <ShieldCheck size={16} color={colors.primary} strokeWidth={2.2} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 16,
                  fontFamily: fontFamily.body,
                }}
              >
                SLMC verified practitioner. Qualifications and credentials are authenticated with medical council records.
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Contact Information Card ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SectionHeader
            title={t("doctorProfile.sections.contact", { defaultValue: "Contact Information" })}
            subtitle="Direct communication channels"
          />

          <View
            style={{
              borderRadius: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.03,
              shadowRadius: 8,
              elevation: 2,
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
            subtitle="Schedules, clinics, and patient tools"
          />

          <View
            style={{
              borderRadius: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.03,
              shadowRadius: 8,
              elevation: 2,
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
              title="Workspaces & Clinics"
              subtitle="Manage hospital affiliations and multi-clinic care"
              tone="info"
              onPress={() => router.push("/tenants" as any)}
            />
            <NavigationLinkRow
              icon={Layers}
              title="Prescription Templates"
              subtitle="Reusable medication sets and dosages"
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
              title="Earnings & Payouts"
              subtitle="View consultation revenue and payouts"
              tone="success"
              last
              onPress={() => router.push("/(doctor)/earnings" as any)}
            />
          </View>
        </View>

        {/* ─── App Preferences (Language & Theme) ─── */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SectionHeader
            title="App Preferences"
            subtitle="Language and visual appearance"
          />

          <View
            style={{
              borderRadius: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              padding: 16,
              gap: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.03,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {/* Language Selector */}
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Languages size={17} color={colors.primary} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, fontFamily: fontFamily.bodyBold }}>
                  Language / භාෂාව / மொழி
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  borderRadius: 14,
                  backgroundColor: colors.surfaceMuted,
                  padding: 4,
                  gap: 4,
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
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: active ? colors.surface : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: active ? "#000" : "transparent",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: active ? 0.08 : 0,
                        shadowRadius: 3,
                        elevation: active ? 1 : 0,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: active ? "800" : "600",
                          color: active ? colors.primary : colors.textMuted,
                          fontFamily: active ? fontFamily.bodyBold : fontFamily.body,
                        }}
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
                paddingTop: 12,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.borderSubtle ?? colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {scheme === "dark" ? (
                  <Moon size={17} color={colors.primary} strokeWidth={2.2} />
                ) : (
                  <Sun size={17} color={colors.warning} strokeWidth={2.2} />
                )}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, fontFamily: fontFamily.bodyBold }}>
                    Dark Mode
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {scheme === "dark" ? "Dark appearance active" : "Light appearance active"}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={toggleTheme}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle ?? colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                  Toggle
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
            accessibilityLabel="Sign out of doctor portal"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              paddingVertical: 14,
              borderRadius: 20,
              backgroundColor: withOpacity(colors.danger || "#EF4444", 0.08),
              borderWidth: 1,
              borderColor: withOpacity(colors.danger || "#EF4444", 0.25),
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <LogOut size={18} color={colors.danger || "#EF4444"} strokeWidth={2.2} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: colors.danger || "#EF4444",
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {t("profile.logout.confirm", { defaultValue: "Sign Out" })}
            </Text>
          </Pressable>

          <View style={{ alignItems: "center", gap: 3, marginTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <ShieldCheck size={13} color={colors.textSubtle} />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: "600",
                  color: colors.textSubtle,
                  letterSpacing: 0.2,
                }}
              >
                HIPAA & Sri Lanka Medical Council Compliant
              </Text>
            </View>
            <Text
              style={[
                typography.caption,
                { color: colors.textSubtle, fontSize: 11, textAlign: "center" },
              ]}
            >
              Healthcare Suite v2.4 • Practitioner Edition
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}