import React from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Building2,
  Building,
  BadgeCheck,
  MapPin,
  Phone,
  Hash,
  Star,
  CalendarDays,
  Mail,
  Clock,
  ChevronRight,
  UserRound,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Screen, Avatar, Pressable } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminTenant } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  ListSkeleton,
  AdminError,
  StatusPill,
  relTime,
} from "@/components/admin/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

export default function AdminTenantDetail() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const router = useRouter();
  const { spacing } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading, isError, refetch, isRefetching } = useAdminTenant(
    type!,
    id!
  );
  const t = data?.tenant;
  const Icon = type === "hospital" ? Building2 : Building;
  const lastLogin = t?.ownerLastLoginAt
    ? relTime(t.ownerLastLoginAt) ||
      fmtDateTime(t.ownerLastLoginAt, locale as any)
    : "Never";

  return (
    <Screen
      scroll
      padded={false}
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow={type === "hospital" ? "Hospital" : "Clinic"}
          title={t?.name ?? "Tenant"}
          subtitle={t?.address ?? undefined}
          icon={Icon}
          stats={
            t
              ? [
                  {
                    icon: Star,
                    value: t.rating != null ? Number(t.rating).toFixed(1) : "—",
                    label: "Rating",
                  },
                  {
                    icon: CalendarDays,
                    value: t.createdAt
                      ? fmtDate(t.createdAt, locale as any)
                      : "—",
                    label: "Member since",
                  },
                ]
              : undefined
          }
        >
          {t ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginTop: spacing.md,
              }}
            >
              <StatusPill status={t.ownerStatus ?? "active"} />
              {t.shortCode ? <HeroTag label={t.shortCode} /> : null}
            </View>
          ) : null}
        </AdminHero>
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xxl,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        {isError ? (
          <AdminError
            title="Load failed"
            message="Couldn't load this tenant."
            onRetry={refetch}
            retrying={isRefetching}
          />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : t ? (
          <>
            {t.phone || t.ownerEmail ? (
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                {t.phone ? (
                  <ActionTile
                    icon={Phone}
                    label="Call facility"
                    onPress={() => Linking.openURL(`tel:${t.phone}`)}
                  />
                ) : null}
                {t.ownerEmail ? (
                  <ActionTile
                    icon={Mail}
                    label="Email owner"
                    onPress={() => Linking.openURL(`mailto:${t.ownerEmail}`)}
                  />
                ) : null}
              </View>
            ) : null}

            <View>
              <AdminSection title="Facility" />
              <AdminCard style={{ paddingVertical: spacing.xs }}>
                <InfoRow icon={BadgeCheck} label="License" value={t.license} mono />
                <InfoRow icon={MapPin} label="Address" value={t.address} />
                <InfoRow icon={Phone} label="Phone" value={t.phone} />
                {t.shortCode ? (
                  <InfoRow icon={Hash} label="Short code" value={t.shortCode} mono />
                ) : null}
                <InfoRow
                  icon={CalendarDays}
                  label="Registered"
                  value={
                    t.createdAt ? fmtDateTime(t.createdAt, locale as any) : null
                  }
                  last
                />
              </AdminCard>
            </View>

            <View>
              <AdminSection title="Owner account" />
              <OwnerCard
                name={t.ownerName}
                email={t.ownerEmail}
                status={t.ownerStatus}
                lastLogin={lastLogin}
                onPress={
                  t.ownerUserId
                    ? () =>
                        router.push({
                          pathname: "/(admin)/user-detail",
                          params: { id: t.ownerUserId },
                        } as any)
                    : undefined
                }
              />
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function HeroTag({ label }: { label: string }) {
  const { typography } = useTheme();
  return (
    <View
      style={{
        height: 24,
        paddingHorizontal: 10,
        borderRadius: 12,
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.16)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.3)",
      }}
    >
      <Text style={[typography.label.xs, { color: "#FFFFFF" }]}>{label}</Text>
    </View>
  );
}

function ActionTile({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          height: 52,
          paddingHorizontal: spacing.md,
          borderRadius: radius.card,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
        },
        scheme === "dark" ? null : shadow.xs,
      ]}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <Icon size={16} color={colors.primary} strokeWidth={2.3} />
      </View>
      <Text
        style={[typography.label.md, { color: colors.text, flex: 1 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number | null;
  mono?: boolean;
  last?: boolean;
}) {
  const { colors, spacing, typography, fontFamily } = useTheme();
  const empty = value === null || value === undefined || value === "";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.well,
        }}
      >
        <Icon size={16} color={colors.textMuted} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          {label}
        </Text>
        <Text
          style={[
            typography.body.md,
            {
              color: empty ? colors.textSubtle : colors.text,
              fontFamily: mono ? fontFamily.mono : fontFamily.bodySemibold,
              marginTop: 1,
            },
          ]}
          numberOfLines={2}
          selectable
        >
          {empty ? "Not provided" : String(value)}
        </Text>
      </View>
    </View>
  );
}

function OwnerCard({
  name,
  email,
  status,
  lastLogin,
  onPress,
}: {
  name?: string | null;
  email?: string | null;
  status?: string | null;
  lastLogin: string;
  onPress?: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <AdminCard onPress={onPress} style={{ padding: 0 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.lg,
        }}
      >
        {name ? (
          <Avatar name={name} size="lg" />
        ) : (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.well,
            }}
          >
            <UserRound size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            style={[typography.title.sm, { color: colors.text }]}
            numberOfLines={1}
          >
            {name ?? "No owner assigned"}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {email ?? "No email on file"}
          </Text>
        </View>
        <StatusPill status={status ?? "active"} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <Clock size={14} color={colors.textSubtle} strokeWidth={2.3} />
        <Text
          style={[typography.label.sm, { color: colors.textMuted, flex: 1 }]}
          numberOfLines={1}
        >
          Last login · {lastLogin}
        </Text>
        {onPress ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Text style={[typography.label.sm, { color: colors.primary }]}>
              View account
            </Text>
            <ChevronRight size={15} color={colors.primary} strokeWidth={2.5} />
          </View>
        ) : null}
      </View>
    </AdminCard>
  );
}
