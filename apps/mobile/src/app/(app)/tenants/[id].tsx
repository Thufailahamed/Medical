// @ts-nocheck
// Phase MTN-1 mobile (patient view): tenant detail. Lists care team +
// upcoming appointments scoped to that tenant.

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Screen, Card, Pill, EmptyState } from "@/components/ui";
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
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const name = useActiveTenantStore((s) =>
    (activeHosp
      ? s.myHospitals.find((h) => h.id === id)?.name
      : s.myClinics.find((c) => c.id === id)?.name) || ""
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={{
            marginBottom: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "600" }}>Back</Text>
        </Pressable>

        <Text
          style={[
            typography.title.lg,
            { color: colors.text, fontWeight: "800", marginBottom: spacing.xs },
          ]}
        >
          {name || (activeHosp ? "Hospital" : "Clinic")}
        </Text>
        <Pill label={activeHosp ? "Hospital" : "Clinic"} tone="primary" />

        <Text
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          My care team here
        </Text>
        {error ? (
          <Text style={{ color: colors.danger }}>{error}</Text>
        ) : members.length === 0 ? (
          <EmptyState
            title="No care team yet"
            description="Add a doctor from this workspace to share records."
          />
        ) : (
          members.map((m) => (
            <Card key={m.id} style={{ marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {m.doctorName || m.name || m.id}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {m.relationshipKind || m.role || ""} · {m.status || ""}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}