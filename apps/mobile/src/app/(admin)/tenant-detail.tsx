import React from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Building2, Building, UserRound } from "lucide-react-native";
import { Screen, Button } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminTenant } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  KV,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

export default function AdminTenantDetail() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading, isError, refetch, isRefetching } = useAdminTenant(
    type!,
    id!
  );
  const t = data?.tenant;
  const Icon = type === "hospital" ? Building2 : Building;

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
          subtitle={t?.address ?? t?.license ?? undefined}
          icon={Icon}
        >
          {t ? (
            <View style={{ marginTop: spacing.md }}>
              <StatusPill status={t.ownerStatus ?? "active"} />
            </View>
          ) : null}
        </AdminHero>
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        {isError ? <AdminError message="Couldn't load this tenant." /> : null}
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : t ? (
          <>
            <View>
              <AdminSection title="Facility" />
              <AdminCard>
                <KV label="License" value={t.license} />
                <KV label="Address" value={t.address} />
                <KV label="Phone" value={t.phone} />
                {t.shortCode ? (
                  <KV label="Short code" value={t.shortCode} mono />
                ) : null}
                <KV label="Rating" value={t.rating} />
                <KV
                  label="Registered"
                  value={
                    t.createdAt ? fmtDateTime(t.createdAt, locale as any) : null
                  }
                />
              </AdminCard>
            </View>

            <View>
              <AdminSection title="Owner account" />
              <AdminCard>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    marginBottom: spacing.xs,
                  }}
                >
                  <UserRound size={15} color={colors.primary} />
                  <Text
                    style={[typography.title.sm, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {t.ownerName ?? "Owner"}
                  </Text>
                </View>
                <KV label="Email" value={t.ownerEmail} />
                <KV
                  label="Last login"
                  value={
                    t.ownerLastLoginAt
                      ? fmtDateTime(t.ownerLastLoginAt, locale as any)
                      : "Never"
                  }
                />
                <View style={{ marginTop: spacing.sm }}>
                  <Button
                    title="View owner account"
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: "/(admin)/user-detail",
                        params: { id: t.ownerUserId },
                      } as any)
                    }
                  />
                </View>
              </AdminCard>
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
