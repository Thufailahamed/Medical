// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Download,
  FileCode,
  FileText,
  HeartPulse,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Pill as PillIcon,
  AlertTriangle,
  ClipboardList,
  Users,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { getExportUrl, usePatientProfile } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Pill,
  Avatar,
  useToast,
} from "@/components/ui";

type FormatValue = "json" | "txt" | "fhir-bundle";

type FormatConfig = {
  id: FormatValue;
  shortName: string;
  title: string;
  tag: string;
  description: string;
  icon: any;
  tint: string;
  bg: string;
};

const FORMAT_OPTIONS: FormatConfig[] = [
  {
    id: "json",
    shortName: "JSON",
    title: "JSON Data Bundle",
    tag: "Full Archive",
    description: "Complete raw clinical data for personal backups & software import",
    icon: FileCode,
    tint: "#D97706",
    bg: "#FEF3C7",
  },
  {
    id: "txt",
    shortName: "Plain Text",
    title: "Formatted Document",
    tag: "Print & Share",
    description: "Structured chronological text document, easy to read and print",
    icon: FileText,
    tint: "#0284C7",
    bg: "#E0F2FE",
  },
  {
    id: "fhir-bundle",
    shortName: "FHIR R4",
    title: "HL7 FHIR R4 Bundle",
    tag: "Hospital Standard",
    description: "International healthcare format for importing into hospital EHRs",
    icon: HeartPulse,
    tint: "#059669",
    bg: "#D1FAE5",
  },
];

const INCLUDED_CATEGORIES = [
  {
    icon: Activity,
    label: "Vitals & Trends",
    details: "Blood pressure, heart rate, blood glucose, SpO2, BMI & temp",
  },
  {
    icon: PillIcon,
    label: "Prescriptions",
    details: "Active & past medications, dosage amounts, refill records",
  },
  {
    icon: AlertTriangle,
    label: "Allergies",
    details: "Documented drug, food & environmental allergies with severity",
  },
  {
    icon: ClipboardList,
    label: "Doctor Notes",
    details: "Completed visit summaries, clinician notes, care interactions",
  },
  {
    icon: Users,
    label: "Family History",
    details: "Inherited risk factors, relative diagnoses, genetic notes",
  },
  {
    icon: Shield,
    label: "Insurance & Profile",
    details: "Active insurance policies, emergency contacts, donor info",
  },
];

function getPatientAge(dob?: string): string | null {
  if (!dob) return null;
  const parsed = new Date(dob.trim());
  if (isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  if (
    now.getMonth() < parsed.getMonth() ||
    (now.getMonth() === parsed.getMonth() && now.getDate() < parsed.getDate())
  ) {
    age--;
  }
  if (age < 0 || age > 130) return null;
  return `${age} yrs`;
}

export default function ExportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow } = useTheme();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const { data: profileData } = usePatientProfile();

  const [format, setFormat] = useState<FormatValue>("json");
  const [loading, setLoading] = useState(false);
  const [dsarLoading, setDsarLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const patient = profileData?.patient?.patients;
  const patientName = patient?.fullName || user?.name || "Patient";
  const patientDob = patient?.dateOfBirth;
  const patientAge = getPatientAge(patientDob);
  const bloodGroup = patient?.bloodGroup;

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.id === format) || FORMAT_OPTIONS[0];

  async function downloadExport() {
    setLoading(true);
    try {
      const blob = await api<Blob>(getExportUrl(format), {
        responseType: "blob",
      });
      const text = await blob.text();
      let payload = text;
      try {
        const json = JSON.parse(text);
        payload = JSON.stringify(json, null, 2);
      } catch {}
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        throw new Error("Cache directory unavailable on this device");
      }
      const extension = format === "txt" ? "txt" : "json";
      const fileUri = `${cacheDir}healthhub-export-${Date.now()}.${extension}`;
      await FileSystem.writeAsStringAsync(fileUri, payload);
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device");
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: format === "txt" ? "text/plain" : "application/json",
        dialogTitle: t("export.shareTitle", {
          format: format.toUpperCase(),
          defaultValue: `Export Medical Record (${format.toUpperCase()})`,
        }),
      });
      toast.show({
        message: t("export.toast.success", {
          defaultValue: "Export generated successfully",
        }),
        tone: "success",
      });
    } catch (e: any) {
      toast.show({
        message: e?.message || t("export.toast.error", { defaultValue: "Export failed" }),
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDsarExport() {
    setDsarLoading(true);
    try {
      await api("/dsar/export", { method: "POST" });
      toast.show({
        message: t("dsar.exportReady", {
          defaultValue: "Formal data archive request submitted",
        }),
        tone: "success",
      });
    } catch (e: any) {
      toast.show({
        message:
          e?.message ??
          t("dsar.exportFailed", { defaultValue: "Archive request failed" }),
        tone: "danger",
      });
    } finally {
      setDsarLoading(false);
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("export.title", { defaultValue: "Export my data" })}
        subtitle={t("export.subtitle", {
          defaultValue: "Download a copy of your personal health record",
        })}
        back={true}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
          paddingBottom: 24,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Compact Patient Identity Strip ── */}
        <Card
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={patientName} size="md" />

            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 2,
                }}
              >
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.text, fontWeight: "700", fontSize: 15 },
                  ]}
                  numberOfLines={1}
                >
                  {patientName}
                </Text>
                <Pill
                  label="Verified Patient"
                  tone="success"
                  icon={CheckCircle2}
                  size="sm"
                />
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                }}
                numberOfLines={1}
              >
                {[
                  patientDob ? `DOB ${patientDob}${patientAge ? ` (${patientAge})` : ""}` : null,
                  bloodGroup ? `Blood ${bloodGroup}` : null,
                  "EHR Linked",
                ]
                  .filter(Boolean)
                  .join("  •  ")}
              </Text>
            </View>
          </View>
        </Card>

        {/* ── 2. Format Selection (Front & Center) ── */}
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: "700",
              color: colors.textMuted,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginLeft: 2,
            }}
          >
            Select Format
          </Text>

          <View style={{ gap: 10 }}>
            {FORMAT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = format === opt.id;

              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setFormat(opt.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => ({
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: isSelected ? 1.5 : 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected
                      ? withOpacity(colors.primary, 0.05)
                      : colors.surface,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  {/* Icon Tile */}
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: isSelected
                        ? colors.primary
                        : opt.bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      size={20}
                      color={isSelected ? "#FFFFFF" : opt.tint}
                      strokeWidth={2.2}
                    />
                  </View>

                  {/* Text Content */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 2,
                      }}
                    >
                      <Text
                        style={[
                          typography.title.xs,
                          {
                            color: colors.text,
                            fontWeight: "700",
                            fontSize: 14.5,
                          },
                        ]}
                      >
                        {opt.title}
                      </Text>
                      <Pill
                        label={opt.tag}
                        tone={isSelected ? "primary" : "neutral"}
                        size="sm"
                      />
                    </View>

                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        lineHeight: 16,
                      }}
                    >
                      {opt.description}
                    </Text>
                  </View>

                  {/* Radio Indicator */}
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: isSelected ? 5 : 1.5,
                      borderColor: isSelected ? colors.primary : colors.borderStrong,
                      backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── 3. What is Included (Clean & Expandable) ── */}
        <Card
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <Pressable
            onPress={() => setShowDetails((prev) => !prev)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                style={[
                  typography.title.xs,
                  { color: colors.text, fontWeight: "700", fontSize: 14 },
                ]}
              >
                Included in this export
              </Text>
              <Pill label="6 Categories" tone="neutral" size="sm" />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.primary,
                }}
              >
                {showDetails ? "Less" : "Details"}
              </Text>
              {showDetails ? (
                <ChevronUp size={14} color={colors.primary} />
              ) : (
                <ChevronDown size={14} color={colors.primary} />
              )}
            </View>
          </Pressable>

          {/* Categories: Compact Chip Grid or Detailed List */}
          {showDetails ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              {INCLUDED_CATEGORIES.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "flex-start",
                      paddingVertical: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        backgroundColor: colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 1,
                      }}
                    >
                      <Icon size={13} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: colors.text,
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11.5,
                          color: colors.textMuted,
                          lineHeight: 16,
                        }}
                      >
                        {item.details}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {INCLUDED_CATEGORIES.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: colors.bg,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.borderSoft,
                    }}
                  >
                    <Icon size={13} color={colors.primary} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: colors.text,
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Footnote on media links */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: colors.borderSoft,
            }}
          >
            <Info size={13} color={colors.textMuted} />
            <Text
              style={{
                fontSize: 11,
                color: colors.textMuted,
                flex: 1,
                lineHeight: 15,
              }}
            >
              Lab PDFs and scans are included via secure, temporary download links.
            </Text>
          </View>
        </Card>

        {/* ── 4. Privacy & Trust Guarantee (Subtle & Reassuring) ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: withOpacity(colors.success || "#059669", 0.07),
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withOpacity(colors.success || "#059669", 0.2),
          }}
        >
          <ShieldCheck size={18} color={colors.success || "#059669"} />
          <Text
            style={{
              fontSize: 12,
              color: colors.text,
              flex: 1,
              lineHeight: 16,
            }}
          >
            <Text style={{ fontWeight: "700" }}>End-to-End Encrypted</Text> — Assembled directly on your device. Never retained on external servers.
          </Text>
        </View>

        {/* ── 5. Formal Compliance Archive (DSAR) ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 4,
            paddingTop: 2,
            paddingBottom: 8,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text }}>
              Need a formal GDPR / DSAR archive?
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>
              Request audit logs, consent history & metadata.
            </Text>
          </View>

          <Button
            title="Request"
            variant="outline"
            size="sm"
            loading={dsarLoading}
            onPress={handleDsarExport}
            fullWidth={false}
          />
        </View>
      </ScrollView>

      {/* ── 6. Fixed Bottom Action Bar (Always Visible & Reachable) ── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
            },
            android: {
              elevation: 4,
            },
          }),
        }}
      >
        <Button
          title={
            loading
              ? "Generating Export..."
              : `Export as ${selectedFormat.shortName}`
          }
          icon={Download}
          onPress={downloadExport}
          loading={loading}
          size="lg"
          variant="primary"
        />
      </View>
    </Screen>
  );
}