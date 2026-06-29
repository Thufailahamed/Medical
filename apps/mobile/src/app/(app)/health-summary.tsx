// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Share,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Share2,
  FileText,
  User,
  Pill,
  Activity,
  Heart,
  AlertTriangle,
  Calendar,
} from "lucide-react-native";
import { useHealthSummary } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  EmptyState,
  IconButton,
  useToast,
} from "@/components/ui";

export default function HealthSummaryScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading, refetch, isFetching } = useHealthSummary();

  const summary = data;

  const text = useMemo(() => {
    if (!summary) return "";
    return renderText(summary);
  }, [summary]);

  async function onShare() {
    try {
      await Share.share({ message: text });
    } catch (e: any) {
      toast.show({ message: e?.message || "Share failed", tone: "danger" });
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title="Health Summary"
        subtitle="One-page snapshot of your record"
        onBack={() => router.back()}
        right={
          <IconButton
            icon={Share2}
            onPress={onShare}
            accessibilityLabel="Share summary"
          />
        }
      />

      {isLoading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing.xl }}
        />
      ) : !summary ? (
        <EmptyState
          icon={FileText}
          title="No summary available"
          message="Add profile information to generate a summary."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Demographics */}
          <Card>
            <SectionHeader icon={User} title="About you" />
            <Row label="Name" value={summary.demographics.name} />
            <Row
              label="Age"
              value={
                summary.demographics.age != null
                  ? `${summary.demographics.age}`
                  : null
              }
            />
            <Row label="Sex" value={summary.demographics.sex} />
            <Row label="Blood group" value={summary.demographics.bloodGroup} />
            <Row
              label="Height / Weight"
              value={
                summary.demographics.heightCm || summary.demographics.weightKg
                  ? `${summary.demographics.heightCm ?? "—"} cm / ${summary.demographics.weightKg ?? "—"} kg`
                  : null
              }
            />
            <Row
              label="BMI"
              value={
                summary.demographics.bmi != null
                  ? String(summary.demographics.bmi)
                  : null
              }
            />
          </Card>

          {/* Allergies */}
          <Card>
            <SectionHeader
              icon={AlertTriangle}
              title="Allergies"
              tone="danger"
              count={summary.allergies.length}
            />
            {summary.allergies.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                None recorded
              </Text>
            ) : (
              summary.allergies.map((a, i) => (
                <View
                  key={i}
                  style={{
                    paddingVertical: 6,
                    borderBottomWidth:
                      i < summary.allergies.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text
                    style={[
                      typography.body.md,
                      { color: colors.text, fontWeight: "600" },
                    ]}
                  >
                    {a.substance}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted },
                    ]}
                  >
                    {a.severity}
                    {a.reaction ? " • " + a.reaction : ""}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Conditions */}
          <Card>
            <SectionHeader
              icon={Heart}
              title="Conditions"
              count={summary.conditions.length}
            />
            {summary.conditions.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                None on record
              </Text>
            ) : (
              summary.conditions.map((c, i) => (
                <View key={i} style={{ paddingVertical: 4 }}>
                  <Text style={[typography.body.md, { color: colors.text }]}>
                    {c.title}
                  </Text>
                  {c.diagnosedOn && (
                    <Text
                      style={[typography.caption, { color: colors.textMuted }]}
                    >
                      {c.diagnosedOn}
                    </Text>
                  )}
                </View>
              ))
            )}
          </Card>

          {/* Medicines */}
          <Card>
            <SectionHeader
              icon={Pill}
              title="Active medicines"
              count={summary.activeMedicines.length}
            />
            {summary.activeMedicines.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                None
              </Text>
            ) : (
              summary.activeMedicines.map((m, i) => (
                <View
                  key={i}
                  style={{
                    paddingVertical: 4,
                    flexDirection: "row",
                    gap: spacing.xs,
                  }}
                >
                  <Text
                    style={[typography.body.md, { color: colors.text, flex: 1 }]}
                  >
                    {m.name}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                  >
                    {[m.dosage, m.frequency].filter(Boolean).join(" • ")}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Vitals */}
          <Card>
            <SectionHeader icon={Activity} title="Recent vitals (30 days)" />
            {summary.recentVitals.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                No vitals logged
              </Text>
            ) : (
              summary.recentVitals.map((v, i) => (
                <View
                  key={i}
                  style={{
                    paddingVertical: 4,
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={[typography.body.md, { color: colors.text }]}>
                    {v.type.replace(/_/g, " ")}
                  </Text>
                  <Text
                    style={[typography.body.sm, { color: colors.textMuted }]}
                  >
                    {v.latest
                      ? `${v.latest.value}${v.latest.secondary != null ? "/" + v.latest.secondary : ""} ${v.latest.unit || ""}`
                      : "—"}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Follow-ups */}
          <Card>
            <SectionHeader
              icon={Calendar}
              title="Upcoming follow-ups"
              count={summary.followUps.length}
            />
            {summary.followUps.length === 0 ? (
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
              >
                None scheduled
              </Text>
            ) : (
              summary.followUps.map((f, i) => (
                <View key={i} style={{ paddingVertical: 4 }}>
                  <Text style={[typography.body.md, { color: colors.text }]}>
                    {f.title}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                  >
                    {f.scheduledAt}
                    {f.provider ? " • " + f.provider : ""}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {/* Text preview */}
          <Card>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, marginBottom: 4 },
              ]}
            >
              PLAIN TEXT
            </Text>
            <Text
              selectable
              style={[
                typography.body.sm,
                {
                  color: colors.text,
                  fontFamily: "Courier",
                  lineHeight: 20,
                },
              ]}
            >
              {text}
            </Text>
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  tone,
  count,
}: {
  icon: any;
  title: string;
  tone?: "primary" | "danger" | "info";
  count?: number;
}) {
  const { spacing, colors, typography } = useTheme();
  const fg =
    tone === "danger"
      ? colors.danger
      : tone === "info"
      ? colors.info
      : colors.primary;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.sm,
      }}
    >
      <Icon size={18} color={fg} strokeWidth={2.25} />
      <Text
        style={[
          typography.title.sm,
          { color: colors.text, fontWeight: "800", flex: 1 },
        ]}
      >
        {title}
      </Text>
      {typeof count === "number" && (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {count}
        </Text>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const { spacing, colors, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
        gap: spacing.sm,
      }}
    >
      <Text style={[typography.body.sm, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[
          typography.body.md,
          { color: colors.text, fontWeight: "600", textAlign: "right", flexShrink: 1 },
        ]}
        numberOfLines={1}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

function renderText(s: any): string {
  const lines: string[] = [];
  lines.push("HEALTH SUMMARY");
  lines.push(`Generated: ${s.generatedAt}`);
  lines.push("");
  const d = s.demographics;
  if (d.name) lines.push(`Patient: ${d.name}`);
  const demo = [
    d.age != null ? `Age ${d.age}` : null,
    d.sex,
    d.bloodGroup ? `Blood ${d.bloodGroup}` : null,
    d.heightCm ? `${d.heightCm} cm` : null,
    d.weightKg ? `${d.weightKg} kg` : null,
    d.bmi ? `BMI ${d.bmi}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
  if (demo) lines.push(demo);
  lines.push("");
  lines.push("ALLERGIES");
  if (s.allergies.length === 0) lines.push("  None recorded");
  for (const a of s.allergies)
    lines.push(`  • ${a.substance} (${a.severity})${a.reaction ? " — " + a.reaction : ""}`);
  lines.push("");
  lines.push("CONDITIONS");
  if (s.conditions.length === 0) lines.push("  None on record");
  for (const c of s.conditions)
    lines.push(`  • ${c.title}${c.diagnosedOn ? " (" + c.diagnosedOn + ")" : ""}`);
  lines.push("");
  lines.push("ACTIVE MEDICINES");
  if (s.activeMedicines.length === 0) lines.push("  None");
  for (const m of s.activeMedicines)
    lines.push(
      `  • ${m.name}${m.dosage ? " " + m.dosage : ""}${m.frequency ? " " + m.frequency : ""}`
    );
  lines.push("");
  lines.push("RECENT VITALS (30d)");
  if (s.recentVitals.length === 0) lines.push("  None");
  for (const v of s.recentVitals) {
    const l = v.latest;
    if (!l) continue;
    lines.push(
      `  • ${v.type.replace(/_/g, " ")}: ${l.value}${l.secondary != null ? "/" + l.secondary : ""} ${l.unit || ""}`
    );
  }
  lines.push("");
  lines.push("UPCOMING FOLLOW-UPS");
  if (s.followUps.length === 0) lines.push("  None scheduled");
  for (const f of s.followUps)
    lines.push(`  • ${f.title} — ${f.scheduledAt}${f.provider ? " @ " + f.provider : ""}`);
  return lines.join("\n");
}