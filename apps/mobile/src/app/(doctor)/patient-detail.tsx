// @ts-nocheck

import { useMemo, useState } from "react";
import { View, Text } from "react-native";
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
  ChevronRight,
  Heart,
} from "lucide-react-native";
import {
  usePatientSummary,
  usePatientOverview,
  useVitalsSeries,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Pill as PillCmp,
  EmptyState,
  Skeleton,
  SectionHeader,
  ListItem,
  Divider,
  Button,
} from "@/components/ui";
import { LatestStatusCard, AlertsCard } from "@/components/vitals";

type Tab = "summary" | "records" | "meds" | "labs" | "vitals";

export default function DoctorPatientDetail() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("summary");

  const { data, isLoading } = usePatientSummary(id || null);
  const { data: overview, isLoading: overviewLoading } = usePatientOverview(id || null);

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

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={user?.name || t("doctorPatientDetail.fallbackTitle")}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {/* Header card */}
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Avatar
                name={user?.name}
                size="lg"
                tone="primary"
                ring
                source={user?.photo ? { uri: user.photo } : undefined}
              />
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.md, { color: colors.text }]}>
                  {user?.name || t("doctorPatientDetail.fallbackTitle")}
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                >
                  {user?.nic || user?.phone || "—"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              {patient.bloodGroup ? (
                <PillCmp icon={Droplet} label={patient.bloodGroup} tone="danger" size="sm" />
              ) : null}
              {patient.gender ? (
                <PillCmp icon={User} label={patient.gender} tone="neutral" size="sm" />
              ) : null}
              {patient.dateOfBirth ? (
                <PillCmp icon={Cake} label={patient.dateOfBirth} tone="neutral" size="sm" />
              ) : null}
              {user?.phone ? (
                <PillCmp icon={Phone} label={user.phone} tone="neutral" size="sm" />
              ) : null}
            </View>

            {(allergies.length > 0 || conditions.length > 0) && (
              <View style={{ gap: spacing.xs }}>
                {allergies.length > 0 ? (
                  <Text style={[typography.body.sm, { color: colors.danger }]}>
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

        {/* Actions */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
          }}
        >
          <Button
            title={t("doctorPatientDetail.actionCompleteVisit")}
            icon={Sparkles}
            variant="primary"
            size="sm"
            fullWidth={false}
            onPress={() =>
              router.push({
                pathname: "/doctor/visit-summary",
                params: { patientId: id },
              })
            }
          />
          <Button
            title={t("doctorPatientDetail.actionClinicalNote")}
            icon={Stethoscope}
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() =>
              router.push({
                pathname: "/doctor/clinical-note",
                params: { patientId: id },
              })
            }
          />
          <Button
            title={t("doctorPatientDetail.actionPrescribe")}
            icon={Pill}
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() =>
              router.push({
                pathname: "/doctor/prescription",
                params: { patientId: id },
              })
            }
          />
          <Button
            title={t("doctorPatientDetail.actionOrderLabs")}
            icon={FlaskConical}
            variant="outline"
            size="sm"
            fullWidth={false}
            onPress={() =>
              router.push({
                pathname: "/doctor/lab-order",
                params: { patientId: id },
              })
            }
          />
          <Button
            title={t("doctorPatientDetail.actionFollowUp")}
            icon={CalendarClock}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() =>
              router.push({
                pathname: "/doctor/follow-up-new",
                params: { patientId: id },
              })
            }
          />
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: "row",
            gap: spacing.xs,
            backgroundColor: colors.surface,
            padding: 4,
            borderRadius: 12,
          }}
        >
          {TABS.map((tabKey) => (
            <View
              key={tabKey}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: tab === tabKey ? colors.bg : "transparent",
                alignItems: "center",
              }}
              onTouchEnd={() => setTab(tabKey)}
            >
              <Text
                style={[
                  typography.label.md,
                  {
                    color: tab === tabKey ? colors.text : colors.textMuted,
                    fontWeight: tab === tabKey ? "700" : "500",
                    textTransform: "capitalize",
                  },
                ]}
              >
                {t(`doctorPatientDetail.tab${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`)}
              </Text>
            </View>
          ))}
        </View>

        {tab === "summary" && (
          <View style={{ gap: spacing.md }}>
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
              emptyTitle={t("vitals.empty")}
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
                    <DoctorLatestVitalTile latest={l} />
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
                    title={r.title || r.diagnosis || t("prescription.untitled")}
                    subtitle={r.diagnosis ?? undefined}
                    pill={{ label: r.status, tone: statusToTone(r.status) }}
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
                    icon={FlaskConical}
                    iconTone="info"
                    title={(o.tests || []).join(", ") || t("labs.untitled")}
                    subtitle={o.notes || o.priority}
                    pill={{ label: o.status, tone: statusToTone(o.status) }}
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
                        title={r.reportType || "—"}
                        subtitle={fmtDate(new Date(r.createdAt), locale)}
                        pill={{ label: r.status, tone: "neutral" }}
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
                    icon={CalendarCheck}
                    iconTone="info"
                    title={`${v.kind === "walkin" ? "Walk-in" : "Appointment"}${v.reason ? " · " + v.reason : ""}`}
                    subtitle={`${fmtDate(new Date(v.date), locale)}${v.time ? " " + v.time : ""}`}
                    pill={{ label: v.status, tone: statusToTone(v.status) }}
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
                      <PillCmp label="deceased" tone="warning" size="sm" />
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
                        valid until
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
                    onPress={() => router.push({ pathname: "/doctor/inbox" })}
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
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={[typography.body.xs, { color: colors.text }]}>
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
                    icon={FlaskConical}
                    iconTone="info"
                    title={l.reportType}
                    subtitle={fmtDate(new Date(l.createdAt), locale)}
                    pill={{ label: l.status, tone: "neutral" }}
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
              <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
                {t("doctorPatientDetail.vitalsHeading")}
              </Text>
              {data.vitalsAlerts && data.vitalsAlerts.count > 0 ? (
                <PillCmp
                  size="sm"
                  tone="danger"
                  label={t("doctorPatientDetail.abnormalCount", { count: data.vitalsAlerts.count })}
                />
              ) : null}
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
                    <DoctorLatestVitalTile latest={l} />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon={Stethoscope} title={t("doctorPatientDetail.noVitals")} />
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { typography, colors } = useTheme();
  return (
    <View style={{ alignItems: "center", minWidth: 56 }}>
      <Text style={[typography.title.lg, { color: colors.text }]}>{value}</Text>
      <Text
        style={[
          typography.overline,
          { color: colors.textMuted, marginTop: 2 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// Per-type tile with a 7-day sparkline fetched inline. Lives here rather
// than inside the shared LatestStatusCard because the doctor's chart
// needs the patient-scoped series endpoint behaviour; portal-side cards
// stay generic.
function DoctorLatestVitalTile({ latest }: { latest: any }) {
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);
  const { data: series } = useVitalsSeries({
    type: latest.type,
    from,
    enabled: !!latest.type,
  });
  return (
    <LatestStatusCard
      latest={latest}
      sparkline={series?.points ?? []}
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
    <Card>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon}
          <Text style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
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
