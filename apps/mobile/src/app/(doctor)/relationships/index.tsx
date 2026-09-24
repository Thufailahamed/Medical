// @ts-nocheck
// Phase MTN-1 mobile: doctor's relationships list grouped by tenant.
// Pulls from GET /doctor-patient-relationships?doctorId=… and groups
// client-side by (contextType, contextId).

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Building2,
  Stethoscope,
  User,
  Users,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Divider,
  ListItem,
  Button,
  Skeleton,
  ErrorState,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import { useActiveTenantStore } from "@/stores/tenant-store";

type Rel = {
  id: string;
  doctorId: string;
  patientId: string;
  contextType: "hospital" | "clinic";
  contextId: string;
  relationshipKind: string;
  status: string;
};

export default function DoctorRelationships() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const [rels, setRels] = useState<Rel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Need doctor's doctorId (not userId) — fetch doctor profile.
  const [doctorId, setDoctorId] = useState<string | null>(null);

  async function load(refresh = false) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      let did = doctorId;
      if (!did) {
        const me = await api<{
          doctor?: { doctors?: { id?: string }; id?: string };
          doctorId?: string;
          id?: string;
        }>("/doctor/me");
        did =
          me?.doctor?.doctors?.id ||
          me?.doctor?.id ||
          me?.doctorId ||
          me?.id;
        setDoctorId(did || null);
      }
      if (!did) {
        setRels([]);
        return;
      }
      const rows = await api<Rel[]>(
        `/doctor-patient-relationships?doctorId=${did}`
      );
      setRels(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || "Could not load patient relationships.");
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

  const grouped = useMemo(() => {
    const map = new Map<string, Rel[]>();
    for (const r of rels) {
      const k = `${r.contextType}:${r.contextId}`;
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [rels]);

  const myHospitals = useActiveTenantStore((s) => s.myHospitals);
  const myClinics = useActiveTenantStore((s) => s.myClinics);

  function tenantLabel(t: "hospital" | "clinic", id: string) {
    const list = t === "hospital" ? myHospitals : myClinics;
    return list.find((x) => x.id === id)?.name || id.slice(0, 8);
  }

  const initialLoading = loading && !loaded;
  const uniquePatients = new Set(rels.map((r) => r.patientId)).size;

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
        title="Patient Relationships"
        subtitle="Care connections by workspace"
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
          <RelationshipStat
            icon={Users}
            label="Patients"
            value={uniquePatients}
          />
          <RelationshipStat
            icon={Building2}
            label="Workspaces"
            value={grouped.length}
          />
        </View>

        {initialLoading ? (
          <Card padded={false}>
            <RelationshipSkeleton />
          </Card>
        ) : error ? (
          <Card padded={false}>
            <ErrorState
              title="Couldn't load relationships"
              message={error}
              actionLabel="Try again"
              onAction={() => load()}
            />
          </Card>
        ) : rels.length === 0 ? (
          <Card padded={false}>
            <RelationshipsEmptyState
              action={
                <Button
                  title="Browse workspaces"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => router.push("/(doctor)/tenants" as any)}
                />
              }
            />
          </Card>
        ) : (
          grouped.map(([key, items]) => {
            const [type, id] = key.split(":") as ["hospital" | "clinic", string];
            const Icon = type === "hospital" ? Building2 : Stethoscope;
            return (
              <RelationshipGroup
                key={key}
                icon={Icon}
                title={tenantLabel(type, id)}
                subtitle={type === "hospital" ? "Hospital" : "Clinic"}
                count={items.length}
              >
                {items.map((r, idx) => (
                  <View key={r.id}>
                    {idx > 0 ? <Divider inset={72} /> : null}
                    <ListItem
                      bordered={false}
                      icon={User}
                      iconTone="primary"
                      title={`Patient ${r.patientId.slice(0, 8)}`}
                      subtitle={`${formatLabel(r.relationshipKind)} · ${formatLabel(r.status)}`}
                      onPress={() =>
                        router.push({
                          pathname: "/(doctor)/patient-detail",
                          params: { id: r.patientId },
                        } as any)
                      }
                      showChevron
                    />
                  </View>
                ))}
              </RelationshipGroup>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function RelationshipStat({
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

function RelationshipGroup({
  icon: Icon,
  title,
  subtitle,
  count,
  children,
}: {
  icon: any;
  title: string;
  subtitle: string;
  count: number;
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
            width: 38,
            height: 38,
            borderRadius: 12,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon size={19} color={colors.primary} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={[typography.title.md, { color: colors.text }]}
          >
            {title}
          </Text>
          <Text style={[typography.body.xs, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>
        <Pill label={String(count)} tone="primary" size="sm" />
      </View>
      {children}
    </Card>
  );
}

function RelationshipsEmptyState({ action }: { action?: ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xxl,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
          marginBottom: spacing.md,
        }}
      >
        <Users size={34} color={colors.primary} strokeWidth={1.9} />
      </View>
      <Text
        style={[
          typography.title.lg,
          { color: colors.text, textAlign: "center" },
        ]}
      >
        No active relationships
      </Text>
      <Text
        style={[
          typography.body.sm,
          {
            color: colors.textMuted,
            textAlign: "center",
            marginTop: spacing.xs,
            marginBottom: spacing.lg,
            maxWidth: 280,
          },
        ]}
      >
        Add a patient from a hospital or clinic to start one.
      </Text>
      {action}
    </View>
  );
}

function RelationshipSkeleton() {
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
      <Skeleton height={58} radius={16} />
    </View>
  );
}

function formatLabel(value?: string) {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
