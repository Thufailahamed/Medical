// @ts-nocheck
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  Trash2,
  Tag as TagIcon,
  Archive,
  ArchiveRestore,
  Users,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  useBulkArchiveRecords,
  useBulkDeleteRecords,
  useBulkRestoreRecords,
  useBulkMoveRecords,
} from "@/hooks/useApi";
import { useToast } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  selectedIds: string[];
  allArchived?: boolean; // if true, show Restore instead of Archive
  hideMove?: boolean; // doctor view cannot move between family members
  onClose: () => void;
  onTagPress: () => void;
  onMovePress: () => void;
};

export function RecordsActionBar({
  selectedIds = [],
  allArchived,
  hideMove,
  onClose,
  onTagPress,
  onMovePress,
}: Props) {
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const toast = useToast();
  const archive = useBulkArchiveRecords();
  const restore = useBulkRestoreRecords();
  const del = useBulkDeleteRecords();
  const move = useBulkMoveRecords();

  const count = (selectedIds || []).length;
  const busy =
    archive.isPending ||
    restore.isPending ||
    del.isPending ||
    move.isPending;

  function announceDenied(
    op: string,
    denied: Array<{ id: string; reason: string }> | undefined,
    ok: number
  ) {
    if (!denied || denied.length === 0) {
      toast.show(`${ok} record${ok === 1 ? "" : "s"} ${op}`, "success");
      return;
    }
    toast.show(
      `${op}: ${ok} done, ${denied.length} denied`,
      "warning"
    );
  }

  async function handleArchive() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const res = await archive.mutateAsync(selectedIds || []);
      announceDenied("archived", res.denied, res.archived);
      const ids = [...(selectedIds || [])];
      toast.show("Archived", {
        tone: "info",
        action: {
          label: "Undo",
          onPress: async () => {
            try {
              const r = await restore.mutateAsync(ids);
              announceDenied("restored", r.denied, r.restored);
            } catch (err: any) {
              toast.show(err?.message || "Restore failed", "danger");
            }
          },
        },
      });
      onClose();
    } catch (err: any) {
      toast.show(err?.message || "Archive failed", "danger");
    }
  }

  async function handleRestore() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const res = await restore.mutateAsync(selectedIds || []);
      announceDenied("restored", res.denied, res.restored);
      onClose();
    } catch (err: any) {
      toast.show(err?.message || "Restore failed", "danger");
    }
  }

  function handleDelete() {
    Alert.alert(
      `Delete ${count} record${count === 1 ? "" : "s"}?`,
      "This will permanently remove the records and their attachments. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
              () => {}
            );
            try {
              const res = await del.mutateAsync(selectedIds || []);
              announceDenied("deleted", res.denied, res.deleted);
              onClose();
            } catch (err: any) {
              toast.show(err?.message || "Delete failed", "danger");
            }
          },
        },
      ]
    );
  }

  const Action = ({
    icon: Icon,
    label,
    onPress,
    tone = "neutral",
    disabled,
  }: any) => (
    <Pressable
      onPress={busy || disabled ? undefined : onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        opacity: busy || disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Icon
        size={20}
        color={
          tone === "danger"
            ? colors.danger
            : tone === "warning"
            ? colors.warning
            : colors.text
        }
        strokeWidth={2.25}
      />
      <Text
        style={[
          typography.caption,
          {
            color:
              tone === "danger"
                ? colors.danger
                : tone === "warning"
                ? colors.warning
                : colors.text,
            marginTop: 2,
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.bar,
        shadow.lg,
        {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.sm,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
        }}
      >
        <Text
          style={[
            typography.label.md,
            { color: colors.textMuted, flex: 1, fontWeight: "700" },
          ]}
        >
          {count} selected
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel selection"
        >
          <X size={18} color={colors.textMuted} strokeWidth={2.5} />
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 4,
        }}
      >
        {busy ? (
          <View style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <Action icon={TagIcon} label="Tag" onPress={onTagPress} />
            {!hideMove && (
              <Action
                icon={Users}
                label="Move"
                onPress={onMovePress}
                disabled={!allArchived && false}
              />
            )}
            {allArchived ? (
              <Action
                icon={ArchiveRestore}
                label="Unarchive"
                tone="warning"
                onPress={handleRestore}
              />
            ) : (
              <Action
                icon={Archive}
                label="Archive"
                tone="warning"
                onPress={handleArchive}
              />
            )}
            <Action
              icon={Trash2}
              label="Delete"
              tone="danger"
              onPress={handleDelete}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    paddingTop: 4,
  },
});