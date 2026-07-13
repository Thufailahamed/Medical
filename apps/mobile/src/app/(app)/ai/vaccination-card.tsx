// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
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
} from "lucide-react-native";
import {
  useVaccinationCardOcr,
  useBulkAddVaccinations,
  useVaccinations,
  type VaccinationExtracted,
} from "@/hooks/useApi";
import { useUploadFile } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  Skeleton,
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

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("vaccinationCard.title")}
        subtitle={t("vaccinationCard.subtitle")}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Scan */}
        {step === "scan" && (
          <>
            <Card>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Syringe size={20} color={colors.accent} strokeWidth={2.2} />
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("vaccinationCard.scanHeading")}
                  </Text>
                </View>

                {imageUri ? (
                  <View style={{ gap: spacing.sm }}>
                    <View
                      style={{
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: colors.surfaceMuted,
                      }}
                    >
                      <Image
                        source={{ uri: imageUri }}
                        style={{ width: "100%", height: 240 }}
                        resizeMode="cover"
                      />
                    </View>
                    <Button
                      title={t("vaccinationCard.removeButton")}
                      icon={Trash2}
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      onPress={clearImage}
                    />
                  </View>
                ) : (
                  <EmptyState
                    icon={ImageIcon}
                    title={t("vaccinationCard.imageEmptyTitle")}
                    message={t("vaccinationCard.imageEmptyBody")}
                    tone="neutral"
                  />
                )}

                <View style={{ flexDirection: "row", gap: spacing.sm, width: "100%" }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("vaccinationCard.cameraButton")}
                      icon={Camera}
                      variant="outline"
                      size="md"
                      onPress={() => pickFrom("camera")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("vaccinationCard.galleryButton")}
                      icon={ImageIcon}
                      variant="outline"
                      size="md"
                      onPress={() => pickFrom("gallery")}
                    />
                  </View>
                </View>
              </View>
            </Card>

            <View style={{ width: "100%" }}>
              <Button
                title={t("vaccinationCard.scanButton")}
                icon={Sparkles}
                size="lg"
                onPress={runOcr}
                loading={cardOcr.isPending || upload.isPending}
                disabled={!imageUri}
              />
            </View>
          </>
        )}

        {/* Loading state */}
        {cardOcr.isPending && (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={80} radius={20} />
            <Skeleton height={80} radius={20} />
            <Skeleton height={80} radius={20} />
          </View>
        )}

        {/* Step 2: Review */}
        {step === "review" && vaccinations.length > 0 && (
          <>
            <Card>
              <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <CheckCircle2 size={20} color={colors.success} strokeWidth={2.2} />
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("vaccinationCard.reviewTitle")}
                  </Text>
                </View>
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  {t("vaccinationCard.reviewSubtitle", { count: vaccinations.length })}
                </Text>
              </View>
            </Card>

            {vaccinations.map((v) => (
              <Card key={v._id}>
                <View style={{ padding: spacing.lg, gap: spacing.md }}>
                  {/* Header row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                      <Syringe size={16} color={colors.accent} strokeWidth={2.2} />
                      {v.matched && v.catalogName ? (
                        <Chip
                          label={v.catalogShortName || v.catalogName}
                          tone="primary"
                          size="sm"
                        />
                      ) : (
                        <Chip
                          label={t("vaccinationCard.noMatch")}
                          tone="neutral"
                          size="sm"
                        />
                      )}
                    </View>
                    <Pressable
                      onPress={() => removeVaccination(v._id)}
                      hitSlop={8}
                      style={{ padding: spacing.xs }}
                    >
                      <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                    </Pressable>
                  </View>

                  {/* Vaccine name */}
                  <FormField label={t("vaccinationCard.field.name")}>
                    <TextInput
                      value={v.vaccineName}
                      onChangeText={(val) => updateVaccination(v._id, "vaccineName", val)}
                      placeholder={t("vaccinationCard.field.namePlaceholder")}
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: radius.md,
                        padding: spacing.md,
                        color: colors.text,
                        fontSize: 15,
                      }}
                    />
                  </FormField>

                  {/* Date + Dose row */}
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={{ flex: 2 }}>
                      <FormField label={t("vaccinationCard.field.date")}>
                        <TextInput
                          value={v.date}
                          onChangeText={(val) => updateVaccination(v._id, "date", val)}
                          placeholder="YYYY-MM-DD"
                          style={{
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: radius.md,
                            padding: spacing.md,
                            color: colors.text,
                            fontSize: 15,
                          }}
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
                          keyboardType="numeric"
                          placeholder="—"
                          style={{
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: radius.md,
                            padding: spacing.md,
                            color: colors.text,
                            fontSize: 15,
                          }}
                        />
                      </FormField>
                    </View>
                  </View>

                  {/* Provider */}
                  <FormField label={t("vaccinationCard.field.provider")}>
                    <TextInput
                      value={v.provider}
                      onChangeText={(val) => updateVaccination(v._id, "provider", val)}
                      placeholder={t("vaccinationCard.field.providerPlaceholder")}
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: radius.md,
                        padding: spacing.md,
                        color: colors.text,
                        fontSize: 15,
                      }}
                    />
                  </FormField>
                </View>
              </Card>
            ))}

            {/* Add row button */}
            <Button
              title={t("vaccinationCard.addRow")}
              icon={Plus}
              variant="outline"
              size="md"
              onPress={addEmptyRow}
            />

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title={t("vaccinationCard.rescan")}
                icon={Camera}
                variant="outline"
                onPress={() => {
                  setStep("scan");
                  setVaccinations([]);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title={t("vaccinationCard.saveAll", { count: vaccinations.length })}
                icon={CheckCircle2}
                onPress={saveAll}
                loading={bulkAdd.isPending}
                style={{ flex: 1 }}
              />
            </View>

            <Text
              style={[
                typography.caption,
                { color: colors.textSubtle, textAlign: "center" },
              ]}
            >
              {t("vaccinationCard.disclaimer")}
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
