// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
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
  const { spacing, colors, typography, radius, scheme, shadow } = useTheme();
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
              contentContainerStyle={{ gap: spacing.sm }}
            >
              <Pressable
                onPress={() => insertSnippet("• ")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: spacing.md,
                  height: 32,
                  borderRadius: radius.full,
                  backgroundColor: colors.fill,
                }}
              >
                <ListPlus size={12} color={colors.primary} />
                <Text style={[typography.label.sm, { color: colors.text }]}>
                  + Bullet point
                </Text>
              </Pressable>

              <Pressable
                onPress={() => insertSnippet(`[${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}] `)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: spacing.md,
                  height: 32,
                  borderRadius: radius.full,
                  backgroundColor: colors.fill,
                }}
              >
                <Clock size={12} color={colors.primary} />
                <Text style={[typography.label.sm, { color: colors.text }]}>
                  + Timestamp
                </Text>
              </Pressable>

              <Pressable
                onPress={() => insertSnippet("Severity: 5/10 - ")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: spacing.md,
                  height: 32,
                  borderRadius: radius.full,
                  backgroundColor: colors.fill,
                }}
              >
                <Activity size={12} color={colors.primary} />
                <Text style={[typography.label.sm, { color: colors.text }]}>
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
              padding: spacing.lg,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: pinned ? colors.warningSoft : colors.fill,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <Pin
                size={18}
                color={pinned ? colors.warning : colors.textSubtle}
                fill={pinned ? colors.warning : "none"}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[typography.title.sm, { color: colors.text }]}
                >
                  {pinned
                    ? t("notes.composing.pinToggle.on")
                    : t("notes.composing.pinToggle.off")}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                  Pinned notes stay at the top of your journal
                </Text>
              </View>
            </View>

            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: pinned ? colors.warning : "transparent",
                borderWidth: pinned ? 0 : 1.5,
                borderColor: colors.textSubtle,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pinned && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
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
              backgroundColor: colors.primarySoft,
              borderRadius: radius.card,
              borderCurve: "continuous",
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  borderCurve: "continuous",
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
                      typography.title.md,
                      { color: colors.text },
                    ]}
                  >
                    Personal Health Journal
                  </Text>
                  <Sparkles size={13} color={colors.primary} />
                </View>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                >
                  Record symptoms, prepare questions for your doctor, or track daily wellness.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Starter Templates Carousel */}
        <View style={{ marginTop: spacing.xl }}>
          <Text
            style={[
              typography.overline,
              {
                color: colors.textSubtle,
                paddingHorizontal: spacing.lg + 2,
                marginBottom: spacing.sm,
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
                    gap: 8,
                    paddingHorizontal: spacing.md,
                    height: 40,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    backgroundColor: colors.surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: isDark ? colors.borderStrong : colors.separator,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Icon size={15} color={colors.primary} strokeWidth={2.2} />
                  <Text
                    style={[typography.label.md, { color: colors.text }]}
                  >
                    {tmpl.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Search Bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.fill,
              borderRadius: 12,
              borderCurve: "continuous",
              paddingHorizontal: 12,
              height: 42,
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
                fontSize: 16,
                fontFamily: typography.body.md.fontFamily,
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
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: colors.textSubtle,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={12} color={colors.surface} strokeWidth={3} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Category Filters Carousel */}
        <View style={{ marginTop: spacing.md }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.sm,
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
            <Skeleton height={130} radius={radius.card} />
            <Skeleton height={130} radius={radius.card} />
            <Skeleton height={130} radius={radius.card} />
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
              paddingTop: spacing.md,
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
                    backgroundColor: colors.surface,
                    borderRadius: radius.card,
                    borderCurve: "continuous",
                    padding: spacing.lg,
                    borderWidth: n.pinned ? 1 : StyleSheet.hairlineWidth,
                    borderColor: n.pinned
                      ? colors.warning + "59"
                      : isDark
                      ? colors.borderStrong
                      : colors.separator,
                    ...(isDark ? null : shadow.sm),
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
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
                        typography.title.md,
                        {
                          color: colors.text,
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
                          paddingVertical: 3,
                          borderRadius: radius.full,
                          backgroundColor: colors.warningSoft,
                        }}
                      >
                        <Pin size={10} color={colors.warning} fill={colors.warning} />
                        <Text
                          style={[
                            typography.label.xs,
                            {
                              fontSize: 10,
                              color: colors.warning,
                              textTransform: "uppercase",
                            },
                          ]}
                        >
                          Pinned
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Note Body Text */}
                  <Text
                    style={[
                      typography.body.md,
                      {
                        color: colors.textMuted,
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
                      paddingTop: spacing.md,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.separator,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <CalendarDays size={12} color={colors.textSubtle} strokeWidth={2.2} />
                      <Text
                        style={[typography.caption, { color: colors.textSubtle }]}
                      >
                        {formattedDate}
                      </Text>
                    </View>

                    {/* Action buttons with isolated touch handlers */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {/* Pin button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          togglePin(n);
                        }}
                        hitSlop={6}
                        style={{
                          width: 32,
                          height: 32,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: radius.full,
                          backgroundColor: n.pinned
                            ? colors.warningSoft
                            : colors.fill,
                        }}
                      >
                        <Pin
                          size={14}
                          color={n.pinned ? colors.warning : colors.textSubtle}
                          fill={n.pinned ? colors.warning : "none"}
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
                          width: 32,
                          height: 32,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: radius.full,
                          backgroundColor: colors.primarySoft,
                        }}
                      >
                        <Pencil size={14} color={colors.primary} />
                      </Pressable>

                      {/* Delete button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          confirmDelete(n.id);
                        }}
                        hitSlop={6}
                        style={{
                          width: 32,
                          height: 32,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: radius.full,
                          backgroundColor: colors.dangerSoft,
                        }}
                      >
                        <Trash2 size={14} color={colors.danger} />
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
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        height: 36,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary : colors.fill,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={[
          typography.label.md,
          { color: active ? colors.onPrimary : colors.text },
        ]}
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
            : colors.fillStrong,
        }}
      >
        <Text
          style={[
            typography.label.xs,
            { letterSpacing: 0, color: active ? colors.onPrimary : colors.textMuted },
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}