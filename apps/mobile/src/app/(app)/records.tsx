import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import {
  Upload,
  FileText,
  FlaskConical,
  Stethoscope,
  Image as ImageIcon,
  ScrollText,
  Search,
} from "lucide-react-native";
import { useMedicalRecords, useUploadFile } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast } from "@/components/ui";
import {
  Screen,
  ScreenHeader,
  IconButton,
  ListItem,
  EmptyState,
  TextInput,
  Skeleton,
  Pill,
  PillTone,
} from "@/components/ui";
import { useDebounce } from "@/hooks/useDebounce";
import { useTone, type Tone } from "@/theme/tone";

const TYPE_META: Record<
  string,
  { label: string; icon: any; tone: Tone }
> = {
  lab_report: { label: "Lab report", icon: FlaskConical, tone: "primary" },
  prescription: { label: "Prescription", icon: ScrollText, tone: "accent" },
  diagnosis: { label: "Diagnosis", icon: Stethoscope, tone: "warning" },
  imaging: { label: "Imaging", icon: ImageIcon, tone: "info" },
  discharge_summary: { label: "Discharge", icon: FileText, tone: "info" },
  other: { label: "Other", icon: FileText, tone: "primary" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "lab_report", label: "Lab" },
  { value: "prescription", label: "Rx" },
  { value: "imaging", label: "Imaging" },
  { value: "diagnosis", label: "Diagnosis" },
];

export default function RecordsScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useMedicalRecords();
  const uploadFile = useUploadFile();
  const records = data?.records || [];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const debouncedSearch = useDebounce(search, 250);

  const filtered = records.filter((r: any) => {
    const rec = r.medical_records;
    if (filter !== "all" && rec.recordType !== filter) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return (
        rec.title?.toLowerCase().includes(q) ||
        rec.recordType?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadFile.mutateAsync({
        file: {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || "application/octet-stream",
        } as any,
      });
      toast.show("File uploaded successfully", "success");
    } catch (err: any) {
      toast.show(err.message || "Upload failed", "danger");
    }
  }

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        title="Medical records"
        subtitle={`${records.length} ${records.length === 1 ? "record" : "records"}`}
        right={
          <IconButton
            icon={Upload}
            variant="solid"
            onPress={handleUpload}
            accessibilityLabel="Upload record"
          />
        }
      />

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <TextInput
          placeholder="Search records..."
          value={search}
          onChangeText={setSearch}
          leadingIcon={Search}
          tone="soft"
          autoCorrect={false}
          autoCapitalize="none"
        />

        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <FilterPill
              key={f.value}
              label={f.label}
              active={filter === f.value}
              onPress={() => setFilter(f.value)}
            />
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={80} radius={20} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={records.length === 0 ? "No records yet" : "No matches"}
          message={
            records.length === 0
              ? "Upload your first medical record to get started"
              : "Try a different search or filter"
          }
          actionLabel={records.length === 0 ? "Upload record" : undefined}
          onAction={records.length === 0 ? handleUpload : undefined}
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {filtered.map((item: any) => {
            const rec = item.medical_records;
            const meta = TYPE_META[rec.recordType] || TYPE_META.other;
            const Icon = meta.icon;
            return (
              <RecordRow
                key={rec.id}
                rec={rec}
                meta={meta}
                Icon={Icon}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/record-detail",
                    params: { id: rec.id },
                  })
                }
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function RecordRow({
  rec,
  meta,
  Icon,
  onPress,
}: {
  rec: any;
  meta: { label: string; icon: any; tone: Tone };
  Icon: any;
  onPress: () => void;
}) {
  return (
    <ListItem
      icon={Icon}
      iconTone={meta.tone}
      pill={{ label: meta.label, tone: meta.tone as PillTone }}
      title={rec.title}
      subtitle={rec.date}
      showChevron
      onPress={onPress}
    />
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onTouchEnd={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={[
          typography.label.md,
          {
            color: active ? colors.onPrimary : colors.text,
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
