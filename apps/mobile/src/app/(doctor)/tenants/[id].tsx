// @ts-nocheck
// Phase MTN-1 mobile: tenant detail. Same shape for hospital + clinic;
// the active tenant header on incoming requests picks the right scope.

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
};

export default function DoctorTenantDetail() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeHosp = useActiveTenantStore((s) => s.activeHospitalId);
  const activeClinic = useActiveTenantStore((s) => s.activeClinicId);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull members for the active tenant — API differs by context.
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const path = activeHosp
        ? `/hospital-doctors?hospitalId=${id}`
        : `/clinic-doctors?clinicId=${id}`;
      const rows = await api<Member[]>(path);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load members");
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
          style={{ marginBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: 6 }}
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
          Members
        </Text>
        {error ? (
          <Text style={{ color: colors.danger }}>{error}</Text>
        ) : members.length === 0 ? (
          <EmptyState title="No members" description="Add doctors to start collaborating." />
        ) : (
          members.map((m) => (
            <Card key={m.id} style={{ marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {m.name || m.id}
              </Text>
              {m.role ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {m.role} {m.status ? `· ${m.status}` : ""}
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}