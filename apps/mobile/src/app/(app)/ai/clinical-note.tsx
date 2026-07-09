// @ts-nocheck

// Day 2 #1 mobile surface.
//
// Paste a doctor's free-text note → 1-line summary + SOAP fields
// (subjective/objective/assessment/plan) + key terms. Calls
// /ai/clinical-note-summary and renders the result.
//
// This is a thin shell over the existing AI plumbing; UI reuses the
// patterns from ai/summary.tsx (Card + Pill + Button + skeleton).

import { useState } from "react";
import { View, Text, ScrollView, TextInput as RNTextInput } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCcw, Stethoscope, Pill as PillIcon, AlertCircle } from "lucide-react-native";
import { useAiClinicalNoteSummary } from "@/hooks/useApi";
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

export default function AiClinicalNoteScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const patient = useAuthStore((s) => s.patient);

  const aiSummary = useAiClinicalNoteSummary();
  const [noteText, setNoteText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [cached, setCached] = useState<boolean>(false);

  async function generate() {
    if (!patient?.id) {
      toast.show(t("aiClinicalNote.noProfile"), "warning");
      return;
    }
    if (!noteText.trim() || noteText.trim().length < 5) {
      toast.show(t("aiClinicalNote.inputTooShort"), "warning");
      return;
    }
    try {
      const res = await aiSummary.mutateAsync({
        patientId: patient.id,
        noteText: noteText.trim(),
      });
      setResult(res.summary);
      setCached(!!res.cached);
    } catch (err: any) {
      toast.show(err?.message || t("aiClinicalNote.generateError"), "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiClinicalNote.title")}
        subtitle={t("aiClinicalNote.subtitle")}
        right={
          <PillCmp
            icon={Sparkles}
            label={t("aiClinicalNote.aiPill")}
            tone="accent"
            size="sm"
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <Card>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text
              style={{
                ...typography.h3,
                color: colors.text,
              }}
            >
              {result
                ? t("aiClinicalNote.headerResult")
                : t("aiClinicalNote.headerIdle")}
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textMuted,
              }}
            >
              {t("aiClinicalNote.bodyIdle")}
            </Text>

            <View style={{ gap: spacing.xs }}>
              <Text
                style={{
                  ...typography.label,
                  color: colors.textMuted,
                }}
              >
                {t("aiClinicalNote.inputLabel")}
              </Text>
              <RNTextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t("aiClinicalNote.placeholder")}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                style={{
                  minHeight: 160,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: spacing.md,
                  color: colors.text,
                  backgroundColor: colors.surface,
                  fontSize: 15,
                }}
              />
            </View>

            <Button
              label={
                result
                  ? t("aiClinicalNote.actionRegenerate")
                  : t("aiClinicalNote.actionGenerate")
              }
              onPress={generate}
              loading={aiSummary.isPending}
              icon={result ? RefreshCcw : Stethoscope}
              disabled={!noteText.trim()}
            />
            {cached ? (
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                {t("aiClinicalNote.cached")}
              </Text>
            ) : null}
          </View>
        </Card>

        {aiSummary.isPending ? (
          <Card>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="90%" height={14} />
              <Skeleton width="80%" height={14} />
            </View>
          </Card>
        ) : result ? (
          <>
            <Card>
              <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                <SectionHeader title={t("aiClinicalNote.sectionSummary")} />
                <Text style={{ ...typography.body, color: colors.text }}>
                  {result.summary || t("aiSummary.emptySummary")}
                </Text>
              </View>
            </Card>

            <Card>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <SectionHeader title={t("aiClinicalNote.sectionSoap")} />
                <SoapField
                  label={t("aiClinicalNote.soapS")}
                  value={result.soap?.subjective}
                />
                <SoapField
                  label={t("aiClinicalNote.soapO")}
                  value={result.soap?.objective}
                />
                <SoapField
                  label={t("aiClinicalNote.soapA")}
                  value={result.soap?.assessment}
                />
                <SoapField
                  label={t("aiClinicalNote.soapP")}
                  value={result.soap?.plan}
                />
              </View>
            </Card>

            {result.keyTerms?.length ? (
              <Card>
                <View style={{ padding: spacing.lg, gap: spacing.md }}>
                  <SectionHeader title={t("aiClinicalNote.sectionKeyTerms")} />
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing.xs,
                    }}
                  >
                    {result.keyTerms.map((term: string, i: number) => (
                      <PillCmp key={i} icon={PillIcon} label={term} size="sm" />
                    ))}
                  </View>
                </View>
              </Card>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
              }}
            >
              <AlertCircle size={14} color={colors.textMuted} />
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                {t("aiClinicalNote.disclaimer")}
              </Text>
            </View>
          </>
        ) : (
          <EmptyState
            icon={Stethoscope}
            title={t("aiClinicalNote.emptyTitle")}
            body={t("aiClinicalNote.emptyBody")}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function SoapField({ label, value }: { label: string; value?: string }) {
  const { spacing, colors, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xxs }}>
      <Text style={{ ...typography.label, color: colors.textMuted }}>{label}</Text>
      <Text style={{ ...typography.body, color: colors.text }}>
        {value || "—"}
      </Text>
    </View>
  );
}