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
import { Screen, Skeleton } from "@/components/ui";
import { parseDob } from "@/lib/format";

const AVATAR_PALETTES = [
  { bg: "#EFF6FF", fg: "#2563EB", border: "#BFDBFE" }, // Sapphire
  { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0" }, // Emerald
  { bg: "#F5F3FF", fg: "#7C3AED", border: "#DDD6FE" }, // Violet
  { bg: "#FFF7ED", fg: "#EA580C", border: "#FED7AA" }, // Coral
  { bg: "#ECFEFF", fg: "#0891B2", border: "#A5F3FC" }, // Cyan
  { bg: "#FDF2F8", fg: "#DB2777", border: "#FBCFE8" }, // Rose
];

function getAvatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTES.length;
  }
  return AVATAR_PALETTES[hash];
}

function getInitials(name: string): string {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const ROLE_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  primary_care: { bg: "#ECFDF5", fg: "#059669", label: "Primary Care" },
  specialist: { bg: "#EFF6FF", fg: "#2563EB", label: "Specialist" },
  covering: { bg: "#FFFBEB", fg: "#D97706", label: "Covering" },
  on_call: { bg: "#F5F3FF", fg: "#7C3AED", label: "On Call" },
  family_view: { bg: "#FEF2F2", fg: "#EF4444", label: "Family Link" },
};

export default function DoctorCareTeamScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();

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
                borderRadius: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderSubtle ?? colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              })}
            >
              <ChevronLeft size={20} color={colors.text} strokeWidth={2.4} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.display.lg,
                  {
                    color: colors.text,
                    fontFamily: fontFamily.displayBold,
                    fontSize: 22,
                    lineHeight: 28,
                    letterSpacing: -0.4,
                  },
                ]}
              >
                {t("careTeam.doctorTitle", { defaultValue: "My Care Team" })}
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  color: colors.textMuted,
                  marginTop: 1,
                  fontFamily: fontFamily.body,
                }}
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
              borderRadius: 16,
              backgroundColor: colors.primarySoft,
              borderWidth: 1,
              borderColor: withOpacity(colors.primary, 0.2),
            }}
          >
            <ShieldCheck size={14} color={colors.primary} strokeWidth={2.4} />
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: "700",
                color: colors.primary,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              Verified
            </Text>
          </View>
        </View>

        {/* ── Search Bar ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.borderSubtle ?? colors.border,
            paddingHorizontal: 14,
            height: 46,
            marginTop: 14,
            gap: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.03,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <Search size={18} color={colors.primary} strokeWidth={2.2} />
          <RNTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search patient, phone, or NIC..."
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.text,
              fontFamily: fontFamily.body,
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
                backgroundColor: colors.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={13} color={colors.textMuted} strokeWidth={2.2} />
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
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              backgroundColor: roleFilter === "all" ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: roleFilter === "all" ? colors.primary : colors.borderSubtle ?? colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: roleFilter === "all" ? "700" : "600",
                color: roleFilter === "all" ? "#FFFFFF" : colors.textMuted,
                fontFamily: roleFilter === "all" ? fontFamily.bodyBold : fontFamily.body,
              }}
            >
              All Patients
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 10,
                backgroundColor:
                  roleFilter === "all" ? "rgba(255,255,255,0.25)" : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "800",
                  color: roleFilter === "all" ? "#FFFFFF" : colors.textMuted,
                }}
              >
                {patients.length}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setRoleFilter("primary_care")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              backgroundColor: roleFilter === "primary_care" ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor:
                roleFilter === "primary_care" ? colors.primary : colors.borderSubtle ?? colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: roleFilter === "primary_care" ? "700" : "600",
                color: roleFilter === "primary_care" ? "#FFFFFF" : colors.textMuted,
                fontFamily: roleFilter === "primary_care" ? fontFamily.bodyBold : fontFamily.body,
              }}
            >
              Primary Care
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 10,
                backgroundColor:
                  roleFilter === "primary_care" ? "rgba(255,255,255,0.25)" : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "800",
                  color: roleFilter === "primary_care" ? "#FFFFFF" : colors.textMuted,
                }}
              >
                {primaryCount}
              </Text>
            </View>
          </Pressable>

          {specialistCount > 0 && (
            <Pressable
              onPress={() => setRoleFilter("specialist")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor: roleFilter === "specialist" ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor:
                  roleFilter === "specialist" ? colors.primary : colors.borderSubtle ?? colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: roleFilter === "specialist" ? "700" : "600",
                  color: roleFilter === "specialist" ? "#FFFFFF" : colors.textMuted,
                  fontFamily: roleFilter === "specialist" ? fontFamily.bodyBold : fontFamily.body,
                }}
              >
                Specialist
              </Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 10,
                  backgroundColor:
                    roleFilter === "specialist" ? "rgba(255,255,255,0.25)" : colors.surfaceMuted,
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "800",
                    color: roleFilter === "specialist" ? "#FFFFFF" : colors.textMuted,
                  }}
                >
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
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle ?? colors.border,
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
            const palette = getAvatarPalette(pName);
            const initials = getInitials(pName);
            const roleStyle = ROLE_STYLES[p.role] ?? {
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
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle ?? colors.border,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.03,
                  shadowRadius: 6,
                  elevation: 1.5,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.995 : 1 }],
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
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: palette.border,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        backgroundColor: palette.bg,
                        borderWidth: 1,
                        borderColor: palette.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "800",
                          color: palette.fg,
                          fontFamily: fontFamily.displayBold,
                        }}
                      >
                        {initials}
                      </Text>
                    </View>
                  )}

                  {/* Patient Info */}
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0, paddingRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: colors.text,
                          fontFamily: fontFamily.displayBold,
                          flexShrink: 1,
                        }}
                      >
                        {pName}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 13,
                        color: colors.textMuted,
                        marginTop: 2,
                        fontFamily: fontFamily.body,
                      }}
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
                    borderTopColor: colors.borderSubtle ?? colors.border,
                  }}
                >
                  {/* Role Badge */}
                  <View
                    style={{
                      backgroundColor: roleStyle.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: roleStyle.fg,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
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
                        backgroundColor: "#FEF3C7",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                      }}
                    >
                      <Clock size={11} color="#D97706" />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#D97706",
                        }}
                      >
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
                      backgroundColor: colors.surfaceMuted,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.borderSubtle ?? colors.border,
                    }}
                  >
                    <ShieldCheck size={11} color={colors.primary} />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: colors.textMuted,
                      }}
                    >
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
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: colors.borderSubtle ?? colors.border,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <PhoneCall size={11} color={colors.primary} />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: "600",
                          color: colors.text,
                          fontFamily: fontFamily.body,
                        }}
                      >
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
                      gap: 5,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: colors.primarySoft,
                      borderWidth: 1,
                      borderColor: withOpacity(colors.primary, 0.2),
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <FilePenLine size={13} color={colors.primary} strokeWidth={2.4} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.primary,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
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
                      gap: 5,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.borderSubtle ?? colors.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <UserRound size={13} color={colors.text} strokeWidth={2.2} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.text,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
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
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              marginTop: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <Search size={22} color={colors.textSubtle} strokeWidth={2} />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              No patients found
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 18,
                paddingHorizontal: 16,
              }}
            >
              No patient matching "{search}" in your care team. Check name, phone, or NIC.
            </Text>
            <Pressable
              onPress={() => setSearch("")}
              style={{
                marginTop: 6,
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 16,
                backgroundColor: colors.primarySoft,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
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
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.borderSubtle ?? colors.border,
              marginTop: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <Users size={24} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
            >
              {t("careTeam.doctorEmptyTitle", { defaultValue: "No patients yet" })}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 18,
                maxWidth: 260,
              }}
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