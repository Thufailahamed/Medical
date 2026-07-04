// @ts-nocheck
// Phase MTN-1 mobile (hospital admin): doctors at this hospital.
// Tenant-scoped via /hospital-doctors + x-active-hospital-id header.

import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Stethoscope, ChevronRight } from "lucide-react-native";
import { useHospitalDoctors } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  EmptyState,
  Skeleton,
} from "@/components/ui";

export default function HospitalDoctors() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const { data, isLoading } = useHospitalDoctors();
  const list = Array.isArray(data) ? data : [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Doctors"
        subtitle={`${list.length} member${list.length === 1 ? "" : "s"}`}
      />
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={72} radius={20} />
          ))}
        </View>
      ) : list.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={Stethoscope}
            title="No doctors yet"
            message="Invite doctors via the staff invites screen."
            tone="neutral"
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {list.map((d: any) => (
            <Card key={d.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
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
                    {d.name || d.doctorName || d.id}
                  </Text>
                  {d.role || d.department ? (
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {d.role || ""}
                      {d.department ? ` · ${d.department}` : ""}
                    </Text>
                  ) : null}
                </View>
                {d.status ? <Pill label={d.status} tone="muted" /> : null}
                <ChevronRight size={16} color={colors.textMuted} />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}