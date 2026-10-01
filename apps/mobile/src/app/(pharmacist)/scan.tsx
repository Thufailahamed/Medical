// @ts-nocheck
// Scan a patient QR to filter the dispense queue. QR encodes JSON
// { t: token, p: purpose }; resolved via POST /portal/scan/resolve.
// Mirrors web `portal/(portal)/scan` (dispense purpose).
// Camera needs a dev build — manual entry always available.

import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from "react-native-vision-camera";
import { ScanLine, Keyboard } from "lucide-react-native";
import { useResolveScanToken } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  TextInput,
  FormField,
  useToast,
} from "@/components/ui";

export default function PharmacistScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const isFocused = useIsFocused();

  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const resolve = useResolveScanToken();

  const [locked, setLocked] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualPatientId, setManualPatientId] = useState("");

  async function onToken(raw: string) {
    const token = (() => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.t === "string") return parsed.t;
      } catch {
        /* raw token */
      }
      return raw.trim();
    })();
    if (!token) return;
    try {
      const res = await resolve.mutateAsync({ token, purpose: "dispense" });
      toast.show(t("pharmacy.resolved"), "success");
      router.push(`/(pharmacist)/?patient=${encodeURIComponent(res.patient.id)}` as any);
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  const scanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes) => {
      const value = codes[0]?.value;
      if (!value || locked || resolve.isPending) return;
      setLocked(true);
      onToken(value).finally(() => setLocked(false));
    },
  });

  function onManualPatient() {
    const id = manualPatientId.trim();
    if (!id) return;
    router.push(`/(pharmacist)/?patient=${encodeURIComponent(id)}` as any);
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("pharmacy.scanTitle")}
        subtitle={t("pharmacy.scanSubtitle")}
        kicker="PHARMACY"
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Camera ── */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {!device ? (
            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <Text style={[typography.body.md, { color: colors.text }]}>
                {t("pharmacy.noCamera")}
              </Text>
            </View>
          ) : !hasPermission ? (
            <View style={{ padding: spacing.lg, gap: spacing.md, alignItems: "center" }}>
              <ScanLine size={40} color={colors.primary} />
              <Text style={[typography.body.sm, { color: colors.textMuted, textAlign: "center" }]}>
                {t("pharmacy.scanHint")}
              </Text>
              <Button
                title={t("pharmacy.requestCamera")}
                onPress={() => requestPermission()}
              />
            </View>
          ) : (
            <View style={{ height: 320 }}>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isFocused && !locked}
                codeScanner={scanner}
              />
              <View
                pointerEvents="none"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 220,
                    height: 220,
                    borderRadius: 24,
                    borderWidth: 3,
                    borderColor: colors.onPrimary ?? "#fff",
                    opacity: 0.9,
                  }}
                />
              </View>
            </View>
          )}
        </Card>

        {/* ── Manual fallback ── */}
        <Card style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Keyboard size={18} color={colors.primary} />
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("pharmacy.manualTitle")}
            </Text>
          </View>
          <FormField label="QR token">
            <TextInput
              value={manualToken}
              onChangeText={setManualToken}
              placeholder={t("pharmacy.tokenPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
            />
          </FormField>
          <Button
            title={t("pharmacy.resolve")}
            onPress={() => onToken(manualToken)}
            loading={resolve.isPending}
            disabled={resolve.isPending || !manualToken.trim()}
          />
          <FormField label="Patient ID">
            <TextInput
              value={manualPatientId}
              onChangeText={setManualPatientId}
              placeholder={t("pharmacy.patientPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
            />
          </FormField>
          <Button
            title={t("pharmacy.resolve")}
            variant="secondary"
            onPress={onManualPatient}
            disabled={!manualPatientId.trim()}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
