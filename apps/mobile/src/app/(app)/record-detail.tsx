import { useState } from "react";
import { View, Text, Share, Pressable } from "react-native";
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
  AlertTriangle,
  CalendarDays,
  Building2,
} from "lucide-react-native";
import { useMedicalRecord } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Pill,
  Card,
  Divider,
  Skeleton,
  EmptyState,
  IconButton,
  BottomSheet,
  useToast,
} from "@/components/ui";
import { useTone, type Tone } from "@/theme/tone";

const TYPE_META: Record<
  string,
  { label: string; icon: any; tone: Tone }
> = {
  lab_report: { label: "Lab report", icon: FlaskConical, tone: "primary" },
  prescription: { label: "Prescription", icon: ScrollText, tone: "accent" },
  diagnosis: { label: "Diagnosis", icon: Stethoscope, tone: "warning" },
  imaging: { label: "Imaging", icon: ImageIcon, tone: "info" },
  discharge_summary: { label: "Discharge summary", icon: FileText, tone: "info" },
  other: { label: "Other", icon: FileText, tone: "primary" },
};

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, typography, radius } = useTheme();
  const { data, isLoading, error, refetch } = useMedicalRecord(id || "");
  const toast = useToast();
  const [moreOpen, setMoreOpen] = useState(false);

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]}>
        <ScreenHeader back title="Loading..." />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="40%" height={20} />
          <Skeleton height={28} radius={8} />
          <Skeleton width="60%" height={14} />
          <View style={{ height: spacing.md }} />
          <Skeleton height={120} radius={20} />
          <Skeleton height={120} radius={20} />
        </View>
      </Screen>
    );
  }

  if (error || !data?.record) {
    return (
      <Screen edges={["top"]}>
        <ScreenHeader back title="Not found" />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load record"
          message="The record may have been removed or you may not have access."
          actionLabel="Try again"
          onAction={() => refetch()}
          tone="accent2"
        />
      </Screen>
    );
  }

  const record = data.record;
  const meta = TYPE_META[record.recordType] || TYPE_META.other;
  const Icon = meta.icon;
  const { fg, bg } = useTone(meta.tone);

  const fields: { label: string; value?: string; icon?: any }[] = [
    { label: "Doctor", value: record.doctorName, icon: Stethoscope },
    { label: "Hospital", value: record.hospitalName, icon: Building2 },
    { label: "Diagnosis", value: record.diagnosis, icon: AlertTriangle },
    { label: "Summary", value: record.summary },
    { label: "Notes", value: record.notes },
    { label: "Follow-up date", value: record.followUpDate, icon: CalendarDays },
    { label: "Record date", value: record.date, icon: CalendarDays },
  ].filter((f) => f.value && String(f.value).trim());

  async function handleShare() {
    try {
      await Share.share({
        title: record.title,
        message: `${record.title}\n${record.date}\n\nView in HealthHub`,
      });
    } catch {
      // user cancelled
    }
    setMoreOpen(false);
  }

  return (
    <Screen scroll padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title="Record"
        right={
          <IconButton
            icon={MoreVertical}
            onPress={() => setMoreOpen(true)}
            accessibilityLabel="More options"
            variant="ghost"
          />
        }
      />

      {/* Compact hero strip */}
      <View
        style={{
          margin: spacing.lg,
          marginTop: spacing.sm,
          padding: spacing.lg,
          borderRadius: radius.glass,
          backgroundColor: bg,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={32} color={fg} strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Pill label={meta.label} tone={meta.tone} size="sm" />
          <Text
            style={[typography.title.md, { color: colors.text }]}
            numberOfLines={2}
          >
            {record.title}
          </Text>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted },
            ]}
          >
            {record.date}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {/* Attached file */}
        <Card padded={false}>
          <View
            style={{
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={22} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[typography.title.sm, { color: colors.text }]}
                numberOfLines={1}
              >
                {record.fileName || "Attached document"}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted },
                ]}
              >
                Tap to download
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Download file"
              onPress={() => toast.show("Download started", "info")}
              style={({ pressed }: any) => ({
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed
                  ? colors.surfaceMuted
                  : colors.primarySoft,
              })}
            >
              <Download size={18} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>
        </Card>

        {/* Fields */}
        {fields.length > 0 ? (
          <Card padded={false}>
            {fields.map((f, i) => {
              const FIcon = f.icon;
              return (
                <View key={f.label}>
                  {i > 0 ? <Divider /> : null}
                  <View
                    style={{
                      padding: spacing.lg,
                      gap: 4,
                      flexDirection: "row",
                      alignItems: "flex-start",
                    }}
                  >
                    {FIcon ? (
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.surfaceMuted,
                          marginRight: spacing.sm,
                        }}
                      >
                        <FIcon
                          size={15}
                          color={colors.textMuted}
                          strokeWidth={2.25}
                        />
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          typography.overline,
                          { color: colors.textMuted, marginBottom: 2 },
                        ]}
                      >
                        {f.label}
                      </Text>
                      <Text
                        style={[
                          typography.body.md,
                          { color: colors.text, lineHeight: 22 },
                        ]}
                      >
                        {f.value}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}
      </View>

      <BottomSheet
        visible={moreOpen}
        onDismiss={() => setMoreOpen(false)}
        title="Record options"
      >
        <View style={{ gap: spacing.sm }}>
          <SheetAction
            icon={Share2}
            label="Share"
            tone="primary"
            onPress={handleShare}
          />
          <SheetAction
            icon={Download}
            label="Download"
            tone="info"
            onPress={() => {
              setMoreOpen(false);
              toast.show("Download started", "info");
            }}
          />
          <SheetAction
            icon={Trash2}
            label="Delete record"
            tone="danger"
            onPress={() => {
              setMoreOpen(false);
              toast.show("Delete coming soon", "danger");
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function SheetAction({
  icon: Icon,
  label,
  tone,
  onPress,
}: {
  icon: any;
  label: string;
  tone: "primary" | "info" | "danger";
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const palette = useTone(tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }: any) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={18} color={palette.fg} strokeWidth={2.25} />
      </View>
      <Text
        style={[
          typography.title.sm,
          {
            color: tone === "danger" ? palette.fg : colors.text,
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
