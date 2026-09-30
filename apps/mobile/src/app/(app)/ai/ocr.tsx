// @ts-nocheck

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Image as ImageIcon,
  Pill,
  Sparkles,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Sun,
  FileText,
  Maximize,
  Stethoscope,
  CalendarDays,
  ClipboardList,
  Plus,
  Check,
} from "lucide-react-native";
import { useAiOcr, useUploadFile } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Pill as PillCmp,
  TextInput,
  useToast,
} from "@/components/ui";

const HINT_PRESETS = ["handwritten", "blurry", "brandNames"] as const;

/** Four L-shaped corner marks — reads as a camera viewfinder. */
function Viewfinder({ color, inset = 14, size = 26 }: { color: string; inset?: number; size?: number }) {
  const w = 3;
  const base = { position: "absolute" as const, width: size, height: size, borderColor: color };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[base, { top: inset, left: inset, borderTopWidth: w, borderLeftWidth: w, borderTopLeftRadius: 10 }]} />
      <View style={[base, { top: inset, right: inset, borderTopWidth: w, borderRightWidth: w, borderTopRightRadius: 10 }]} />
      <View style={[base, { bottom: inset, left: inset, borderBottomWidth: w, borderLeftWidth: w, borderBottomLeftRadius: 10 }]} />
      <View style={[base, { bottom: inset, right: inset, borderBottomWidth: w, borderRightWidth: w, borderBottomRightRadius: 10 }]} />
    </View>
  );
}

export default function AiOcrScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme, shadow } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const upload = useUploadFile();
  const aiOcr = useAiOcr();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [presets, setPresets] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const busy = upload.isPending || aiOcr.isPending;

  // Scanning sweep over the preview while the request runs.
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!busy) {
      sweep.stopAnimation();
      sweep.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [busy, sweep]);

  async function pickFrom(source: "camera" | "gallery") {
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show(t("aiOcr.permissionDenied"), "warning");
        return;
      }
      const res =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              base64: false,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              base64: false,
            });
      if (res.canceled || !res.assets?.[0]) return;
      setImageUri(res.assets[0].uri);
      setResult(null);
      setAdded(false);
    } catch (err: any) {
      toast.show(err?.message || t("aiOcr.pickImageError"), "danger");
    }
  }

  function clearImage() {
    setImageUri(null);
    setResult(null);
    setAdded(false);
  }

  function togglePreset(p: string) {
    setPresets((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function runOcr() {
    if (!imageUri) {
      toast.show(t("aiOcr.pickFirst"), "warning");
      return;
    }
    try {
      const form = new FormData();
      const filename = (imageUri.split("/").pop() || "rx.jpg").split("?")[0];
      // @ts-ignore RN FormData accepts this shape
      form.append("file", {
        uri: imageUri,
        name: filename,
        type: "image/jpeg",
      });
      const up = await upload.mutateAsync(form as any);
      const fileUrl = up?.file?.url || up?.url || null;

      const textHint = [...presets.map((p) => t(`aiOcr.v2.preset.${p}`)), hint.trim()]
        .filter(Boolean)
        .join(", ");
      const res = await aiOcr.mutateAsync({
        fileUrl: fileUrl || imageUri,
        textHint: textHint || undefined,
      });
      setResult(res);
      setAdded(false);
    } catch (err: any) {
      toast.show(err?.message || t("aiOcr.ocrError"), "danger");
    }
  }

  async function addAllMedicines() {
    const meds = result?.medicines ?? [];
    if (!meds.length) return;
    setAdding(true);
    try {
      // Sequential POSTs — same payload shape as the add-record OCR sheet.
      for (const m of meds) {
        await api("/medicines", {
          method: "POST",
          body: { name: m.name, dosage: m.dosage || undefined, status: "active" },
        });
      }
      queryClient.invalidateQueries({
        predicate: (q) => JSON.stringify(q.queryKey).toLowerCase().includes("medicine"),
      });
      setAdded(true);
      toast.show(t("aiOcr.v2.addedN", { count: meds.length }), "success");
    } catch (err: any) {
      toast.show(err?.message || t("aiOcr.v2.addError"), "danger");
    } finally {
      setAdding(false);
    }
  }

  const status = upload.isPending
    ? t("aiOcr.v2.statusUploading", "Uploading photo…")
    : t("aiOcr.v2.statusReading", "Reading medicines…");
  const surface = scheme === "dark" ? colors.surfaceElevated : colors.surface;
  const medicines: any[] = result?.medicines ?? [];

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiOcr.title")}
        subtitle={t("aiOcr.subtitle")}
        right={<PillCmp icon={Sparkles} label={t("aiOcr.aiPill")} tone="accent" size="sm" />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Capture / preview ─── */}
        {imageUri ? (
          <View style={{ gap: spacing.sm }}>
            <View
              style={{
                height: 300,
                borderRadius: 24,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: "#0B1220",
              }}
            >
              <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              <Viewfinder color={busy ? colors.accent : "rgba(255,255,255,0.85)"} />
              {busy ? (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: 20,
                      right: 20,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: colors.accent,
                      shadowColor: colors.accent,
                      shadowOpacity: 0.9,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 0 },
                      transform: [
                        { translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [24, 272] }) },
                      ],
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 14,
                      alignSelf: "center",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: "rgba(0,0,0,0.6)",
                    }}
                  >
                    <Sparkles size={13} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={[typography.label.sm, { color: "#FFFFFF" }]}>{status}</Text>
                  </View>
                </>
              ) : null}
            </View>
            {!busy ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button
                  title={t("aiOcr.v2.retake", "Retake")}
                  icon={RefreshCw}
                  variant="secondary"
                  size="sm"
                  onPress={() => pickFrom("camera")}
                  style={{ flex: 1 }}
                />
                <Button
                  title={t("aiOcr.removeButton")}
                  icon={Trash2}
                  variant="ghost"
                  size="sm"
                  onPress={clearImage}
                  style={{ flex: 1 }}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Pressable
              onPress={() => pickFrom("camera")}
              accessibilityRole="button"
              accessibilityLabel={t("aiOcr.cameraButton")}
              style={({ pressed }) => [
                {
                  height: 260,
                  borderRadius: 24,
                  borderCurve: "continuous",
                  backgroundColor: surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.hairline,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.md,
                  opacity: pressed ? 0.9 : 1,
                },
                scheme === "dark" ? null : shadow.xs,
              ]}
            >
              <Viewfinder color={colors.primary} inset={18} size={30} />
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  borderCurve: "continuous",
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Camera size={32} color={colors.onPrimary} strokeWidth={2} />
              </View>
              <View style={{ alignItems: "center", gap: 4, paddingHorizontal: spacing.xl }}>
                <Text style={[typography.title.md, { color: colors.text }]}>
                  {t("aiOcr.v2.captureTitle", "Scan a prescription")}
                </Text>
                <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
                  {t("aiOcr.v2.captureBody", "Tap to open the camera. We'll pick out each medicine and its dose.")}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => pickFrom("gallery")}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 48,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: colors.fill,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <ImageIcon size={17} color={colors.primary} strokeWidth={2.3} />
              <Text style={[typography.label.lg, { color: colors.primary }]}>
                {t("aiOcr.v2.fromGallery", "Choose from gallery")}
              </Text>
            </Pressable>

            {/* Photo tips */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {[
                { icon: Sun, label: t("aiOcr.v2.tipLight", "Good light") },
                { icon: FileText, label: t("aiOcr.v2.tipFlat", "Lay it flat") },
                { icon: Maximize, label: t("aiOcr.v2.tipFrame", "Fill the frame") },
              ].map((tip) => (
                <View
                  key={tip.label}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: spacing.md,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    backgroundColor: surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.hairline,
                  }}
                >
                  <tip.icon size={17} color={colors.accent} strokeWidth={2.3} />
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {tip.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Hint ─── */}
        {imageUri && !result ? (
          <View style={{ gap: 10 }}>
            <Text style={[typography.overline, { color: colors.textMuted, marginLeft: 4 }]}>
              {t("aiOcr.v2.hintTitle", "Help us read it (optional)")}
            </Text>
            <Card padded={false}>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {HINT_PRESETS.map((p) => {
                    const sel = presets.includes(p);
                    return (
                      <Pressable
                        key={p}
                        onPress={() => togglePreset(p)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: sel }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          height: 34,
                          paddingHorizontal: 12,
                          borderRadius: 17,
                          borderWidth: 1.5,
                          borderColor: sel ? colors.primary : "transparent",
                          backgroundColor: sel ? colors.primarySoft : colors.fill,
                        }}
                      >
                        {sel ? <Check size={12} color={colors.primary} strokeWidth={3} /> : null}
                        <Text style={[typography.label.md, { color: sel ? colors.primary : colors.text }]}>
                          {t(`aiOcr.v2.preset.${p}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={hint}
                  onChangeText={setHint}
                  placeholder={t("aiOcr.v2.hintPlaceholder", "Anything else? e.g. doctor's name")}
                  leadingIcon={Sparkles}
                  tone="soft"
                />
              </View>
            </Card>
          </View>
        ) : null}

        {/* ─── Results ─── */}
        {result && !busy ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 4 }}>
              <CheckCircle2 size={16} color={colors.success} strokeWidth={2.4} />
              <Text style={[typography.title.md, { color: colors.text, flex: 1 }]}>
                {medicines.length
                  ? t("aiOcr.v2.foundN", { count: medicines.length })
                  : t("aiOcr.medicinesSection")}
              </Text>
            </View>

            {medicines.length > 0 ? (
              <Card padded={false}>
                {medicines.map((m: any, idx: number) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        backgroundColor: colors.accentSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Pill size={18} color={colors.accent} strokeWidth={2.3} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]} numberOfLines={2}>
                        {[m.dosage, m.frequency, m.timing].filter(Boolean).join(" · ") ||
                          t("aiOcr.v2.noDose", "Dose not detected")}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            ) : (
              <Card>
                <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md }}>
                  <Pill size={24} color={colors.textSubtle} strokeWidth={2.2} />
                  <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
                    {t("aiOcr.noMeds")}
                  </Text>
                </View>
              </Card>
            )}

            {result.doctor || result.date || result.diagnosis ? (
              <Card padded={false}>
                {[
                  result.doctor && { icon: Stethoscope, label: t("aiOcr.v2.doctor", "Doctor"), value: result.doctor },
                  result.date && { icon: CalendarDays, label: t("aiOcr.v2.date", "Date"), value: result.date },
                  result.diagnosis && {
                    icon: ClipboardList,
                    label: t("aiOcr.v2.diagnosis", "Diagnosis"),
                    value: result.diagnosis,
                  },
                ]
                  .filter(Boolean)
                  .map((row: any, i: number) => (
                    <View
                      key={row.label}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: colors.separator,
                      }}
                    >
                      <row.icon size={16} color={colors.textSubtle} strokeWidth={2.3} />
                      <Text style={[typography.body.sm, { color: colors.textMuted, width: 80 }]}>{row.label}</Text>
                      <Text style={[typography.title.xs, { color: colors.text, flex: 1, textAlign: "right" }]}>
                        {row.value}
                      </Text>
                    </View>
                  ))}
              </Card>
            ) : null}

            {result.note ? (
              <Text style={[typography.body.sm, { color: colors.textMuted, paddingHorizontal: 4 }]}>
                {result.note}
              </Text>
            ) : null}

            <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center" }]}>
              {t("aiOcr.disclaimer")}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky action */}
      {imageUri ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            backgroundColor: surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.hairline,
          }}
        >
          {result && medicines.length > 0 && !busy ? (
            <Button
              title={
                added
                  ? t("aiOcr.v2.addedN", { count: medicines.length })
                  : t("aiOcr.v2.addAll", { count: medicines.length })
              }
              icon={added ? Check : Plus}
              size="lg"
              onPress={addAllMedicines}
              loading={adding}
              disabled={added}
            />
          ) : (
            <Button
              title={t("aiOcr.readButton")}
              icon={Sparkles}
              size="lg"
              onPress={runOcr}
              loading={busy}
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
