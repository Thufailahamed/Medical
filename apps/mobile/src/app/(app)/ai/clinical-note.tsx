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
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import {
  Sparkles,
  RefreshCcw,
  Stethoscope,
  AlertCircle,
  ClipboardPaste,
  Copy,
  X,
  Wand2,
  type LucideIcon,
} from "lucide-react-native";
import { useAiClinicalNoteSummary } from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Skeleton,
  Pill as PillCmp,
  TextInput,
  useToast,
} from "@/components/ui";

const SOAP: { key: "subjective" | "objective" | "assessment" | "plan"; letter: string; labelKey: string; tone: Tone }[] = [
  { key: "subjective", letter: "S", labelKey: "aiClinicalNote.soapS", tone: "primary" },
  { key: "objective", letter: "O", labelKey: "aiClinicalNote.soapO", tone: "info" },
  { key: "assessment", letter: "A", labelKey: "aiClinicalNote.soapA", tone: "warning" },
  { key: "plan", letter: "P", labelKey: "aiClinicalNote.soapP", tone: "accent" },
];

function SmallAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 32,
        paddingHorizontal: 11,
        borderRadius: 16,
        backgroundColor: colors.fill,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={13} color={colors.primary} strokeWidth={2.5} />
      <Text style={[typography.label.sm, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

export default function AiClinicalNoteScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme } = useTheme();
  const toast = useToast();
  const patient = useAuthStore((s) => s.patient);

  const aiSummary = useAiClinicalNoteSummary();
  const [noteText, setNoteText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [cached, setCached] = useState<boolean>(false);
  const [generatedFor, setGeneratedFor] = useState<string | null>(null);

  const trimmed = noteText.trim();
  const tooShort = trimmed.length < 5;
  const isFresh = !!result && generatedFor === trimmed;

  async function generate() {
    if (!patient?.id) {
      toast.show(t("aiClinicalNote.noProfile"), "warning");
      return;
    }
    if (tooShort) {
      toast.show(t("aiClinicalNote.inputTooShort"), "warning");
      return;
    }
    try {
      const res = await aiSummary.mutateAsync({ patientId: patient.id, noteText: trimmed });
      setResult(res.summary);
      setCached(!!res.cached);
      setGeneratedFor(trimmed);
    } catch (err: any) {
      toast.show(err?.message || t("aiClinicalNote.generateError"), "danger");
    }
  }

  async function pasteNote() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text?.trim()) setNoteText(text);
      else toast.show(t("aiClinicalNote.v2.clipboardEmpty", "Clipboard is empty"), "info");
    } catch {
      toast.show(t("aiClinicalNote.v2.clipboardEmpty", "Clipboard is empty"), "info");
    }
  }

  async function copySoap() {
    if (!result) return;
    const lines = [
      result.summary,
      "",
      ...SOAP.map((f) => `${t(f.labelKey)}: ${result.soap?.[f.key] || "—"}`),
      result.keyTerms?.length ? `\n${t("aiClinicalNote.sectionKeyTerms")}: ${result.keyTerms.join(", ")}` : "",
    ].filter((x) => x !== undefined);
    await Clipboard.setStringAsync(lines.join("\n").trim());
    toast.show(t("aiClinicalNote.v2.copied", "SOAP note copied"), "success");
  }

  const surface = scheme === "dark" ? colors.surfaceElevated : colors.surface;

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiClinicalNote.title")}
        subtitle={t("aiClinicalNote.subtitle")}
        right={<PillCmp icon={Sparkles} label={t("aiClinicalNote.aiPill")} tone="accent" size="sm" />}
      />

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl }}
      >
        {/* ─── Result ─── */}
        {aiSummary.isPending ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 4 }}>
              <Sparkles size={15} color={colors.accent} strokeWidth={2.4} />
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("aiClinicalNote.v2.working", "Structuring your note…")}
              </Text>
            </View>
            <Skeleton height={84} radius={20} />
            <Skeleton height={220} radius={20} />
          </View>
        ) : result ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: 4 }}>
              <Text style={[typography.title.lg, { color: colors.text, flex: 1 }]}>
                {t("aiClinicalNote.headerResult")}
              </Text>
              {cached ? <PillCmp label={t("aiClinicalNote.cached")} tone="neutral" size="sm" /> : null}
              <SmallAction icon={Copy} label={t("aiClinicalNote.v2.copy", "Copy")} onPress={copySoap} />
            </View>

            {/* One-line summary */}
            <View
              style={{
                padding: spacing.lg,
                gap: 6,
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor: colors.accentSoft,
              }}
            >
              <Text style={[typography.overline, { color: colors.accent, fontSize: 10 }]}>
                {t("aiClinicalNote.sectionSummary")}
              </Text>
              <Text style={[typography.title.sm, { color: colors.text, lineHeight: 21 }]}>
                {result.summary || t("aiSummary.emptySummary")}
              </Text>
            </View>

            {/* SOAP */}
            <Card padded={false}>
              {SOAP.map((f, i) => {
                const pal = tonePalette(f.tone, colors);
                return (
                  <View
                    key={f.key}
                    style={{
                      flexDirection: "row",
                      gap: spacing.md,
                      padding: spacing.lg,
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        borderCurve: "continuous",
                        backgroundColor: pal.bg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={[typography.title.sm, { color: pal.fg }]}>{f.letter}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[typography.caption, { color: colors.textSubtle }]}>{t(f.labelKey)}</Text>
                      <Text
                        style={[
                          typography.body.md,
                          { color: result.soap?.[f.key] ? colors.text : colors.textSubtle, lineHeight: 21 },
                        ]}
                      >
                        {result.soap?.[f.key] || t("aiClinicalNote.v2.notMentioned", "Not mentioned in the note")}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>

            {result.keyTerms?.length ? (
              <View style={{ gap: 8 }}>
                <Text style={[typography.overline, { color: colors.textMuted, marginLeft: 4 }]}>
                  {t("aiClinicalNote.sectionKeyTerms")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {result.keyTerms.map((term: string, i: number) => (
                    <View
                      key={`${term}-${i}`}
                      style={{
                        paddingHorizontal: 11,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: surface,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.hairline,
                      }}
                    >
                      <Text style={[typography.label.md, { color: colors.text }]}>{term}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 4 }}>
              <AlertCircle size={13} color={colors.textSubtle} style={{ marginTop: 1 }} />
              <Text style={[typography.caption, { color: colors.textSubtle, flex: 1 }]}>
                {t("aiClinicalNote.disclaimer")}
              </Text>
            </View>
          </View>
        ) : (
          /* Idle intro — what SOAP means, at a glance */
          <View style={{ gap: spacing.md }}>
            <Text style={[typography.body.md, { color: colors.textMuted, marginHorizontal: 4 }]}>
              {t("aiClinicalNote.v2.intro", "Paste a free-text note and we'll structure it into a one-line summary, SOAP sections and key terms.")}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {SOAP.map((f) => {
                const pal = tonePalette(f.tone, colors);
                return (
                  <View
                    key={f.key}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      gap: 4,
                      paddingVertical: spacing.md,
                      borderRadius: 16,
                      borderCurve: "continuous",
                      backgroundColor: pal.bg,
                    }}
                  >
                    <Text style={[typography.title.lg, { color: pal.fg }]}>{f.letter}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]} numberOfLines={1}>
                      {t(f.labelKey)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Note input ─── */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 4 }}>
            <Text style={[typography.overline, { color: colors.textMuted, flex: 1 }]}>
              {t("aiClinicalNote.inputLabel")}
            </Text>
            {noteText ? (
              <SmallAction icon={X} label={t("common.clear", "Clear")} onPress={() => setNoteText("")} />
            ) : (
              <>
                <SmallAction icon={ClipboardPaste} label={t("aiClinicalNote.v2.paste", "Paste")} onPress={pasteNote} />
                <SmallAction
                  icon={Wand2}
                  label={t("aiClinicalNote.v2.example", "Example")}
                  onPress={() => setNoteText(t("aiClinicalNote.placeholder").replace(/^e\.g\.\s*/, ""))}
                />
              </>
            )}
          </View>
          <Card padded={false}>
            <View style={{ padding: spacing.md, gap: 6 }}>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t("aiClinicalNote.v2.inputPlaceholder", "Type or paste the doctor's note here…")}
                multiline
                tone="soft"
                style={{ minHeight: 170, textAlignVertical: "top", fontSize: 15, lineHeight: 22 }}
              />
              <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "right", marginRight: 4 }]}>
                {t("aiClinicalNote.v2.chars", { count: trimmed.length, defaultValue: "{{count}} characters" })}
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Sticky action */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          backgroundColor: surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
        }}
      >
        <Button
          title={
            tooShort
              ? t("aiClinicalNote.v2.addNoteFirst", "Add a note to generate")
              : isFresh
                ? t("aiClinicalNote.actionRegenerate")
                : t("aiClinicalNote.actionGenerate")
          }
          onPress={generate}
          loading={aiSummary.isPending}
          icon={isFresh ? RefreshCcw : Stethoscope}
          size="lg"
          disabled={tooShort}
        />
      </View>
    </Screen>
  );
}
