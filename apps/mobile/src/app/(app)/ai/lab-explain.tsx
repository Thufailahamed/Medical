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
  EmptyState,
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
            <SectionHeader title={t("aiLabExplain.sections.explanation")} />
            <View style={{ padding: spacing.lg, paddingTop: 0 }}>
              <Text
                style={[
                  typography.body.md,
                  { color: colors.text, lineHeight: 22 },
                ]}
              >
                {result.explanation || t("aiLabExplain.noExplanation")}
              </Text>
            </View>
          </Card>

          {result.abnormalValues && result.abnormalValues.length > 0 ? (
            <Card>
              <SectionHeader
                title={t("aiLabExplain.sections.abnormal")}
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
                title={t("aiLabExplain.sections.recommendations")}
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
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={FlaskConical}
            title={t("aiLabExplain.noReportsTitle")}
            message={t("aiLabExplain.noReportsBody")}
            tone="neutral"
          />
        </View>
      ) : aiExplain.isPending ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={80} radius={16} />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, marginBottom: spacing.xs },
            ]}
          >
            {t("aiLabExplain.pickPrompt")}
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
        </View>
      )}
    </Screen>
  );
}