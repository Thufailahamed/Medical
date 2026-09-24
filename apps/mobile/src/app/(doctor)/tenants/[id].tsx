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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      t("doctorTenantDetail.deleteTitle"),
      t("doctorTenantDetail.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
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
              Alert.alert(
                t("common.errorTitle"),
                e?.message || t("doctorTenantDetail.deleteFailed")
              );
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
      setError(e?.message || t("doctorTenantDetail.loadFailed"));
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
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            {t("doctorTenantDetail.back")}
          </Text>
        </Pressable>

        <Text
          style={[
            typography.title.lg,
            { color: colors.text, fontWeight: "800", marginBottom: spacing.xs },
          ]}
        >
          {name || t(activeHosp ? "doctorTenantDetail.hospital" : "doctorTenantDetail.clinic")}
        </Text>
        <Pill
          label={t(activeHosp ? "doctorTenantDetail.hospital" : "doctorTenantDetail.clinic")}
          tone="primary"
        />

        <Text
          style={[
            typography.title.sm,
            { color: colors.text, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          {t("doctorTenantDetail.members")}
        </Text>
        {error ? (
          <Text style={{ color: colors.danger }}>{error}</Text>
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("doctorTenantDetail.noMembersTitle")}
            message={t("doctorTenantDetail.noMembersBody")}
          />
        ) : (
          members.map((m) => (
            <Card key={m.id} style={{ marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {m.name || m.id}
              </Text>
              {m.role ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {t(`doctorTenantDetail.roles.${m.role}`, {
                    defaultValue: m.role,
                  })}{" "}
                  {m.status
                    ? `· ${t(`doctorTenantDetail.statuses.${m.status}`, {
                        defaultValue: m.status,
                      })}`
                    : ""}
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
                borderCurve: "continuous",
                alignItems: "center",
                opacity: deleting ? 0.6 : 1,
              })}
            >
              {deleting ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={{ color: colors.danger, fontWeight: "800" }}>
                  {t("doctorTenantDetail.deleteTitle")}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}