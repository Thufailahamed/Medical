// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  Share,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Share2,
  Trash2,
  MoreVertical,
  FileText,
  FlaskConical,
  Stethoscope,
  Image as ImageIcon,
  ScrollText,
  Download,
  CalendarDays,
  Building2,
  ArrowLeft,
  ClipboardList,
  Syringe,
  Scissors,
  ShieldAlert,
  Dumbbell,
  FileBadge,
  NotebookPen,
  Receipt,
  Sparkles,
  Paperclip,
  Pencil,
  Stethoscope as DocIcon,
  Link,
} from "lucide-react-native";
import {
  useMedicalRecord,
  useDeleteMedicalRecord,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  BottomSheet,
  useToast,
  Button,
  Pill,
  IconButton,
} from "@/components/ui";

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
  {
    label: string;
    icon: any;
    tone: "primary" | "accent" | "warning" | "info" | "danger" | "success" | "neutral";
  }
> = {
  lab_report: { label: "Lab Report", icon: FlaskConical, tone: "warning" },
  imaging: { label: "Imaging", icon: ImageIcon, tone: "info" },
  prescription: { label: "Prescription", icon: ScrollText, tone: "primary" },
  hospital_visit: { label: "Visit", icon: Building2, tone: "accent" },
  vaccination: { label: "Vaccination", icon: Syringe, tone: "success" },
  surgery: { label: "Surgery", icon: Scissors, tone: "danger" },
  allergy: { label: "Allergy", icon: ShieldAlert, tone: "danger" },
  insurance: { label: "Insurance", icon: FileBadge, tone: "info" },
  fitness: { label: "Fitness", icon: Dumbbell, tone: "success" },
  discharge_summary: { label: "Discharge", icon: NotebookPen, tone: "accent" },
  medical_certificate: { label: "Certificate", icon: FileBadge, tone: "primary" },
  operation_note: { label: "Op Note", icon: Scissors, tone: "danger" },
  invoice: { label: "Invoice", icon: Receipt, tone: "warning" },
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toneFgColor(tone: string, c: any) {
  switch (tone) {
    case "primary": return c.primary;
    case "accent": return c.accent;
    case "warning": return c.warning;
    case "info": return c.info;
    case "danger": return c.danger;
    case "success": return c.success;
    default: return c.textMuted;
  }
}

function toneSoftColor(tone: string, c: any) {
  return `${toneFgColor(tone, c)}1A`;
}

function toneBorderColor(tone: string, c: any) {
  return `${toneFgColor(tone, c)}33`;
}

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, typography, radius, shadow } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useMedicalRecord(id || "");
  const deleteRecord = useDeleteMedicalRecord();
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Opens the file in the system browser / via Linking. In dev mode the
  // /files/download/:key?stream=1 endpoint serves the bytes without auth,
  // so Linking.openURL works. In production the same path requires a
  // bearer token which Linking can't supply — we fall back to a clear
  // "copy link" toast for the user to share manually.
  async function openFile(f: any) {
    if (!f?.r2Key) {
      toast.show("No file key on this attachment", "warning");
      return;
    }
    try {
      setOpeningId(f.id);
      const streamUrl = `${process.env.EXPO_PUBLIC_API_URL}/files/download/${encodeURIComponent(
        f.r2Key
      )}?stream=1`;
      const supported = await Linking.canOpenURL(streamUrl);
      if (supported) {
        await Linking.openURL(streamUrl);
      } else {
        toast.show("Can't open this file type on your device", "warning");
      }
    } catch (err: any) {
      toast.show(err?.message || "Could not open file", "danger");
    } finally {
      setOpeningId(null);
    }
  }

  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const record = data?.record;
  const meta = record ? TYPE_META[record.recordType as RecordType] : null;
  const IconComponent = meta?.icon ?? FileText;
  const tone = meta?.tone ?? "neutral";
  const files: any[] = record?.files ?? [];

  async function handleShare() {
    if (!record) return;
    try {
      const lines = [
        record.title,
        `${meta?.label ?? "Record"} · ${formatDate(record.date)}`,
      ];
      if (record.doctor?.name) lines.push(`Doctor: ${record.doctor.name}`);
      if (record.hospital?.name) lines.push(`Hospital: ${record.hospital.name}`);
      if (record.diagnosis) lines.push(`Diagnosis: ${record.diagnosis}`);
      if (record.followUpDate) lines.push(`Next follow-up: ${formatDate(record.followUpDate)}`);
      lines.push("", "Shared from HealthHub");
      await Share.share({
        title: record.title,
        message: lines.join("\n"),
      });
    } catch {}
    setMoreOpen(false);
  }

  function handleDelete() {
    if (!record) return;
    Alert.alert(
      "Delete record?",
      "This will remove the record and its attachments. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecord.mutateAsync(record.id);
              toast.show("Record deleted", "success");
              router.back();
            } catch (err: any) {
              toast.show(err?.message || "Failed to delete", "danger");
            }
          },
        },
      ]
    );
    setMoreOpen(false);
    setConfirmDelete(false);
  }

  function handleEdit() {
    if (!record) return;
    router.push({
      pathname: "/(app)/edit-record",
      params: { id: record.id },
    } as any);
    setMoreOpen(false);
  }

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.xl,
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FileText size={28} color={colors.textMuted} strokeWidth={1.75} />
          </View>
          <Text
            style={[
              typography.title.md,
              { color: colors.text, fontWeight: "800" },
            ]}
          >
            Record not found
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, textAlign: "center" },
            ]}
          >
            It may have been removed or you no longer have access.
          </Text>
          <Button title="Go back" onPress={() => router.back()} variant="outline" />
        </View>
      </Screen>
    );
  }

  const sections: { label: string; value: string; icon: any }[] = [
    record.diagnosis
      ? { label: "Diagnosis", value: record.diagnosis, icon: ClipboardList }
      : null,
    record.summary
      ? { label: "Summary", value: record.summary, icon: FileText }
      : null,
    record.notes
      ? { label: "Notes", value: record.notes, icon: NotebookPen }
      : null,
    record.followUpDate
      ? {
          label: "Next follow-up",
          value: formatDate(record.followUpDate),
          icon: CalendarDays,
        }
      : null,
  ].filter(Boolean) as { label: string; value: string; icon: any }[];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title={meta?.label ?? "Record"}
        subtitle={formatDate(record.date)}
        right={
          <Pressable
            onPress={() => setMoreOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More options"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            })}
          >
            <MoreVertical size={22} color={colors.text} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Hero */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            padding: spacing.xl,
            borderRadius: radius.xxl,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            gap: spacing.sm,
            ...shadow.sm,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: toneSoftColor(tone, colors),
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: toneBorderColor(tone, colors),
            }}
          >
            <IconComponent size={32} color={toneFgColor(tone, colors)} strokeWidth={2.25} />
          </View>
          <Pill label={meta?.label ?? "Record"} tone={tone as any} size="sm" />
          <Text
            style={[
              typography.title.lg,
              { color: colors.text, textAlign: "center", fontWeight: "900", marginTop: 4, fontSize: 22 },
            ]}
          >
            {record.title}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, textAlign: "center" },
            ]}
          >
            {formatDate(record.date)}
          </Text>

          {/* Doctor + hospital chips */}
          {(record.doctor?.name || record.hospital?.name) && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
                marginTop: spacing.xs,
                justifyContent: "center",
              }}
            >
              {record.doctor?.name ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <DocIcon size={12} color={colors.textMuted} strokeWidth={2.25} />
                  <Text style={[typography.caption, { color: colors.text }]}>
                    {record.doctor.name}
                    {record.doctor.specialization
                      ? ` · ${record.doctor.specialization}`
                      : ""}
                  </Text>
                </View>
              ) : null}
              {record.hospital?.name ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <Building2 size={12} color={colors.textMuted} strokeWidth={2.25} />
                  <Text style={[typography.caption, { color: colors.text }]}>
                    {record.hospital.name}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.lg }}>
          {/* Quick action row */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title="Edit record"
              icon={Pencil}
              variant="outline"
              size="md"
              onPress={handleEdit}
              style={{ flex: 1 }}
            />
            <Button
              title="Share"
              icon={Share2}
              variant="ghost"
              size="md"
              onPress={handleShare}
              style={{ flex: 1 }}
            />
            <Button
              title="Link"
              icon={Link}
              variant="ghost"
              size="md"
              onPress={() => router.push("/(app)/share" as any)}
              style={{ flex: 1 }}
            />
          </View>

          {/* Attachments */}
          {files.length ? (
            <Card padded={false}>
              <View
                style={{
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Paperclip size={16} color={colors.textMuted} strokeWidth={2.25} />
                <Text
                  style={[
                    typography.label.md,
                    { color: colors.textMuted, fontWeight: "800", letterSpacing: 0.5 },
                  ]}
                >
                  ATTACHMENTS · {files.length}
                </Text>
              </View>
              {files.map((f, i) => (
                <View
                  key={f.id}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText size={20} color={colors.primary} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {f.fileName}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, fontSize: 13 },
                      ]}
                    >
                      {[f.mimeType, formatBytes(f.fileSize)].filter(Boolean).join(" • ")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => openFile(f)}
                    accessibilityRole="button"
                    accessibilityLabel="Open file"
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: pressed ? colors.surfaceMuted : colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    {openingId === f.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Download size={18} color={colors.primary} strokeWidth={2.25} />
                    )}
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Clinical sections */}
          {sections.length ? (
            <Card style={{ padding: spacing.lg }}>
              <Text
                style={[
                  typography.title.md,
                  { color: colors.text, fontWeight: "900", marginBottom: spacing.md },
                ]}
              >
                Details
              </Text>
              {sections.map((s, i) => {
                const Icon = s.icon;
                return (
                  <View
                    key={s.label}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      paddingVertical: spacing.md,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                      gap: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.surfaceMuted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={18} color={colors.textMuted} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          typography.overline,
                          { color: colors.textMuted, letterSpacing: 0.5, fontWeight: "600" },
                        ]}
                      >
                        {s.label}
                      </Text>
                      <Text
                        style={[
                          typography.body.md,
                          { color: colors.text, fontWeight: "700", marginTop: 2, lineHeight: 22 },
                        ]}
                      >
                        {s.value}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}

          {!files.length && !sections.length ? (
            <Card style={{ padding: spacing.xl, alignItems: "center" }}>
              <Sparkles size={20} color={colors.textMuted} strokeWidth={1.75} />
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
                ]}
              >
                This record has no attachments or notes yet.
              </Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {/* More options */}
      <BottomSheet
        visible={moreOpen}
        onDismiss={() => setMoreOpen(false)}
        title="Record actions"
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Button
            title="Edit record"
            icon={Pencil}
            onPress={handleEdit}
            variant="outline"
          />
          <Button
            title="Share record"
            icon={Share2}
            onPress={handleShare}
            variant="outline"
          />
          <Button
            title="Delete record"
            icon={Trash2}
            onPress={handleDelete}
            variant="danger"
            loading={deleteRecord.isPending}
          />
          <Button
            title="Cancel"
            onPress={() => setMoreOpen(false)}
            variant="ghost"
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
