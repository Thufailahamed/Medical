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
  TextInput as RNTextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Stethoscope,
  ChevronRight,
  QrCode,
  Search,
  X,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Layers,
  ScanLine,
  RefreshCcw,
} from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Button,
  Pressable,
  IconButton,
  IconTile,
  SectionHeader,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import {
  useActiveTenantStore,
  type TenantRef,
} from "@/stores/tenant-store";

type FilterTab = "all" | "hospitals" | "clinics";

export default function PatientTenants() {
  const { t } = useTranslation();
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
    return myHospitals.filter((h) => (h.name || "").toLowerCase().includes(query));
  }, [myHospitals, query]);

  const filteredClinics = useMemo(() => {
    if (!query) return myClinics;
    return myClinics.filter((c) => (c.name || "").toLowerCase().includes(query));
  }, [myClinics, query]);

  const totalCount = myHospitals.length + myClinics.length;
  // Search and filter only earn their space once the list is long enough to need them.
  const showTools = totalCount >= 4;
  const tab = showTools ? activeTab : "all";
  const isDark = scheme === "dark";
  const openHealthId = () => router.push("/(app)/health-id" as any);

  const surfaceCard = {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderCurve: "continuous" as const,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? colors.borderStrong : colors.hairline,
    ...(isDark ? null : shadow.xs),
  };

  const tabs: { key: FilterTab; label: string; count: number; icon: any }[] = [
    { key: "all", label: t("careNetwork.tabs.all", "All"), count: totalCount, icon: Layers },
    { key: "hospitals", label: t("careNetwork.tabs.hospitals", "Hospitals"), count: myHospitals.length, icon: Building2 },
    { key: "clinics", label: t("careNetwork.tabs.clinics", "Clinics"), count: myClinics.length, icon: Stethoscope },
  ];

  const breakdown = [
    myHospitals.length ? t("careNetwork.hospitalCount", { count: myHospitals.length }) : null,
    myClinics.length ? t("careNetwork.clinicCount", { count: myClinics.length }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={t("careNetwork.title", "Hospitals & Clinics")}
        subtitle={t("careNetwork.subtitle", "Your connected care network")}
        back={true}
        right={
          <IconButton
            icon={QrCode}
            variant="soft"
            onPress={openHealthId}
            accessibilityLabel={t("careNetwork.showQrA11y", "Show Health ID QR")}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xxxxl,
        }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Network hero (compact: counts live in the sections below) ── */}
        <LinearGradient
          colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 28,
            borderCurve: "continuous",
            padding: spacing.xl,
            overflow: "hidden",
            ...(isDark ? null : shadow.hero),
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 240,
              height: 240,
              borderRadius: 120,
              top: -120,
              right: -80,
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <IconTile icon={ShieldCheck} appearance="glass" size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.kicker, { color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }]}>
                {t("careNetwork.hero.kicker", "Connected care")}
              </Text>
              <Text style={[typography.title.lg, { color: "#FFFFFF", marginTop: 2 }]} numberOfLines={1}>
                {totalCount > 0
                  ? t("careNetwork.hero.linked", { count: totalCount })
                  : t("careNetwork.hero.none", "No facilities linked")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: totalCount > 0 ? "#4ADE80" : "rgba(255,255,255,0.55)",
                  }}
                />
                <Text style={[typography.label.sm, { color: "rgba(255,255,255,0.88)" }]} numberOfLines={1}>
                  {totalCount > 0
                    ? [t("careNetwork.hero.syncing", "Syncing"), breakdown].filter(Boolean).join(" · ")
                    : t("careNetwork.hero.notLinked", "Not linked")}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[typography.body.sm, { color: "rgba(255,255,255,0.84)", marginTop: spacing.md }]}>
            {t("careNetwork.hero.body", "Records, lab results and prescriptions sync to your timeline automatically.")}
          </Text>

          <Pressable
            onPress={openHealthId}
            accessibilityRole="button"
            haptic="light"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 48,
              marginTop: spacing.lg,
              borderRadius: radius.full,
              backgroundColor: "#FFFFFF",
            }}
          >
            <QrCode size={17} color={colors.primary} strokeWidth={2.4} />
            <Text style={[typography.label.lg, { color: colors.primary }]}>
              {t("careNetwork.hero.cta", "Link a new facility")}
            </Text>
          </Pressable>
        </LinearGradient>

        {showTools ? (
          <>
            {/* ── Search ── */}
            <View
              style={{
                ...surfaceCard,
                borderRadius: 16,
                flexDirection: "row",
                alignItems: "center",
                height: 48,
                paddingHorizontal: 14,
                marginTop: spacing.xl,
              }}
            >
              <Search size={18} color={colors.textSubtle} strokeWidth={2.2} />
              <RNTextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("careNetwork.searchPlaceholder", "Search hospitals and clinics")}
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={{
                  flex: 1,
                  height: "100%",
                  paddingHorizontal: spacing.sm,
                  fontSize: 15,
                  fontFamily: typography.body.md.fontFamily,
                  color: colors.text,
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  hitSlop={8}
                  accessibilityLabel={t("careNetwork.clearSearch", "Clear search")}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: colors.textSubtle,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={12} color={colors.surface} strokeWidth={3} />
                </Pressable>
              )}
            </View>

            {/* ── Segmented filter ── */}
            <View
              style={{
                flexDirection: "row",
                marginTop: spacing.md,
                padding: 4,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: colors.fill,
              }}
            >
              {tabs.map((tb) => {
                const active = activeTab === tb.key;
                const Icon = tb.icon;
                return (
                  <Pressable
                    key={tb.key}
                    onPress={() => setActiveTab(tb.key)}
                    hapticOnPress
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      {
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        height: 38,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: active ? colors.surface : "transparent",
                      },
                      active && !isDark ? shadow.sm : null,
                    ]}
                  >
                    <Icon size={14} color={active ? colors.primary : colors.textSubtle} strokeWidth={2.3} />
                    <Text
                      style={[typography.label.md, { color: active ? colors.text : colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {tb.label}
                    </Text>
                    <Text style={[typography.label.xs, { color: active ? colors.primary : colors.textSubtle }]}>
                      {tb.count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* ── Hospitals ── */}
        {(tab === "all" || tab === "hospitals") && (
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              kicker={t("careNetwork.hospitals.kicker", "Registered at")}
              title={t("careNetwork.hospitals.title", "Hospitals")}
              count={filteredHospitals.length || undefined}
              style={{ paddingBottom: 0 }}
            />
            {filteredHospitals.length === 0 ? (
              tab === "all" && !query ? (
                <CompactEmptyStrip
                  icon={Building2}
                  title={t("careNetwork.hospitals.emptyTitle", "No hospitals linked yet")}
                  subtitle={t("careNetwork.hospitals.emptyHint", "Show your Health ID at admission to link")}
                  cta={t("careNetwork.showQr", "Show QR")}
                  onPress={openHealthId}
                />
              ) : (
                <FullEmptyCard
                  icon={Building2}
                  title={
                    query
                      ? t("careNetwork.hospitals.noMatch", "No matching hospitals")
                      : t("careNetwork.hospitals.emptyTitle", "No hospitals linked yet")
                  }
                  body={
                    query
                      ? t("careNetwork.noMatchBody", { query: searchQuery.trim() })
                      : t("careNetwork.hospitals.emptyBody")
                  }
                  showCta={!query}
                  cta={t("careNetwork.viewHealthId", "View my Health ID")}
                  onCtaPress={openHealthId}
                />
              )
            ) : (
              filteredHospitals.map((h: TenantRef) => (
                <FacilityCard
                  key={`h-${h.id}`}
                  facility={h}
                  icon={Building2}
                  tone="primary"
                  typeSubtitle={t("careNetwork.hospitals.type", "Hospital · Inpatient care")}
                  isActive={h.id === activeHospitalId}
                  onPress={() => go("hospital", h.id)}
                />
              ))
            )}
          </View>
        )}

        {/* ── Clinics ── */}
        {(tab === "all" || tab === "clinics") && (
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              kicker={t("careNetwork.clinics.kicker", "Outpatient")}
              title={t("careNetwork.clinics.title", "Clinics")}
              count={filteredClinics.length || undefined}
              style={{ paddingBottom: 0 }}
            />
            {filteredClinics.length === 0 ? (
              tab === "all" && !query ? (
                <CompactEmptyStrip
                  icon={Stethoscope}
                  title={t("careNetwork.clinics.emptyTitle", "No clinics linked yet")}
                  subtitle={t("careNetwork.clinics.emptyHint", "Share your Health ID at your next visit")}
                  cta={t("careNetwork.showQr", "Show QR")}
                  onPress={openHealthId}
                />
              ) : (
                <FullEmptyCard
                  icon={Stethoscope}
                  title={
                    query
                      ? t("careNetwork.clinics.noMatch", "No matching clinics")
                      : t("careNetwork.clinics.emptyTitle", "No clinics linked yet")
                  }
                  body={
                    query
                      ? t("careNetwork.noMatchBody", { query: searchQuery.trim() })
                      : t("careNetwork.clinics.emptyBody")
                  }
                  showCta={!query}
                  cta={t("careNetwork.viewHealthId", "View my Health ID")}
                  onCtaPress={openHealthId}
                />
              )
            ) : (
              filteredClinics.map((c: TenantRef) => (
                <FacilityCard
                  key={`c-${c.id}`}
                  facility={c}
                  icon={Stethoscope}
                  tone="info"
                  typeSubtitle={t("careNetwork.clinics.type", "Clinic · Outpatient care")}
                  isActive={c.id === activeClinicId}
                  onPress={() => go("clinic", c.id)}
                />
              ))
            )}
          </View>
        )}

        {/* ── How to link ── */}
        <SectionHeader
          kicker={t("careNetwork.guide.kicker", "Guide")}
          title={t("careNetwork.guide.title", "How linking works")}
        />
        <View style={{ ...surfaceCard, padding: spacing.lg }}>
          {[
            { icon: QrCode, title: t("careNetwork.guide.s1Title"), body: t("careNetwork.guide.s1Body") },
            { icon: ScanLine, title: t("careNetwork.guide.s2Title"), body: t("careNetwork.guide.s2Body") },
            { icon: RefreshCcw, title: t("careNetwork.guide.s3Title"), body: t("careNetwork.guide.s3Body") },
          ].map((s, i, arr) => (
            <GuideStep
              key={i}
              n={i + 1}
              icon={s.icon}
              title={s.title}
              body={s.body}
              stepLabel={t("careNetwork.guide.step", { n: i + 1 })}
              last={i === arr.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Linked facility row card. */
function FacilityCard({
  facility,
  icon,
  tone,
  typeSubtitle,
  isActive,
  onPress,
}: {
  facility: TenantRef;
  icon: any;
  tone: "primary" | "info";
  typeSubtitle: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";

  return (
    <Pressable
      onPress={onPress}
      pressedScale={0.985}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${facility.name}. ${typeSubtitle}`}
      wrapperStyle={isDark ? null : shadow.sm}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: 22,
        borderCurve: "continuous",
        borderWidth: isActive ? 1.5 : StyleSheet.hairlineWidth,
        borderColor: isActive ? colors.primary : isDark ? colors.borderStrong : colors.hairline,
      }}
    >
      <View>
        <IconTile icon={icon} tone={tone} appearance={isActive ? "solid" : "soft"} size={48} />
        {/* Status dot on the tile replaces a separate "Connected" pill. */}
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.success,
            borderWidth: 2.5,
            borderColor: colors.surface,
          }}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={2}>
          {facility.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
          {typeSubtitle}
        </Text>
        {isActive ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <CheckCircle2 size={12} color={colors.primary} strokeWidth={2.6} />
            <Text style={[typography.label.xs, { color: colors.primary, letterSpacing: 0 }]}>
              {t("careNetwork.activeNow", "Currently selected")}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.well,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

/** Compact helper strip shown in 'All' view when a section has 0 items. */
function CompactEmptyStrip({
  icon,
  title,
  subtitle,
  cta,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  cta: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: 22,
        borderCurve: "continuous",
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: colors.separator,
      }}
    >
      <IconTile icon={icon} tone="neutral" size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        haptic="light"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          height: 32,
          paddingHorizontal: spacing.md,
          borderRadius: radius.full,
          backgroundColor: colors.primarySoft,
        }}
      >
        <QrCode size={13} color={colors.primary} strokeWidth={2.4} />
        <Text style={[typography.label.sm, { color: colors.primary }]}>{cta}</Text>
      </Pressable>
    </View>
  );
}

/** Full empty card used in dedicated tabs or search empty states. */
function FullEmptyCard({
  icon,
  title,
  body,
  showCta,
  cta,
  onCtaPress,
}: {
  icon: any;
  title: string;
  body: string;
  showCta: boolean;
  cta: string;
  onCtaPress: () => void;
}) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";

  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: 22,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.hairline,
        ...(isDark ? null : shadow.xs),
      }}
    >
      <IconTile icon={icon} tone="primary" size={56} />
      <Text style={[typography.title.md, { color: colors.text, marginTop: spacing.md, textAlign: "center" }]}>
        {title}
      </Text>
      <Text
        style={[
          typography.body.sm,
          { color: colors.textMuted, textAlign: "center", marginTop: 6, marginBottom: showCta ? spacing.lg : 0 },
        ]}
      >
        {body}
      </Text>
      {showCta && <Button variant="secondary" size="sm" title={cta} icon={QrCode} onPress={onCtaPress} />}
    </View>
  );
}

/** Numbered step on a vertical rail. */
function GuideStep({
  n,
  icon: Icon,
  title,
  body,
  stepLabel,
  last,
}: {
  n: number;
  icon: any;
  title: string;
  body: string;
  stepLabel: string;
  last?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <View style={{ alignItems: "center", width: 36 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={17} color={colors.primary} strokeWidth={2.3} />
        </View>
        {!last ? (
          <View style={{ flex: 1, width: 2, minHeight: 14, marginVertical: 4, borderRadius: 1, backgroundColor: colors.separator }} />
        ) : null}
      </View>
      <View style={{ flex: 1, paddingTop: 2, paddingBottom: last ? 0 : spacing.lg }}>
        <Text style={[typography.overline, { color: colors.primary, textTransform: "uppercase" }]}>{stepLabel}</Text>
        <Text style={[typography.title.sm, { color: colors.text, marginTop: 2 }]}>{title}</Text>
        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>{body}</Text>
      </View>
    </View>
  );
}
