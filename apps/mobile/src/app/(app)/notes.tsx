import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  Plus,
  StickyNote,
  Pin,
  Trash2,
  X,
  Check,
  Pencil,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateTime } from "@/lib/format";
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  TextInput,
  Card,
  Button,
  Avatar,
  FormField,
  Skeleton,
  EmptyState,
  ErrorState,
  IconButton,
  useToast,
} from "@/components/ui";

export default function NotesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useNotes();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const notes: any[] = data?.notes || [];

  function startEdit(n: any) {
    setEditingId(n.id);
    setTitle(n.title || "");
    setBody(n.body || "");
    setPinned(!!n.pinned);
    setComposing(true);
  }

  function startNew() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPinned(false);
    setComposing(true);
  }

  function cancel() {
    setComposing(false);
    setEditingId(null);
  }

  async function save() {
    if (!body.trim()) {
      toast.show(t("notes.validation.bodyRequired"), "warning");
      return;
    }
    try {
      if (editingId) {
        await updateNote.mutateAsync({
          id: editingId,
          data: { title: title.trim() || null, body: body.trim(), pinned },
        });
        toast.show(t("notes.toast.updated"), "success");
      } else {
        await createNote.mutateAsync({
          title: title.trim() || undefined,
          body: body.trim(),
          pinned,
        });
        toast.show(t("notes.toast.saved"), "success");
      }
      cancel();
    } catch (err: any) {
      toast.show(err?.message || t("notes.toast.saveError"), "danger");
    }
  }

  function confirmDelete(id: string) {
    Alert.alert(
      t("notes.deleteConfirm.title"),
      t("notes.deleteConfirm.body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteNote.mutateAsync(id);
              toast.show(t("notes.toast.deleted"), "info");
            } catch (err: any) {
              toast.show(err?.message || t("notes.toast.deleteError"), "danger");
            }
          },
        },
      ]
    );
  }

  async function togglePin(n: any) {
    try {
      await updateNote.mutateAsync({
        id: n.id,
        data: { pinned: !n.pinned },
      });
    } catch (err: any) {
      toast.show(err?.message || t("notes.toast.updateError"), "danger");
    }
  }

  if (composing) {
    return (
      <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          title={editingId ? t("notes.composing.editTitle") : t("notes.composing.newTitle")}
          right={
            <IconButton
              icon={X}
              onPress={cancel}
              accessibilityLabel={t("notes.composing.cancelLabel")}
            />
          }
        />
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <FormField label={t("notes.composing.fieldTitleLabel")} helper={t("notes.composing.titleOptional")}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("notes.composing.titlePlaceholder")}
            />
          </FormField>
          <FormField label={t("notes.composing.bodyLabel")} required>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t("notes.composing.bodyPlaceholder")}
              multiline
              numberOfLines={10}
              tone="soft"
              style={{ minHeight: 200 }}
            />
          </FormField>

          <Button
            title={pinned ? t("notes.composing.pinToggle.on") : t("notes.composing.pinToggle.off")}
            variant={pinned ? "primary" : "outline"}
            icon={Pin}
            onPress={() => setPinned(!pinned)}
          />

          <Button
            title={editingId ? t("notes.composing.submitEdit") : t("notes.composing.submitNew")}
            onPress={save}
            loading={createNote.isPending || updateNote.isPending}
            icon={Check}
            size="lg"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader
        title={t("notes.title")}
        subtitle={t("notes.subtitle")}
        right={
          <IconButton
            icon={Plus}
            onPress={startNew}
            accessibilityLabel={t("notes.list.newNoteLabel")}
          />
        }
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={120} radius={20} />
          <Skeleton height={120} radius={20} />
        </View>
      ) : isError ? (
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load notes")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : notes.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={StickyNote}
            title={t("notes.empty.title")}
            message={t("notes.empty.message")}
            tone="neutral"
          />
          <View style={{ alignItems: "center", marginTop: spacing.lg }}>
            <Button
              title={t("notes.empty.action")}
              onPress={startNew}
              icon={Plus}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: 120,
          }}
        >
          {notes.map((n) => (
            <Card key={n.id} padded={false}>
              <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={[typography.title.sm, { color: colors.text, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {n.title || t("notes.list.untitled")}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <IconButton
                      icon={Pin}
                      size="sm"
                      onPress={() => togglePin(n)}
                      accessibilityLabel={n.pinned ? t("notes.list.unpinLabel") : t("notes.list.pinLabel")}
                      tint={n.pinned ? colors.primary : colors.textMuted}
                    />
                    <IconButton
                      icon={Pencil}
                      size="sm"
                      onPress={() => startEdit(n)}
                      accessibilityLabel={t("notes.list.editLabel")}
                    />
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      onPress={() => confirmDelete(n.id)}
                      accessibilityLabel={t("notes.list.deleteLabel")}
                      tint={colors.danger}
                    />
                  </View>
                </View>
                <Text
                  style={[typography.body.md, { color: colors.text }]}
                  numberOfLines={6}
                >
                  {n.body}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textMuted }]}
                >
                  {fmtDateTime(new Date(n.createdAt || n.updatedAt), locale)}
                </Text>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}