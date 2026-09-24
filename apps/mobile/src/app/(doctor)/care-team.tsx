// @ts-nocheck
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput as RNTextInput,
  RefreshControl,
  StyleSheet,
  Image,
  Linking,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  PhoneCall,
  ShieldCheck,
  FilePenLine,
  UserRound,
  Sparkles,
  CalendarClock,
  Clock,
} from "lucide-react-native";
import { useDoctorCareTeamPatients } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import { tonePalette, type Tone } from "@/theme/tone";
import { Screen, Skeleton } from "@/components/ui";
import { parseDob } from "@/lib/format";

// Avatar tints are derived from theme tones so they adapt to dark mode.
const AVATAR_TONES: Tone[] = ["primary", "accent", "info", "accent2", "success", "warning"];

function getAvatarPalette(name: string, colors: any) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_TONES.length;
  }
  const tp = tonePalette(AVATAR_TONES[hash], colors);
  return { bg: tp.bg, fg: tp.fg, border: "transparent" };
}

function getInitials(name: string): string {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const ROLE_STYLES: Record<string, { tone: Tone; label: string }> = {
  primary_care: { tone: "accent", label: "Primary Care" },
  specialist: { tone: "primary", label: "Specialist" },
  covering: { tone: "warning", label: "Covering" },
  on_call: { tone: "info", label: "On Call" },
  family_view: { tone: "danger", label: "Family Link" },
};

export default function DoctorCareTeamScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  const hairline = isDark ? colors.borderStrong : colors.separator;
  const chipStyle = (active: boolean) => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderCurve: "continuous" as const,
    backgroundColor: active ? colors.primarySoft : colors.fill,
  });
  const chipText = (active: boolean) => [
    active ? typography.label.md : typography.body.sm,
    { color: active ? colors.primary : colors.textMuted },
  ];
  const chipCount = (active: boolean) => ({
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderCurve: "continuous" as const,
    backgroundColor: active ? colors.primary : colors.fillStrong,
  });
  const chipCountText = (active: boolean) => [
    typography.label.xs,
    { fontSize: 10.5, color: active ? colors.onPrimary : colors.textMuted },
  ];

  const { data, isLoading, refetch, isRefetching } = useDoctorCareTeamPatients();
  const patients: any[] = data?.patients ?? [];

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const primaryCount = useMemo(
    () => patients.filter((p) => p.role === "primary_care").length,
    [patients]
  );
  const specialistCount = useMemo(
    () => patients.filter((p) => p.role === "specialist").length,
    [patients]
  );

  const filteredPatients = useMemo(() => {
    let list = patients;

    if (roleFilter !== "all") {
      list = list.filter((p) => p.role === roleFilter);
    }

    if (search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => {
        const name = (p.patientName || "").toLowerCase();
        const phone = (p.patientPhone || "").toLowerCase();
        const nic = (p.patientNic || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || nic.includes(q);
      });
    }

    return list;
  }, [patients, roleFilter, search]);

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* ── Top Header ── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: colors.bg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.fillStrong : colors.fill,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <ChevronLeft size={20} color={colors.text} strokeWidth={2.4} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[typography.display.sm, { color: colors.text }]}>
                {t("careTeam.doctorTitle", { defaultValue: "My Care Team" })}
              </Text>
              <Text
                numberOfLines={1}
                style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}
              >
                {t("careTeam.doctorSubtitle", {
                  count: patients.length,
                  defaultValue: `${patients.length} patients granted you clinical access`,
                })}
              </Text>
            </View>
          </View>

          {/* Quick Access Badge */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: colors.primarySoft,
            }}
          >
            <ShieldCheck size={14} color={colors.primary} strokeWidth={2.4} />
            <Text style={[typography.label.sm, { color: colors.primary }]}>
              Verified
            </Text>
          </View>
        </View>

        {/* ── Search Bar ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.fill,
            borderRadius: 12,
            borderCurve: "continuous",
            paddingHorizontal: 12,
            height: 40,
            marginTop: spacing.lg,
            gap: 8,
          }}
        >
          <Search size={16} color={colors.textSubtle} strokeWidth={2.2} />
          <RNTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search patient, phone, or NIC..."
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            style={{
              flex: 1,
              ...typography.body.md,
              color: colors.text,
              paddingVertical: 0,
            }}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={8}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderCurve: "continuous",
                backgroundColor: colors.fillStrong,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={12} color={colors.textMuted} strokeWidth={2.6} />
            </Pressable>
          )}
        </View>

        {/* ── Filter Segment Chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingTop: 12,
            paddingBottom: 2,
          }}
        >
          <Pressable
            onPress={() => setRoleFilter("all")}
            style={chipStyle(roleFilter === "all")}
          >
            <Text style={chipText(roleFilter === "all")}>
              All Patients
            </Text>
            <View style={chipCount(roleFilter === "all")}>
              <Text style={chipCountText(roleFilter === "all")}>
                {patients.length}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setRoleFilter("primary_care")}
            style={chipStyle(roleFilter === "primary_care")}
          >
            <Text style={chipText(roleFilter === "primary_care")}>
              Primary Care
            </Text>
            <View style={chipCount(roleFilter === "primary_care")}>
              <Text style={chipCountText(roleFilter === "primary_care")}>
                {primaryCount}
              </Text>
            </View>
          </Pressable>

          {specialistCount > 0 && (
            <Pressable
              onPress={() => setRoleFilter("specialist")}
              style={chipStyle(roleFilter === "specialist")}
            >
              <Text style={chipText(roleFilter === "specialist")}>
                Specialist
              </Text>
              <View style={chipCount(roleFilter === "specialist")}>
                <Text style={chipCountText(roleFilter === "specialist")}>
                  {specialistCount}
                </Text>
              </View>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* ── Content List ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 140, // Clearance for bottom navigation
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={{ gap: 12, paddingTop: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View
                key={i}
                style={{
                  padding: 16,
                  borderRadius: radius.card,
                  borderCurve: "continuous",
                  backgroundColor: colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: hairline,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Skeleton width={48} height={48} radius={16} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="50%" height={16} radius={4} />
                    <Skeleton width="35%" height={12} radius={4} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Skeleton width={90} height={26} radius={10} />
                  <Skeleton width={80} height={26} radius={10} />
                </View>
              </View>
            ))}
          </View>
        ) : filteredPatients.length > 0 ? (
          filteredPatients.map((p) => {
            const dob = parseDob(p.patientDob);
            const age = dob
              ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : null;
            const pName = p.patientName || "Patient";
            const palette = getAvatarPalette(pName, colors);
            const initials = getInitials(pName);
            const roleDef = ROLE_STYLES[p.role];
            const roleTp = roleDef ? tonePalette(roleDef.tone, colors) : null;
            const roleStyle = roleDef
              ? { bg: roleTp.bg, fg: roleTp.fg, label: roleDef.label }
              : {
                  bg: colors.surfaceMuted,
                  fg: colors.text,
                  label: p.role?.replace("_", " ") || "Care Team",
                };

            return (
              <Pressable
                key={p.careTeamId}
                onPress={() =>
                  router.push({
                    pathname: "/(doctor)/patient-detail",
                    params: { id: p.patientId },
                  })
                }
                style={({ pressed }) => ({
                  backgroundColor: colors.surface,
                  borderRadius: radius.card,
                  borderCurve: "continuous",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: hairline,
                  padding: 16,
                  ...(isDark ? {} : shadow.sm),
                  opacity: pressed ? 0.94 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                {/* Patient Header: Avatar, Name, Demographics, Chevron */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {/* Dynamic Squircle Avatar with Photo fallback */}
                  {p.patientPhoto ? (
                    <Image
                      source={{ uri: p.patientPhoto }}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderCurve: "continuous",
                        backgroundColor: colors.surfaceMuted,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderCurve: "continuous",
                        backgroundColor: palette.bg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={[typography.title.sm, { color: palette.fg }]}>
                        {initials}
                      </Text>
                    </View>
                  )}

                  {/* Patient Info */}
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0, paddingRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text
                        numberOfLines={1}
                        style={[typography.title.md, { color: colors.text, flexShrink: 1 }]}
                      >
                        {pName}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={1}
                      style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}
                    >
                      {[
                        age != null ? `${age}y` : null,
                        p.patientGender
                          ? p.patientGender.charAt(0).toUpperCase() + p.patientGender.slice(1)
                          : null,
                        p.patientNic ? `NIC: ${p.patientNic}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Demographics on file"}
                    </Text>
                  </View>

                  <ChevronRight size={18} color={colors.textSubtle} strokeWidth={2.2} />
                </View>

                {/* Metadata & Tag Badges */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                  }}
                >
                  {/* Role Badge */}
                  <View
                    style={{
                      backgroundColor: roleStyle.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      borderCurve: "continuous",
                    }}
                  >
                    <Text style={[typography.label.xs, { color: roleStyle.fg }]}>
                      {roleStyle.label}
                    </Text>
                  </View>

                  {/* Status if pending */}
                  {p.status === "pending" && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: colors.warningSoft,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                      }}
                    >
                      <Clock size={11} color={colors.warning} />
                      <Text style={[typography.label.xs, { color: colors.warning }]}>
                        Pending Invite
                      </Text>
                    </View>
                  )}

                  {/* Scope Badge */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: colors.fill,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      borderCurve: "continuous",
                    }}
                  >
                    <ShieldCheck size={11} color={colors.textMuted} />
                    <Text style={[typography.label.xs, { color: colors.textMuted }]}>
                      {p.scope === "full" ? "Full Access" : p.scope || "Consented"}
                    </Text>
                  </View>

                  {/* Phone Quick Call */}
                  {p.patientPhone && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        Linking.openURL(`tel:${p.patientPhone}`);
                      }}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginLeft: "auto",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        borderCurve: "continuous",
                        backgroundColor: colors.primarySoft,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <PhoneCall size={11} color={colors.primary} />
                      <Text style={[typography.label.xs, { color: colors.primary, fontVariant: ["tabular-nums"] }]}>
                        {p.patientPhone}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Quick Action Pathways */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/(doctor)/prescription",
                        params: { patientId: p.patientId },
                      } as any)
                    }
                    hitSlop={6}
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      height: 36,
                      borderRadius: 999,
                      borderCurve: "continuous",
                      backgroundColor: colors.primarySoft,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <FilePenLine size={14} color={colors.primary} strokeWidth={2.4} />
                    <Text style={[typography.label.md, { color: colors.primary }]}>
                      Write Prescription
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/(doctor)/patient-detail",
                        params: { id: p.patientId },
                      })
                    }
                    hitSlop={6}
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      height: 36,
                      borderRadius: 999,
                      borderCurve: "continuous",
                      backgroundColor: colors.fill,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <UserRound size={14} color={colors.text} strokeWidth={2.2} />
                    <Text style={[typography.label.md, { color: colors.text }]}>
                      View Patient Chart
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        ) : search.length > 0 ? (
          <View
            style={{
              paddingVertical: 44,
              paddingHorizontal: spacing.lg,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderCurve: "continuous",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: hairline,
              marginTop: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor: colors.fill,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <Search size={22} color={colors.textSubtle} strokeWidth={2} />
            </View>
            <Text style={[typography.title.md, { color: colors.text }]}>
              No patients found
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, textAlign: "center", paddingHorizontal: 16 },
              ]}
            >
              No patient matching "{search}" in your care team. Check name, phone, or NIC.
            </Text>
            <Pressable
              onPress={() => setSearch("")}
              style={{
                marginTop: 6,
                paddingHorizontal: 16,
                height: 36,
                justifyContent: "center",
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
              }}
            >
              <Text style={[typography.label.md, { color: colors.primary }]}>
                Clear Search
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              paddingVertical: 44,
              paddingHorizontal: spacing.lg,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderCurve: "continuous",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: hairline,
              marginTop: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <Users size={24} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={[typography.title.md, { color: colors.text }]}>
              {t("careTeam.doctorEmptyTitle", { defaultValue: "No patients yet" })}
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, textAlign: "center", maxWidth: 260 },
              ]}
            >
              {t("careTeam.doctorEmptyBody", {
                defaultValue: "Patients appear here when they grant you clinical access.",
              })}
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}