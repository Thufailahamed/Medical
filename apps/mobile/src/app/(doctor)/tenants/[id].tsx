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
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Users } from "lucide-react-native";
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
  const [deleting, setDeleting] = useState(false);

  const clinicRef = useActiveTenantStore((s) =>
    activeHosp ? null : s.myClinics.find((c) => c.id === id)
  );
  const isOwner = clinicRef?.role === "owner";

  async function handleDelete() {
    Alert.alert(
      "Delete Clinic",
      "Are you sure you want to permanently delete this clinic? This will discharge all patients and remove all staff. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api(`/clinics/${id}`, { method: "DELETE" });
              // Clear active clinic if this was the active one
              if (activeClinic === id) {
                useActiveTenantStore.getState().setActiveClinic(null);
              }
              // Go back
              router.back();
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to delete clinic");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

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
          <EmptyState
            icon={Users}
            title="No members"
            message="Add doctors to start collaborating."
          />
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
        {/* Render delete button for clinic owners */}
        {!activeHosp && isOwner ? (
          <View style={{ marginTop: spacing.xl }}>
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: pressed ? "rgba(239, 68, 68, 0.1)" : "transparent",
                borderWidth: 1,
                borderColor: colors.danger,
                paddingVertical: spacing.md,
                borderRadius: 12,
                alignItems: "center",
                opacity: deleting ? 0.6 : 1,
              })}
            >
              {deleting ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={{ color: colors.danger, fontWeight: "800" }}>
                  Delete Clinic
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}