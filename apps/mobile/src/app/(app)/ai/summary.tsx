// @ts-nocheck

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
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
} from "lucide-react-native";
import { useAiSummary } from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
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
  useToast,
} from "@/components/ui";

export default function AiSummaryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const patient = useAuthStore((s) => s.patient);

  const aiSummary = useAiSummary();
  const [result, setResult] = useState<any>(null);
  const [cached, setCached] = useState<boolean>(false);

  async function generate() {
    if (!patient?.id) {
      toast.show(t("aiSummary.noPatient"), "warning");
      return;
    }
    try {
      const res = await aiSummary.mutateAsync({ patientId: patient.id });
      setResult(res.summary);
      setCached(!!res.cached);
    } catch (err: any) {
      toast.show(err?.message || t("aiSummary.generateError"), "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiSummary.title")}
        subtitle={t("aiSummary.subtitle")}
        right={
          <PillCmp
            icon={Sparkles}
            label={t("aiSummary.aiPill")}
            tone="accent"
            size="sm"
          />
        }
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <View
            style={{
              padding: spacing.lg,
              gap: spacing.md,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: colors.accentSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={28} color={colors.accent} strokeWidth={2.2} />
            </View>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, textAlign: "center" },
              ]}
            >
              {result ? t("aiSummary.yourSummary") : t("aiSummary.generateTitle")}
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, textAlign: "center" },
              ]}
            >
              {result
                ? t("aiSummary.bodyReady")
                : t("aiSummary.bodyIntro")}
            </Text>
            <Button
              title={result ? t("aiSummary.regenerate") : t("aiSummary.generateAction")}
              icon={result ? RefreshCcw : Sparkles}
              onPress={generate}
              loading={aiSummary.isPending}
              variant={result ? "outline" : "primary"}
              size="lg"
              fullWidth={false}
            />
            {cached ? (
              <PillCmp label={t("aiSummary.fromCache")} tone="neutral" size="sm" />
            ) : null}
          </View>
        </Card>

        {aiSummary.isPending ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={120} radius={20} />
            <Skeleton height={80} radius={16} />
            <Skeleton height={120} radius={20} />
          </View>
        ) : result ? (
          <View style={{ gap: spacing.md }}>
            <Card>
              <SectionHeader title={t("aiSummary.sections.overview")} />
              <View style={{ padding: spacing.lg, paddingTop: 0 }}>
                <Text
                  style={[
                    typography.body.md,
                    { color: colors.text, lineHeight: 22 },
                  ]}
                >
                  {result.patientSummary || t("aiSummary.noBody")}
                </Text>
              </View>
            </Card>

            {result.diagnoses && result.diagnoses.length > 0 ? (
              <Card>
                <SectionHeader
                  title={t("aiSummary.sections.diagnoses")}
                />
                <View
                  style={{
                    padding: spacing.lg,
                    paddingTop: 0,
                    gap: spacing.xs,
                    flexDirection: "row",
                    flexWrap: "wrap",
                  }}
                >
                  {result.diagnoses.map((d: string, idx: number) => (
                    <PillCmp
                      key={idx}
                      label={d}
                      tone="primary"
                      size="sm"
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            {result.medicines && result.medicines.length > 0 ? (
              <Card>
                <SectionHeader title={t("aiSummary.sections.medicines")} />
                <View
                  style={{
                    padding: spacing.lg,
                    paddingTop: 0,
                    gap: spacing.xs,
                    flexDirection: "row",
                    flexWrap: "wrap",
                  }}
                >
                  {result.medicines.map((m: string, idx: number) => (
                    <PillCmp
                      key={idx}
                      label={m}
                      tone="accent"
                      size="sm"
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            {result.history && result.history.length > 0 ? (
              <Card>
                <SectionHeader title={t("aiSummary.sections.history")} />
                <View
                  style={{
                    padding: spacing.lg,
                    paddingTop: 0,
                    gap: spacing.sm,
                  }}
                >
                  {result.history.map((h: string, idx: number) => (
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
                        {h}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {result.recentTests && result.recentTests.length > 0 ? (
              <Card>
                <SectionHeader
                  title={t("aiSummary.sections.recentTests")}
                />
                <View
                  style={{
                    padding: spacing.lg,
                    paddingTop: 0,
                    gap: spacing.xs,
                    flexDirection: "row",
                    flexWrap: "wrap",
                  }}
                >
                  {result.recentTests.map((x: string, idx: number) => (
                    <PillCmp
                      key={idx}
                      label={x}
                      tone="info"
                      size="sm"
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            {result.risks && result.risks.length > 0 ? (
              <Card>
                <SectionHeader
                  title={t("aiSummary.sections.risks")}
                />
                <View
                  style={{
                    padding: spacing.lg,
                    paddingTop: 0,
                    gap: spacing.sm,
                  }}
                >
                  {result.risks.map((r: string, idx: number) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        gap: spacing.sm,
                      }}
                    >
                      <AlertTriangle
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
                        {r}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            <Text
              style={[
                typography.caption,
                { color: colors.textSubtle, textAlign: "center" },
              ]}
            >
              {t("aiSummary.disclaimer")}
            </Text>
          </View>
        ) : (
          <EmptyState
            icon={Sparkles}
            title={t("aiSummary.emptyTitle")}
            message={t("aiSummary.emptyBody")}
          />
        )}
      </View>
    </Screen>
  );
}