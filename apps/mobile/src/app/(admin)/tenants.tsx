import React, { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Building2, Building, ChevronRight } from "lucide-react-native";
import { Screen, EmptyState } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminTenants, type AdminTenantRow } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  IconTile,
  FilterChips,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";

const TYPES = [
  { label: "Hospitals", value: "hospital" },
  { label: "Clinics", value: "clinic" },
];

export default function AdminTenantsScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const [type, setType] = useState<"hospital" | "clinic">("hospital");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminTenants(type);
  const items = data?.items ?? [];

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
          eyebrow="Directory"
          title="Tenants"
          subtitle={`${data?.total ?? 0} ${type === "hospital" ? "hospitals" : "clinics"} registered`}
          icon={type === "hospital" ? Building2 : Building}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <FilterChips
          options={TYPES}
          value={type}
          onChange={(v) => setType(v as any)}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          marginTop: spacing.sm,
          paddingBottom: spacing.xxl,
        }}
      >
        {isError ? <AdminError message="Couldn't load tenants." /> : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={type === "hospital" ? Building2 : Building}
            title={`No ${type === "hospital" ? "hospitals" : "clinics"}`}
            message="Registered facilities will appear here."
          />
        ) : (
          items.map((t) => (
            <TenantCard
              key={t.id}
              t={t}
              type={type}
              onPress={() =>
                router.push({
                  pathname: "/(admin)/tenant-detail",
                  params: { type, id: t.id },
                } as any)
              }
            />
          ))
        )}
      </View>
    </Screen>
  );
}

function TenantCard({
  t,
  type,
  onPress,
}: {
  t: AdminTenantRow;
  type: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <AdminCard onPress={onPress}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
      >
        <IconTile
          icon={type === "hospital" ? Building2 : Building}
          tone="primary"
          size={44}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[typography.title.sm, { color: colors.text }]}
            numberOfLines={1}
          >
            {t.name}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {t.address ?? t.license ?? "—"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
            }}
          >
            <StatusPill status={t.ownerStatus ?? "active"} />
            <Text
              style={[typography.caption, { color: colors.textSubtle }]}
              numberOfLines={1}
            >
              {t.ownerName ?? ""}
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={colors.textSubtle} />
      </View>
    </AdminCard>
  );
}
