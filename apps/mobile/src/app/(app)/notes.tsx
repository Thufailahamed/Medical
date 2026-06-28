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
  IconButton,
  useToast,
} from "@/components/ui";

export default function NotesScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useNotes();
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
      toast.show("Note body cannot be empty", "warning");
      return;
    }
    try {
      if (editingId) {
        await updateNote.mutateAsync({
          id: editingId,
          data: { title: title.trim() || null, body: body.trim(), pinned },
        });
        toast.show("Note updated", "success");
      } else {
        await createNote.mutateAsync({
          title: title.trim() || undefined,
          body: body.trim(),
          pinned,
        });
        toast.show("Note saved", "success");
      }
      cancel();
    } catch (err: any) {
      toast.show(err?.message || "Could not save note", "danger");
    }
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete note?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteNote.mutateAsync(id);
            toast.show("Note deleted", "info");
          } catch (err: any) {
            toast.show(err?.message || "Could not delete", "danger");
          }
        },
      },
    ]);
  }

  async function togglePin(n: any) {
    try {
      await updateNote.mutateAsync({
        id: n.id,
        data: { pinned: !n.pinned },
      });
    } catch (err: any) {
      toast.show(err?.message || "Could not update", "danger");
    }
  }

  if (composing) {
    return (
      <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          title={editingId ? "Edit note" : "New note"}
          right={
            <IconButton icon={X} onPress={cancel} accessibilityLabel="Cancel" />
          }
        />
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <FormField label="Title" helper="Optional">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Follow-up questions"
            />
          </FormField>
          <FormField label="Note" required>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write your note..."
              multiline
              numberOfLines={10}
              tone="soft"
              style={{ minHeight: 200 }}
            />
          </FormField>

          <Button
            title={pinned ? "Pinned" : "Pin to top"}
            variant={pinned ? "primary" : "outline"}
            icon={Pin}
            onPress={() => setPinned(!pinned)}
          />

          <Button
            title={editingId ? "Save changes" : "Save note"}
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
        title="Notes"
        subtitle="Personal journal"
        right={
          <IconButton
            icon={Plus}
            onPress={startNew}
            accessibilityLabel="New note"
          />
        }
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={120} radius={20} />
          <Skeleton height={120} radius={20} />
        </View>
      ) : notes.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            message="Use notes to track symptoms, questions for your doctor, or anything else."
            tone="neutral"
          />
          <View style={{ alignItems: "center", marginTop: spacing.lg }}>
            <Button title="Write your first note" onPress={startNew} icon={Plus} />
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
                    {n.title || "Untitled"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <IconButton
                      icon={Pin}
                      size="sm"
                      onPress={() => togglePin(n)}
                      accessibilityLabel={n.pinned ? "Unpin" : "Pin"}
                      tint={n.pinned ? colors.primary : colors.textMuted}
                    />
                    <IconButton
                      icon={Pencil}
                      size="sm"
                      onPress={() => startEdit(n)}
                      accessibilityLabel="Edit"
                    />
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      onPress={() => confirmDelete(n.id)}
                      accessibilityLabel="Delete"
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
                  {new Date(
                    n.createdAt || n.updatedAt
                  ).toLocaleString()}
                </Text>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}