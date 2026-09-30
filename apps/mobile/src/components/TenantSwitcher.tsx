// Phase MTN-1 mobile: pill rendered on the home topbar when the user is
// "acting in" a hospital or clinic. Tapping opens TenantPickerSheet so
// they can switch. Selecting persists to server column via
// PATCH /me/active-tenant (durable cross-device).
//
// Renders nothing when no tenant is selected — a hospital_admin user
// with no active workspace still gets a "no tenant" pill from this
// component only if they've explicitly picked one.

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Building2, ChevronsUpDown, Stethoscope } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useActiveTenantStore } from "@/stores/tenant-store";
import { TenantPickerSheet } from "./TenantPickerSheet";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  /** `pill` (default) — compact outlined capsule for top bars.
   *  `row` — full-width card row: tone tile + "Workspace" eyebrow + name. */
  variant?: "pill" | "row" | "chip";
  /** Eyebrow shown above the name in the `row` variant. */
  caption?: string;
};

export function TenantSwitcher({ variant = "pill", caption = "Workspace" }: Props = {}) {
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
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
  let unset = false;
  if (!label) {
    if (myHospitals.length > 0 || myClinics.length > 0) {
      label = "Select workspace";
      unset = true;
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

  const isDark = scheme === "dark";
  const trigger =
    variant === "chip" ? (
      <Pressable
        onPress={() => {
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Active workspace: ${label}. Tap to switch.`}
        hitSlop={4}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 6,
          height: 34,
          paddingLeft: 5,
          paddingRight: 10,
          borderRadius: 999,
          borderCurve: "continuous",
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? colors.borderStrong : colors.hairline,
          ...(isDark ? {} : shadow.xs),
        })}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon size={13} color={colors.primary} strokeWidth={2.3} />
        </View>
        <Text
          numberOfLines={1}
          style={[typography.label.md, { color: unset ? colors.primary : colors.text, maxWidth: 220 }]}
        >
          {label}
        </Text>
        <ChevronsUpDown size={13} color={colors.textMuted} strokeWidth={2.4} />
      </Pressable>
    ) : variant === "row" ? (
      <Pressable
        onPress={() => {
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Active workspace: ${label}. Tap to switch.`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: 56,
          paddingVertical: 8,
          paddingLeft: 8,
          paddingRight: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? colors.borderStrong : colors.hairline,
          ...(isDark ? {} : shadow.xs),
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon size={19} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase" }]}
          >
            {caption}
          </Text>
          <Text
            numberOfLines={1}
            style={[typography.title.sm, { color: unset ? colors.primary : colors.text, marginTop: 1 }]}
          >
            {label}
          </Text>
        </View>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.well,
          }}
        >
          <ChevronsUpDown size={14} color={colors.textMuted} strokeWidth={2.4} />
        </View>
      </Pressable>
    ) : (
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
    );

  return (
    <>
      {trigger}
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