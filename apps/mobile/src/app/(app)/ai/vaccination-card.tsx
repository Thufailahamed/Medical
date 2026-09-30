// @ts-nocheck

import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  BackHandler,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Image as ImageIcon,
  Syringe,
  Sparkles,
  Trash2,
  CheckCircle2,
  Plus,
  Edit3,
  ChevronRight,
  Sun,
  Maximize,
  ScanLine,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react-native";
import {
  useVaccinationCardOcr,
  useBulkAddVaccinations,
  useVaccinations,
  type VaccinationExtracted,
} from "@/hooks/useApi";
import { useUploadFile } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  IconTile,
  FormField,
  TextInput,
  Chip,
  useToast,
} from "@/components/ui";

type EditableVaccination = VaccinationExtracted & {
  _id: string;
  _editing: boolean;
};

export default function VaccinationCardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();

  const upload = useUploadFile();
  const cardOcr = useVaccinationCardOcr();
  const bulkAdd = useBulkAddVaccinations();
  const { data: catalogData } = useVaccinations();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"scan" | "review">("scan");
  const [vaccinations, setVaccinations] = useState<EditableVaccination[]>([]);

  const catalog = catalogData?.catalog ?? [];
  const scanning = cardOcr.isPending || upload.isPending;
  const matchedCount = vaccinations.filter((v) => v.matched).length;

  async function pickFrom(source: "camera" | "gallery") {
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show({ message: t("vaccinationCard.permissionDenied"), tone: "warning" });
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
      const asset = res.assets[0];
      setImageUri(asset.uri);
      setVaccinations([]);
      setStep("scan");
    } catch (err: any) {
      toast.show({ message: err?.message || t("vaccinationCard.pickImageError"), tone: "danger" });
    }
  }

  function clearImage() {
    setImageUri(null);
    setUploadedUrl(null);
    setVaccinations([]);
    setStep("scan");
  }

  async function runOcr() {
    if (!imageUri) {
      toast.show({ message: t("vaccinationCard.pickFirst"), tone: "warning" });
      return;
    }
    try {
      const form = new FormData();
      const filename = (imageUri.split("/").pop() || "vaccination-card.jpg").split("?")[0];
      // @ts-ignore RN FormData accepts this shape
      form.append("file", {
        uri: imageUri,
        name: filename,
        type: "image/jpeg",
      });
      const up = await upload.mutateAsync(form as any);
      const fileUrl = up?.file?.url || up?.url || null;
      if (fileUrl) setUploadedUrl(fileUrl);

      const res = await cardOcr.mutateAsync({
        fileUrl: fileUrl || imageUri,
      });

      const extracted = res?.result?.vaccinations ?? [];
      if (extracted.length === 0) {
        toast.show({ message: t("vaccinationCard.noVaccinesFound"), tone: "warning" });
        return;
      }

      const editable: EditableVaccination[] = extracted.map((v, i) => ({
        ...v,
        _id: `ext-${i}`,
        _editing: false,
      }));
      setVaccinations(editable);
      setStep("review");
    } catch (err: any) {
      toast.show({ message: err?.message || t("vaccinationCard.ocrError"), tone: "danger" });
    }
  }

  function updateVaccination(_id: string, field: string, value: any) {
    setVaccinations((prev) =>
      prev.map((v) => (v._id === _id ? { ...v, [field]: value } : v))
    );
  }

  function removeVaccination(_id: string) {
    setVaccinations((prev) => prev.filter((v) => v._id !== _id));
  }

  function addEmptyRow() {
    const newEntry: EditableVaccination = {
      vaccineName: "",
      date: new Date().toISOString().slice(0, 10),
      doseNumber: 1,
      provider: "",
      batchNumber: "",
      catalogId: null,
      catalogName: null,
      catalogShortName: null,
      matched: false,
      _id: `ext-${Date.now()}`,
      _editing: true,
    };
    setVaccinations((prev) => [...prev, newEntry]);
  }

  async function saveAll() {
    const valid = vaccinations.filter((v) => v.vaccineName.trim().length >= 2);
    if (valid.length === 0) {
      toast.show({ message: t("vaccinationCard.noValidEntries"), tone: "warning" });
      return;
    }

    try {
      await bulkAdd.mutateAsync({
        vaccinations: valid.map((v) => ({
          vaccineName: v.vaccineName.trim(),
          vaccineId: v.catalogId || undefined,
          dose: v.doseNumber || undefined,
          recordDate: v.date || new Date().toISOString().slice(0, 10),
          provider: v.provider || undefined,
          notes: v.batchNumber ? `Batch: ${v.batchNumber}` : undefined,
          batchNumber: v.batchNumber || undefined,
        })),
      });
      toast.show({ message: t("vaccinationCard.toast.saved", { count: valid.length }), tone: "success" });
      router.replace("/(app)/vaccinations");
    } catch (err: any) {
      toast.show({ message: err?.message || t("vaccinationCard.toast.error"), tone: "danger" });
    }
  }

  const handleBack = useCallback(() => {
    if (step === "review") {
      setStep("scan");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/vaccinations");
    }
  }, [step, router]);

  useEffect(() => {
    const onBackPress = () => {
      if (step === "review") {
        setStep("scan");
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [step, router]);

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={handleBack}
        title={t("vaccinationCard.title")}
        subtitle={
          step === "review"
            ? t("vaccinationCard.reviewSubtitle", { count: vaccinations.length })
            : t("vaccinationCard.subtitle")
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepRail step={step} />

          {/* Step 1: Capture */}
          {step === "scan" && (
            <>
              <Viewfinder
                imageUri={imageUri}
                scanning={scanning}
                onCapture={() => pickFrom("camera")}
                onRemove={clearImage}
              />

              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <SourceTile
                  icon={Camera}
                  label={imageUri ? t("vaccinationCard.retake") : t("vaccinationCard.cameraButton")}
                  tone="primary"
                  onPress={() => pickFrom("camera")}
                  disabled={scanning}
                />
                <SourceTile
                  icon={ImageIcon}
                  label={t("vaccinationCard.galleryShort")}
                  tone="accent"
                  onPress={() => pickFrom("gallery")}
                  disabled={scanning}
                />
              </View>

              <TipsCard />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingHorizontal: spacing.lg,
                }}
              >
                <ShieldCheck size={13} color={colors.textSubtle} strokeWidth={2.4} />
                <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center" }]}>
                  {t("vaccinationCard.privacy")}
                </Text>
              </View>
            </>
          )}

          {/* Step 2: Review */}
          {step === "review" && vaccinations.length > 0 && (
            <>
              <ReviewSummary
                total={vaccinations.length}
                matched={matchedCount}
                imageUri={imageUri}
              />

              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor: colors.warningSoft,
                }}
              >
                <AlertTriangle size={16} color={colors.warning} strokeWidth={2.4} style={{ marginTop: 1 }} />
                <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                  {t("vaccinationCard.disclaimer")}
                </Text>
              </View>

              {vaccinations.map((v, idx) => (
                <Card key={v._id} padded={false}>
                  <View style={{ padding: spacing.lg, gap: spacing.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                      <IconTile
                        icon={Syringe}
                        tone={v.matched ? "accent" : "neutral"}
                        appearance="soft"
                        size={40}
                      />
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
                          {v.vaccineName?.trim() || t("vaccinationCard.entryN", { n: idx + 1 })}
                        </Text>
                        <View style={{ flexDirection: "row" }}>
                          {v.matched && v.catalogName ? (
                            <Chip label={v.catalogShortName || v.catalogName} tone="primary" size="sm" />
                          ) : (
                            <Chip label={t("vaccinationCard.noMatch")} tone="neutral" size="sm" />
                          )}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => removeVaccination(v._id)}
                        accessibilityRole="button"
                        accessibilityLabel={t("vaccinationCard.removeEntry")}
                        hitSlop={8}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: pressed ? colors.dangerSoft : colors.well,
                        })}
                      >
                        <Trash2 size={16} color={colors.danger} strokeWidth={2.2} />
                      </Pressable>
                    </View>

                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />

                    <FormField label={t("vaccinationCard.field.name")}>
                      <TextInput
                        value={v.vaccineName}
                        onChangeText={(val) => updateVaccination(v._id, "vaccineName", val)}
                        placeholder={t("vaccinationCard.field.namePlaceholder")}
                      />
                    </FormField>

                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <View style={{ flex: 2 }}>
                        <FormField label={t("vaccinationCard.field.date")}>
                          <TextInput
                            value={v.date}
                            onChangeText={(val) => updateVaccination(v._id, "date", val)}
                            placeholder="YYYY-MM-DD"
                            keyboardType="numbers-and-punctuation"
                          />
                        </FormField>
                      </View>
                      <View style={{ flex: 1 }}>
                        <FormField label={t("vaccinationCard.field.dose")}>
                          <TextInput
                            value={v.doseNumber != null ? String(v.doseNumber) : ""}
                            onChangeText={(val) =>
                              updateVaccination(v._id, "doseNumber", val ? Number(val) : null)
                            }
                            keyboardType="number-pad"
                            placeholder="—"
                          />
                        </FormField>
                      </View>
                    </View>

                    <FormField label={t("vaccinationCard.field.provider")}>
                      <TextInput
                        value={v.provider}
                        onChangeText={(val) => updateVaccination(v._id, "provider", val)}
                        placeholder={t("vaccinationCard.field.providerPlaceholder")}
                      />
                    </FormField>
                  </View>
                </Card>
              ))}

              <Pressable
                onPress={addEmptyRow}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  height: 52,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: colors.primary,
                  backgroundColor: pressed ? colors.primarySoft : "transparent",
                })}
              >
                <Plus size={18} color={colors.primary} strokeWidth={2.4} />
                <Text style={[typography.label.lg, { color: colors.primary }]}>
                  {t("vaccinationCard.addRow")}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        {/* Sticky footer: primary action always within thumb reach. */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            gap: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
            backgroundColor: colors.bg,
          }}
        >
          {step === "scan" ? (
            <>
              <Button
                title={scanning ? t("vaccinationCard.scanning") : t("vaccinationCard.scanButton")}
                icon={Sparkles}
                size="lg"
                onPress={runOcr}
                loading={scanning}
                disabled={!imageUri || scanning}
              />
              {!imageUri ? (
                <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center" }]}>
                  {t("vaccinationCard.addPhotoHint")}
                </Text>
              ) : null}
            </>
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={t("vaccinationCard.rescan")}
                  icon={RefreshCw}
                  variant="secondary"
                  size="lg"
                  onPress={() => {
                    setStep("scan");
                    setVaccinations([]);
                  }}
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Button
                  title={t("vaccinationCard.saveAll", { count: vaccinations.length })}
                  icon={CheckCircle2}
                  size="lg"
                  onPress={saveAll}
                  loading={bulkAdd.isPending}
                />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Three-step progress: capture → review → save. */
function StepRail({ step }: { step: "scan" | "review" }) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const current = step === "scan" ? 0 : 1;
  const steps = [
    t("vaccinationCard.steps.capture"),
    t("vaccinationCard.steps.review"),
    t("vaccinationCard.steps.save"),
  ];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={{ flex: 1, gap: 6 }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: done ? colors.success : active ? colors.primary : colors.fill,
              }}
            />
            <Text
              numberOfLines={1}
              style={[
                typography.label.xs,
                {
                  color: active ? colors.primary : done ? colors.success : colors.textSubtle,
                  letterSpacing: 0.4,
                },
              ]}
            >
              {`${i + 1}. ${label}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Card-shaped capture frame with corner guides. Empty: tap to open the
 * camera. Filled: shows the photo, a remove control, and a scanning veil.
 */
function Viewfinder({
  imageUri,
  scanning,
  onCapture,
  onRemove,
}: {
  imageUri: string | null;
  scanning: boolean;
  onCapture: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const primary = useTone("primary");
  const isDark = scheme === "dark";
  const guide = imageUri ? "rgba(255,255,255,0.95)" : primary.fg;

  const corners = (["tl", "tr", "bl", "br"] as const).map((c) => (
    <View
      key={c}
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 28,
        height: 28,
        borderColor: guide,
        top: c[0] === "t" ? 14 : undefined,
        bottom: c[0] === "b" ? 14 : undefined,
        left: c[1] === "l" ? 14 : undefined,
        right: c[1] === "r" ? 14 : undefined,
        borderTopWidth: c[0] === "t" ? 3 : 0,
        borderBottomWidth: c[0] === "b" ? 3 : 0,
        borderLeftWidth: c[1] === "l" ? 3 : 0,
        borderRightWidth: c[1] === "r" ? 3 : 0,
        borderTopLeftRadius: c === "tl" ? 10 : 0,
        borderTopRightRadius: c === "tr" ? 10 : 0,
        borderBottomLeftRadius: c === "bl" ? 10 : 0,
        borderBottomRightRadius: c === "br" ? 10 : 0,
      }}
    />
  ));

  return (
    <Pressable
      onPress={imageUri ? undefined : onCapture}
      disabled={!!imageUri}
      accessibilityRole={imageUri ? "image" : "button"}
      accessibilityLabel={imageUri ? t("vaccinationCard.scanHeading") : t("vaccinationCard.cameraButton")}
      style={({ pressed }) => [
        {
          aspectRatio: 1.45,
          borderRadius: 26,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: imageUri ? colors.surfaceMuted : colors.surface,
          borderWidth: imageUri ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        isDark ? null : shadow.card,
      ]}
    >
      {imageUri ? (
        <>
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {scanning ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", gap: spacing.sm },
              ]}
            >
              <ActivityIndicator color="#fff" />
              <Text style={[typography.label.md, { color: "#fff" }]}>{t("vaccinationCard.scanning")}</Text>
            </View>
          ) : (
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel={t("vaccinationCard.removeButton")}
              hitSlop={8}
              style={({ pressed }) => ({
                position: "absolute",
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)",
              })}
            >
              <Trash2 size={16} color="#fff" strokeWidth={2.3} />
            </Pressable>
          )}
          {!scanning ? (
            <View
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                height: 28,
                borderRadius: 14,
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
            >
              <CheckCircle2 size={13} color="#fff" strokeWidth={2.6} />
              <Text style={[typography.label.sm, { color: "#fff" }]}>{t("vaccinationCard.photoReady")}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: primary.bg,
              marginBottom: spacing.xs,
            }}
          >
            <ScanLine size={30} color={primary.fg} strokeWidth={2} />
          </View>
          <Text style={[typography.title.md, { color: colors.text, textAlign: "center" }]}>
            {t("vaccinationCard.frameTitle")}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
            {t("vaccinationCard.frameBody")}
          </Text>
        </View>
      )}
      {scanning ? null : corners}
    </Pressable>
  );
}

function SourceTile({
  icon: Icon,
  label,
  tone,
  onPress,
  disabled,
}: {
  icon: any;
  label: string;
  tone: "primary" | "accent";
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const p = useTone(tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm + 2,
          padding: spacing.md,
          borderRadius: 20,
          borderCurve: "continuous",
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
          opacity: disabled ? 0.5 : 1,
        },
        scheme === "dark" ? null : shadow.xs,
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: p.bg,
        }}
      >
        <Icon size={19} color={p.fg} strokeWidth={2.3} />
      </View>
      <Text style={[typography.label.lg, { color: colors.text, flex: 1 }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function TipsCard() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const tips = [
    { icon: Sun, text: t("vaccinationCard.tips.light") },
    { icon: Maximize, text: t("vaccinationCard.tips.frame") },
    { icon: Edit3, text: t("vaccinationCard.tips.legible") },
  ];
  return (
    <Card variant="muted" style={{ gap: spacing.md }}>
      <Text style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase" }]}>
        {t("vaccinationCard.tips.title")}
      </Text>
      {tips.map(({ icon: Icon, text }) => (
        <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
            }}
          >
            <Icon size={15} color={colors.primary} strokeWidth={2.3} />
          </View>
          <Text style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}>{text}</Text>
        </View>
      ))}
    </Card>
  );
}

function ReviewSummary({
  total,
  matched,
  imageUri,
}: {
  total: number;
  matched: number;
  imageUri: string | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const success = useTone("success");
  return (
    <Card padded={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: 56, height: 56, borderRadius: 14 }}
            resizeMode="cover"
          />
        ) : (
          <IconTile icon={CheckCircle2} tone="success" size={56} />
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[typography.title.sm, { color: colors.text }]}>
            {t("vaccinationCard.reviewTitle")}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {t("vaccinationCard.matchedSummary", { matched, total })}
          </Text>
        </View>
        <View
          style={{
            minWidth: 40,
            height: 40,
            paddingHorizontal: 10,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: success.bg,
          }}
        >
          <Text style={[typography.title.sm, { color: success.fg, fontVariant: ["tabular-nums"] }]}>
            {total}
          </Text>
        </View>
      </View>
    </Card>
  );
}
