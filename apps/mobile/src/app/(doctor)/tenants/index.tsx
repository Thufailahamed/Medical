// @ts-nocheck
// Phase MTN-1 mobile: "My Hospitals + My Clinics" landing for doctors.
// Pulls from GET /me/tenants (same store that powers the top-bar
// switcher). Each row is tappable → tenants/[id] detail.

import { useEffect, useState, useCallback } from "react";
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
  ChevronRight,
} from "lucide-react-native";
import { Screen, Card, Pill, EmptyState } from "@/components/ui";
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
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
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
      setLoading(false);
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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
      >
        <Text
          style={[
            typography.title.lg,
            { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
          ]}
        >
          My Hospitals
        </Text>
        {myHospitals.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No hospitals yet"
            message="Ask an admin to add you, or join via an invite link."
          />
        ) : (
          myHospitals.map((h: TenantRef) => (
            <Pressable
              key={`h-${h.id}`}
              onPress={() => go("hospital", h.id)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
                marginBottom: spacing.sm,
              })}
            >
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Building2 size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                    >
                      {h.name}
                    </Text>
                    {h.role ? (
                      <Pill label={h.role} tone="primary" />
                    ) : null}
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          ))
        )}

        <View style={{ height: spacing.xl }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
          }}
        >
          <Text
            style={[
              typography.title.lg,
              { color: colors.text, fontWeight: "800" },
            ]}
          >
            My Clinics
          </Text>
          <Pressable
            onPress={() => router.push("/(doctor)/clinics/new")}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              + New
            </Text>
          </Pressable>
        </View>
        {myClinics.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No clinics yet"
            message="Create your own clinic to invite partners + patients."
          />
        ) : (
          myClinics.map((c: TenantRef) => (
            <Pressable
              key={`c-${c.id}`}
              onPress={() => go("clinic", c.id)}
              accessibilityRole="button"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: spacing.sm })}
            >
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Stethoscope size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                    >
                      {c.name}
                    </Text>
                    {c.role ? (
                      <Pill label={c.role} tone="primary" />
                    ) : null}
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}