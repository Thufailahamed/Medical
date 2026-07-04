// Phase MTN-1 mobile: pill rendered on the home topbar when the user is
// "acting in" a hospital or clinic. Tapping opens TenantPickerSheet so
// they can switch. Selecting persists to server column via
// PATCH /me/active-tenant (durable cross-device).
//
// Renders nothing when no tenant is selected — a hospital_admin user
// with no active workspace still gets a "no tenant" pill from this
// component only if they've explicitly picked one.

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Building2, Stethoscope } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useActiveTenantStore } from "@/stores/tenant-store";
import { TenantPickerSheet } from "./TenantPickerSheet";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export function TenantSwitcher() {
  const { colors, spacing, typography } = useTheme();
  const myHospitals = useActiveTenantStore((s) => s.myHospitals);
  const myClinics = useActiveTenantStore((s) => s.myClinics);
  const activeHospId = useActiveTenantStore((s) => s.activeHospitalId);
  const activeClinicId = useActiveTenantStore((s) => s.activeClinicId);
  const setMemberships = useActiveTenantStore((s) => s.setMemberships);
  const [open, setOpen] = useState(false);

  // Hydrate from /me/tenants on mount + when auth changes.
  useEffect(() => {
    let alive = true;
    api<{
      hospitals: Array<{ id: string; name: string; role?: string | null }>;
      clinics: Array<{ id: string; name: string; role?: string | null }>;
      activeHospitalId: string | null;
      activeClinicId: string | null;
    }>("/me/tenants")
      .then((res) => {
        if (!alive) return;
        setMemberships(
          res.hospitals || [],
          res.clinics || [],
          res.activeHospitalId || null,
          res.activeClinicId || null
        );
      })
      .catch(() => {
        // unauthenticated boot — fine, header still sends nothing.
      });
    return () => {
      alive = false;
    };
  }, [setMemberships]);

  const qc = useQueryClient();

  // Resolve display label.
  let label: string | null = null;
  let Icon: any = Building2;
  if (activeHospId) {
    const h = myHospitals.find((x) => x.id === activeHospId);
    label = h?.name ?? "Hospital";
    Icon = Building2;
  } else if (activeClinicId) {
    const c = myClinics.find((x) => x.id === activeClinicId);
    label = c?.name ?? "Clinic";
    Icon = Stethoscope;
  }
  if (!label) {
    if (myHospitals.length > 0 || myClinics.length > 0) {
      label = "Select workspace";
      Icon = Building2;
    } else {
      return null;
    }
  }

  async function persist(
    type: "hospital" | "clinic" | null,
    id: string | null
  ) {
    try {
      await api("/me/active-tenant", {
        method: "PATCH",
        body:
          type === null
            ? { type: null, id: null }
            : { type, id },
      });
    } catch {
      // Local change wins; next request will re-validate server-side.
    }
    qc.invalidateQueries();
  }

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Active workspace: ${label}. Tap to switch.`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingVertical: 6,
          paddingHorizontal: spacing.sm,
          borderRadius: 999,
          backgroundColor: pressed ? colors.primarySoft : colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.primary,
        })}
      >
        <Icon size={14} color={colors.primary} strokeWidth={2.25} />
        <Text
          numberOfLines={1}
          style={[
            typography.label.md,
            { color: colors.primary, fontWeight: "700" },
          ]}
        >
          {label}
        </Text>
      </Pressable>
      <TenantPickerSheet
        visible={open}
        onDismiss={() => {
          setOpen(false);
          // After dismissal, sync the new active ids to the server.
          const state = useActiveTenantStore.getState();
          if (state.activeHospitalId && !state.activeClinicId) {
            persist("hospital", state.activeHospitalId);
          } else if (state.activeClinicId && !state.activeHospitalId) {
            persist("clinic", state.activeClinicId);
          } else if (!state.activeHospitalId && !state.activeClinicId) {
            persist(null, null);
          }
        }}
      />
    </>
  );
}