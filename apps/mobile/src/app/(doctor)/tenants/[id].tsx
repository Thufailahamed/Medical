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
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Building2, Stethoscope, Users } from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  EmptyState,
  IconTile,
  SectionHeader,
  ListCard,
  Avatar,
  Button,
} from "@/components/ui";
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

  const kindLabel = t(activeHosp ? "doctorTenantDetail.hospital" : "doctorTenantDetail.clinic");

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back onBack={() => router.back()} title={name || kindLabel} kicker={kindLabel} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <IconTile
              icon={activeHosp ? Building2 : Stethoscope}
              tone={activeHosp ? "primary" : "accent"}
              appearance="solid"
              size={48}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={[typography.title.lg, { color: colors.text }]}>
                {name || kindLabel}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                {kindLabel}
                {members.length ? `  ·  ${members.length} ${t("doctorTenantDetail.members").toLowerCase()}` : ""}
              </Text>
            </View>
          </View>
        </Card>

        <SectionHeader
          kicker={t("doctorTenantDetail.teamKicker", "Team")}
          title={t("doctorTenantDetail.members")}
          count={members.length || undefined}
        />
        {error ? (
          <Pill label={error} tone="danger" />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("doctorTenantDetail.noMembersTitle")}
            message={t("doctorTenantDetail.noMembersBody")}
          />
        ) : (
          <ListCard>
            {members.map((m, idx) => (
              <View
                key={m.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: colors.separator,
                }}
              >
                <Avatar name={m.name || m.id} size="sm" tone="primary" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text }]}>
                    {m.name || m.id}
                  </Text>
                  {m.role ? (
                    <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                      {t(`doctorTenantDetail.roles.${m.role}`, { defaultValue: m.role })}
                      {m.status
                        ? `  ·  ${t(`doctorTenantDetail.statuses.${m.status}`, { defaultValue: m.status })}`
                        : ""}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ListCard>
        )}

        {!activeHosp && isOwner ? (
          <Button
            title={t("doctorTenantDetail.deleteTitle")}
            variant="danger"
            onPress={handleDelete}
            loading={deleting}
            style={{ marginTop: spacing.xl }}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
