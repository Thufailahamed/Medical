// @ts-nocheck

/**
 * DoctorSidePanel — collapsible bottom drawer for the doctor's in-call
 * surface. Mirrors the portal PatientSidebar (apps/marketing/src/portal/
 * components/teleconsult/PatientSidebar.tsx) with three tabs:
 *
 *   - records       → allergies / conditions / active meds / recent
 *                     records + open-full-chart link
 *   - prescriptions → recent Rx + sticky "New prescription" CTA
 *   - notes         → recent clinical notes + sticky "New note" CTA
 *
 * Allergies banner is always visible at the top (rose-50 strip). The
 * two composer CTAs open MiniPrescriptionForm / MiniClinicalNoteForm
 * BottomSheets; the parent's video stage stays visible at the top.
 */

import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Pill,
  ClipboardList,
  AlertTriangle,
  Plus,
  ExternalLink,
} from "lucide-react-native";
import {
  usePatientOverview,
  useConsentsIssued,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Pill as PillCmp,
  EmptyState,
  Skeleton,
  Button,
  useToast,
} from "@/components/ui";
import MiniPrescriptionForm from "./MiniPrescriptionForm";
import MiniClinicalNoteForm from "./MiniClinicalNoteForm";

type Tab = "records" | "prescriptions" | "notes";

type Props = {
  patientId: string | null;
  appointmentId?: string;
};

export default function DoctorSidePanel({ patientId, appointmentId }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing, typography } = useTheme();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("records");
  const [composer, setComposer] = useState<null | "prescription" | "note">(null);

  const overview = usePatientOverview(patientId);
  const consents = useConsentsIssued();

  const o = overview.data;
  const allergies = (o?.allergies ?? []) as Array<{
    id?: string;
    substance?: string;
    severity?: string | null;
  }>;
  const conditions = (o?.chronicConditions ?? []) as Array<{
    id?: string;
    title?: string;
    name?: string;
  }>;
  const activeMeds = (o?.activeMedicines ?? []) as Array<{
    id?: string;
    name?: string;
    dosage?: string | null;
  }>;
  const recentRecords = (o?.records?.recent ?? []) as Array<{
    id?: string;
    title?: string;
    type?: string;
    date?: string | null;
  }>;
  const recentRx = (o?.prescriptions?.recent ?? []) as Array<{
    id?: string;
    diagnosis?: string;
    title?: string;
    date?: string | null;
    status?: string;
  }>;
  const recentNotes = (o?.clinicalNotes?.recent ?? []) as Array<{
    id?: string;
    title?: string;
    date?: string | null;
  }>;

  const tabs: { key: Tab; label: string; Icon: any }[] = [
    { key: "records", label: t("consult.tabs.records"), Icon: FileText },
    { key: "prescriptions", label: t("consult.tabs.prescriptions"), Icon: Pill },
    { key: "notes", label: t("consult.tabs.clinicalNote"), Icon: ClipboardList },
  ];

  function openFullChart() {
    if (!patientId) return;
    // Mobile router doesn't support nested drawer, so deep-link via the
    // patient detail route via a tab-jump. Falls back to a no-op toast if
    // not navigable from this screen.
    Linking.openURL(`/(doctor)/patient-detail?id=${patientId}`).catch(() => {
      toast.show(t("consult.openFullChart"), "info");
    });
  }

  return (
    <>
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          maxHeight: drawerOpen ? "55%" : 60,
          overflow: "hidden",
        }}
      >
        {/* Allergies banner — always visible while drawer open */}
        {drawerOpen && allergies.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.sm,
              paddingBottom: spacing.sm,
              backgroundColor: colors.dangerSoft,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <AlertTriangle size={16} color={colors.danger} strokeWidth={2.25} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.overline, { color: colors.danger }]}>
                {t("consult.allergiesBanner")}
              </Text>
              <Text style={[typography.body.xs, { color: colors.text, marginTop: 2 }]}>
                {allergies
                  .map((a) =>
                    a.severity && a.severity !== "mild"
                      ? `${a.substance} (${a.severity})`
                      : a.substance
                  )
                  .join(", ")}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Handle + tab label */}
        <Pressable
          onPress={() => setDrawerOpen((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            borderBottomWidth: drawerOpen ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
            <Text style={[typography.body.md, { color: colors.text, fontWeight: "600" }]}>
              {tabs.find((tt) => tt.key === tab)?.label ?? ""}
            </Text>
          </View>
          {drawerOpen ? (
            <ChevronDown size={18} color={colors.textMuted} />
          ) : (
            <ChevronUp size={18} color={colors.textMuted} />
          )}
        </Pressable>

        {drawerOpen ? (
          <>
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
              }}
            >
              {tabs.map(({ key, label, Icon }) => (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.md,
                    backgroundColor: tab === key ? colors.primary : colors.surface2,
                  }}
                >
                  <Icon size={13} color={tab === key ? "#fff" : colors.textMuted} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: tab === key ? "#fff" : colors.textMuted,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
            >
              {overview.isLoading ? (
                <View style={{ gap: spacing.sm }}>
                  <Skeleton height={64} radius={12} />
                  <Skeleton height={64} radius={12} />
                  <Skeleton height={64} radius={12} />
                </View>
              ) : !patientId ? (
                <EmptyState
                  icon={FileText}
                  title={t("consult.noPatient", "No patient linked")}
                  tone="neutral"
                />
              ) : tab === "records" ? (
                <RecordsTab
                  conditions={conditions}
                  activeMeds={activeMeds}
                  recentRecords={recentRecords}
                  onOpenFullChart={openFullChart}
                />
              ) : tab === "prescriptions" ? (
                <PrescriptionsTab
                  recent={recentRx}
                  onNew={() => setComposer("prescription")}
                />
              ) : (
                <NotesTab
                  recent={recentNotes}
                  onNew={() => setComposer("note")}
                />
              )}
            </ScrollView>

            {tab !== "records" && patientId ? (
              <View
                style={{
                  padding: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Button
                  title={
                    tab === "prescriptions"
                      ? t("consult.newPrescription", "New prescription")
                      : t("consult.newNote", "New note")
                  }
                  icon={Plus}
                  size="md"
                  fullWidth
                  onPress={() =>
                    setComposer(tab === "prescriptions" ? "prescription" : "note")
                  }
                />
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <MiniPrescriptionForm
        visible={composer === "prescription"}
        patientId={patientId ?? ""}
        appointmentId={appointmentId}
        onSaved={() => {
          setComposer(null);
          overview.refetch();
        }}
        onCancel={() => setComposer(null)}
      />
      <MiniClinicalNoteForm
        visible={composer === "note"}
        patientId={patientId ?? ""}
        onSaved={() => {
          setComposer(null);
          overview.refetch();
        }}
        onCancel={() => setComposer(null)}
      />
    </>
  );
}

function RecordsTab({
  conditions,
  activeMeds,
  recentRecords,
  onOpenFullChart,
}: {
  conditions: Array<{ id?: string; title?: string; name?: string }>;
  activeMeds: Array<{ id?: string; name?: string; dosage?: string | null }>;
  recentRecords: Array<{ id?: string; title?: string; type?: string; date?: string | null }>;
  onOpenFullChart: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const empty =
    conditions.length === 0 && activeMeds.length === 0 && recentRecords.length === 0;

  if (empty) {
    return (
      <View style={{ gap: spacing.md }}>
        <EmptyState
          icon={FileText}
          title={t("consult.noRecords")}
          message={t("consult.noRecordsBody", "No recent records for this patient.")}
          tone="neutral"
        />
        <Button
          title={t("consult.openFullChart")}
          icon={ExternalLink}
          variant="ghost"
          size="sm"
          fullWidth
          onPress={onOpenFullChart}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {conditions.length > 0 ? (
        <Block title={t("doctorPatientDetail.conditions", "Conditions")}>
          {conditions.map((c, i) => (
            <Text
              key={c.id ?? i}
              style={[typography.body.sm, { color: colors.text, marginBottom: 2 }]}
            >
              • {c.title ?? c.name}
            </Text>
          ))}
        </Block>
      ) : null}
      {activeMeds.length > 0 ? (
        <Block title={t("consult.activeMeds", "Active medicines")}>
          {activeMeds.map((m, i) => (
            <Text
              key={m.id ?? i}
              style={[typography.body.sm, { color: colors.text, marginBottom: 2 }]}
            >
              • {m.name}
              {m.dosage ? ` ${m.dosage}` : ""}
            </Text>
          ))}
        </Block>
      ) : null}
      {recentRecords.length > 0 ? (
        <Block title={t("consult.recentRecords", "Recent records")}>
          {recentRecords.slice(0, 5).map((r, i) => (
            <View
              key={r.id ?? i}
              style={{
                paddingVertical: 6,
                borderBottomWidth:
                  i === Math.min(4, recentRecords.length - 1) ? 0 : 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={[typography.body.sm, { color: colors.text, fontWeight: "600" }]}
                numberOfLines={1}
              >
                {r.title ?? r.type ?? "Record"}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {[r.type, r.date].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ))}
        </Block>
      ) : null}
      <Button
        title={t("consult.openFullChart")}
        icon={ExternalLink}
        variant="ghost"
        size="sm"
        fullWidth
        onPress={onOpenFullChart}
      />
    </View>
  );
}

function PrescriptionsTab({
  recent,
  onNew,
}: {
  recent: Array<{
    id?: string;
    diagnosis?: string;
    title?: string;
    date?: string | null;
    status?: string;
  }>;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  if (!recent.length) {
    return (
      <EmptyState
        icon={Pill}
        title={t("consult.noPrescriptions")}
        message={t("consult.noPrescriptionsBody", "No active prescriptions yet.")}
        tone="neutral"
      />
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {recent.slice(0, 5).map((p, i) => (
        <View
          key={p.id ?? i}
          style={{
            paddingVertical: 8,
            borderBottomWidth: i === Math.min(4, recent.length - 1) ? 0 : 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={[typography.body.md, { color: colors.text, fontWeight: "600" }]}>
            {p.diagnosis ?? p.title ?? "Prescription"}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {[p.date, p.status].filter(Boolean).join(" · ")}
          </Text>
        </View>
      ))}
    </View>
  );
}

function NotesTab({
  recent,
}: {
  recent: Array<{ id?: string; title?: string; date?: string | null }>;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  if (!recent.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("consult.noNotes")}
        message={t("consult.noNotesBody", "No clinical notes yet.")}
        tone="neutral"
      />
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {recent.slice(0, 5).map((n, i) => (
        <View
          key={n.id ?? i}
          style={{
            paddingVertical: 8,
            borderBottomWidth: i === Math.min(4, recent.length - 1) ? 0 : 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={[typography.body.md, { color: colors.text, fontWeight: "600" }]}>
            {n.title ?? "Note"}
          </Text>
          {n.date ? (
            <Text style={[typography.body.sm, { color: colors.textMuted }]}>{n.date}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View>
      <Text
        style={[
          typography.overline,
          { color: colors.textMuted, marginBottom: 4 },
        ]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}