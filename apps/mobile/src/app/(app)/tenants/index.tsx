// @ts-nocheck
// Phase MTN-1 mobile (patient view): "Hospitals I'm registered at +
// Clinics I visit" landing.

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Building2,
  Stethoscope,
  ChevronRight,
  QrCode,
  Search,
  X,
  ShieldCheck,
  Info,
  CheckCircle2,
  FileText,
  Plus,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Button,
  Pressable,
  TextInput,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import {
  useActiveTenantStore,
  type TenantRef,
} from "@/stores/tenant-store";

type FilterTab = "all" | "hospitals" | "clinics";

export default function PatientTenants() {
  const { colors, spacing, typography, radius } = useTheme();
  const router = useRouter();

  const myHospitals = useActiveTenantStore((s) => s.myHospitals);
  const myClinics = useActiveTenantStore((s) => s.myClinics);
  const activeHospitalId = useActiveTenantStore((s) => s.activeHospitalId);
  const activeClinicId = useActiveTenantStore((s) => s.activeClinicId);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

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
          useActiveTenantStore.getState().activeHospitalId,
          useActiveTenantStore.getState().activeClinicId
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

  function go(kind: "hospital" | "clinic", id: string) {
    if (kind === "hospital") {
      useActiveTenantStore.getState().setActiveHospital(id);
    } else {
      useActiveTenantStore.getState().setActiveClinic(id);
    }
    router.push(`/(app)/tenants/${id}`);
  }

  const query = searchQuery.trim().toLowerCase();

  const filteredHospitals = useMemo(() => {
    if (!query) return myHospitals;
    return myHospitals.filter((h) =>
      (h.name || "").toLowerCase().includes(query)
    );
  }, [myHospitals, query]);

  const filteredClinics = useMemo(() => {
    if (!query) return myClinics;
    return myClinics.filter((c) =>
      (c.name || "").toLowerCase().includes(query)
    );
  }, [myClinics, query]);

  const totalCount = myHospitals.length + myClinics.length;

  return (
    <Screen padded={false}>
      <ScreenHeader
        title="Hospitals & Clinics"
        subtitle="Healthcare facilities linked to your digital record"
        kicker="Care Network"
        back={true}
        right={
          <Pressable
            onPress={() => router.push("/(app)/health-id" as any)}
            accessibilityRole="button"
            accessibilityLabel="Show Health ID QR"
            hitSlop={8}
            haptic="light"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <QrCode size={19} color={colors.primary} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Healthcare Network Hub Card ── */}
        <Card
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={20} color={colors.primary} />
              </View>
              <View>
                <Text
                  style={[
                    typography.title.xs,
                    { color: colors.text, fontWeight: "800", fontSize: 16 },
                  ]}
                >
                  Connected Care Network
                </Text>
                <Text
                  style={[
                    typography.body.xs,
                    { color: colors.textMuted, fontSize: 11 },
                  ]}
                >
                  Synchronized EHR & Digital Records
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor:
                  totalCount > 0
                    ? colors.successSoft || "#ECFDF5"
                    : colors.surfaceMuted,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor:
                  totalCount > 0
                    ? colors.successBorder || "#A7F3D0"
                    : colors.borderSoft,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    totalCount > 0
                      ? colors.success || "#10B981"
                      : colors.textMuted,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color:
                    totalCount > 0
                      ? colors.success || "#059669"
                      : colors.textMuted,
                }}
              >
                {totalCount} {totalCount === 1 ? "Facility" : "Facilities"}
              </Text>
            </View>
          </View>

          <Text
            style={[
              typography.body.xs,
              {
                color: colors.textMuted,
                lineHeight: 18,
                marginBottom: spacing.md,
              },
            ]}
          >
            Medical records, lab tests, prescriptions, and consult notes
            automatically synchronize between your linked providers and your
            timeline.
          </Text>

          {/* Dual Stat Metrics Strip */}
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: colors.bg,
                borderRadius: 14,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.borderSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={16} color={colors.primary} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  {myHospitals.length}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    fontWeight: "600",
                  }}
                >
                  {myHospitals.length === 1 ? "Hospital" : "Hospitals"}
                </Text>
              </View>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: colors.bg,
                borderRadius: 14,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.borderSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: colors.infoSoft || "#E0F2FE",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Stethoscope size={16} color={colors.info || "#0284C7"} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  {myClinics.length}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    fontWeight: "600",
                  }}
                >
                  {myClinics.length === 1 ? "Clinic" : "Clinics"}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Action Button: Show Health ID at reception */}
          <Pressable
            onPress={() => router.push("/(app)/health-id" as any)}
            accessibilityRole="button"
            haptic="light"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.primarySoft,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.primarySoft,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <QrCode size={16} color={colors.primary} />
              <Text
                style={[
                  typography.body.xs,
                  { color: colors.primary, fontWeight: "700", fontSize: 12 },
                ]}
              >
                Show Health ID QR at reception to link
              </Text>
            </View>
            <ChevronRight size={15} color={colors.primary} />
          </Pressable>
        </Card>

        {/* ── Search Bar ── */}
        <TextInput
          placeholder="Search linked facilities..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leadingIcon={Search}
          trailingIcon={searchQuery ? X : undefined}
          onTrailingIconPress={() => setSearchQuery("")}
          containerStyle={{ marginBottom: spacing.md }}
        />

        {/* ── Segmented Filter Control ── */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surface,
            padding: 4,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
          }}
        >
          <Pressable
            onPress={() => setActiveTab("all")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor:
                activeTab === "all" ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: activeTab === "all" ? "#FFFFFF" : colors.textMuted,
              }}
            >
              All ({totalCount})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("hospitals")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor:
                activeTab === "hospitals" ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: activeTab === "hospitals" ? "#FFFFFF" : colors.textMuted,
              }}
            >
              Hospitals ({myHospitals.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("clinics")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor:
                activeTab === "clinics" ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: activeTab === "clinics" ? "#FFFFFF" : colors.textMuted,
              }}
            >
              Clinics ({myClinics.length})
            </Text>
          </Pressable>
        </View>

        {/* ── Hospitals Section ── */}
        {(activeTab === "all" || activeTab === "hospitals") && (
          <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
            <SectionHeader
              icon={Building2}
              title="Hospitals I'm registered at"
              count={filteredHospitals.length}
            />

            {filteredHospitals.length === 0 ? (
              activeTab === "all" ? (
                /* Compact Helper in 'All' view */
                <CompactEmptyStrip
                  icon={Building2}
                  title="No hospitals linked yet"
                  subtitle="Present Health ID at admission to link records"
                  onPress={() => router.push("/(app)/health-id" as any)}
                />
              ) : (
                /* Dedicated Tab Empty State */
                <FullEmptyCard
                  icon={Building2}
                  title={
                    searchQuery ? "No matching hospitals" : "No hospitals yet"
                  }
                  body={
                    searchQuery
                      ? `No hospitals match "${searchQuery}". Try searching with a different name.`
                      : "Register at any partner hospital or present your Health ID at admission to sync your records."
                  }
                  showCta={!searchQuery}
                  onCtaPress={() => router.push("/(app)/health-id" as any)}
                />
              )
            ) : (
              filteredHospitals.map((h: TenantRef) => (
                <FacilityCard
                  key={`h-${h.id}`}
                  facility={h}
                  icon={Building2}
                  tone="primary"
                  typeLabel="Hospital"
                  typeSubtitle="Hospital & Inpatient Center"
                  isActive={h.id === activeHospitalId}
                  onPress={() => go("hospital", h.id)}
                />
              ))
            )}
          </View>
        )}

        {/* ── Clinics Section ── */}
        {(activeTab === "all" || activeTab === "clinics") && (
          <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
            <SectionHeader
              icon={Stethoscope}
              title="Clinics I visit"
              count={filteredClinics.length}
            />

            {filteredClinics.length === 0 ? (
              activeTab === "all" ? (
                /* Compact Helper in 'All' view (prevents giant awkward card!) */
                <CompactEmptyStrip
                  icon={Stethoscope}
                  title="No clinics linked yet"
                  subtitle="Share your Health ID at your next visit to link records"
                  onPress={() => router.push("/(app)/health-id" as any)}
                />
              ) : (
                /* Dedicated Tab Empty State */
                <FullEmptyCard
                  icon={Stethoscope}
                  title={searchQuery ? "No matching clinics" : "No clinics yet"}
                  body={
                    searchQuery
                      ? `No clinics match "${searchQuery}". Try searching with a different name.`
                      : "Visit a clinic or private practice and share your Health ID to link consultation notes and prescriptions."
                  }
                  showCta={!searchQuery}
                  onCtaPress={() => router.push("/(app)/health-id" as any)}
                />
              )
            ) : (
              filteredClinics.map((c: TenantRef) => (
                <FacilityCard
                  key={`c-${c.id}`}
                  facility={c}
                  icon={Stethoscope}
                  tone="info"
                  typeLabel="Clinic"
                  typeSubtitle="Specialist & Outpatient Clinic"
                  isActive={c.id === activeClinicId}
                  onPress={() => go("clinic", c.id)}
                />
              ))
            )}
          </View>
        )}

        {/* ── How to Link New Facilities Guide ── */}
        <Card
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Info size={18} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.title.xs,
                { color: colors.text, fontWeight: "800", fontSize: 15 },
              ]}
            >
              How to link a new facility
            </Text>
          </View>

          <Text
            style={[
              typography.body.xs,
              {
                color: colors.textMuted,
                lineHeight: 18,
                marginBottom: spacing.md,
              },
            ]}
          >
            Connect any hospital, diagnostic center, or private clinic in 3
            simple steps:
          </Text>

          <View style={{ gap: 12, marginBottom: spacing.lg }}>
            <GuideStep
              n={1}
              icon={QrCode}
              title="Show your Health ID"
              body="Open your personal QR pass at the registration or admission desk."
            />
            <GuideStep
              n={2}
              icon={CheckCircle2}
              title="Desk scans and validates"
              body="Staff scan your QR code to securely link your digital medical chart."
            />
            <GuideStep
              n={3}
              icon={FileText}
              title="Automatic synchronization"
              body="All prescriptions, lab investigations, and doctor notes appear in your records."
            />
          </View>

          <Button
            variant="primary"
            size="md"
            onPress={() => router.push("/(app)/health-id" as any)}
            style={{ width: "100%" }}
          >
            Open My Health ID
          </Button>
        </Card>
      </ScrollView>
    </Screen>
  );
}

/** Uppercase overline section header with count badge. */
function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: any;
  title: string;
  count: number;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: 2,
        marginBottom: 2,
      }}
    >
      <Icon size={14} color={colors.textMuted} />
      <Text
        style={[
          typography.label.md,
          {
            color: colors.textMuted,
            fontWeight: "700",
            letterSpacing: 0.8,
            textTransform: "uppercase",
            fontSize: 11,
            flex: 1,
          },
        ]}
      >
        {title}
      </Text>
      <Pill label={String(count)} tone="neutral" size="sm" />
    </View>
  );
}

/** Single linked facility row card. */
function FacilityCard({
  facility,
  icon: Icon,
  tone,
  typeLabel,
  typeSubtitle,
  isActive,
  onPress,
}: {
  facility: TenantRef;
  icon: any;
  tone: "primary" | "info";
  typeLabel: string;
  typeSubtitle: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const iconBg = tone === "primary" ? colors.primarySoft : (colors.infoSoft || "#E0F2FE");
  const iconFg = tone === "primary" ? colors.primary : (colors.info || "#0284C7");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${typeLabel} ${facility.name}`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <Card
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: isActive ? colors.primary : colors.border,
          borderRadius: 16,
          padding: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          {/* Facility Icon */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: iconBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={24} color={iconFg} />
          </View>

          {/* Details */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 2,
              }}
            >
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text, fontWeight: "700", fontSize: 15 },
                ]}
                numberOfLines={1}
              >
                {facility.name}
              </Text>
              {isActive && (
                <Pill
                  label="Active"
                  tone="primary"
                  icon={CheckCircle2}
                  size="sm"
                />
              )}
            </View>

            <Text
              style={[
                typography.body.xs,
                { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
              ]}
              numberOfLines={1}
            >
              {typeSubtitle}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Pill label={typeLabel} tone={tone} size="sm" />
              <Pill label="Connected" tone="success" size="sm" />
            </View>
          </View>

          {/* Chevron Action */}
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.bg,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.borderSoft,
            }}
          >
            <ChevronRight size={16} color={colors.textMuted} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

/** Compact helper strip shown in 'All' view when a section has 0 items. */
function CompactEmptyStrip({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderStyle: "dashed",
        borderRadius: 14,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          flex: 1,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
            {title}
          </Text>
          <Text
            style={{ fontSize: 11, color: colors.textMuted }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: colors.primarySoft,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.primary,
          }}
        >
          Show QR
        </Text>
      </Pressable>
    </View>
  );
}

/** Full graphic empty card used in dedicated tabs or search empty states. */
function FullEmptyCard({
  icon: Icon,
  title,
  body,
  showCta,
  onCtaPress,
}: {
  icon: any;
  title: string;
  body: string;
  showCta: boolean;
  onCtaPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <Card
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: 16,
        padding: spacing.lg,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.sm,
        }}
      >
        <Icon size={24} color={colors.primary} />
      </View>
      <Text
        style={[
          typography.title.xs,
          { color: colors.text, fontWeight: "700", marginBottom: 4 },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          typography.body.xs,
          {
            color: colors.textMuted,
            textAlign: "center",
            lineHeight: 18,
            marginBottom: showCta ? spacing.md : 0,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        {body}
      </Text>
      {showCta && (
        <Button variant="outline" size="sm" onPress={onCtaPress}>
          View My Health ID
        </Button>
      )}
    </Card>
  );
}

/** Step item for the educational guide. */
function GuideStep({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number;
  icon: any;
  title: string;
  body: string;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        <Text
          style={{
            color: colors.primary,
            fontSize: 12,
            fontWeight: "800",
          }}
        >
          {n}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.body.xs,
            { color: colors.text, fontWeight: "700", marginBottom: 2 },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            typography.body.xs,
            { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
          ]}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}
