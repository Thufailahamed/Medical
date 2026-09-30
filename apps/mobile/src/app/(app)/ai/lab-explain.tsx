// @ts-nocheck

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";
import {
  Sparkles,
  FlaskConical,
  AlertCircle,
  ListChecks,
  Lightbulb,
  Upload,
  FolderOpen,
  ScanText,
  MessageSquareText,
  ShieldCheck,
  TrendingDown,
} from "lucide-react-native";
import {
  useAiLabExplain,
  useLabReports,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  Pill as PillCmp,
  SectionHeader,
  ListItem,
  Divider,
  useToast,
  Avatar,
} from "@/components/ui";

export default function LabExplainScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const { data: reports, isLoading: loadingReports } = useLabReports();
  const aiExplain = useAiLabExplain();

  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  async function explain(report: any) {
    setSelectedReport(report);
    setResult(null);

    const fileUrl =
      report.pdfUrl ||
      report.fileUrl ||
      report.url ||
      `lab-report://${report.id}`;

    try {
      const res = await aiExplain.mutateAsync({
        fileUrl,
        reportId: report.id,
        textHint: report.aiSummary || report.reportType || "",
      });
      setResult(res.explanation);
    } catch (err: any) {
      toast.show(err?.message || t("aiLabExplain.explainError"), "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiLabExplain.title")}
        subtitle={t("aiLabExplain.subtitle")}
        right={<PillCmp icon={Sparkles} label={t("aiLabExplain.aiPill")} tone="accent" size="sm" />}
      />

      {result && selectedReport ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        >
          <Card>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    backgroundColor: colors.infoSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FlaskConical
                    size={22}
                    color={colors.info}
                    strokeWidth={2.2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {selectedReport.reportType}
                  </Text>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    {fmtDate(new Date(selectedReport.createdAt), locale)}
                  </Text>
                </View>
                <PillCmp
                  label={selectedReport.status}
                  tone="neutral"
                  size="sm"
                />
              </View>
            </View>
          </Card>

          <Card>
            <SectionHeader title={t("aiLabExplain.sectionExplanation")} />
            <View style={{ padding: spacing.lg, paddingTop: 0 }}>
              <Text
                style={[
                  typography.body.md,
                  { color: colors.text, lineHeight: 22 },
                ]}
              >
                {result.explanation || t("aiLabExplain.emptyExplanation")}
              </Text>
            </View>
          </Card>

          {result.abnormalValues && result.abnormalValues.length > 0 ? (
            <Card>
              <SectionHeader
                title={t("aiLabExplain.sectionAbnormal")}
              />
              <View
                style={{
                  padding: spacing.lg,
                  paddingTop: 0,
                  gap: spacing.sm,
                }}
              >
                {result.abnormalValues.map((v: string, idx: number) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                    }}
                  >
                    <AlertCircle
                      size={16}
                      color={colors.warning}
                      strokeWidth={2.4}
                      style={{ marginTop: 2 }}
                    />
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.text, flex: 1 },
                      ]}
                    >
                      {v}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {result.recommendations && result.recommendations.length > 0 ? (
            <Card>
              <SectionHeader
                title={t("aiLabExplain.sectionRecommendations")}
              />
              <View
                style={{
                  padding: spacing.lg,
                  paddingTop: 0,
                  gap: spacing.sm,
                }}
              >
                {result.recommendations.map((r: string, idx: number) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.primary,
                        marginTop: 8,
                      }}
                    />
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.text, flex: 1 },
                      ]}
                    >
                      {r}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Button
            title={t("aiLabExplain.pickAnother")}
            icon={Lightbulb}
            variant="ghost"
            onPress={() => setResult(null)}
            fullWidth={false}
          />

          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, textAlign: "center" },
            ]}
          >
            {t("aiLabExplain.disclaimer")}
          </Text>
        </ScrollView>
      ) : loadingReports ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={80} radius={20} />
          ))}
        </View>
      ) : (reports?.reports || []).length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl }}
        >
          {/* Intro + example of what the explainer produces */}
          <Card padded={false} style={{ overflow: "hidden" }}>
            <View style={{ padding: spacing.xl, gap: spacing.md, alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 22,
                  borderCurve: "continuous",
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FlaskConical size={30} color={colors.accent} strokeWidth={2} />
                <View
                  style={{
                    position: "absolute",
                    right: -6,
                    top: -6,
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: colors.accent,
                    borderWidth: 3,
                    borderColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={12} color={colors.onAccent} strokeWidth={2.6} />
                </View>
              </View>
              <Text style={[typography.title.lg, { color: colors.text, textAlign: "center" }]}>
                {t("aiLabExplain.empty.title", "Understand your lab results")}
              </Text>
              <Text style={[typography.body.md, { color: colors.textMuted, textAlign: "center" }]}>
                {t(
                  "aiLabExplain.empty.body",
                  "Add a lab report and we'll explain each value in plain language — what's normal, what to watch, and what to ask your doctor."
                )}
              </Text>
            </View>

            {/* Example output */}
            <View
              style={{
                marginHorizontal: spacing.lg,
                marginBottom: spacing.lg,
                padding: spacing.md,
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor: colors.fill,
                gap: spacing.sm,
              }}
            >
              <Text style={[typography.overline, { color: colors.textSubtle, fontSize: 10 }]}>
                {t("aiLabExplain.empty.exampleLabel", "Example")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    backgroundColor: colors.warningSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TrendingDown size={15} color={colors.warning} strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.xs, { color: colors.text }]}>
                    {t("aiLabExplain.empty.exampleValue", "Haemoglobin · 11.2 g/dL")}
                  </Text>
                  <Text style={[typography.caption, { color: colors.warning }]}>
                    {t("aiLabExplain.empty.exampleFlag", "Slightly below range")}
                  </Text>
                </View>
              </View>
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {t(
                  "aiLabExplain.empty.exampleText",
                  "This carries oxygen in your blood. A little low can cause tiredness — worth asking about iron levels."
                )}
              </Text>
            </View>
          </Card>

          {/* Steps */}
          <View style={{ gap: spacing.md }}>
            <Text style={[typography.overline, { color: colors.textMuted, marginLeft: 4 }]}>
              {t("aiLabExplain.empty.howTitle", "How it works")}
            </Text>
            <Card padded={false}>
              {[
                { icon: Upload, text: t("aiLabExplain.empty.step1", "Upload a PDF or photo of your report") },
                { icon: ScanText, text: t("aiLabExplain.empty.step2", "We read each test value and its range") },
                { icon: MessageSquareText, text: t("aiLabExplain.empty.step3", "Get a plain-language explanation") },
              ].map((step, i, all) => (
                <View key={i}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <step.icon size={17} color={colors.primary} strokeWidth={2.3} />
                    </View>
                    <Text style={[typography.body.md, { color: colors.text, flex: 1 }]}>
                      {step.text}
                    </Text>
                    <Text style={[typography.label.md, { color: colors.textSubtle }]}>{i + 1}</Text>
                  </View>
                  {i < all.length - 1 ? <Divider inset={spacing.lg + 36 + spacing.md} /> : null}
                </View>
              ))}
            </Card>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Button
              title={t("aiLabExplain.empty.upload", "Upload a lab report")}
              icon={Upload}
              size="lg"
              onPress={() => router.push("/(app)/add-record")}
            />
            <Button
              title={t("aiLabExplain.empty.browse", "Browse my records")}
              icon={FolderOpen}
              variant="ghost"
              onPress={() => router.push("/(app)/records")}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: spacing.md }}>
            <ShieldCheck size={13} color={colors.textSubtle} strokeWidth={2.3} style={{ marginTop: 1 }} />
            <Text style={[typography.caption, { color: colors.textSubtle, flex: 1 }]}>
              {t("aiLabExplain.disclaimer")}
            </Text>
          </View>
        </ScrollView>
      ) : aiExplain.isPending ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
            <Sparkles size={16} color={colors.accent} strokeWidth={2.4} />
            <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {t("aiLabExplain.reading", {
                name: selectedReport?.reportType ?? "",
                defaultValue: "Reading {{name}}…",
              })}
            </Text>
          </View>
          <Skeleton height={120} radius={20} />
          <Skeleton height={80} radius={16} />
          <Skeleton height={80} radius={16} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        >
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, marginBottom: spacing.xs },
            ]}
          >
            {t("aiLabExplain.pickTitle")}
          </Text>
          {(reports?.reports || []).map((r: any) => (
            <ListItem
              key={r.id}
              icon={FlaskConical}
              iconTone="info"
              title={r.reportType}
              subtitle={`${fmtDate(new Date(r.createdAt), locale)} · ${r.status}`}
              pill={{ label: t("aiLabExplain.explainPill"), tone: "primary" }}
              onPress={() => explain(r)}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}