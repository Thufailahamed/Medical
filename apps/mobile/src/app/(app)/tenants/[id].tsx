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
    <Screen>
      <ScreenHeader
        title={name}
        kicker={isHospital ? "HOSPITAL PROFILE" : "CLINIC PROFILE"}
        subtitle="Connected Healthcare Facility"
        back={true}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
      >
        {/* Facility Hero Card */}
        <Card
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isHospital ? (
                <Building2 size={26} color={colors.primary} />
              ) : (
                <Stethoscope size={26} color={colors.primary} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text, fontWeight: "800", marginBottom: 4 },
                ]}
              >
                {name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pill
                  label={isHospital ? "Hospital" : "Clinic"}
                  tone={isHospital ? "primary" : "info"}
                />
                <Pill label="Connected" tone="success" icon={CheckCircle2} />
              </View>
            </View>
          </View>

          <View
            style={{
              backgroundColor: colors.bg,
              borderRadius: 14,
              padding: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: colors.borderSoft,
            }}
          >
            <ShieldCheck size={16} color={colors.success} />
            <Text
              style={[
                typography.body.xs,
                { color: colors.textMuted, fontSize: 12, flex: 1 },
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
            marginBottom: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Users size={18} color={colors.primary} />
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "800" },
              ]}
            >
              My care team here
            </Text>
          </View>
          <Text style={[typography.body.xs, { color: colors.textMuted, fontWeight: "600" }]}>
            {members.length} {members.length === 1 ? "Doctor" : "Doctors"}
          </Text>
        </View>

        {error ? (
          <Card
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.danger,
              borderWidth: 1,
              padding: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
          </Card>
        ) : members.length === 0 ? (
          <Card
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSoft,
              borderRadius: 16,
              padding: spacing.lg,
              alignItems: "center",
              marginBottom: spacing.lg,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.sm,
              }}
            >
              <Users size={22} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.title.xs,
                { color: colors.text, fontWeight: "700", marginBottom: 4 },
              ]}
            >
              No care team linked yet
            </Text>
            <Text
              style={[
                typography.body.xs,
                {
                  color: colors.textMuted,
                  textAlign: "center",
                  lineHeight: 18,
                  marginBottom: spacing.md,
                  paddingHorizontal: spacing.sm,
                },
              ]}
            >
              Doctors you consult with at {name} will appear here when they access or contribute to your records.
            </Text>
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.push("/(app)/care-team" as any)}
            >
              Manage Care Team
            </Button>
          </Card>
        ) : (
          members.map((m) => {
            const displayName = m.doctorName || m.name || `Dr. ${m.id.slice(0, 6)}`;
            const roleText = m.relationshipKind || m.role || "Consulting Doctor";
            return (
              <Card
                key={m.id}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <Avatar name={displayName} size="md" />

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.xs,
                        { color: colors.text, fontWeight: "700", marginBottom: 2 },
                      ]}
                    >
                      {displayName}
                    </Text>
                    <Text
                      style={[
                        typography.body.xs,
                        { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
                      ]}
                    >
                      {roleText}
                    </Text>
                    <Pill
                      label={m.status || "Active"}
                      tone={m.status === "pending" ? "warning" : "success"}
                    />
                  </View>
                </View>
              </Card>
            );
          })
        )}

        {/* Quick Actions Card */}
        <Card
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: spacing.md,
            marginTop: spacing.sm,
          }}
        >
          <Text
            style={[
              typography.title.xs,
              { color: colors.text, fontWeight: "700", marginBottom: spacing.sm },
            ]}
          >
            Facility Quick Actions
          </Text>

          <Pressable
            onPress={() => router.push("/(app)/timeline" as any)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSoft,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <FileText size={16} color={colors.primary} />
              <Text style={[typography.body.xs, { color: colors.text, fontWeight: "600" }]}>
                View Medical Timeline & Records
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => router.push("/(app)/care-team" as any)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 10,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Users size={16} color={colors.primary} />
              <Text style={[typography.body.xs, { color: colors.text, fontWeight: "600" }]}>
                Full Care Team Directory
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}