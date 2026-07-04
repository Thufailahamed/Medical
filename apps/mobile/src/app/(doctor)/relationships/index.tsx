// @ts-nocheck
// Phase MTN-1 mobile: doctor's relationships list grouped by tenant.
// Pulls from GET /doctor-patient-relationships?doctorId=… and groups
// client-side by (contextType, contextId).

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Building2, Stethoscope } from "lucide-react-native";
import { Screen, Card, Pill, EmptyState } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
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
  const userId = useAuthStore((s) => s.userId);
  const [rels, setRels] = useState<Rel[]>([]);
  const [loading, setLoading] = useState(false);

  // Need doctor's doctorId (not userId) — fetch doctor profile.
  const [doctorId, setDoctorId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      let did = doctorId;
      if (!did) {
        const me = await api<{ doctorId?: string; id?: string }>("/doctors/me");
        did = me?.doctorId || me?.id;
        setDoctorId(did || null);
      }
      if (!did) return;
      const rows = await api<Rel[]>(
        `/doctor-patient-relationships?doctorId=${did}`
      );
      setRels(Array.isArray(rows) ? rows : []);
    } catch {
      // swallow — empty state shown below
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
            { color: colors.text, fontWeight: "800", marginBottom: spacing.md },
          ]}
        >
          Patient Relationships
        </Text>
        {rels.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No active relationships"
            message="Add a patient from a hospital or clinic to start one."
          />
        ) : (
          grouped.map(([key, items]) => {
            const [t, id] = key.split(":") as ["hospital" | "clinic", string];
            const Icon = t === "hospital" ? Building2 : Stethoscope;
            return (
              <View key={key} style={{ marginBottom: spacing.lg }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    marginBottom: spacing.sm,
                  }}
                >
                  <Icon size={16} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    {tenantLabel(t, id)}
                  </Text>
                  <Pill label={`${items.length}`} tone="muted" />
                </View>
                {items.map((r) => (
                  <Card
                    key={r.id}
                    style={{ marginBottom: spacing.xs }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "600" }}>
                      Patient {r.patientId.slice(0, 8)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {r.relationshipKind} · {r.status}
                    </Text>
                  </Card>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}