// @ts-nocheck
// Phase MTN-1 mobile: bottom-sheet listing the user's hospitals + clinics
// with one-tap switching. Mirrors FamilyPickerSheet pattern.

import { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Building2, Stethoscope, UserMinus } from "lucide-react-native";
import { BottomSheet } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useActiveTenantStore,
  type TenantType,
} from "@/stores/tenant-store";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function TenantPickerSheet({ visible, onDismiss }: Props) {
  const { colors, spacing, typography } = useTheme();
  const myHospitals = useActiveTenantStore((s) => s.myHospitals);
  const myClinics = useActiveTenantStore((s) => s.myClinics);
  const setHospital = useActiveTenantStore((s) => s.setActiveHospital);
  const setClinic = useActiveTenantStore((s) => s.setActiveClinic);
  const clear = useActiveTenantStore((s) => s.clear);

  const hasAny = useMemo(
    () => myHospitals.length > 0 || myClinics.length > 0,
    [myHospitals, myClinics]
  );

  function Row({
    label,
    sub,
    icon: Icon,
    onPress,
  }: any) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          borderTopWidth: 1,
          borderTopColor: colors.border,
        })}
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
          <Icon size={18} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "700" },
            ]}
          >
            {label}
          </Text>
          {sub ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {sub}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  function pick(t: TenantType, id: string | null) {
    if (t === "hospital") setHospital(id);
    else setClinic(id);
    onDismiss();
  }

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title="Switch workspace"
    >
      <ScrollView
        style={{ maxHeight: 360 }}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
      >
        <Row
          icon={UserMinus}
          label="No active workspace"
          sub="Removes the active tenant header"
          onPress={() => {
            clear();
            onDismiss();
          }}
        />
        {!hasAny ? (
          <View style={{ padding: spacing.lg }}>
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>
              You aren't a member of any hospital or clinic yet.
            </Text>
          </View>
        ) : null}
        {myHospitals.map((h: any) => (
          <Row
            key={`h-${h.id}`}
            icon={Building2}
            label={h.name}
            sub={h.role ? `Hospital · ${h.role}` : "Hospital"}
            onPress={() => pick("hospital", h.id)}
          />
        ))}
        {myClinics.map((c: any) => (
          <Row
            key={`c-${c.id}`}
            icon={Stethoscope}
            label={c.name}
            sub={c.role ? `Clinic · ${c.role}` : "Clinic"}
            onPress={() => pick("clinic", c.id)}
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}