// @ts-nocheck
// Phase MTN-1 mobile (patient view): tenant detail. Lists care team +
// upcoming appointments scoped to that tenant.

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Building2,
  Stethoscope,
  ChevronRight,
  UserPlus,
  Users,
  ShieldCheck,
  Calendar,
  FileText,
  CheckCircle2,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Pressable,
  Avatar,
  EmptyState,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import { useActiveTenantStore } from "@/stores/tenant-store";

type Member = {
  id: string;
  name?: string;
  role?: string;
  status?: string;
  doctorName?: string;
  relationshipKind?: string;
};

export default function PatientTenantDetail() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeHosp = useActiveTenantStore((s) => s.activeHospitalId);
  const isHospital = !!activeHosp;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Care-team GET already scopes by tenant header.
      const rows = await api<Member[]>("/care-team");
      setMembers(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load care team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const tenantObj = useActiveTenantStore((s) =>
    isHospital
      ? s.myHospitals.find((h) => h.id === id)
      : s.myClinics.find((c) => c.id === id)
  );

  const name = tenantObj?.name || (isHospital ? "Hospital" : "Clinic");

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={name}
        kicker={isHospital ? "HOSPITAL PROFILE" : "CLINIC PROFILE"}
        subtitle="Connected Healthcare Facility"
        back={true}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxxl,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        {/* Facility Hero Card */}
        <Card
          style={{
            padding: spacing.lg,
            marginBottom: spacing.xxl,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isHospital ? (
                <Building2 size={28} color={colors.primary} />
              ) : (
                <Stethoscope size={28} color={colors.primary} />
              )}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[
                  typography.title.lg,
                  { color: colors.text, marginBottom: 6 },
                ]}
              >
                {name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Pill
                  label={isHospital ? "Hospital" : "Clinic"}
                  tone={isHospital ? "primary" : "info"}
                  size="sm"
                />
                <Pill label="Connected" tone="success" icon={CheckCircle2} size="sm" />
              </View>
            </View>
          </View>

          <View
            style={{
              backgroundColor: colors.successSoft,
              borderRadius: 14,
              borderCurve: "continuous",
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <ShieldCheck size={16} color={colors.success} />
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, flex: 1 },
              ]}
            >
              Records, prescriptions, and lab tests from this facility are synchronized.
            </Text>
          </View>
        </Card>

        {/* Care Team Section Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Users size={18} color={colors.primary} />
            <Text
              style={[
                typography.title.lg,
                { color: colors.text },
              ]}
            >
              My care team here
            </Text>
          </View>
          <Text style={[typography.label.sm, { color: colors.textSubtle }]}>
            {members.length} {members.length === 1 ? "Doctor" : "Doctors"}
          </Text>
        </View>

        {error ? (
          <Card
            elevated={false}
            style={{
              backgroundColor: colors.dangerSoft,
              borderWidth: 0,
              padding: spacing.lg,
              marginBottom: spacing.xxl,
            }}
          >
            <Text style={[typography.body.sm, { color: colors.danger }]}>{error}</Text>
          </Card>
        ) : members.length === 0 ? (
          <Card
            style={{
              paddingVertical: spacing.xxl,
              paddingHorizontal: spacing.xl,
              alignItems: "center",
              marginBottom: spacing.xxl,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              }}
            >
              <Users size={24} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, marginBottom: 6, textAlign: "center" },
              ]}
            >
              No care team linked yet
            </Text>
            <Text
              style={[
                typography.body.sm,
                {
                  color: colors.textMuted,
                  textAlign: "center",
                  marginBottom: spacing.lg,
                },
              ]}
            >
              Doctors you consult with at {name} will appear here when they access or contribute to your records.
            </Text>
            <Button
              variant="secondary"
              size="sm"
              title="Manage Care Team"
              fullWidth={false}
              onPress={() => router.push("/(app)/care-team" as any)}
            >
              Manage Care Team
            </Button>
          </Card>
        ) : (
          <Card padded={false} style={{ marginBottom: spacing.xxl, overflow: "hidden" }}>
            {members.map((m, idx) => {
              const displayName = m.doctorName || m.name || `Dr. ${m.id.slice(0, 6)}`;
              const roleText = m.relationshipKind || m.role || "Consulting Doctor";
              return (
                <View key={m.id}>
                  {idx > 0 ? (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: colors.separator,
                        marginLeft: spacing.lg + 40 + spacing.md,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      minHeight: 64,
                    }}
                  >
                    <Avatar name={displayName} size="md" />

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          typography.title.sm,
                          { color: colors.text, marginBottom: 2 },
                        ]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {roleText}
                      </Text>
                    </View>
                    <Pill
                      label={m.status || "Active"}
                      tone={m.status === "pending" ? "warning" : "success"}
                      size="sm"
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* Quick Actions Card */}
        <Text
          style={[
            typography.title.lg,
            { color: colors.text, marginBottom: spacing.md, paddingHorizontal: 4 },
          ]}
        >
          Facility Quick Actions
        </Text>
        <Card padded={false} style={{ overflow: "hidden" }}>
          <Pressable
            onPress={() => router.push("/(app)/timeline" as any)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.lg,
              minHeight: 56,
              backgroundColor: pressed ? colors.fill : "transparent",
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText size={17} color="#FFFFFF" />
              </View>
              <Text style={[typography.body.md, { color: colors.text, flex: 1 }]}>
                View Medical Timeline & Records
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSubtle} />
          </Pressable>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.separator,
              marginLeft: spacing.lg + 32 + spacing.md,
            }}
          />
          <Pressable
            onPress={() => router.push("/(app)/care-team" as any)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.lg,
              minHeight: 56,
              backgroundColor: pressed ? colors.fill : "transparent",
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={17} color="#FFFFFF" />
              </View>
              <Text style={[typography.body.md, { color: colors.text, flex: 1 }]}>
                Full Care Team Directory
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSubtle} />
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}
