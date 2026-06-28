import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("summary");

  const { data, isLoading } = usePatientSummary(id || null);

  if (!id) {
    return (
      <Screen padded>
        <EmptyState
          icon={User}
          title="No patient"
          message="Missing patient id"
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader back onBack={() => router.back()} title="Patient" />
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
          title="Not found"
          message="Patient not available"
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

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={user?.name || "Patient"}
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
                  {user?.name || "Patient"}
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
                    Allergies: {allergies.join(", ")}
                  </Text>
                ) : null}
                {conditions.length > 0 ? (
                  <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                    Conditions: {conditions.join(", ")}
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
            title="Clinical note"
            icon={Stethoscope}
            variant="primary"
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
            title="Prescribe"
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
            title="Order labs"
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
            title="Follow-up"
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
          {(["summary", "records", "meds", "labs", "vitals"] as Tab[]).map((t) => (
            <View
              key={t}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: tab === t ? colors.bg : "transparent",
                alignItems: "center",
              }}
              onTouchEnd={() => setTab(t)}
            >
              <Text
                style={[
                  typography.label.md,
                  {
                    color: tab === t ? colors.text : colors.textMuted,
                    fontWeight: tab === t ? "700" : "500",
                    textTransform: "capitalize",
                  },
                ]}
              >
                {t}
              </Text>
            </View>
          ))}
        </View>

        {tab === "summary" && (
          <View style={{ gap: spacing.md }}>
            <Card>
              <SectionHeader title="Counts" />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.lg,
                }}
              >
                <Stat label="Records" value={data.records?.length ?? 0} />
                <Stat
                  label="Active meds"
                  value={data.activeMedicines?.length ?? 0}
                />
                <Stat label="Rx" value={data.prescriptions?.length ?? 0} />
                <Stat label="Labs" value={data.labReports?.length ?? 0} />
                <Stat label="Vitals" value={data.vitals?.length ?? 0} />
              </View>
            </Card>

            {data.labOrders && data.labOrders.length > 0 ? (
              <Card>
                <SectionHeader title="Recent lab orders" />
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
                        title={tests.join(", ") || "Lab order"}
                        subtitle={`${o.status} · ${new Date(o.orderedAt).toLocaleDateString()}`}
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
            <SectionHeader title="Medical records" />
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
              <EmptyState icon={Stethoscope} title="No records" />
            )}
          </Card>
        )}

        {tab === "meds" && (
          <Card>
            <SectionHeader title="Active medicines" />
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
              <EmptyState icon={Pill} title="No active medicines" />
            )}
          </Card>
        )}

        {tab === "labs" && (
          <Card>
            <SectionHeader title="Lab reports" />
            {data.labReports && data.labReports.length > 0 ? (
              data.labReports.slice(0, 20).map((l: any, idx: number) => (
                <View key={l.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    icon={FlaskConical}
                    iconTone="info"
                    title={l.reportType}
                    subtitle={new Date(l.createdAt).toLocaleDateString()}
                    pill={{ label: l.status, tone: "neutral" }}
                  />
                </View>
              ))
            ) : (
              <EmptyState icon={FlaskConical} title="No lab reports" />
            )}
          </Card>
        )}

        {tab === "vitals" && (
          <Card>
            <SectionHeader title="Vitals" />
            {data.vitals && data.vitals.length > 0 ? (
              data.vitals.slice(0, 30).map((v: any, idx: number) => (
                <View key={v.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListItem
                    title={v.type.replace(/_/g, " ")}
                    subtitle={new Date(v.recordedAt).toLocaleDateString()}
                    pill={{
                      label: `${v.value}${v.secondaryValue ? `/${v.secondaryValue}` : ""} ${v.unit}`,
                      tone: "primary",
                    }}
                  />
                </View>
              ))
            ) : (
              <EmptyState icon={Stethoscope} title="No vitals recorded" />
            )}
          </Card>
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { typography, colors, spacing } = useTheme();
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