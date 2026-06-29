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

const FORMATS: { value: "json" | "txt" | "fhir-bundle"; label: string; icon: any; hint: string }[] = [
  { value: "json", label: "JSON", icon: FileJson, hint: "Full bundle, machine-readable" },
  { value: "txt", label: "Plain text", icon: FileText, hint: "Human-readable text summary" },
  { value: "fhir-bundle", label: "FHIR", icon: HeartPulse, hint: "Healthcare interoperability standard" },
];

export default function ExportScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const { data: profileData } = usePatientProfile();

  const [format, setFormat] = useState<"json" | "txt" | "fhir-bundle">("json");
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
        title: `HealthHub export (${format})`,
      });
      toast.show({ message: "Export ready to share", tone: "success" });
    } catch (e: any) {
      toast.show({ message: e?.message || "Export failed", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title="Export my data"
        subtitle="Download a copy of your full record"
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
              What's included
            </Text>
          </View>
          <Text style={[typography.body.sm, { color: colors.textMuted, lineHeight: 20 }]}>
            Demographics, allergies, medicines, vitals, symptoms, records,
            appointments, prescriptions, family history, insurance policies,
            emergency history, and file references. Files themselves are NOT
            downloaded — links only.
          </Text>
        </Card>

        <Card>
          <Text
            style={[
              typography.title.sm,
              { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
            ]}
          >
            Format
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
                      {f.label}
                    </Text>
                    <Text
                      style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
                    >
                      {f.hint}
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
            PATIENT
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
          title={loading ? "Generating…" : `Export as ${format.toUpperCase()}`}
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
          Your data belongs to you. Exports are not stored on our servers and
          are generated on demand.
        </Text>
      </ScrollView>
    </Screen>
  );
}
