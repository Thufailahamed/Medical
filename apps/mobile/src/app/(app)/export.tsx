// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Share,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Download,
  Share as ShareIcon,
  FileJson,
  FileText,
  HeartPulse,
  Check,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  getExportUrl,
  usePatientProfile,
} from "@/hooks/useApi";
import { api, API_BASE } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  useToast,
} from "@/components/ui";

type FormatValue = "json" | "txt" | "fhir-bundle";

const FORMATS: { value: FormatValue; labelKey: string; hintKey: string; icon: any }[] = [
  {
    value: "json",
    labelKey: "export.format.json.label",
    hintKey: "export.format.json.hint",
    icon: FileJson,
  },
  {
    value: "txt",
    labelKey: "export.format.txt.label",
    hintKey: "export.format.txt.hint",
    icon: FileText,
  },
  {
    value: "fhir-bundle",
    labelKey: "export.format.fhirBundle.label",
    hintKey: "export.format.fhirBundle.hint",
    icon: HeartPulse,
  },
];

export default function ExportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const { data: profileData } = usePatientProfile();

  const [format, setFormat] = useState<FormatValue>("json");
  const [loading, setLoading] = useState(false);

  const patient = profileData?.patient?.patients;

  async function downloadExport() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}${getExportUrl(format)}`, {
        headers: (api as any).authHeaders
          ? (api as any).authHeaders()
          : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let payload = text;
      try {
        const json = JSON.parse(text);
        payload = JSON.stringify(json, null, 2);
      } catch {}
      await Share.share({
        message: payload.slice(0, 200_000),
        title: t("export.shareTitle", { format }),
      });
      toast.show({ message: t("export.toast.success"), tone: "success" });
    } catch (e: any) {
      toast.show({ message: e?.message || t("export.toast.error"), tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  const formatLabel = format.toUpperCase();

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("export.title")}
        subtitle={t("export.subtitle")}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
            <Download size={20} color={colors.primary} />
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "800", flex: 1 },
              ]}
            >
              {t("export.whatsIncluded.title")}
            </Text>
          </View>
          <Text style={[typography.body.sm, { color: colors.textMuted, lineHeight: 20 }]}>
            {t("export.whatsIncluded.body")}
          </Text>
        </Card>

        <Card>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
            ]}
          >
            {t("export.format.title")}
          </Text>
          <View style={{ gap: spacing.sm }}>
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const selected = format === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setFormat(f.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.85 : 1,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 2,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primarySoft : colors.surface,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      size={18}
                      color={selected ? "#fff" : colors.textMuted}
                      strokeWidth={2.25}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                    >
                      {t(f.labelKey)}
                    </Text>
                    <Text
                      style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
                    >
                      {t(f.hintKey)}
                    </Text>
                  </View>
                  {selected && (
                    <Check size={18} color={colors.primary} strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card padded>
          <Text
            style={[
              typography.overline,
              { color: colors.textMuted, marginBottom: 4 },
            ]}
          >
            {t("export.patient.heading")}
          </Text>
          <Text style={[typography.body.md, { color: colors.text }]}>
            {patient?.fullName || user?.name || "—"}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {patient?.dateOfBirth ? `DOB ${patient.dateOfBirth}` : ""}
            {patient?.bloodGroup ? ` • Blood ${patient.bloodGroup}` : ""}
          </Text>
        </Card>

        <Button
          title={
            loading
              ? t("export.action.generating")
              : t("export.action.exportAs", { format: formatLabel })
          }
          icon={ShareIcon}
          onPress={downloadExport}
          loading={loading}
          size="lg"
        />

        <Text
          style={[
            typography.caption,
            { color: colors.textSubtle, textAlign: "center", marginTop: spacing.sm, lineHeight: 18 },
          ]}
        >
          {t("export.footer")}
        </Text>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <AppText variant="title.sm">{t("dsar.title", "Data rights")}</AppText>
          <AppText variant="body.sm" color="muted">
            {t("dsar.exportBody", "Receive a portable, encrypted copy of all your data.")}
          </AppText>
          <Button
            label={t("dsar.exportTitle", "Export my data")}
            onPress={async () => {
              try {
                const r = await fetch(`${API_BASE}/dsar/export`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                });
                if (!r.ok) throw new Error(`DSAR export failed: ${r.status}`);
                toast.show({ message: "Export ready", tone: "success" });
              } catch (e: any) {
                toast.show({ message: e?.message ?? "Failed", tone: "danger" });
              }
            }}
            icon={FileText}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}