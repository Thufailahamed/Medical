import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import {
  Upload,
  Search,
  FlaskConical,
  ScrollText,
  Image as ImageIcon,
  FileText,
  Bell,
  Stethoscope,
  Syringe,
  Scissors,
  AlertCircle,
  ShieldCheck,
  Dumbbell,
  Building2,
  FileBadge,
  NotebookPen,
  Receipt,
  HeartPulse,
} from "lucide-react-native";
import { useMedicalRecords, useUploadFile, usePatientProfile, useUnreadCount } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast, Screen, Card, Avatar } from "@/components/ui";

type RecordType =
  | "lab_report"
  | "imaging"
  | "prescription"
  | "hospital_visit"
  | "vaccination"
  | "surgery"
  | "allergy"
  | "insurance"
  | "fitness"
  | "discharge_summary"
  | "medical_certificate"
  | "operation_note"
  | "invoice";

const TYPE_META: Record<
  RecordType,
  { label: string; icon: any; iconColor: string; bgTone: string }
> = {
  lab_report: { label: "Lab", icon: FlaskConical, iconColor: "#765b00", bgTone: "#ffdf93" },
  imaging: { label: "Imaging", icon: ImageIcon, iconColor: "#63597c", bgTone: "#e1d4fd" },
  prescription: { label: "Prescription", icon: ScrollText, iconColor: "#4f378a", bgTone: "#e9ddff" },
  hospital_visit: { label: "Visit", icon: Stethoscope, iconColor: "#006a6a", bgTone: "#a4f0f0" },
  vaccination: { label: "Vaccine", icon: Syringe, iconColor: "#7a5900", bgTone: "#fff0c2" },
  surgery: { label: "Surgery", icon: Scissors, iconColor: "#ba1a1a", bgTone: "#ffdad6" },
  allergy: { label: "Allergy", icon: AlertCircle, iconColor: "#ba1a1a", bgTone: "#ffdad6" },
  insurance: { label: "Insurance", icon: ShieldCheck, iconColor: "#006b54", bgTone: "#a8f0d4" },
  fitness: { label: "Fitness", icon: Dumbbell, iconColor: "#4f378a", bgTone: "#e9ddff" },
  discharge_summary: { label: "Discharge", icon: FileBadge, iconColor: "#4f378a", bgTone: "#e9ddff" },
  medical_certificate: { label: "Certificate", icon: NotebookPen, iconColor: "#4f378a", bgTone: "#e9ddff" },
  operation_note: { label: "Op Note", icon: HeartPulse, iconColor: "#ba1a1a", bgTone: "#ffdad6" },
  invoice: { label: "Invoice", icon: Receipt, iconColor: "#765b00", bgTone: "#ffdf93" },
};

const FILTER_ORDER: { value: "all" | RecordType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lab_report", label: "Lab" },
  { value: "prescription", label: "Prescription" },
  { value: "imaging", label: "Imaging" },
  { value: "hospital_visit", label: "Visits" },
  { value: "vaccination", label: "Vaccines" },
  { value: "surgery", label: "Surgery" },
];

function metaFor(type?: string) {
  return TYPE_META[type as RecordType] ?? {
    label: type ? type.replace(/_/g, " ") : "Record",
    icon: FileText,
    iconColor: "#7a7582",
    bgTone: "#e6e0e9",
  };
}

export default function RecordsScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data: profileData } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { data: recordsData, isLoading, refetch } = useMedicalRecords();
  const uploadFile = useUploadFile();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | RecordType>("all");
  const [isUploading, setIsUploading] = useState(false);

  const records: any[] = recordsData?.records ?? [];

  const userPhoto = profileData?.patient?.users?.photo;
  const userName = profileData?.patient?.users?.name || "";

  // Filter records
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((rec: any) => {
      if (filter !== "all" && rec.recordType !== filter) return false;
      if (!q) return true;
      return (
        rec.title?.toLowerCase().includes(q) ||
        rec.diagnosis?.toLowerCase().includes(q) ||
        rec.summary?.toLowerCase().includes(q) ||
        rec.notes?.toLowerCase().includes(q) ||
        rec.recordType?.toLowerCase().includes(q)
      );
    });
  }, [records, search, filter]);

  // Group by year-month
  const groups = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const rec of filtered) {
      const d = new Date(rec.date);
      let key: string;
      if (isNaN(d.getTime())) {
        key = "RECENT";
      } else {
        const month = d.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
        const year = d.getFullYear();
        key = `${month} ${year}`;
      }
      (map[key] ??= []).push(rec);
    }
    return map;
  }, [filtered]);

  const sortedHeaders = useMemo(() => {
    const headers = Object.keys(groups);
    return headers.sort((a, b) => {
      if (a === "RECENT") return 1;
      if (b === "RECENT") return -1;
      const ad = new Date(`${a} 1`);
      const bd = new Date(`${b} 1`);
      return bd.getTime() - ad.getTime();
    });
  }, [groups]);

  async function handleUpload() {
    try {
      setIsUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        setIsUploading(false);
        return;
      }
      const file = result.assets[0];
      await uploadFile.mutateAsync({
        file: {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || "application/octet-stream",
        } as any,
      });
      toast.show("File uploaded. Your doctor can attach it to a record.", "success");
    } catch (err: any) {
      toast.show(err.message || "Upload failed", "danger");
    } finally {
      setIsUploading(false);
    }
  }

  const formatItemDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const subtitleFor = (rec: any) =>
    rec.diagnosis || rec.summary || rec.notes || "Medical record";

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 150 }}
      >
        {/* Top App Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push("/(app)/profile")}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={6}
            >
              <Avatar
                name={userName || "You"}
                source={userPhoto ? { uri: userPhoto } : undefined}
                size="md"
                tone="primary"
              />
            </Pressable>
            <Text
              style={[
                typography.title.lg,
                { color: colors.primary, fontWeight: "800", fontSize: 20 },
              ]}
            >
              HealthHub
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
            ) : (
              <Pressable
                onPress={handleUpload}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Upload file"
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Upload size={22} color={colors.primary} strokeWidth={2.25} />
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push("/(app)/notifications")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Bell size={22} color={colors.primary} strokeWidth={2.25} />
              {unread?.count ? (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Hero Section Banner */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <LinearGradient
            colors={["#0EA5B7", "#078B9C"]}
            style={{
              padding: spacing.lg,
              borderRadius: radius.xxl,
              position: "relative",
              overflow: "hidden",
              shadowColor: "#0EA5B7",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.15,
              shadowRadius: 15,
              elevation: 6,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: -50,
                left: -50,
                width: 160,
                height: 160,
                borderRadius: 80,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
              }}
            />

            <View style={{ zIndex: 10 }}>
              <Text
                style={[
                  typography.overline,
                  { color: "rgba(255,255,255,0.85)", letterSpacing: 1.5, fontWeight: "700" },
                ]}
              >
                MEDICAL HISTORY
              </Text>
              <Text
                style={[
                  typography.display.sm,
                  { color: "#FFFFFF", fontWeight: "800", marginTop: 4, fontSize: 28 },
                ]}
              >
                Your Records
              </Text>

              {/* Embedded Search Input */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.95)",
                  height: 48,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  marginTop: spacing.md,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Search size={18} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
                <TextInput
                  placeholder="Search title, diagnosis, notes..."
                  placeholderTextColor="rgba(29, 27, 32, 0.4)"
                  value={search}
                  onChangeText={setSearch}
                  style={[
                    typography.body.md,
                    { flex: 1, color: colors.text, height: "100%", padding: 0 },
                  ]}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Filter Pills (Horizontal Scroll) */}
        <View style={{ marginTop: spacing.lg }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
          >
            {FILTER_ORDER.map((f) => {
              const active = filter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${f.label}`}
                  accessibilityState={{ selected: active }}
                  style={{
                    height: 40,
                    paddingHorizontal: spacing.lg,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primary : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={[
                      typography.label.md,
                      {
                        color: active ? colors.onPrimary : colors.textMuted,
                        fontWeight: active ? "700" : "500",
                      },
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Timeline Records List */}
        {isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: 40 }}>
            <Card style={{ alignItems: "center", paddingVertical: 40 }}>
              <FileText size={48} color={colors.textMuted} strokeWidth={1.5} />
              <Text
                style={[
                  typography.title.md,
                  { color: colors.text, fontWeight: "700", marginTop: spacing.md },
                ]}
              >
                {records.length === 0 ? "No Records Yet" : "No Records Found"}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, textAlign: "center", marginTop: spacing.xs, paddingHorizontal: spacing.xl },
                ]}
              >
                {records.length === 0
                  ? "Your doctor will add records after your visits. Uploaded files will appear once attached."
                  : "Try a different search query or filter."}
              </Text>
            </Card>
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
            {sortedHeaders.map((header) => (
              <View key={header} style={{ marginBottom: spacing.lg }}>
                <Text
                  style={[
                    typography.overline,
                    {
                      color: colors.textMuted,
                      letterSpacing: 1.5,
                      fontWeight: "700",
                      marginBottom: spacing.md,
                      paddingVertical: 4,
                    },
                  ]}
                >
                  {header}
                </Text>

                <View style={{ position: "relative" }}>
                  <View
                    style={{
                      position: "absolute",
                      left: 24,
                      top: 10,
                      bottom: 0,
                      width: 2,
                      backgroundColor: colors.surfaceMuted,
                      zIndex: -1,
                    }}
                  />

                  {groups[header].map((rec) => {
                    const meta = metaFor(rec.recordType);
                    const IconComponent = meta.icon;
                    return (
                      <Pressable
                        key={rec.id}
                        onPress={() =>
                          router.push({
                            pathname: "/(app)/record-detail",
                            params: { id: rec.id },
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${meta.label} record: ${rec.title}`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "flex-start",
                          marginBottom: spacing.md,
                          opacity: pressed ? 0.95 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: colors.bg,
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 10,
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: meta.bgTone,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <IconComponent size={20} color={meta.iconColor} strokeWidth={2.25} />
                          </View>
                        </View>

                        <View
                          style={{
                            flex: 1,
                            marginLeft: spacing.md,
                            backgroundColor: colors.surface,
                            borderRadius: radius.xl,
                            padding: spacing.md,
                            borderWidth: 1,
                            borderColor: colors.border,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.03,
                            shadowRadius: 6,
                            elevation: 1,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: spacing.xs,
                            }}
                          >
                            <View
                              style={{
                                paddingHorizontal: spacing.sm,
                                paddingVertical: 2,
                                borderRadius: 6,
                                backgroundColor: `${meta.bgTone}80`,
                                borderWidth: 1,
                                borderColor: `${meta.iconColor}33`,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "700",
                                  color: meta.iconColor,
                                  letterSpacing: 0.2,
                                }}
                              >
                                {meta.label}
                              </Text>
                            </View>
                            <Text
                              style={[
                                typography.label.md,
                                { color: colors.textMuted, fontWeight: "500" },
                              ]}
                            >
                              {formatItemDate(rec.date)}
                            </Text>
                          </View>

                          <Text
                            style={[
                              typography.title.sm,
                              { color: colors.text, fontWeight: "800", fontSize: 16 },
                            ]}
                            numberOfLines={2}
                          >
                            {rec.title}
                          </Text>

                          <Text
                            style={[
                              typography.body.sm,
                              { color: colors.textMuted, marginTop: 2 },
                            ]}
                            numberOfLines={2}
                          >
                            {subtitleFor(rec)}
                          </Text>

                          {rec.followUpDate && (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: spacing.xs,
                                marginTop: spacing.sm,
                              }}
                            >
                              <Building2 size={12} color={colors.textMuted} />
                              <Text
                                style={[
                                  typography.caption,
                                  { color: colors.textMuted },
                                ]}
                              >
                                Follow-up: {formatItemDate(rec.followUpDate)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}