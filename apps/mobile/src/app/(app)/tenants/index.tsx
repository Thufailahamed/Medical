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
import { LinearGradient } from "expo-linear-gradient";
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
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
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
              borderCurve: "continuous",
              backgroundColor: pressed ? colors.fillStrong : colors.fill,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <QrCode size={19} color={colors.primary} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxxl,
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
          padded={false}
          elevated={false}
          style={{
            borderRadius: radius.xxl,
            borderCurve: "continuous",
            borderWidth: 0,
            overflow: "hidden",
            marginBottom: spacing.xl,
            ...(scheme === "dark" ? null : shadow.hero),
          }}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: spacing.xl }}
          >
            <ShieldCheck
              size={150}
              color="#FFFFFF"
              strokeWidth={1}
              style={{
                position: "absolute",
                right: -30,
                top: -24,
                opacity: 0.08,
              }}
              pointerEvents="none"
            />
            {/* Header Row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.md,
                gap: spacing.sm,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.18)",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: "rgba(255,255,255,0.28)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldCheck size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      typography.title.md,
                      { color: "#FFFFFF" },
                    ]}
                    numberOfLines={1}
                  >
                    Connected Care Network
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: "rgba(255,255,255,0.78)" },
                    ]}
                    numberOfLines={1}
                  >
                    Synchronized EHR & Digital Records
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.28)",
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      totalCount > 0
                        ? "#8FF0C4"
                        : "rgba(255,255,255,0.55)",
                  }}
                />
                <Text
                  style={[
                    typography.label.sm,
                    { color: "#FFFFFF" },
                  ]}
                >
                  {totalCount} {totalCount === 1 ? "Facility" : "Facilities"}
                </Text>
              </View>
            </View>

            <Text
              style={[
                typography.body.sm,
                {
                  color: "rgba(255,255,255,0.82)",
                  marginBottom: spacing.lg,
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
                gap: spacing.sm,
                marginBottom: spacing.lg,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderRadius: 16,
                  borderCurve: "continuous",
                  padding: spacing.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.28)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Building2 size={17} color="#FFFFFF" />
                </View>
                <View>
                  <Text
                    style={[
                      typography.display.sm,
                      { color: "#FFFFFF" },
                    ]}
                  >
                    {myHospitals.length}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: "rgba(255,255,255,0.78)" },
                    ]}
                  >
                    {myHospitals.length === 1 ? "Hospital" : "Hospitals"}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderRadius: 16,
                  borderCurve: "continuous",
                  padding: spacing.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.28)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Stethoscope size={17} color="#FFFFFF" />
                </View>
                <View>
                  <Text
                    style={[
                      typography.display.sm,
                      { color: "#FFFFFF" },
                    ]}
                  >
                    {myClinics.length}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: "rgba(255,255,255,0.78)" },
                    ]}
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
                backgroundColor: "#FFFFFF",
                minHeight: 46,
                paddingHorizontal: spacing.lg,
                borderRadius: 14,
                borderCurve: "continuous",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}
              >
                <QrCode size={17} color={colors.primaryGradientEnd} />
                <Text
                  style={[
                    typography.label.md,
                    { color: colors.primaryGradientEnd, flex: 1 },
                  ]}
                  numberOfLines={1}
                >
                  Show Health ID QR at reception to link
                </Text>
              </View>
              <ChevronRight size={16} color={colors.primaryGradientEnd} />
            </Pressable>
          </LinearGradient>
        </Card>

        {/* ── Search Bar ── */}
        <TextInput
          placeholder="Search linked facilities..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leadingIcon={Search}
          trailingIcon={searchQuery ? X : undefined}
          onTrailingIconPress={() => setSearchQuery("")}
          tone="soft"
          containerStyle={{
            marginBottom: spacing.md,
            minHeight: 44,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
          }}
          style={{ fontSize: 16, paddingVertical: 10 }}
        />

        {/* ── Segmented Filter Control ── */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.fill,
            padding: 3,
            borderRadius: 12,
            borderCurve: "continuous",
            marginBottom: spacing.xxl,
          }}
        >
          <Pressable
            onPress={() => setActiveTab("all")}
            style={[
              {
                flex: 1,
                paddingVertical: 8,
                borderRadius: 9,
                borderCurve: "continuous",
                backgroundColor:
                  activeTab === "all" ? colors.surface : "transparent",
                alignItems: "center",
                justifyContent: "center",
              },
              activeTab === "all" && scheme !== "dark" ? shadow.xs : null,
            ]}
          >
            <Text
              style={[
                activeTab === "all" ? typography.label.md : typography.label.sm,
                { color: activeTab === "all" ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              All ({totalCount})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("hospitals")}
            style={[
              {
                flex: 1,
                paddingVertical: 8,
                borderRadius: 9,
                borderCurve: "continuous",
                backgroundColor:
                  activeTab === "hospitals" ? colors.surface : "transparent",
                alignItems: "center",
                justifyContent: "center",
              },
              activeTab === "hospitals" && scheme !== "dark" ? shadow.xs : null,
            ]}
          >
            <Text
              style={[
                activeTab === "hospitals" ? typography.label.md : typography.label.sm,
                { color: activeTab === "hospitals" ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              Hospitals ({myHospitals.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("clinics")}
            style={[
              {
                flex: 1,
                paddingVertical: 8,
                borderRadius: 9,
                borderCurve: "continuous",
                backgroundColor:
                  activeTab === "clinics" ? colors.surface : "transparent",
                alignItems: "center",
                justifyContent: "center",
              },
              activeTab === "clinics" && scheme !== "dark" ? shadow.xs : null,
            ]}
          >
            <Text
              style={[
                activeTab === "clinics" ? typography.label.md : typography.label.sm,
                { color: activeTab === "clinics" ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              Clinics ({myClinics.length})
            </Text>
          </Pressable>
        </View>

        {/* ── Hospitals Section ── */}
        {(activeTab === "all" || activeTab === "hospitals") && (
          <View style={{ marginBottom: spacing.xxl, gap: spacing.md }}>
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
          <View style={{ marginBottom: spacing.xxl, gap: spacing.md }}>
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
            padding: spacing.xl,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Info size={18} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, flex: 1 },
              ]}
            >
              How to link a new facility
            </Text>
          </View>

          <Text
            style={[
              typography.body.sm,
              {
                color: colors.textMuted,
                marginBottom: spacing.lg,
              },
            ]}
          >
            Connect any hospital, diagnostic center, or private clinic in 3
            simple steps:
          </Text>

          <View style={{ gap: spacing.lg, marginBottom: spacing.xl }}>
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
            title="Open My Health ID"
            icon={QrCode}
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
        gap: spacing.sm,
        paddingHorizontal: 4,
      }}
    >
      <Icon size={18} color={colors.primary} />
      <Text
        style={[
          typography.title.lg,
          {
            color: colors.text,
            flex: 1,
          },
        ]}
        numberOfLines={1}
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
  const iconBg = tone === "primary" ? colors.primarySoft : colors.infoSoft;
  const iconFg = tone === "primary" ? colors.primary : colors.info;

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
        style={[
          { padding: spacing.lg },
          isActive
            ? { borderWidth: 1.5, borderColor: colors.primary }
            : null,
        ]}
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
              width: 52,
              height: 52,
              borderRadius: 15,
              borderCurve: "continuous",
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
                  typography.title.md,
                  { color: colors.text, flexShrink: 1 },
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
                typography.body.sm,
                { color: colors.textMuted, marginBottom: spacing.sm },
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
              width: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={18} color={colors.textSubtle} />
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
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
        borderRadius: 18,
        borderCurve: "continuous",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          flex: 1,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            borderCurve: "continuous",
            backgroundColor: colors.fill,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={colors.textMuted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title.sm, { color: colors.text }]}>
            {title}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textMuted }]}
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
          height: 32,
          justifyContent: "center",
          paddingHorizontal: spacing.md,
          borderRadius: radius.full,
          backgroundColor: colors.primarySoft,
        }}
      >
        <Text
          style={[
            typography.label.sm,
            { color: colors.primary },
          ]}
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
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.md,
        }}
      >
        <Icon size={24} color={colors.primary} />
      </View>
      <Text
        style={[
          typography.title.md,
          { color: colors.text, marginBottom: 6, textAlign: "center" },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          typography.body.sm,
          {
            color: colors.textMuted,
            textAlign: "center",
            marginBottom: showCta ? spacing.lg : 0,
          },
        ]}
      >
        {body}
      </Text>
      {showCta && (
        <Button
          variant="secondary"
          size="sm"
          title="View My Health ID"
          fullWidth={false}
          onPress={onCtaPress}
        >
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
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={[
            typography.label.sm,
            { color: colors.onPrimary },
          ]}
        >
          {n}
        </Text>
      </View>
      <View style={{ flex: 1, paddingTop: 3 }}>
        <Text
          style={[
            typography.title.sm,
            { color: colors.text, marginBottom: 2 },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted },
          ]}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}
