// @ts-nocheck
// Phase MTN-1 mobile: "My Hospitals + My Clinics" landing for doctors.
// Pulls from GET /me/tenants (same store that powers the top-bar
// switcher). Each row is tappable → tenants/[id] detail.

import { useState, useCallback, type ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Building2,
  Stethoscope,
  Plus,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Divider,
  ListItem,
  Skeleton,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import {
  useActiveTenantStore,
  type TenantRef,
} from "@/stores/tenant-store";

type TenantKind = "hospital" | "clinic";

export default function DoctorTenants() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const myHospitals = useActiveTenantStore((s) => s.myHospitals);
  const myClinics = useActiveTenantStore((s) => s.myClinics);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load(refresh = false) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await api<{
        hospitals: TenantRef[];
        clinics: TenantRef[];
      }>("/me/tenants");
      useActiveTenantStore
        .getState()
        .setMemberships(
          res.hospitals || [],
          res.clinics || [],
          null,
          null
        );
    } catch {
      // ignore — fallback to store
    } finally {
      setLoaded(true);
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  function go(kind: TenantKind, id: string) {
    // Set active tenant so the destination's data loads scoped.
    if (kind === "hospital") {
      useActiveTenantStore.getState().setActiveHospital(id);
    } else {
      useActiveTenantStore.getState().setActiveClinic(id);
    }
    router.push(`/(doctor)/tenants/${id}`);
  }

  const initialLoading = loading && !loaded;

  return (
    <Screen
      padded={false}
      edges={["top"]}
      bottomInset
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Workspaces"
        subtitle="Hospitals and clinics"
        style={{ backgroundColor: "transparent" }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <WorkspaceStat
            icon={Building2}
            label="Hospitals"
            value={myHospitals.length}
          />
          <WorkspaceStat
            icon={Stethoscope}
            label="Clinics"
            value={myClinics.length}
          />
        </View>

        <TenantSection
          icon={Building2}
          title="My Hospitals"
          description="Shared workspaces managed by hospital teams."
        >
          {initialLoading ? (
            <TenantSkeleton />
          ) : myHospitals.length === 0 ? (
            <TenantEmptyState
              icon={Building2}
              title="No hospitals yet"
              message="Ask an admin to add you, or join via an invite link."
            />
          ) : (
            myHospitals.map((h: TenantRef, idx: number) => (
              <View key={`h-${h.id}`}>
                {idx > 0 ? <Divider inset={72} /> : null}
                <ListItem
                  bordered={false}
                  icon={Building2}
                  iconTone="primary"
                  title={h.name}
                  pill={h.role ? { label: h.role, tone: "primary" } : undefined}
                  onPress={() => go("hospital", h.id)}
                  showChevron
                />
              </View>
            ))
          )}
        </TenantSection>

        <TenantSection
          icon={Stethoscope}
          title="My Clinics"
          description="Your independent practices and teams."
          action={
            <Pressable
              onPress={() => router.push("/(doctor)/clinics/new")}
              accessibilityRole="button"
              accessibilityLabel="New clinic"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                minHeight: 34,
                paddingHorizontal: spacing.md,
                borderRadius: 17,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.fillStrong : colors.primarySoft,
              })}
            >
              <Plus size={15} color={colors.primary} strokeWidth={2.5} />
              <Text
                style={[
                  typography.label.md,
                  { color: colors.primary, fontWeight: "700" },
                ]}
              >
                New
              </Text>
            </Pressable>
          }
        >
          {initialLoading ? (
            <TenantSkeleton />
          ) : myClinics.length === 0 ? (
            <TenantEmptyState
              icon={Stethoscope}
              title="No clinics yet"
              message="Create your own clinic to invite partners and patients."
              action={
                <Pressable
                  onPress={() => router.push("/(doctor)/clinics/new")}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    marginTop: spacing.sm,
                    minHeight: 38,
                    paddingHorizontal: spacing.lg,
                    borderRadius: 19,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed ? colors.fillStrong : colors.primarySoft,
                  })}
                >
                  <Text
                    style={[
                      typography.label.md,
                      { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    Create clinic
                  </Text>
                </Pressable>
              }
            />
          ) : (
            myClinics.map((c: TenantRef, idx: number) => (
              <View key={`c-${c.id}`}>
                {idx > 0 ? <Divider inset={72} /> : null}
                <ListItem
                  bordered={false}
                  icon={Stethoscope}
                  iconTone="primary"
                  title={c.name}
                  pill={c.role ? { label: c.role, tone: "primary" } : undefined}
                  onPress={() => go("clinic", c.id)}
                  showChevron
                />
              </View>
            ))
          )}
        </TenantSection>
      </ScrollView>
    </Screen>
  );
}

function WorkspaceStat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card padded={false} style={{ flex: 1 }}>
      <View
        style={{
          minHeight: 92,
          padding: spacing.md,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon size={18} color={colors.primary} strokeWidth={2.3} />
        </View>
        <View>
          <Text style={[typography.display.sm, { color: colors.text }]}>
            {value}
          </Text>
          <Text style={[typography.label.sm, { color: colors.textMuted }]}>
            {label}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function TenantSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: any;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card padded={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon size={18} color={colors.primary} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title.md, { color: colors.text }]}>
            {title}
          </Text>
          {description ? (
            <Text
              numberOfLines={1}
              style={[typography.body.xs, { color: colors.textMuted }]}
            >
              {description}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Card>
  );
}

function TenantEmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: any;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
      }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
          marginBottom: spacing.md,
        }}
      >
        <Icon size={27} color={colors.primary} strokeWidth={1.9} />
      </View>
      <Text style={[typography.title.sm, { color: colors.text }]}>{title}</Text>
      <Text
        style={[
          typography.body.sm,
          {
            color: colors.textMuted,
            textAlign: "center",
            marginTop: spacing.xs,
            maxWidth: 270,
          },
        ]}
      >
        {message}
      </Text>
      {action}
    </View>
  );
}

function TenantSkeleton() {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Skeleton height={58} radius={16} />
      <Skeleton height={58} radius={16} />
    </View>
  );
}
