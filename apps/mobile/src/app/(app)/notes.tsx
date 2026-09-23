// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TextInput as RNTextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Plus,
  StickyNote,
  Pin,
  Trash2,
  X,
  Check,
  Pencil,
  Search,
  Sparkles,
  Stethoscope,
  Activity,
  Pill,
  CalendarDays,
  Clock,
  ChevronRight,
  ListPlus,
  Heart,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
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
  FormField,
  Skeleton,
  EmptyState,
  ErrorState,
  IconButton,
  useToast,
  Pressable,
} from "@/components/ui";

const HEALTH_TEMPLATES = [
  {
    id: "questions",
    title: "Questions for Doctor",
    icon: Stethoscope,
    body: "• Symptoms onset & changes:\n• Current medications & side effects:\n• Questions about treatment plan:\n• Next follow-up or test recommendations:",
  },
  {
    id: "symptoms",
    title: "Symptom Tracker",
    icon: Activity,
    body: "• Primary symptom:\n• Severity (1-10):\n• When it started:\n• Possible triggers (food, stress, activity):\n• What helps relieve it:",
  },
  {
    id: "medications",
    title: "Medication Observation",
    icon: Pill,
    body: "• Medicine name & dose:\n• Time taken:\n• Observed reaction or side effect:\n• Questions for doctor/pharmacist:",
  },
  {
    id: "daily",
    title: "Daily Check-in",
    icon: Sparkles,
    body: "• Today's overall wellness (1-10):\n• Energy level & sleep quality:\n• Meals and hydration:\n• Physical activity or mood:",
  },
];

function formatNoteDate(iso: string | null | undefined, locale: any): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  const datePart = fmtDateLong(d, locale);
  const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

export default function NotesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography, radius, scheme } = useTheme();
  const isDark = scheme === "dark";
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

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "pinned" | "questions" | "symptoms">("all");

  const notes: any[] = data?.notes || [];

  // Categorized counts
  const pinnedCount = useMemo(() => notes.filter((n) => !!n.pinned).length, [notes]);
  const questionsCount = useMemo(
    () =>
      notes.filter((n) => {
        const text = `${n.title || ""} ${n.body || ""}`.toLowerCase();
        return text.includes("?") || text.includes("doctor") || text.includes("question");
      }).length,
    [notes]
  );
  const symptomsCount = useMemo(
    () =>
      notes.filter((n) => {
        const text = `${n.title || ""} ${n.body || ""}`.toLowerCase();
        return (
          text.includes("symptom") ||
          text.includes("pain") ||
          text.includes("fever") ||
          text.includes("headache") ||
          text.includes("severity")
        );
      }).length,
    [notes]
  );

  const filteredNotes = useMemo(() => {
    let list = notes;

    // Filter by tab
    if (selectedFilter === "pinned") {
      list = list.filter((n) => !!n.pinned);
    } else if (selectedFilter === "questions") {
      list = list.filter((n) => {
        const text = `${n.title || ""} ${n.body || ""}`.toLowerCase();
        return text.includes("?") || text.includes("doctor") || text.includes("question");
      });
    } else if (selectedFilter === "symptoms") {
      list = list.filter((n) => {
        const text = `${n.title || ""} ${n.body || ""}`.toLowerCase();
        return (
          text.includes("symptom") ||
          text.includes("pain") ||
          text.includes("fever") ||
          text.includes("headache") ||
          text.includes("severity")
        );
      });
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((n: any) => {
      const hay = `${n.title || ""} ${n.body || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, selectedFilter, searchQuery]);

  function startEdit(n: any) {
    setEditingId(n.id);
    setTitle(n.title || "");
    setBody(n.body || "");
    setPinned(!!n.pinned);
    setComposing(true);
  }

  function startNew(initialTitle?: string, initialBody?: string) {
    setEditingId(null);
    setTitle(initialTitle || "");
    setBody(initialBody || "");
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

  // Quick snippet inserter for composer
  function insertSnippet(snippet: string) {
    setBody((prev) => (prev ? `${prev}\n${snippet}` : snippet));
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
          {/* Quick Helper Snippets */}
          <View>
            <Text
              style={[
                typography.caption,
                { color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "600" },
              ]}
            >
              QUICK INSERTIONS
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs }}
            >
              <Pressable
                onPress={() => insertSnippet("• ")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 5,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <ListPlus size={12} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>
                  + Bullet point
                </Text>
              </Pressable>

              <Pressable
                onPress={() => insertSnippet(`[${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}] `)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 5,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Clock size={12} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>
                  + Timestamp
                </Text>
              </Pressable>

              <Pressable
                onPress={() => insertSnippet("Severity: 5/10 - ")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 5,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Activity size={12} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>
                  + Severity scale
                </Text>
              </Pressable>
            </ScrollView>
          </View>

          <FormField
            label={t("notes.composing.fieldTitleLabel")}
            helper={t("notes.composing.titleOptional")}
          >
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
              style={{ minHeight: 220, textAlignVertical: "top" }}
            />
          </FormField>

          {/* Pin Toggle Card */}
          <Pressable
            onPress={() => setPinned(!pinned)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: pinned
                ? isDark
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(254, 243, 199, 0.5)"
                : colors.surfaceMuted,
              borderWidth: 1,
              borderColor: pinned
                ? isDark
                  ? "rgba(245, 158, 11, 0.4)"
                  : "rgba(245, 158, 11, 0.3)"
                : colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Pin
                size={18}
                color={pinned ? "#D97706" : colors.textSubtle}
                fill={pinned ? "#D97706" : "none"}
              />
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: pinned ? colors.text : colors.text,
                  }}
                >
                  {pinned
                    ? t("notes.composing.pinToggle.on")
                    : t("notes.composing.pinToggle.off")}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
                  Pinned notes stay at the top of your journal
                </Text>
              </View>
            </View>

            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: pinned ? "#D97706" : colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pinned && <Check size={14} color="#FFF" strokeWidth={3} />}
            </View>
          </Pressable>

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
        subtitle={
          notes.length === 1
            ? "1 journal entry"
            : `${notes.length} journal entries`
        }
        right={
          <IconButton
            icon={Plus}
            onPress={() => startNew()}
            accessibilityLabel={t("notes.list.newNoteLabel")}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
      >
        {/* Clinical Health Journal Hero */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
          <View
            style={{
              backgroundColor: isDark
                ? "rgba(59, 130, 246, 0.12)"
                : colors.primarySoft,
              borderRadius: radius.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(59, 130, 246, 0.25)"
                : "rgba(37, 99, 235, 0.18)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <StickyNote size={22} color={colors.onPrimary} strokeWidth={2.4} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "800" },
                    ]}
                  >
                    Personal Health Journal
                  </Text>
                  <Sparkles size={13} color={colors.primary} />
                </View>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2, lineHeight: 18 },
                  ]}
                >
                  Record symptoms, prepare questions for your doctor, or track daily wellness.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Starter Templates Carousel */}
        <View style={{ marginTop: spacing.md }}>
          <Text
            style={[
              typography.overline,
              {
                color: colors.textSubtle,
                letterSpacing: 1.2,
                fontWeight: "700",
                paddingHorizontal: spacing.lg,
                marginBottom: spacing.xs,
              },
            ]}
          >
            {t("notes.templates.title", "QUICK TEMPLATES").toUpperCase()}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.sm,
              paddingVertical: 2,
            }}
          >
            {HEALTH_TEMPLATES.map((tmpl) => {
              const Icon = tmpl.icon;
              return (
                <Pressable
                  key={tmpl.id}
                  onPress={() => startNew(tmpl.title, tmpl.body)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: radius.lg,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Icon size={14} color={colors.primary} strokeWidth={2.2} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.text,
                    }}
                  >
                    {tmpl.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Search Bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              height: 44,
            }}
          >
            <Search size={17} color={colors.textSubtle} strokeWidth={2.2} />
            <RNTextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("notes.searchPlaceholder", "Search notes, questions, symptoms…")}
              placeholderTextColor={colors.textSubtle}
              style={{
                flex: 1,
                paddingHorizontal: spacing.sm,
                fontSize: 13.5,
                color: colors.text,
                height: "100%",
              }}
              returnKeyType="search"
              clearButtonMode="never"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={13} color={colors.text} strokeWidth={2.4} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Category Filters Carousel */}
        <View style={{ marginTop: spacing.sm }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.xs,
              paddingVertical: 4,
            }}
          >
            <FilterChip
              label={t("notes.filters.all", "All")}
              count={notes.length}
              active={selectedFilter === "all"}
              onPress={() => setSelectedFilter("all")}
            />
            {pinnedCount > 0 && (
              <FilterChip
                label={`📌 ${t("notes.filters.pinned", "Pinned")}`}
                count={pinnedCount}
                active={selectedFilter === "pinned"}
                onPress={() => setSelectedFilter("pinned")}
              />
            )}
            {questionsCount > 0 && (
              <FilterChip
                label={t("notes.filters.questions", "Questions")}
                count={questionsCount}
                active={selectedFilter === "questions"}
                onPress={() => setSelectedFilter("questions")}
              />
            )}
            {symptomsCount > 0 && (
              <FilterChip
                label={t("notes.filters.symptoms", "Symptoms")}
                count={symptomsCount}
                active={selectedFilter === "symptoms"}
                onPress={() => setSelectedFilter("symptoms")}
              />
            )}
          </ScrollView>
        </View>

        {/* Notes List Content */}
        {isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Skeleton height={120} radius={20} />
            <Skeleton height={120} radius={20} />
            <Skeleton height={120} radius={20} />
          </View>
        ) : isError ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ErrorState
              title={t("recordDetail.errorTitle", "Couldn't load notes")}
              message={t("recordDetail.errorBody", "Check your connection and try again.")}
              actionLabel={t("common.retry")}
              onAction={() => refetch()}
            />
          </View>
        ) : filteredNotes.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <EmptyState
              style={{ marginTop: spacing.xl }}
              icon={searchQuery || selectedFilter !== "all" ? Search : StickyNote}
              title={
                searchQuery || selectedFilter !== "all"
                  ? t("notes.emptySearch.title", "No matching notes")
                  : t("notes.empty.title")
              }
              message={
                searchQuery || selectedFilter !== "all"
                  ? t("notes.emptySearch.message", "Try searching with a different keyword.")
                  : t("notes.empty.message")
              }
              actionLabel={
                searchQuery || selectedFilter !== "all"
                  ? t("notes.emptySearch.clear", "Clear search")
                  : t("notes.empty.action")
              }
              onAction={
                searchQuery || selectedFilter !== "all"
                  ? () => {
                      setSearchQuery("");
                      setSelectedFilter("all");
                    }
                  : () => startNew()
              }
            />
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              gap: spacing.md,
            }}
          >
            {filteredNotes.map((n) => {
              const formattedDate = formatNoteDate(n.updatedAt || n.createdAt, locale);

              return (
                <Pressable
                  key={n.id}
                  onPress={() => startEdit(n)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed
                      ? colors.surfaceMuted
                      : n.pinned
                      ? isDark
                        ? "rgba(245, 158, 11, 0.08)"
                        : "rgba(254, 243, 199, 0.35)"
                      : colors.surface,
                    borderRadius: radius.xl,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: n.pinned
                      ? isDark
                        ? "rgba(245, 158, 11, 0.35)"
                        : "rgba(245, 158, 11, 0.3)"
                      : isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : colors.border,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0 : 0.03,
                    shadowRadius: 5,
                    elevation: 1,
                  })}
                >
                  {/* Top Note Row: Title + Pinned Badge */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: spacing.sm,
                    }}
                  >
                    <Text
                      style={[
                        typography.title.sm,
                        {
                          color: colors.text,
                          fontWeight: "800",
                          flex: 1,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {n.title || t("notes.list.untitled")}
                    </Text>

                    {n.pinned && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                          paddingHorizontal: 8,
                          paddingVertical: 2.5,
                          borderRadius: radius.full,
                          backgroundColor: isDark
                            ? "rgba(245, 158, 11, 0.25)"
                            : "#FEF3C7",
                          borderWidth: 1,
                          borderColor: "rgba(245, 158, 11, 0.3)",
                        }}
                      >
                        <Pin size={10} color="#D97706" fill="#D97706" />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: "#D97706",
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                          }}
                        >
                          Pinned
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Note Body Text */}
                  <Text
                    style={[
                      typography.body.sm,
                      {
                        color: colors.text,
                        lineHeight: 20,
                        marginTop: spacing.xs,
                      },
                    ]}
                    numberOfLines={5}
                  >
                    {n.body}
                  </Text>

                  {/* Bottom Action & Timestamp Row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: spacing.md,
                      paddingTop: spacing.xs,
                      borderTopWidth: 1,
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <CalendarDays size={11} color={colors.textSubtle} strokeWidth={2.2} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: colors.textSubtle,
                        }}
                      >
                        {formattedDate}
                      </Text>
                    </View>

                    {/* Action buttons with isolated touch handlers */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {/* Pin button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          togglePin(n);
                        }}
                        hitSlop={6}
                        style={{
                          padding: 5,
                          borderRadius: radius.full,
                          backgroundColor: n.pinned
                            ? "rgba(245, 158, 11, 0.15)"
                            : colors.surfaceMuted,
                        }}
                      >
                        <Pin
                          size={13}
                          color={n.pinned ? "#D97706" : colors.textSubtle}
                          fill={n.pinned ? "#D97706" : "none"}
                        />
                      </Pressable>

                      {/* Edit button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          startEdit(n);
                        }}
                        hitSlop={6}
                        style={{
                          padding: 5,
                          borderRadius: radius.full,
                          backgroundColor: colors.surfaceMuted,
                        }}
                      >
                        <Pencil size={13} color={colors.primary} />
                      </Pressable>

                      {/* Delete button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          confirmDelete(n.id);
                        }}
                        hitSlop={6}
                        style={{
                          padding: 5,
                          borderRadius: radius.full,
                          backgroundColor: colors.dangerSoft ?? colors.surfaceMuted,
                        }}
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary : colors.surfaceMuted,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? "700" : "600",
          color: active ? colors.onPrimary : colors.text,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 999,
          backgroundColor: active
            ? "rgba(255, 255, 255, 0.25)"
            : colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: active ? colors.onPrimary : colors.textMuted,
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}