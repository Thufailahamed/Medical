// @ts-nocheck

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";
import {
  Stethoscope,
  Pill,
  FlaskConical,
  CalendarClock,
  CalendarCheck,
  Sparkles,
  User,
  Droplet,
  Cake,
  Phone,
  Activity,
  Users,
  Syringe,
  ShieldCheck,
  MessageSquare,
  ListChecks,
  Plus,
  ClipboardList,
} from "lucide-react-native";
import {
  usePatientSummary,
  usePatientOverview,
  usePatientSnapshot,
  usePreVisitSummary,
  useUpcomingAppointmentsForPatient,
  useStartConversation,
  type VitalsPoint,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Pill as PillCmp,
  EmptyState,
  ErrorState,
  Skeleton,
  SectionHeader,
  ListItem,
  Divider,
  Button,
} from "@/components/ui";
import { LatestStatusCard, AlertsCard } from "@/components/vitals";
import { HealthSnapshotCard } from "@/components/records";

type Tab = "summary" | "records" | "meds" | "labs" | "vitals";

export default function DoctorPatientDetail() {
  const router = useRouter();
  const { spacing, colors, typography, shadow } = useTheme();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("summary");
  const statusText = (value?: string) =>
    value ? t(`status.${value}`, { defaultValue: value }) : value;

  const { data, isLoading, isError, refetch } = usePatientSummary(id || null);
  const { data: overview, isLoading: overviewLoading } = usePatientOverview(id || null);
  const startConversation = useStartConversation();
  // Tier 1 records: Patient Health Snapshot (doctor view).
  const { data: snapshot, isLoading: snapshotLoading } = usePatientSnapshot(id || null);
  // Tier 1 records PR3: pre-visit summary. Pulls the next upcoming
  // confirmed appointment for this patient and lazily fetches the AI
  // briefing. Hooks are no-ops until the patient has a confirmed slot.
  const { data: upcoming } = useUpcomingAppointmentsForPatient(id || null);
  const nextAppt = upcoming?.items?.[0];
  const { data: preVisit } = usePreVisitSummary(nextAppt?.appointmentId ?? null);

  if (!id) {
    return (
      <Screen padded>
        <EmptyState
          icon={User}
          title={t("doctorPatientDetail.noPatientTitle")}
          message={t("doctorPatientDetail.noPatientBody")}
        />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader back onBack={() => router.back()} title={t("doctorPatientDetail.loadingTitle")} />
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load patient")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader back onBack={() => router.back()} title={t("doctorPatientDetail.loadingTitle")} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={120} radius={24} />
          <Skeleton height={80} radius={20} />
          <Skeleton height={200} radius={20} />
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen padded>
        <EmptyState
          icon={User}
          title={t("doctorPatientDetail.notFoundTitle")}
          message={t("doctorPatientDetail.notFoundBody")}
        />
      </Screen>
    );
  }

  const patient = data.patient;
  const user = data.user;

  const allergies = (() => {
    try {
      const arr = patient.allergies ? JSON.parse(patient.allergies) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  })();
  const conditions = (() => {
    try {
      const arr = patient.medicalConditions
        ? JSON.parse(patient.medicalConditions)
        : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  })();

  const TABS: Tab[] = ["summary", "records", "meds", "labs", "vitals"];
  const patientActions = [
    {
      key: "visit",
      title: t("doctorPatientDetail.actionCompleteVisit"),
      icon: Sparkles,
      primary: true,
      onPress: () =>
        router.push({
          pathname: "/(doctor)/visit-summary",
          params: { patientId: id },
        }),
    },
    {
      key: "message",
      title: t("doctorPatientDetail.actionMessage"),
      icon: MessageSquare,
      loading: startConversation.isPending,
      onPress: async () => {
        try {
          const res = await startConversation.mutateAsync(id);
          const convId = res?.conversation?.id;
          if (convId) router.push(`/(doctor)/inbox/${convId}` as any);
        } catch {
          // no-op: React Query surfaces the error state
        }
      },
    },
    {
      key: "note",
      title: t("doctorPatientDetail.actionClinicalNote"),
      icon: Stethoscope,
      onPress: () =>
        router.push({
          pathname: "/(doctor)/clinical-note",
          params: { patientId: id },
        }),
    },
    {
      key: "prescribe",
      title: t("doctorPatientDetail.actionPrescribe"),
      icon: Pill,
      onPress: () =>
        router.push({
          pathname: "/(doctor)/prescription",
          params: { patientId: id },
        }),
    },
    {
      key: "labs",
      title: t("doctorPatientDetail.actionOrderLabs"),
      icon: FlaskConical,
      onPress: () =>
        router.push({
          pathname: "/(doctor)/lab-order",
          params: { patientId: id },
        }),
    },
    {
      key: "follow-up",
      title: t("doctorPatientDetail.actionFollowUp"),
      icon: CalendarClock,
      onPress: () =>
        router.push({
          pathname: "/(doctor)/follow-up-new",
          params: { patientId: id },
        }),
    },
  ];

  return (
    <Screen
      padded={false}
      edges={["top"]}
      bottomInset
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={user?.name || t("doctorPatientDetail.fallbackTitle")}
        style={{ backgroundColor: "transparent" }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        {/* Patient identity card */}
        <Card padded={false}>
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 4 }}
          />
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Avatar
                  name={user?.name}
                  size="lg"
                  tone="primary"
                  ring
                  source={user?.photo ? { uri: user.photo } : undefined}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={[typography.display.sm, { color: colors.text }]}
                >
                  {user?.name || t("doctorPatientDetail.fallbackTitle")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 4 },
                  ]}
                >
                  {user?.nic || user?.phone || "—"}
                </Text>
                {nextAppt ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      marginTop: spacing.sm,
                    }}
                  >
                    <CalendarClock size={13} color={colors.primary} />
                    <Text
                      numberOfLines={1}
                      style={[
                        typography.label.sm,
                        { color: colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {t("overview.nextVisit")} {nextAppt.date} {nextAppt.time}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <PatientMetaTile icon={Droplet} value={patient.bloodGroup} tone="danger" />
              <PatientMetaTile icon={User} value={patient.gender} tone="primary" />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <PatientMetaTile icon={Cake} value={patient.dateOfBirth} tone="primary" />
              <PatientMetaTile icon={Phone} value={user?.phone} tone="primary" />
            </View>

            {(allergies.length > 0 || conditions.length > 0) && (
              <View
                style={{
                  gap: spacing.xs,
                  padding: spacing.md,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: allergies.length > 0 ? colors.danger : colors.border,
                  backgroundColor: allergies.length > 0 ? colors.dangerSoft : colors.surfaceMuted,
                }}
              >
                {allergies.length > 0 ? (
                  <Text style={[typography.label.md, { color: colors.danger }]}>
                    {t("doctorPatientDetail.allergies", { list: allergies.join(", ") })}
                  </Text>
                ) : null}
                {conditions.length > 0 ? (
                  <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                    {t("doctorPatientDetail.conditions", { list: conditions.join(", ") })}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </Card>

        {/* Quick actions */}
        <Card padded={false}>
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, paddingHorizontal: spacing.xs },
              ]}
            >
              {t("home.sectionQuickActions")}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {patientActions.slice(0, 3).map((action) => (
                <PatientActionTile key={action.key} {...action} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {patientActions.slice(3).map((action) => (
                <PatientActionTile key={action.key} {...action} />
              ))}
            </View>
          </View>
        </Card>

        {/* Record sections */}
        <View
          style={{
            flexDirection: "row",
            gap: 3,
            backgroundColor: colors.fill,
            padding: 4,
            borderRadius: 16,
            borderCurve: "continuous",
          }}
        >
          {TABS.map((tabKey) => {
            const active = tab === tabKey;
            return (
              <Pressable
                key={tabKey}
                onPress={() => setTab(tabKey)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 36,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: active
                    ? colors.surface
                    : pressed
                      ? colors.surfaceMuted
                      : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(active ? shadow.xs : shadow.none),
                })}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[
                    active ? typography.label.md : typography.body.sm,
                    {
                      color: active ? colors.primary : colors.textMuted,
                      textTransform: "capitalize",
                    },
                  ]}
                >
                  {t(`doctorPatientDetail.tab${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "summary" && (
          <View style={{ gap: spacing.md }}>
            {/* ─── -1. Tier 1 records PR3: pre-visit summary for the
                next confirmed appointment, if any. ─── */}
            {preVisit?.summary ? (
              <OverviewSection
                title={
                  nextAppt
                    ? t("doctorPatientDetail.preVisitWithDate", {
                        date: nextAppt.date,
                        time: nextAppt.time,
                      })
                    : t("doctorPatientDetail.preVisitSummary")
                }
                icon={<ClipboardList size={14} color={colors.brand} />}
              >
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.text, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
                  ]}
                >
                  {preVisit.summary}
                </Text>
                {preVisit.snapshot?.redBanner?.length > 0 ? (
                  <View style={{ padding: spacing.md, borderRadius: 14, borderCurve: "continuous", backgroundColor: colors.dangerSoft, marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
                    <Text style={[typography.label.sm, { color: colors.danger }]}>
                      Severe allergies: {preVisit.snapshot.redBanner
                        .map((a: any) => a.substance)
                        .join(", ")}
                    </Text>
                  </View>
                ) : null}
              </OverviewSection>
            ) : null}

            {/* ─── 0. Tier 1 records: snapshot at-a-glance ─── */}
            {snapshot && (snapshot.redBanner.length > 0 || (snapshot.drugAllergyWarnings?.length ?? 0) > 0 || snapshot.chronicConditions.length > 0 || snapshot.activeMedicines.length > 0 || Object.values(snapshot.recentVitals).some((a: any) => a?.length > 0)) && (
              <HealthSnapshotCard
                snapshot={snapshot as any}
                loading={snapshotLoading}
                compact
                onJumpToTrends={() => router.push(`/(doctor)/patient-detail/vitals?id=${id}`)}
                onJumpToAllergies={() => setTab("summary")}
              />
            )}
            {/* ─── 1. Active medicines ─── */}
            <OverviewSection
              title={t("overview.section.activeMeds")}
              icon={<Pill size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.activeMedicines?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.activeMeds")}
            >
              {(overview?.activeMedicines ?? []).slice(0, 5).map((m: any, idx: number) => (
                <View key={m.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    icon={Pill}
                    iconTone="accent"
                    title={m.name}
                    subtitle={[m.dosage, m.frequency].filter(Boolean).join(" · ") + (m.instructions ? ` · ${m.instructions}` : "")}
                    rightSlot={
                      m.active ? (
                        <PillCmp label={t("overview.medicineActive")} tone="success" size="sm" />
                      ) : undefined
                    }
                  />
                </View>
              ))}
            </OverviewSection>

            {/* ─── 2. Vitals ─── */}
            <OverviewSection
              title={t("overview.section.vitals")}
              icon={<Activity size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.vitals?.latest?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.vitals")}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingBottom: spacing.md,
                }}
              >
                {(overview?.vitals?.latest ?? []).slice(0, 8).map((l: any) => (
                  <View key={l.type} style={{ flexBasis: "48%", flexGrow: 1 }}>
                    <DoctorLatestVitalTile
                      latest={l}
                      series={(overview.vitals.series?.[l.type] ?? []).map(
                        (p) => ({
                          t: p.recordedAt,
                          value: p.value,
                          secondary: null,
                          id: p.recordedAt,
                          unit: l.unit ?? l.latest?.unit ?? null,
                        })
                      )}
                    />
                  </View>
                ))}
              </View>
              {overview?.vitals?.alerts?.length ? (
                <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                  <AlertsCard alerts={overview.vitals.alerts} title={t("overview.section.alerts")} />
                </View>
              ) : null}
            </OverviewSection>

            {/* ─── 3. Recent prescriptions ─── */}
            <OverviewSection
              title={t("overview.section.prescriptions")}
              icon={<Stethoscope size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.prescriptions?.recent?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.prescriptions")}
            >
              {(overview?.prescriptions?.recent ?? []).map((r: any, idx: number) => (
                <View key={r.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    title={r.title || r.diagnosis || t("prescription.untitled")}
                    subtitle={r.diagnosis ?? undefined}
                    pill={{ label: statusText(r.status), tone: statusToTone(r.status) }}
                    onPress={() =>
                      router.push({
                        pathname: "/(doctor)/prescription-detail",
                        params: { id: r.id },
                      } as any)
                    }
                  />
                </View>
              ))}
            </OverviewSection>

            {/* ─── 4. Lab orders + reports ─── */}
            <OverviewSection
              title={t("overview.section.labOrders")}
              icon={<FlaskConical size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.labOrders?.recent?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.labOrders")}
            >
              {(overview?.labOrders?.recent ?? []).slice(0, 4).map((o: any, idx: number) => (
                <View key={o.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    icon={FlaskConical}
                    iconTone="info"
                    title={(o.tests || []).join(", ") || t("labs.untitled")}
                    subtitle={o.notes || o.priority}
                    pill={{ label: statusText(o.status), tone: statusToTone(o.status) }}
                  />
                </View>
              ))}
              {overview?.labReports?.recent?.length ? (
                <View style={{ paddingTop: spacing.sm }}>
                  <Text
                    style={[
                      typography.overline,
                      { color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
                    ]}
                  >
                    {t("overview.section.labReports")}
                  </Text>
                  {overview.labReports.recent.slice(0, 3).map((r: any, idx: number) => (
                    <View key={r.id}>
                      <Divider />
                      <ListItem
                    bordered={false}
                        title={r.reportType || "—"}
                        subtitle={fmtDate(new Date(r.createdAt), locale)}
                        pill={{ label: statusText(r.status), tone: "neutral" }}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </OverviewSection>

            {/* ─── 5. Clinical notes ─── */}
            <OverviewSection
              title={t("overview.section.clinicalNotes")}
              icon={<Stethoscope size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.clinicalNotes?.recent?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.clinicalNotes")}
            >
              {(overview?.clinicalNotes?.recent ?? []).map((n: any, idx: number) => (
                <View key={n.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    title={n.title || t("prescription.untitled")}
                    subtitle={n.diagnosis ? `Dx: ${n.diagnosis}` : undefined}
                    pill={{ label: fmtDate(new Date(n.createdAt), locale), tone: "neutral" }}
                  />
                </View>
              ))}
            </OverviewSection>

            {/* ─── 6. Upcoming follow-ups ─── */}
            <OverviewSection
              title={t("overview.section.followUps")}
              icon={<CalendarClock size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.followUps?.upcoming?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.followUps")}
              rightSlot={
                overview?.followUps?.missed ? (
                  <PillCmp
                    label={`${t("overview.dueOverdue")} · ${overview.followUps.missed}`}
                    tone="danger"
                    size="sm"
                  />
                ) : undefined
              }
            >
              {(overview?.followUps?.upcoming ?? []).map((f: any, idx: number) => (
                <View key={f.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    icon={CalendarCheck}
                    iconTone="info"
                    title={f.title}
                    subtitle={f.notes}
                    pill={{ label: fmtDate(new Date(f.followUpDate), locale), tone: "brand" }}
                  />
                </View>
              ))}
            </OverviewSection>

            {/* ─── 7. Recent visits ─── */}
            <OverviewSection
              title={t("overview.section.visits")}
              icon={<CalendarCheck size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.visits?.recent?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.visits")}
              rightSlot={
                overview?.visits?.nextScheduled ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <CalendarClock size={12} color={colors.brand} />
                    <Text style={[typography.label.sm, { color: colors.brand, fontWeight: "700" }]}>
                      {t("overview.nextVisit")} {fmtDate(new Date(overview.visits.nextScheduled.date), locale)}
                    </Text>
                  </View>
                ) : undefined
              }
            >
              {(overview?.visits?.recent ?? []).slice(0, 5).map((v: any, idx: number) => (
                <View key={`${v.kind}-${v.id}`}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    icon={CalendarCheck}
                    iconTone="info"
                    title={`${t(
                      v.kind === "walkin"
                        ? "doctorPatientDetail.visitKindWalkin"
                        : "doctorPatientDetail.visitKindAppointment"
                    )}${v.reason ? " · " + v.reason : ""}`}
                    subtitle={`${fmtDate(new Date(v.date), locale)}${v.time ? " " + v.time : ""}`}
                    pill={{ label: statusText(v.status), tone: statusToTone(v.status) }}
                  />
                </View>
              ))}
            </OverviewSection>

            {/* ─── 8. Family history ─── */}
            <OverviewSection
              title={t("overview.section.familyHistory")}
              icon={<Users size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.familyHistory?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.familyHistory")}
            >
              {(overview?.familyHistory ?? []).map((f: any, idx: number) => (
                <View
                  key={f.id}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    gap: spacing.xs,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={[typography.body.sm, { color: colors.text, fontWeight: "700" }]}>
                      {f.name}
                    </Text>
                    <PillCmp label={f.relationship} tone="neutral" size="sm" />
                    {f.isDeceased ? (
                      <PillCmp label={t("doctorPatientDetail.deceased", { defaultValue: "deceased" })} tone="warning" size="sm" />
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                    {(f.conditions ?? []).map((c: string, i: number) => (
                      <PillCmp key={i} label={c} tone="warning" size="sm" />
                    ))}
                    {f.isDeceased && f.causeOfDeath ? (
                      <Text style={[typography.body.xs, { color: colors.textMuted }]}>
                        {t("overview.familyConditions")}: {f.causeOfDeath}
                      </Text>
                    ) : null}
                  </View>
                  {idx < (overview?.familyHistory?.length ?? 0) - 1 ? <Divider /> : null}
                </View>
              ))}
            </OverviewSection>

            {/* ─── 9. Vaccinations ─── */}
            <OverviewSection
              title={t("overview.section.vaccinations")}
              icon={<Syringe size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={(overview?.vaccinations?.length ?? 0) === 0}
              emptyTitle={t("overview.empty.vaccinations")}
            >
              {(overview?.vaccinations ?? []).slice(0, 6).map((v: any, idx: number) => (
                <View key={v.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    icon={Syringe}
                    iconTone="info"
                    title={v.vaccine}
                    subtitle={`${v.shortName ? v.shortName + " · " : ""}dose ${v.doseNumber}`}
                    pill={
                      v.nextDueAt
                        ? { label: fmtDate(new Date(v.nextDueAt), locale), tone: "brand" }
                        : v.administeredAt
                        ? { label: "given", tone: "success" }
                        : undefined
                    }
                  />
                </View>
              ))}
            </OverviewSection>

            {/* ─── 10. Insurance ─── */}
            <OverviewSection
              title={t("overview.section.insurance")}
              icon={<ShieldCheck size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={!overview?.insurance}
              emptyTitle={t("overview.insuranceMissing")}
            >
              {overview?.insurance ? (
                <View
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingBottom: spacing.lg,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]}>
                      {overview.insurance.provider}
                    </Text>
                    <Text style={[typography.body.xs, { color: colors.textMuted }]}>
                      #{overview.insurance.policyNumber}
                      {overview.insurance.coverageType ? " · " + overview.insurance.coverageType : ""}
                    </Text>
                  </View>
                  {overview.insurance.validUntil ? (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[typography.overline, { color: colors.textMuted }]}>
                        {t("doctorPatientDetail.validUntil", { defaultValue: "valid until" })}
                      </Text>
                      <Text style={[typography.body.sm, { color: colors.text, fontWeight: "600" }]}>
                        {fmtDate(new Date(overview.insurance.validUntil), locale)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </OverviewSection>

            {/* ─── 11. Messages preview ─── */}
            <OverviewSection
              title={t("overview.section.messages")}
              icon={<MessageSquare size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={!overview?.messages?.lastConversation}
              emptyTitle={t("overview.noMessages")}
              rightSlot={
                overview?.messages?.unreadCount ? (
                  <PillCmp
                    label={`${overview.messages.unreadCount} ${t("overview.unread")}`}
                    tone="danger"
                    size="sm"
                  />
                ) : undefined
              }
            >
              {overview?.messages?.lastConversation ? (
                <View
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingBottom: spacing.lg,
                    gap: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: spacing.sm,
                    }}
                  >
                    <Text
                      style={[typography.body.sm, { color: colors.text, flex: 1 }]}
                      numberOfLines={1}
                    >
                      {overview.messages.lastConversation.lastMessagePreview || "—"}
                    </Text>
                    <Text style={[typography.body.xs, { color: colors.textMuted }]}>
                      {fmtDate(new Date(overview.messages.lastConversation.lastMessageAt), locale)}
                    </Text>
                  </View>
                  <Button
                    title={t("overview.action.openInbox")}
                    variant="ghost"
                    size="sm"
                    onPress={() => router.push({ pathname: "/(doctor)/inbox" })}
                  />
                </View>
              ) : null}
            </OverviewSection>

            {/* ─── 12. Records by type ─── */}
            <OverviewSection
              title={t("overview.section.recordsSummary")}
              icon={<ListChecks size={14} color={colors.brand} />}
              loading={overviewLoading}
              isEmpty={Object.keys(overview?.records?.counts?.byType ?? {}).length === 0}
              emptyTitle={t("overview.empty.recordsSummary")}
              rightSlot={
                overview?.records?.counts?.total ? (
                  <PillCmp
                    label={String(overview.records.counts.total)}
                    tone="primary"
                    size="sm"
                  />
                ) : undefined
              }
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingBottom: spacing.md,
                }}
              >
                {Object.entries(overview?.records?.counts?.byType ?? {})
                  .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))
                  .map(([type, count]) => (
                    <View
                      key={type}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.xs,
                        paddingLeft: spacing.md,
                        paddingRight: spacing.xs,
                        paddingVertical: spacing.xs,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: colors.surfaceMuted,
                      }}
                    >
                      <Text style={[typography.label.sm, { color: colors.text, textTransform: "capitalize" }]}>
                        {type.replace(/_/g, " ")}
                      </Text>
                      <PillCmp label={String(count)} tone="primary" size="sm" />
                    </View>
                  ))}
              </View>
            </OverviewSection>
          </View>
        )}

        {tab === "records" && (
          <Card>
            <SectionHeader title={t("doctorPatientDetail.recordsHeading")} />
            {data.records && data.records.length > 0 ? (
              data.records.slice(0, 30).map((r: any, idx: number) => (
                <View key={r.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    title={r.title}
                    subtitle={`${r.recordType} · ${r.date}`}
                    pill={{ label: r.recordType, tone: "primary" }}
                  />
                </View>
              ))
            ) : (
              <EmptyState icon={Stethoscope} title={t("doctorPatientDetail.noRecords")} />
            )}
          </Card>
        )}

        {tab === "meds" && (
          <Card>
            <SectionHeader title={t("doctorPatientDetail.activeMedsHeading")} />
            {data.activeMedicines && data.activeMedicines.length > 0 ? (
              data.activeMedicines.map((m: any, idx: number) => (
                <View key={m.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    icon={Pill}
                    iconTone="accent"
                    title={m.name}
                    subtitle={`${m.dosage} · ${m.frequency || ""} ${m.timing ? "· " + m.timing : ""}`}
                  />
                </View>
              ))
            ) : (
              <EmptyState icon={Pill} title={t("doctorPatientDetail.noActiveMeds")} />
            )}
          </Card>
        )}

        {tab === "labs" && (
          <Card>
            <SectionHeader title={t("doctorPatientDetail.labReportsHeading")} />
            {data.labReports && data.labReports.length > 0 ? (
              data.labReports.slice(0, 20).map((l: any, idx: number) => (
                <View key={l.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    bordered={false}
                    icon={FlaskConical}
                    iconTone="info"
                    title={l.reportType}
                    subtitle={fmtDate(new Date(l.createdAt), locale)}
                    pill={{ label: statusText(l.status), tone: "neutral" }}
                  />
                </View>
              ))
            ) : (
              <EmptyState icon={FlaskConical} title={t("doctorPatientDetail.noLabReports")} />
            )}
          </Card>
        )}

        {tab === "vitals" && (
          <View style={{ gap: spacing.md }}>
            {data.vitalsAlerts && data.vitalsAlerts.count > 0 ? (
              <AlertsCard alerts={data.vitalsAlerts.items ?? []} title={t("doctorPatientDetail.alertsHeading")} />
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={[typography.title.lg, { color: colors.text }]}>
                {t("doctorPatientDetail.vitalsHeading")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                {data.vitalsAlerts && data.vitalsAlerts.count > 0 ? (
                  <PillCmp
                    size="sm"
                    tone="danger"
                    label={t("doctorPatientDetail.abnormalCount", { count: data.vitalsAlerts.count })}
                  />
                ) : null}
                <Button
                  title={t("doctorPatientDetail.actionRecordVital")}
                  icon={Plus}
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  onPress={() =>
                    router.push({
                      pathname: "/(doctor)/vital-record",
                      params: { patientId: id },
                    })
                  }
                />
              </View>
            </View>

            {data.latestVitals && data.latestVitals.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {data.latestVitals.map((l: any) => (
                  <View key={l.type} style={{ flexBasis: "48%", flexGrow: 1 }}>
                    <DoctorLatestVitalTile
                      latest={l}
                      series={(data.vitals ?? [])
                        .filter((v: any) => v.type === l.type)
                        .sort(
                          (a: any, b: any) =>
                            +new Date(b.recordedAt) - +new Date(a.recordedAt)
                        )
                        .map((v: any) => ({
                          t: v.recordedAt,
                          value: v.value,
                          secondary: null,
                          id: `${l.type}-${v.recordedAt}`,
                          unit: l.unit ?? null,
                        }))}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon={Stethoscope} title={t("doctorPatientDetail.noVitals")} />
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function PatientMetaTile({
  icon: Icon,
  value,
  tone = "primary",
}: {
  icon: any;
  value?: string | null;
  tone?: "primary" | "danger";
}) {
  const { colors, spacing, typography } = useTheme();
  const accent = tone === "danger" ? colors.danger : colors.primary;
  const soft = tone === "danger" ? colors.dangerSoft : colors.primarySoft;

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: 14,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: soft,
        }}
      >
        <Icon size={17} color={accent} strokeWidth={2.3} />
      </View>
      <Text
        numberOfLines={1}
        style={[
          typography.label.md,
          { color: value ? colors.text : colors.textSubtle, flex: 1 },
        ]}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

function PatientActionTile({
  title,
  icon: Icon,
  onPress,
  primary,
  loading,
}: {
  title: string;
  icon: any;
  onPress: () => void;
  primary?: boolean;
  loading?: boolean;
}) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const fg = primary ? colors.onPrimary : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading }}
      accessibilityLabel={title}
      style={({ pressed }) => [
        {
          flex: 1,
          minWidth: 0,
          minHeight: 82,
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.sm,
          borderRadius: 16,
          borderCurve: "continuous",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          backgroundColor: primary ? colors.primary : colors.surface,
          borderWidth: primary ? 0 : 1,
          borderColor: colors.border,
          opacity: loading ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        !primary && scheme !== "dark" ? shadow.xs : null,
        primary && scheme !== "dark" ? shadow.primary : null,
      ]}
    >
      {primary ? (
        <LinearGradient
          pointerEvents="none"
          colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: primary
            ? "rgba(255,255,255,0.20)"
            : colors.primarySoft,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Icon size={18} color={fg} strokeWidth={2.3} />
        )}
      </View>
      <Text
        numberOfLines={2}
        style={[
          typography.label.sm,
          {
            color: fg,
            textAlign: "center",
            fontWeight: "700",
            lineHeight: 16,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// Per-type tile; sparkline data is passed in (patient-scoped).
//
// IMPORTANT: do NOT replace `series` with a `useVitalsSeries` call —
// that hook hits `/vitals/me/series` which resolves `patientId` from
// the authenticated user. For a doctor that's the doctor's own vitals,
// not the patient being viewed. The two call sites below source
// `series` from patient-scoped payloads:
//   • Summary tab → `overview.vitals.series[type]` (bundled in
//     /doctor-portal/patients/:id/overview).
//   • Vitals tab  → derived from `summary.data.vitals` (full history).
function DoctorLatestVitalTile({
  latest,
  series,
}: {
  latest: any;
  series: VitalsPoint[];
}) {
  return (
    <LatestStatusCard
      latest={latest}
      sparkline={series}
      compact={false}
    />
  );
}

// Section card used by the comprehensive Summary/Overview tab. Mirrors
// the web `Section` helper — title + icon, optional right slot, optional
// loading/empty states, then children.
function OverviewSection({
  title,
  icon,
  rightSlot,
  loading,
  isEmpty,
  emptyTitle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  children?: React.ReactNode;
}) {
  const { typography, colors, spacing } = useTheme();
  return (
    <Card padded={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minWidth: 0 }}>
          {icon ? (
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {icon}
            </View>
          ) : null}
          <Text numberOfLines={1} style={[typography.title.md, { color: colors.text, flexShrink: 1 }]}>
            {title}
          </Text>
        </View>
        {rightSlot}
      </View>
      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <Skeleton lines={3} />
        </View>
      ) : isEmpty ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <EmptyState title={emptyTitle ?? ""} />
        </View>
      ) : (
        children
      )}
    </Card>
  );
}

// Map backend status strings to a Pill tone. Kept conservative — anything
// unrecognized falls back to "neutral" so the UI still renders.
function statusToTone(status?: string): "neutral" | "brand" | "success" | "warning" | "danger" | "info" {
  const s = String(status ?? "").toLowerCase();
  if (!s) return "neutral";
  if (["completed", "signed", "given", "active", "collected", "accepted", "delivered"].includes(s)) {
    return "success";
  }
  if (["scheduled", "draft", "processing", "pending", "ordered"].includes(s)) return "info";
  if (["missed", "cancelled", "overdue", "abnormal", "critical"].includes(s)) return "danger";
  if (["urgent", "stat", "warning"].includes(s)) return "warning";
  return "neutral";
}
