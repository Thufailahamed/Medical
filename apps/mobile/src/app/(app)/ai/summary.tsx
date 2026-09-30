// @ts-nocheck

import { useState, type ReactNode } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  RefreshCcw,
  Pill,
  History,
  AlertTriangle,
  FileSearch,
  Stethoscope,
  FolderHeart,
  FlaskConical,
  HeartPulse,
  Clock,
  type LucideIcon,
} from "lucide-react-native";
import { useAiSummary, usePatientProfile } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  Pill as PillCmp,
  useToast,
} from "@/components/ui";

/** Card with an icon-tile heading — one per summary section. */
function SummarySection({
  icon: Icon,
  tone,
  title,
  children,
  tinted,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  children: ReactNode;
  tinted?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
  const pal = tonePalette(tone, colors);
  return (
    <Card style={tinted ? { backgroundColor: pal.bg, borderColor: "transparent" } : undefined}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              borderCurve: "continuous",
              backgroundColor: tinted ? colors.surface : pal.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={15} color={pal.fg} strokeWidth={2.4} />
          </View>
          <Text style={[typography.title.sm, { color: colors.text }]}>{title}</Text>
        </View>
        {children}
      </View>
    </Card>
  );
}

function ChipList({ items, tone }: { items: string[]; tone: Tone }) {
  const { colors, typography } = useTheme();
  const pal = tonePalette(tone, colors);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((x, i) => (
        <View
          key={`${x}-${i}`}
          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: pal.bg }}
        >
          <Text style={[typography.label.md, { color: pal.fg }]}>{x}</Text>
        </View>
      ))}
    </View>
  );
}

function BulletList({ items, icon: Icon, color }: { items: string[]; icon?: LucideIcon; color: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((x, i) => (
        <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
          {Icon ? (
            <Icon size={15} color={color} strokeWidth={2.4} style={{ marginTop: 2 }} />
          ) : (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 7 }} />
          )}
          <Text style={[typography.body.sm, { color: colors.text, flex: 1, lineHeight: 20 }]}>{x}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AiSummaryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme } = useTheme();
  const toast = useToast();

  const { data: profileData } = usePatientProfile();
  const patient = profileData?.patient?.patients;

  const aiSummary = useAiSummary();
  const [result, setResult] = useState<any>(null);
  const [cached, setCached] = useState<boolean>(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  async function generate() {
    if (!patient?.id) {
      toast.show(t("aiSummary.noProfile"), "warning");
      return;
    }
    try {
      const res = await aiSummary.mutateAsync({ patientId: patient.id });
      setResult(res.summary);
      setCached(!!res.cached);
      setGeneratedAt(new Date());
    } catch (err: any) {
      toast.show(err?.message || t("aiSummary.generateError"), "danger");
    }
  }

  const sources: { icon: LucideIcon; tone: Tone; label: string }[] = [
    { icon: FolderHeart, tone: "primary", label: t("aiSummary.v2.srcRecords", "Records") },
    { icon: Pill, tone: "accent", label: t("aiSummary.v2.srcMedicines", "Medicines") },
    { icon: FlaskConical, tone: "info", label: t("aiSummary.v2.srcLabs", "Lab results") },
    { icon: HeartPulse, tone: "danger", label: t("aiSummary.v2.srcVitals", "Vitals") },
  ];

  const has = (k: string) => Array.isArray(result?.[k]) && result[k].length > 0;

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiSummary.title")}
        subtitle={t("aiSummary.subtitle")}
        right={<PillCmp icon={Sparkles} label={t("aiSummary.aiPill")} tone="accent" size="sm" />}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
      >
        {aiSummary.isPending ? (
          <>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={22} color={colors.accent} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("aiSummary.v2.working", "Reading your health record…")}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {t("aiSummary.v2.workingBody", "This usually takes a few seconds")}
                  </Text>
                </View>
              </View>
            </Card>
            <Skeleton height={130} radius={20} />
            <Skeleton height={90} radius={20} />
            <Skeleton height={90} radius={20} />
          </>
        ) : result ? (
          <>
            {/* Result header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: 4 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.title.lg, { color: colors.text }]}>
                  {t("aiSummary.headerResult")}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Clock size={12} color={colors.textSubtle} strokeWidth={2.4} />
                  <Text style={[typography.caption, { color: colors.textSubtle }]}>
                    {cached
                      ? t("aiSummary.cached")
                      : t("aiSummary.v2.generatedAt", {
                          time: generatedAt?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                          defaultValue: "Generated at {{time}}",
                        })}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={generate}
                accessibilityRole="button"
                accessibilityLabel={t("aiSummary.actionRegenerate")}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  height: 34,
                  paddingHorizontal: 12,
                  borderRadius: 17,
                  backgroundColor: colors.primarySoft,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <RefreshCcw size={14} color={colors.primary} strokeWidth={2.5} />
                <Text style={[typography.label.md, { color: colors.primary }]}>
                  {t("aiSummary.actionRegenerate")}
                </Text>
              </Pressable>
            </View>

            <SummarySection icon={FileSearch} tone="primary" title={t("aiSummary.sectionOverview")}>
              <Text style={[typography.body.md, { color: colors.text, lineHeight: 23 }]}>
                {result.patientSummary || t("aiSummary.emptySummary")}
              </Text>
            </SummarySection>

            {has("risks") ? (
              <SummarySection icon={AlertTriangle} tone="warning" title={t("aiSummary.sectionRisks")} tinted>
                <BulletList items={result.risks} icon={AlertTriangle} color={colors.warning} />
              </SummarySection>
            ) : null}

            {has("diagnoses") ? (
              <SummarySection icon={Stethoscope} tone="primary" title={t("aiSummary.sectionDiagnoses")}>
                <ChipList items={result.diagnoses} tone="primary" />
              </SummarySection>
            ) : null}

            {has("medicines") ? (
              <SummarySection icon={Pill} tone="accent" title={t("aiSummary.sectionMedicines")}>
                <ChipList items={result.medicines} tone="accent" />
              </SummarySection>
            ) : null}

            {has("recentTests") ? (
              <SummarySection icon={FlaskConical} tone="info" title={t("aiSummary.sectionRecentTests")}>
                <ChipList items={result.recentTests} tone="info" />
              </SummarySection>
            ) : null}

            {has("history") ? (
              <SummarySection icon={History} tone="neutral" title={t("aiSummary.sectionHistory")}>
                <BulletList items={result.history} color={colors.primary} />
              </SummarySection>
            ) : null}

            <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center", marginTop: spacing.sm }]}>
              {t("aiSummary.disclaimer")}
            </Text>
          </>
        ) : (
          <>
            {/* Idle: one clear call to action */}
            <Card>
              <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
                <View
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 22,
                    borderCurve: "continuous",
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={30} color={colors.accent} strokeWidth={2.1} />
                </View>
                <Text style={[typography.title.lg, { color: colors.text, textAlign: "center" }]}>
                  {t("aiSummary.v2.idleTitle", "Your health, in one page")}
                </Text>
                <Text style={[typography.body.md, { color: colors.textMuted, textAlign: "center" }]}>
                  {t("aiSummary.bodyIdle")}
                </Text>
              </View>
            </Card>

            <Text style={[typography.overline, { color: colors.textMuted, marginLeft: 4, marginTop: spacing.sm }]}>
              {t("aiSummary.v2.sourcesTitle", "What we'll read")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {sources.map((s) => {
                const pal = tonePalette(s.tone, colors);
                return (
                  <View
                    key={s.label}
                    style={{
                      flexBasis: "47%",
                      flexGrow: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderRadius: 18,
                      borderCurve: "continuous",
                      backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.hairline,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 11,
                        borderCurve: "continuous",
                        backgroundColor: pal.bg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <s.icon size={17} color={pal.fg} strokeWidth={2.3} />
                    </View>
                    <Text style={[typography.label.lg, { color: colors.text }]}>{s.label}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={[typography.overline, { color: colors.textMuted, marginLeft: 4, marginTop: spacing.sm }]}>
              {t("aiSummary.v2.getTitle", "You'll get")}
            </Text>
            <Card>
              <BulletList
                items={[
                  t("aiSummary.v2.get1", "A short overview in everyday language"),
                  t("aiSummary.v2.get2", "Your diagnoses, medicines and recent tests"),
                  t("aiSummary.v2.get3", "Risks worth raising with your doctor"),
                ]}
                color={colors.accent}
              />
            </Card>

            <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center", marginTop: spacing.xs }]}>
              {t("aiSummary.disclaimer")}
            </Text>
          </>
        )}
      </ScrollView>

      {/* Sticky generate — only before the first result */}
      {!result && !aiSummary.isPending ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.hairline,
          }}
        >
          <Button
            title={t("aiSummary.actionGenerate")}
            icon={Sparkles}
            size="lg"
            onPress={generate}
            loading={aiSummary.isPending}
          />
        </View>
      ) : null}
    </Screen>
  );
}
