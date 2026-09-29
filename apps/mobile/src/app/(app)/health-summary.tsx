// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Share,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Share2,
  FileText,
  Pill,
  Activity,
  Heart,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  Droplet,
  Ruler,
  Scale,
  Gauge,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { useHealthSummary } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong, fmtDateTime, fmtMonthShort, fmtTime } from "@/lib/format";
import {
  Screen,
  ScreenHeader,
  Card,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  ErrorState,
  Pressable,
  Skeleton,
  useToast,
} from "@/components/ui";

const PREVIEW_LIMIT = 3;

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function capitalize(s?: string | null) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function bmiBand(bmi: number): { key: string; tone: Tone } {
  if (bmi < 18.5) return { key: "healthSummary.bmiUnder", tone: "warning" };
  if (bmi < 25) return { key: "healthSummary.bmiHealthy", tone: "success" };
  if (bmi < 30) return { key: "healthSummary.bmiOver", tone: "warning" };
  return { key: "healthSummary.bmiObese", tone: "danger" };
}

export default function HealthSummaryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useHealthSummary();
  const [showText, setShowText] = useState(false);

  const summary = data;

  const text = useMemo(() => {
    if (!summary) return "";
    return renderText(t, summary);
  }, [summary, t]);

  async function onShare() {
    try {
      await Share.share({ message: text });
    } catch (e: any) {
      toast.show(e?.message || t("healthSummary.shareFailed"), "danger");
    }
  }

  const d = summary?.demographics ?? ({} as any);
  const generated = toDate(summary?.generatedAt);
  const band = d?.bmi != null ? bmiBand(Number(d.bmi)) : null;

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("healthSummary.title")}
        subtitle={t("healthSummary.subtitle")}
        onBack={() => router.back()}
        right={
          summary ? (
            <IconButton
              icon={Share2}
              variant="surface"
              onPress={onShare}
              accessibilityLabel={t("healthSummary.a11yShare")}
            />
          ) : null
        }
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="100%" height={180} radius={24} />
          <Skeleton width="100%" height={84} radius={22} />
          <Skeleton width="100%" height={160} radius={22} />
          <Skeleton width="100%" height={120} radius={22} />
        </View>
      ) : isError ? (
        <ErrorState
          title={t("common.errorTitle")}
          message={t("common.errorLoad")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : !summary ? (
        <EmptyState
          icon={FileText}
          title={t("healthSummary.emptyTitle")}
          message={t("healthSummary.emptyBody")}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.sm,
            gap: spacing.md,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Profile ─── */}
          <Card style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar name={d.name || "?"} size="lg" />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[typography.title.lg, { color: colors.text }]} numberOfLines={1}>
                  {d.name || "—"}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted }]} numberOfLines={1}>
                  {[
                    d.age != null ? t("healthSummary.yearsOld", { age: d.age }) : null,
                    capitalize(d.sex),
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <StatTile
                icon={Droplet}
                tone="danger"
                label={t("healthSummary.bloodShort")}
                value={d.bloodGroup}
              />
              <StatTile
                icon={Ruler}
                tone="primary"
                label={t("healthSummary.height")}
                value={d.heightCm}
                unit="cm"
              />
              <StatTile
                icon={Scale}
                tone="accent"
                label={t("healthSummary.weight")}
                value={d.weightKg}
                unit="kg"
              />
              <StatTile
                icon={Gauge}
                tone={band?.tone ?? "neutral"}
                label={t("healthSummary.rows.bmi")}
                value={d.bmi != null ? String(d.bmi) : null}
                caption={band ? t(band.key) : undefined}
              />
            </View>
          </Card>

          {/* ─── Allergies ─── */}
          {summary.allergies.length === 0 ? (
            <Card variant="muted" style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <ToneTile icon={ShieldCheck} tone="success" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  {t("healthSummary.noAllergies")}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  {t("healthSummary.noAllergiesBody")}
                </Text>
              </View>
            </Card>
          ) : (
            <Section
              icon={AlertTriangle}
              tone="danger"
              title={t("healthSummary.sections.allergies")}
              count={summary.allergies.length}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {summary.allergies.map((a, i) => (
                  <AllergyChip key={i} allergy={a} />
                ))}
              </View>
            </Section>
          )}

          {/* ─── Conditions ─── */}
          <Section
            icon={Heart}
            tone="primary"
            title={t("healthSummary.sections.conditions")}
            count={summary.conditions.length}
            empty={t("healthSummary.conditionsEmpty")}
            items={summary.conditions}
            renderItem={(c) => {
              const date = toDate(c.diagnosedOn);
              return (
                <ItemRow
                  title={c.title}
                  meta={date ? fmtDateLong(date, locale) : c.diagnosedOn}
                  tone="primary"
                />
              );
            }}
          />

          {/* ─── Medicines ─── */}
          <Section
            icon={Pill}
            tone="accent2"
            title={t("healthSummary.sections.activeMedicines")}
            count={summary.activeMedicines.length}
            empty={t("healthSummary.medicinesEmpty")}
            items={summary.activeMedicines}
            renderItem={(m) => (
              <ItemRow
                title={m.name}
                meta={[m.dosage, m.frequency].filter(Boolean).join(" · ")}
                tone="accent2"
              />
            )}
          />

          {/* ─── Vitals ─── */}
          <Section
            icon={Activity}
            tone="info"
            title={t("healthSummary.sections.vitals")}
            empty={summary.recentVitals.length === 0 ? t("healthSummary.vitalsEmpty") : undefined}
          >
            {summary.recentVitals.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {summary.recentVitals.map((v, i) => (
                  <View
                    key={i}
                    style={{
                      flexGrow: 1,
                      flexBasis: "46%",
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      borderCurve: "continuous",
                      backgroundColor: colors.fill,
                      gap: 2,
                    }}
                  >
                    <Text
                      style={[typography.caption, { color: colors.textMuted, textTransform: "capitalize" }]}
                      numberOfLines={1}
                    >
                      {v.type.replace(/_/g, " ")}
                    </Text>
                    <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
                      {v.latest
                        ? `${v.latest.value}${v.latest.secondary != null ? "/" + v.latest.secondary : ""}`
                        : "—"}
                      {v.latest?.unit ? (
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {` ${v.latest.unit}`}
                        </Text>
                      ) : null}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Section>

          {/* ─── Follow-ups ─── */}
          <Section
            icon={Calendar}
            tone="warning"
            title={t("healthSummary.sections.followUps")}
            count={summary.followUps.length}
            empty={t("healthSummary.followUpsEmpty")}
            items={summary.followUps}
            renderItem={(f) => {
              const date = toDate(f.scheduledAt);
              return (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10 }}>
                  <View
                    style={{
                      width: 44,
                      paddingVertical: 4,
                      borderRadius: radius.md,
                      borderCurve: "continuous",
                      alignItems: "center",
                      backgroundColor: colors.well,
                    }}
                  >
                    <Text style={[typography.title.sm, { color: colors.text }]}>
                      {date ? date.getDate() : "—"}
                    </Text>
                    <Text style={[typography.overline, { color: colors.textSubtle, fontSize: 10, textTransform: "uppercase" }]}>
                      {date ? fmtMonthShort(date, locale) : ""}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.body.md, { color: colors.text }]} numberOfLines={2}>
                      {f.title}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {[date ? fmtTime(date, locale) : f.scheduledAt, f.provider].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* ─── Share ─── */}
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title={t("healthSummary.shareCta")} icon={Share2} onPress={onShare} />
            <Pressable
              onPress={() => setShowText((v) => !v)}
              haptic="light"
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={[typography.label.md, { color: colors.primary }]}>
                {showText ? t("healthSummary.hideText") : t("healthSummary.previewText")}
              </Text>
              {showText ? (
                <ChevronUp size={16} color={colors.primary} />
              ) : (
                <ChevronDown size={16} color={colors.primary} />
              )}
            </Pressable>
            {showText ? (
              <Card variant="muted">
                <Text
                  selectable
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, fontFamily: "Courier", lineHeight: 20 },
                  ]}
                >
                  {text}
                </Text>
              </Card>
            ) : null}
            {generated ? (
              <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center" }]}>
                {t("healthSummary.updated", { when: fmtDateTime(generated, locale) })}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function ToneTile({ icon: Icon, tone, size = 36 }: { icon: any; tone: Tone; size?: number }) {
  const { radius } = useTheme();
  const pal = useTone(tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: pal.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={size * 0.47} color={pal.fg} strokeWidth={2.3} />
    </View>
  );
}

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  caption,
}: {
  icon: any;
  tone: Tone;
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  caption?: string;
}) {
  const { colors, typography, radius, spacing } = useTheme();
  const pal = useTone(tone);
  const has = value != null && value !== "";
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xs,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.fill,
        alignItems: "center",
        gap: 4,
      }}
    >
      <Icon size={16} color={pal.fg} strokeWidth={2.3} />
      <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {has ? value : "—"}
        {has && unit ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>{` ${unit}`}</Text>
        ) : null}
      </Text>
      <Text
        style={[typography.caption, { color: caption ? pal.fg : colors.textMuted, fontWeight: caption ? "700" : undefined }]}
        numberOfLines={1}
      >
        {caption ?? label}
      </Text>
    </View>
  );
}

function AllergyChip({ allergy }: { allergy: any }) {
  const { t } = useTranslation();
  const { typography, radius, spacing } = useTheme();
  const pal = useTone("danger");
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: pal.bg,
        maxWidth: "100%",
      }}
    >
      <Text style={[typography.label.md, { color: pal.fg }]} numberOfLines={1}>
        {allergy.substance}
      </Text>
      <Text style={[typography.caption, { color: pal.fg, opacity: 0.8 }]} numberOfLines={1}>
        {allergy.reaction
          ? t("healthSummary.severityReaction", { severity: allergy.severity, reaction: allergy.reaction })
          : allergy.severity}
      </Text>
    </View>
  );
}

function ItemRow({ title, meta, tone }: { title: string; meta?: string | null; tone: Tone }) {
  const { colors, typography, spacing } = useTheme();
  const pal = useTone(tone);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: pal.fg }} />
      <Text style={[typography.body.md, { color: colors.text, flex: 1 }]} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={[typography.caption, { color: colors.textMuted, maxWidth: "45%", textAlign: "right" }]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

/** Card with icon header, optional count, and either children or a capped list. */
function Section({
  icon,
  tone,
  title,
  count,
  empty,
  items,
  renderItem,
  children,
}: {
  icon: any;
  tone: Tone;
  title: string;
  count?: number;
  empty?: string;
  items?: any[];
  renderItem?: (item: any) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const list = items ?? [];
  const visible = expanded ? list : list.slice(0, PREVIEW_LIMIT);
  const isEmpty = items ? list.length === 0 : !!empty;

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <ToneTile icon={icon} tone={tone} size={32} />
        <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
        {typeof count === "number" && count > 0 ? (
          <View
            style={{
              minWidth: 24,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              alignItems: "center",
              backgroundColor: colors.well,
            }}
          >
            <Text style={[typography.label.sm, { color: colors.textMuted }]}>{count}</Text>
          </View>
        ) : null}
      </View>

      {isEmpty ? (
        <Text style={[typography.body.sm, { color: colors.textSubtle, paddingLeft: 32 + spacing.md }]}>
          {empty}
        </Text>
      ) : items ? (
        <View>
          {visible.map((item, i) => (
            <View
              key={i}
              style={
                i > 0
                  ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }
                  : undefined
              }
            >
              {renderItem?.(item)}
            </View>
          ))}
          {list.length > PREVIEW_LIMIT ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              haptic="light"
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingTop: spacing.sm,
                marginTop: spacing.xs,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
              }}
            >
              <Text style={[typography.label.md, { color: colors.primary }]}>
                {expanded ? t("healthSummary.showLess") : t("healthSummary.showAll", { count: list.length })}
              </Text>
              {expanded ? (
                <ChevronUp size={16} color={colors.primary} />
              ) : (
                <ChevronDown size={16} color={colors.primary} />
              )}
            </Pressable>
          ) : null}
        </View>
      ) : (
        children
      )}
    </Card>
  );
}

function renderText(t: (k: string, opts?: any) => string, s: any): string {
  const lines: string[] = [];
  lines.push(t("healthSummary.plainTitle"));
  lines.push(t("healthSummary.plainGenerated", { when: s.generatedAt }));
  lines.push("");
  const d = s.demographics;
  if (d.name)
    lines.push(t("healthSummary.plainPatient", { name: d.name }));
  const demo = [
    d.age != null ? t("healthSummary.plainAge", { age: d.age }) : null,
    d.sex,
    d.bloodGroup ? t("healthSummary.plainBlood", { group: d.bloodGroup }) : null,
    d.heightCm ? t("healthSummary.plainCm", { n: d.heightCm }) : null,
    d.weightKg ? t("healthSummary.plainKg", { n: d.weightKg }) : null,
    d.bmi ? t("healthSummary.plainBmi", { n: d.bmi }) : null,
  ]
    .filter(Boolean)
    .join(" • ");
  if (demo) lines.push(demo);
  lines.push("");
  lines.push(t("healthSummary.plainAllergiesTitle"));
  if (s.allergies.length === 0) lines.push(t("healthSummary.plainAllergiesNone"));
  for (const a of s.allergies)
    lines.push(
      a.reaction
        ? t("healthSummary.plainAllergyRowReaction", {
            substance: a.substance,
            severity: a.severity,
            reaction: a.reaction,
          })
        : t("healthSummary.plainAllergyRow", {
            substance: a.substance,
            severity: a.severity,
          })
    );
  lines.push("");
  lines.push(t("healthSummary.plainConditionsTitle"));
  if (s.conditions.length === 0)
    lines.push(t("healthSummary.plainConditionsNone"));
  for (const c of s.conditions)
    lines.push(
      c.diagnosedOn
        ? t("healthSummary.plainConditionRowDate", {
            title: c.title,
            date: c.diagnosedOn,
          })
        : t("healthSummary.plainConditionRow", { title: c.title })
    );
  lines.push("");
  lines.push(t("healthSummary.plainMedsTitle"));
  if (s.activeMedicines.length === 0) lines.push(t("healthSummary.plainMedsNone"));
  for (const m of s.activeMedicines) {
    if (m.dosage && m.frequency)
      lines.push(
        t("healthSummary.plainMedRowAll", {
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
        })
      );
    else if (m.dosage)
      lines.push(
        t("healthSummary.plainMedRowDosage", { name: m.name, dosage: m.dosage })
      );
    else lines.push(t("healthSummary.plainMedRow", { name: m.name }));
  }
  lines.push("");
  lines.push(t("healthSummary.plainVitalsTitle"));
  if (s.recentVitals.length === 0) lines.push(t("healthSummary.plainVitalsNone"));
  for (const v of s.recentVitals) {
    const l = v.latest;
    if (!l) continue;
    lines.push(
      t("healthSummary.plainVitalRow", {
        type: v.type.replace(/_/g, " "),
        value: l.value,
        secondary: l.secondary != null ? "/" + l.secondary : "",
        unit: l.unit || "",
      })
    );
  }
  lines.push("");
  lines.push(t("healthSummary.plainFollowUpsTitle"));
  if (s.followUps.length === 0)
    lines.push(t("healthSummary.plainFollowUpsNone"));
  for (const f of s.followUps)
    lines.push(
      f.provider
        ? t("healthSummary.plainFollowUpRowProvider", {
            title: f.title,
            when: f.scheduledAt,
            provider: f.provider,
          })
        : t("healthSummary.plainFollowUpRow", {
            title: f.title,
            when: f.scheduledAt,
          })
    );
  return lines.join("\n");
}