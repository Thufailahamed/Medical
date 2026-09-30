import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Building2,
  Building,
  ChevronRight,
  MapPin,
  UserRound,
  CheckCircle2,
  SearchX,
} from "lucide-react-native";
import { Screen, Avatar } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminTenants, type AdminTenantRow } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  AdminSection,
  AdminSegmented,
  AdminEmpty,
  IconTile,
  SearchBar,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";

type TenantType = "hospital" | "clinic";

const TYPES = [
  { label: "Hospitals", value: "hospital" },
  { label: "Clinics", value: "clinic" },
];

export default function AdminTenantsScreen() {
  const { spacing } = useTheme();
  const router = useRouter();
  const [type, setType] = useState<TenantType>("hospital");
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminTenants(type);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const activeCount = items.filter(
    (t) => (t.ownerStatus ?? "active") === "active"
  ).length;
  const noun = type === "hospital" ? "hospitals" : "clinics";
  const TypeIcon = type === "hospital" ? Building2 : Building;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) =>
      [t.name, t.address, t.license, t.ownerName, t.shortCode]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, query]);

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
          subtitle={`Registered ${noun} on the platform`}
          icon={TypeIcon}
          stats={[
            { icon: TypeIcon, value: total, label: "Registered" },
            { icon: CheckCircle2, value: activeCount, label: "Active" },
          ]}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
          gap: spacing.md,
        }}
      >
        <AdminSegmented
          options={TYPES}
          value={type}
          onChange={(v) => {
            setType(v as TenantType);
            setQuery("");
          }}
        />
        {items.length > 3 || query ? (
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${noun}, owners, addresses`}
          />
        ) : null}
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginTop: spacing.xl,
          paddingBottom: spacing.xxl,
        }}
      >
        <AdminSection
          title={type === "hospital" ? "All hospitals" : "All clinics"}
          count={query ? `${filtered.length}/${total}` : total}
        />
        <View style={{ gap: spacing.md }}>
          {isError ? (
            <AdminError message="Couldn't load tenants." onRetry={refetch} title="Load failed" retrying={isRefetching} />
          ) : isLoading ? (
            <ListSkeleton rows={4} />
          ) : items.length === 0 ? (
            <AdminEmpty
              icon={TypeIcon}
              title={`No ${noun} yet`}
              message="Registered facilities will appear here once onboarded."
            />
          ) : filtered.length === 0 ? (
            <AdminEmpty
              icon={SearchX}
              title="No matches"
              message={`Nothing matches “${query.trim()}”.`}
              actionLabel="Clear search"
              onAction={() => setQuery("")}
            />
          ) : (
            filtered.map((t) => (
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
  type: TenantType;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const location = t.address ?? t.license;
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
        <IconTile
          icon={type === "hospital" ? Building2 : Building}
          tone="primary"
          size={46}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            style={[typography.title.sm, { color: colors.text }]}
            numberOfLines={1}
          >
            {t.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MapPin size={13} color={colors.textSubtle} strokeWidth={2.2} />
            <Text
              style={[typography.caption, { color: colors.textMuted, flex: 1 }]}
              numberOfLines={1}
            >
              {location ?? "No address on file"}
            </Text>
          </View>
        </View>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.well,
          }}
        >
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.4} />
        </View>
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
        {t.ownerName ? (
          <Avatar name={t.ownerName} size={24} />
        ) : (
          <UserRound size={16} color={colors.textSubtle} />
        )}
        <Text
          style={[typography.label.sm, { color: colors.textMuted, flex: 1 }]}
          numberOfLines={1}
        >
          {t.ownerName ?? "No owner assigned"}
        </Text>
        <StatusPill status={t.ownerStatus ?? "active"} />
      </View>
    </AdminCard>
  );
}
