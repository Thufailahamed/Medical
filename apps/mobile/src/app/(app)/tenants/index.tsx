// @ts-nocheck
// Phase MTN-1 mobile (patient view): "Hospitals I'm registered at +
// Clinics I visit" landing.

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Building2, Stethoscope, ChevronRight } from "lucide-react-native";
import { Screen, Card, Pill, EmptyState } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import {
  useActiveTenantStore,
  type TenantRef,
} from "@/stores/tenant-store";

export default function PatientTenants() {
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

  useEffect(() => {
    if (myHospitals.length === 0 && myClinics.length === 0) load();
  }, []);

  function go(kind: "hospital" | "clinic", id: string) {
    if (kind === "hospital") {
      useActiveTenantStore.getState().setActiveHospital(id);
    } else {
      useActiveTenantStore.getState().setActiveClinic(id);
    }
    router.push(`/(app)/tenants/${id}`);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
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
          Hospitals I'm registered at
        </Text>
        {myHospitals.length === 0 ? (
          <EmptyState
            title="No hospitals yet"
            description="Register at a hospital to start a medical record there."
          />
        ) : (
          myHospitals.map((h: TenantRef) => (
            <Pressable
              key={`h-${h.id}`}
              onPress={() => go("hospital", h.id)}
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
                    <Pill label="Hospital" tone="primary" />
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          ))
        )}

        <View style={{ height: spacing.xl }} />
        <Text
          style={[
            typography.title.lg,
            { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
          ]}
        >
          Clinics I visit
        </Text>
        {myClinics.length === 0 ? (
          <EmptyState
            title="No clinics yet"
            description="Visit a clinic to register and start a record there."
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
                    <Pill label="Clinic" tone="primary" />
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