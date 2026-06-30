// @ts-nocheck

import { useState } from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Image as ImageIcon,
  ScanText,
  Pill,
  Sparkles,
  Trash2,
  CheckCircle2,
} from "lucide-react-native";
import { useAiOcr, useUploadFile } from "@/hooks/useApi";
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
  FormField,
  TextInput,
  useToast,
} from "@/components/ui";

export default function AiOcrScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const upload = useUploadFile();
  const aiOcr = useAiOcr();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [result, setResult] = useState<any>(null);

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
      const asset = res.assets[0];
      setImageUri(asset.uri);
      setResult(null);
      setUploadedUrl(null);
    } catch (err: any) {
      toast.show(err?.message || t("aiOcr.pickFailed"), "danger");
    }
  }

  function clearImage() {
    setImageUri(null);
    setUploadedUrl(null);
    setResult(null);
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
      if (fileUrl) setUploadedUrl(fileUrl);

      const res = await aiOcr.mutateAsync({
        fileUrl: fileUrl || imageUri,
        textHint: hint || undefined,
      });
      setResult(res);
    } catch (err: any) {
      toast.show(err?.message || t("aiOcr.ocrFailed"), "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("aiOcr.title")}
        subtitle={t("aiOcr.subtitle")}
        right={
          <PillCmp
            icon={Sparkles}
            label={t("aiOcr.aiPill")}
            tone="accent"
            size="sm"
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <ScanText size={20} color={colors.accent} strokeWidth={2.2} />
              <Text style={[typography.title.sm, { color: colors.text }]}>
                {t("aiOcr.pickHeading")}
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
                    style={{
                      width: "100%",
                      height: 240,
                    }}
                    resizeMode="cover"
                  />
                </View>
                <Button
                  title={t("aiOcr.remove")}
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
                title={t("aiOcr.noImageTitle")}
                message={t("aiOcr.noImageBody")}
                tone="neutral"
              />
            )}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                title={t("aiOcr.camera")}
                icon={Camera}
                variant="outline"
                size="md"
                fullWidth={false}
                onPress={() => pickFrom("camera")}
                style={{ flex: 1 }}
              />
              <Button
                title={t("aiOcr.gallery")}
                icon={ImageIcon}
                variant="outline"
                size="md"
                fullWidth={false}
                onPress={() => pickFrom("gallery")}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <FormField label={t("aiOcr.hintLabel")}>
              <TextInput
                value={hint}
                onChangeText={setHint}
                placeholder={t("aiOcr.hintPlaceholder")}
                leadingIcon={Sparkles}
              />
            </FormField>
          </View>
        </Card>

        <Button
          title={t("aiOcr.readAction")}
          icon={Sparkles}
          size="lg"
          fullWidth={false}
          onPress={runOcr}
          loading={aiOcr.isPending || upload.isPending}
          disabled={!imageUri}
        />

        {aiOcr.isPending ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={120} radius={20} />
            <Skeleton height={80} radius={16} />
          </View>
        ) : result ? (
          <View style={{ gap: spacing.md }}>
            {uploadedUrl ? (
              <Card>
                <View
                  style={{
                    padding: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <CheckCircle2
                    size={16}
                    color={colors.success}
                    strokeWidth={2.4}
                  />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {t("aiOcr.uploaded")}
                  </Text>
                </View>
              </Card>
            ) : null}

            {result.medicines && result.medicines.length > 0 ? (
              <Card>
                <SectionHeader title={t("aiOcr.sections.medicines")} />
                <View
                  style={{
                    padding: spacing.lg,
                    paddingTop: 0,
                    gap: spacing.sm,
                  }}
                >
                  {result.medicines.map((m: any, idx: number) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        padding: spacing.sm,
                        backgroundColor: colors.surfaceMuted,
                        borderRadius: 12,
                      }}
                    >
                      <Pill
                        size={16}
                        color={colors.accent}
                        strokeWidth={2.4}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            typography.body.md,
                            { color: colors.text, fontWeight: "600" },
                          ]}
                        >
                          {m.name}
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textMuted, marginTop: 2 },
                          ]}
                        >
                          {[m.dosage, m.frequency, m.timing]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            ) : (
              <Card>
                <View
                  style={{
                    padding: spacing.lg,
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Pill size={24} color={colors.textMuted} strokeWidth={2.2} />
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, textAlign: "center" },
                    ]}
                  >
                    {t("aiOcr.noMedicines")}
                  </Text>
                </View>
              </Card>
            )}

            {(result.doctor || result.date || result.diagnosis) ? (
              <Card>
                <SectionHeader title={t("aiOcr.sections.header")} />
                <View
                  style={{
                    padding: spacing.lg,
                    paddingTop: 0,
                    gap: spacing.xs,
                  }}
                >
                  {result.doctor ? (
                    <Text style={[typography.body.sm, { color: colors.text }]}>
                      {t("aiOcr.field.doctor", { value: result.doctor })}
                    </Text>
                  ) : null}
                  {result.date ? (
                    <Text style={[typography.body.sm, { color: colors.text }]}>
                      {t("aiOcr.field.date", { value: result.date })}
                    </Text>
                  ) : null}
                  {result.diagnosis ? (
                    <Text style={[typography.body.sm, { color: colors.text }]}>
                      {t("aiOcr.field.diagnosis", { value: result.diagnosis })}
                    </Text>
                  ) : null}
                </View>
              </Card>
            ) : null}

            {result.note ? (
              <Card>
                <View style={{ padding: spacing.lg }}>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textMuted, lineHeight: 20 },
                    ]}
                  >
                    {result.note}
                  </Text>
                </View>
              </Card>
            ) : null}

            <Text
              style={[
                typography.caption,
                { color: colors.textSubtle, textAlign: "center" },
              ]}
            >
              {t("aiOcr.disclaimer")}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}