// @ts-nocheck

import { useState } from "react";
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
  Sparkles,
  User,
  Droplet,
  Cake,
  Phone,
} from "lucide-react-native";
import { usePatientSummary } from "@/hooks/useApi";
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

type Tab = "summary" | "records" | "meds" | "labs" | "vitals";

export default function DoctorPatientDetail() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("summary");

  const { data, isLoading } = usePatientSummary(id || null);

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
            <Card>
              <SectionHeader title={t("doctorPatientDetail.countsHeading")} />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.lg,
                }}
              >
                <Stat label={t("doctorPatientDetail.statRecords")} value={data.records?.length ?? 0} />
                <Stat
                  label={t("doctorPatientDetail.statActiveMeds")}
                  value={data.activeMedicines?.length ?? 0}
                />
                <Stat label={t("doctorPatientDetail.statRx")} value={data.prescriptions?.length ?? 0} />
                <Stat label={t("doctorPatientDetail.statLabs")} value={data.labReports?.length ?? 0} />
                <Stat label={t("doctorPatientDetail.statVitals")} value={data.vitals?.length ?? 0} />
              </View>
            </Card>

            {data.labOrders && data.labOrders.length > 0 ? (
              <Card>
                <SectionHeader title={t("doctorPatientDetail.recentLabOrders")} />
                {data.labOrders.slice(0, 5).map((o: any, idx: number) => {
                  const tests = (() => {
                    try {
                      return JSON.parse(o.tests);
                    } catch {
                      return [];
                    }
                  })();
                  return (
                    <View key={o.id}>
                      {idx > 0 ? <Divider /> : null}
                      <ListItem
                        icon={FlaskConical}
                        iconTone={o.priority === "stat" ? "danger" : "info"}
                        title={tests.join(", ") || t("doctorPatientDetail.labOrderFallback")}
                        subtitle={`${o.status} · ${fmtDate(new Date(o.orderedAt), locale)}`}
                        pill={{
                          label: o.priority,
                          tone:
                            o.priority === "stat"
                              ? "danger"
                              : o.priority === "urgent"
                              ? "warning"
                              : "neutral",
                        }}
                      />
                    </View>
                  );
                })}
              </Card>
            ) : null}
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
          <Card>
            <SectionHeader title={t("doctorPatientDetail.vitalsHeading")} />
            {data.vitals && data.vitals.length > 0 ? (
              data.vitals.slice(0, 30).map((v: any, idx: number) => (
                <View key={v.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    title={v.type.replace(/_/g, " ")}
                    subtitle={fmtDate(new Date(v.recordedAt), locale)}
                    pill={{
                      label: `${v.value}${v.secondaryValue ? `/${v.secondaryValue}` : ""} ${v.unit}`,
                      tone: "primary",
                    }}
                  />
                </View>
              ))
            ) : (
              <EmptyState icon={Stethoscope} title={t("doctorPatientDetail.noVitals")} />
            )}
          </Card>
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
