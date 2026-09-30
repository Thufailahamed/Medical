// @ts-nocheck
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Image,
  Linking,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  Users,
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
import { Screen, ScreenHeader, SearchField, Skeleton } from "@/components/ui";
import { parseDob } from "@/lib/format";

// Avatar tints are derived from theme tones so they adapt to dark mode.
const AVATAR_TONES: Tone[] = ["primary", "accent", "info", "accent2", "success", "warning"];

function getAvatarPalette(name: string, colors: any) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const tp = tonePalette(AVATAR_TONES[hash % AVATAR_TONES.length], colors);
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
  const hairline = isDark ? colors.borderStrong : colors.hairline;
  const chipStyle = (active: boolean) => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderCurve: "continuous" as const,
    backgroundColor: active ? colors.primary : colors.surface,
    borderWidth: active ? 0 : StyleSheet.hairlineWidth,
    borderColor: hairline,
    ...(isDark || active ? {} : shadow.xs),
  });
  const chipText = (active: boolean) => [
    typography.label.md,
    { color: active ? colors.onPrimary : colors.text },
  ];
  const chipCount = (active: boolean) => ({
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderCurve: "continuous" as const,
    alignItems: "center" as const,
    backgroundColor: active ? "rgba(255,255,255,0.24)" : colors.fill,
  });
  const chipCountText = (active: boolean) => [
    typography.label.xs,
    { color: active ? colors.onPrimary : colors.textMuted },
  ];

  const { data, isLoading, refetch, isRefetching } = useDoctorCareTeamPatients();
  const patients: any[] = data?.patients ?? [];

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const roleChips = useMemo(() => {
    const counts: Record<string, number> = {};
    patients.forEach((p) => {
      if (p.role) counts[p.role] = (counts[p.role] ?? 0) + 1;
    });
    return [
      { key: "all", label: t("careTeam.allPatients"), count: patients.length },
      ...Object.keys(counts).map((role) => ({
        key: role,
        label: t(`careTeam.role.${role}`, {
          defaultValue: ROLE_STYLES[role]?.label ?? role.replace("_", " "),
        }),
        count: counts[role],
      })),
    ];
  }, [patients, t]);
  // A role tag on every row is noise when everyone shares the same role.
  const mixedRoles = roleChips.length > 2;

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
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("careTeam.doctorTitle", { defaultValue: "My care team" })}
        subtitle={t("careTeam.doctorSubtitle", {
          count: patients.length,
          defaultValue: `${patients.length} patients granted you clinical access`,
        })}
        right={
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              height: 30,
              borderRadius: 15,
              borderCurve: "continuous",
              backgroundColor: colors.successSoft,
            }}
          >
            <ShieldCheck size={13} color={colors.success} strokeWidth={2.4} />
            <Text style={[typography.label.sm, { color: colors.success }]}>
              {t("careTeam.verified")}
            </Text>
          </View>
        }
      />
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t("careTeam.doctorSearchPlaceholder")}
        />

        {/* ── Filter Segment Chips — only when patients span several roles ── */}
        {roleChips.length > 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingTop: 12,
            paddingBottom: 12,
            paddingHorizontal: spacing.lg,
          }}
          style={{ marginHorizontal: -spacing.lg }}
        >
          {roleChips.map((r) => {
            const active = roleFilter === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRoleFilter(r.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={chipStyle(active)}
              >
                <Text style={chipText(active)}>{r.label}</Text>
                <View style={chipCount(active)}>
                  <Text style={chipCountText(active)}>{r.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        ) : (
          <View style={{ height: spacing.md }} />
        )}
      </View>

      {/* ── Content List ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: 2,
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
          <>
            <Text style={[typography.caption, { color: colors.textSubtle, paddingHorizontal: 4 }]}>
              {t("careTeam.resultCount", {
                count: filteredPatients.length,
                defaultValue: `${filteredPatients.length} patients`,
              })}
            </Text>
            <View
              style={{
                borderRadius: radius.card,
                borderCurve: "continuous",
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: hairline,
                overflow: "hidden",
                ...(isDark ? {} : shadow.card),
              }}
            >
              {filteredPatients.map((p, idx) => {
                const dob = parseDob(p.patientDob);
                const age = dob
                  ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                  : null;
                const pName = p.patientName || t("careTeam.patientFallback");
                const palette = getAvatarPalette(pName, colors);
                const initials = getInitials(pName);
                const roleDef = ROLE_STYLES[p.role];
                const roleTp = tonePalette(roleDef?.tone ?? "neutral", colors);
                const roleLabel = t(`careTeam.role.${p.role}`, {
                  defaultValue: roleDef?.label ?? (p.role?.replace("_", " ") || t("careTeam.fallback")),
                });
                const pending = p.status === "pending";
                const limited = p.scope && p.scope !== "full";
                const demographics = [
                  age != null ? `${age}y` : null,
                  p.patientGender
                    ? p.patientGender.charAt(0).toUpperCase() + p.patientGender.slice(1)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const openChart = () =>
                  router.push({
                    pathname: "/(doctor)/patient-detail",
                    params: { id: p.patientId },
                  });

                return (
                  <Pressable
                    key={p.careTeamId}
                    onPress={openChart}
                    accessibilityRole="button"
                    accessibilityLabel={`${pName}${demographics ? `, ${demographics}` : ""}. ${t("careTeam.viewPatientChart")}`}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingVertical: spacing.md,
                      paddingLeft: spacing.md,
                      paddingRight: spacing.sm + 2,
                      backgroundColor: pressed ? colors.fill : "transparent",
                    })}
                  >
                    {idx > 0 ? (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          left: spacing.md + 46 + spacing.md,
                          height: StyleSheet.hairlineWidth,
                          backgroundColor: colors.separator,
                        }}
                      />
                    ) : null}

                    {/* Avatar + pending dot */}
                    <View>
                      {p.patientPhoto ? (
                        <Image
                          source={{ uri: p.patientPhoto }}
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: 23,
                            backgroundColor: colors.surfaceMuted,
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: 23,
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
                      {pending ? (
                        <View
                          style={{
                            position: "absolute",
                            bottom: -1,
                            right: -1,
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.surface,
                          }}
                        >
                          <Clock size={12} color={colors.warning} strokeWidth={2.6} />
                        </View>
                      ) : null}
                    </View>

                    {/* Name, demographics, tags */}
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text
                        numberOfLines={1}
                        style={[typography.title.sm, { color: colors.text }]}
                      >
                        {pName}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text
                          numberOfLines={1}
                          style={[typography.caption, { color: colors.textMuted }]}
                        >
                          {demographics || t("careTeam.demographicsOnFile")}
                        </Text>
                        {mixedRoles ? (
                          <MiniTag label={roleLabel} bg={roleTp.bg} fg={roleTp.fg} />
                        ) : null}
                        {pending ? (
                          <MiniTag
                            label={t("careTeam.pendingInvite")}
                            bg={colors.warningSoft}
                            fg={colors.warning}
                          />
                        ) : null}
                        {limited ? (
                          <MiniTag
                            label={p.scope || t("careTeam.consented")}
                            bg={colors.fill}
                            fg={colors.textMuted}
                          />
                        ) : null}
                      </View>
                    </View>

                    {/* Quick actions */}
                    {p.patientPhone ? (
                      <RowAction
                        icon={PhoneCall}
                        label={`${t("careTeam.call", "Call")} ${p.patientPhone}`}
                        onPress={() => Linking.openURL(`tel:${p.patientPhone}`)}
                      />
                    ) : null}
                    <RowAction
                      icon={FilePenLine}
                      primary
                      label={t("careTeam.writePrescription")}
                      onPress={() =>
                        router.push({
                          pathname: "/(doctor)/prescription",
                          params: { patientId: p.patientId },
                        } as any)
                      }
                    />
                  </Pressable>
                );
              })}
            </View>
          </>
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
              {t("careTeam.noPatientsFound")}
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, textAlign: "center", paddingHorizontal: 16 },
              ]}
            >
              {t("careTeam.noPatientsFoundBody", { search })}
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
                {t("careTeam.clearSearch")}
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
function MiniTag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  const { typography } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 6,
        height: 18,
        justifyContent: "center",
        borderRadius: 6,
        borderCurve: "continuous",
        backgroundColor: bg,
      }}
    >
      <Text style={[typography.label.xs, { fontSize: 10, color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function RowAction({
  icon: Icon,
  label,
  onPress,
  primary,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary
          ? pressed ? withOpacity(colors.primary, 0.85) : colors.primary
          : pressed ? colors.fill : colors.well,
      })}
    >
      <Icon size={16} color={primary ? colors.onPrimary : colors.text} strokeWidth={2.3} />
    </Pressable>
  );
}
