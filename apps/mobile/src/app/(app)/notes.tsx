// @ts-nocheck

import { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Alert,
  TextInput as RNTextInput,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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
  MessageCircleQuestion,
  Gauge,
  HelpCircle,
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
import { useTone } from "@/theme/tone";
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
  IconTile,
  SectionHeader,
} from "@/components/ui";

const HEALTH_TEMPLATES = [
  {
    id: "questions",
    tone: "primary" as const,
    prompts: 4,
    title: "Questions for Doctor",
    icon: Stethoscope,
    body: "• Symptoms onset & changes:\n• Current medications & side effects:\n• Questions about treatment plan:\n• Next follow-up or test recommendations:",
  },
  {
    id: "symptoms",
    tone: "danger" as const,
    prompts: 5,
    title: "Symptom Tracker",
    icon: Activity,
    body: "• Primary symptom:\n• Severity (1-10):\n• When it started:\n• Possible triggers (food, stress, activity):\n• What helps relieve it:",
  },
  {
    id: "medications",
    tone: "success" as const,
    prompts: 4,
    title: "Medication Observation",
    icon: Pill,
    body: "• Medicine name & dose:\n• Time taken:\n• Observed reaction or side effect:\n• Questions for doctor/pharmacist:",
  },
  {
    id: "daily",
    tone: "accent2" as const,
    prompts: 4,
    title: "Daily Check-in",
    icon: Sparkles,
    body: "• Today's overall wellness (1-10):\n• Energy level & sleep quality:\n• Meals and hydration:\n• Physical activity or mood:",
  },
];

function noteText(n: any): string {
  return `${n.title || ""} ${n.body || ""}`.toLowerCase();
}

function isQuestionNote(n: any): boolean {
  const text = noteText(n);
  return text.includes("?") || text.includes("doctor") || text.includes("question");
}

function isSymptomNote(n: any): boolean {
  const text = noteText(n);
  return ["symptom", "pain", "fever", "headache", "severity"].some((k) => text.includes(k));
}

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
  // Snapshot at open so "cancel" only warns when something actually changed.
  const [initial, setInitial] = useState({ title: "", body: "", pinned: false });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "pinned" | "questions" | "symptoms">("all");

  const notes: any[] = data?.notes || [];

  // Categorized counts
  const pinnedCount = useMemo(() => notes.filter((n) => !!n.pinned).length, [notes]);
  const questionsCount = useMemo(() => notes.filter(isQuestionNote).length, [notes]);
  const symptomsCount = useMemo(() => notes.filter(isSymptomNote).length, [notes]);

  const filteredNotes = useMemo(() => {
    let list = notes;

    // Filter by tab
    if (selectedFilter === "pinned") {
      list = list.filter((n) => !!n.pinned);
    } else if (selectedFilter === "questions") {
      list = list.filter(isQuestionNote);
    } else if (selectedFilter === "symptoms") {
      list = list.filter(isSymptomNote);
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
    setInitial({ title: n.title || "", body: n.body || "", pinned: !!n.pinned });
    setComposing(true);
  }

  function startNew(initialTitle?: string, initialBody?: string) {
    setEditingId(null);
    setTitle(initialTitle || "");
    setBody(initialBody || "");
    setPinned(false);
    setInitial({ title: initialTitle || "", body: initialBody || "", pinned: false });
    setComposing(true);
  }

  function cancel() {
    setComposing(false);
    setEditingId(null);
  }

  const dirty = title !== initial.title || body !== initial.body || pinned !== initial.pinned;

  function requestCancel() {
    if (!dirty) return cancel();
    Alert.alert(
      t("notes.composing.discardTitle", "Discard changes?"),
      t("notes.composing.discardBody", "Your edits to this note will be lost."),
      [
        { text: t("notes.composing.keepEditing", "Keep editing"), style: "cancel" },
        { text: t("notes.composing.discard", "Discard"), style: "destructive", onPress: cancel },
      ]
    );
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
    const words = body.trim() ? body.trim().split(/\s+/).length : 0;
    const saving = createNote.isPending || updateNote.isPending;
    const tools = [
      { icon: ListPlus, label: t("notes.composing.tools.bullet", "Bullet"), snippet: "• " },
      {
        icon: Clock,
        label: t("notes.composing.tools.time", "Time"),
        snippet: () => `[${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}] `,
      },
      { icon: Gauge, label: t("notes.composing.tools.severity", "Severity"), snippet: "Severity: 5/10 - " },
      { icon: HelpCircle, label: t("notes.composing.tools.question", "Question"), snippet: "Q: " },
    ];
    return (
      <Screen padded={false} keyboard edges={["top"]} bottomInset>
        <ScreenHeader
          onBack={requestCancel}
          title={editingId ? t("notes.composing.editTitle") : t("notes.composing.newTitle")}
          subtitle={
            dirty
              ? t("notes.composing.unsaved", "Unsaved changes")
              : editingId
              ? t("notes.composing.editing", "Editing")
              : undefined
          }
        />

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }}
        >
          {/* One "paper" card: title + body + formatting toolbar */}
          <Card padded={false}>
            <RNTextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("notes.composing.titlePlaceholderShort", "Title (optional)")}
              placeholderTextColor={colors.textSubtle}
              returnKeyType="next"
              style={[
                typography.title.lg,
                {
                  color: colors.text,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.lg,
                  paddingBottom: spacing.md,
                },
              ]}
            />
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.separator,
                marginHorizontal: spacing.lg,
              }}
            />
            <RNTextInput
              value={body}
              onChangeText={setBody}
              placeholder={t("notes.composing.bodyPlaceholderLong", "How are you feeling? Symptoms, questions for your doctor, anything worth remembering…")}
              placeholderTextColor={colors.textSubtle}
              multiline
              autoFocus={!editingId && !body}
              textAlignVertical="top"
              style={[
                typography.body.lg ?? typography.body.md,
                {
                  color: colors.text,
                  minHeight: 260,
                  lineHeight: 24,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.lg,
                },
              ]}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
                backgroundColor: colors.surfaceMuted,
                borderBottomLeftRadius: radius.card,
                borderBottomRightRadius: radius.card,
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="always"
              >
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Pressable
                      key={tool.label}
                      haptic="light"
                      onPress={() =>
                        insertSnippet(typeof tool.snippet === "function" ? tool.snippet() : tool.snippet)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={tool.label}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        height: 32,
                        paddingHorizontal: 11,
                        borderRadius: 16,
                        backgroundColor: colors.surface,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.hairline,
                      }}
                    >
                      <Icon size={14} color={colors.primary} strokeWidth={2.3} />
                      <Text style={[typography.label.sm, { color: colors.text }]}>{tool.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={[typography.caption, { color: colors.textSubtle, fontVariant: ["tabular-nums"] }]}>
                {t("notes.composing.words", { count: words, defaultValue: `${words} words` })}
              </Text>
            </View>
          </Card>

          {/* Pin setting as a native switch row */}
          <Card padded={false}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, paddingHorizontal: spacing.lg }}>
              <IconTile icon={Pin} tone={pinned ? "warning" : "neutral"} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.title.sm, { color: colors.text }]}>
                  {t("notes.composing.pinToggle.off")}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
                  {t("notes.composing.pinHelp", "Pinned notes stay at the top of your journal")}
                </Text>
              </View>
              <Switch
                value={pinned}
                onValueChange={setPinned}
                trackColor={{ true: colors.warning, false: colors.fillStrong }}
                accessibilityLabel={t("notes.composing.pinToggle.off")}
              />
            </View>
          </Card>
        </ScrollView>

        {/* Sticky save */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
            backgroundColor: colors.bg,
          }}
        >
          <Button
            title={editingId ? t("notes.composing.submitEdit") : t("notes.composing.submitNew")}
            onPress={save}
            loading={saving}
            disabled={!body.trim() || (!!editingId && !dirty)}
            icon={Check}
            size="lg"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  const pinnedNotes = filteredNotes.filter((n) => !!n.pinned);
  const otherNotes = filteredNotes.filter((n) => !n.pinned);
  const isFiltering = !!searchQuery.trim() || selectedFilter !== "all";
  const lastEntry = notes.reduce<string | null>((acc, n) => {
    const ts = n.updatedAt || n.createdAt;
    return ts && (!acc || ts > acc) ? ts : acc;
  }, null);

  const renderNote = (n: any) => (
    <NoteCard
      key={n.id}
      note={n}
      locale={locale}
      untitled={t("notes.list.untitled")}
      onOpen={() => startEdit(n)}
      onTogglePin={() => togglePin(n)}
      onDelete={() => confirmDelete(n.id)}
    />
  );

  return (
    <Screen scroll padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        title={t("notes.title")}
        subtitle={
          t("notes.entryCount", { count: notes.length, defaultValue: `${notes.length} journal entries` })
        }
        right={
          <IconButton
            icon={Plus}
            onPress={() => startNew()}
            accessibilityLabel={t("notes.list.newNoteLabel")}
          />
        }
      />

      {/* Health Journal Hero */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
        <LinearGradient
          colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 28,
            borderCurve: "continuous",
            padding: spacing.xl,
            overflow: "hidden",
            ...(isDark ? null : shadow.hero),
          }}
        >
          {/* Decorative orbs */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 220,
              height: 220,
              borderRadius: 110,
              top: -110,
              right: -70,
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 140,
              height: 140,
              borderRadius: 70,
              bottom: -60,
              left: -40,
              backgroundColor: "rgba(255,255,255,0.07)",
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={[typography.kicker, { color: "rgba(255,255,255,0.78)", textTransform: "uppercase" }]}>
                {t("notes.hero.kicker", "Health journal")}
              </Text>
              <Text style={[typography.title.lg, { color: "#FFFFFF", marginTop: 6 }]}>
                {t("notes.hero.title", "Your health, in your words")}
              </Text>
            </View>
            <IconTile icon={StickyNote} appearance="glass" size={46} />
          </View>

          <Text style={[typography.body.sm, { color: "rgba(255,255,255,0.84)", marginTop: spacing.sm }]}>
            {lastEntry
              ? t("notes.hero.lastEntry", { when: formatRelative(lastEntry, locale, t), defaultValue: `Last entry ${formatRelative(lastEntry, locale, t)}` })
              : t("notes.hero.body", "Record symptoms, prepare doctor questions, track wellness.")}
          </Text>

          <Pressable
            onPress={() => startNew()}
            haptic="light"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: spacing.lg,
              height: 48,
              borderRadius: radius.full,
              backgroundColor: "#FFFFFF",
            }}
          >
            <Plus size={17} color={colors.primary} strokeWidth={2.6} />
            <Text style={[typography.label.lg, { color: colors.primary }]}>
              {t("notes.hero.cta", "Write a new note")}
            </Text>
          </Pressable>
        </LinearGradient>
      </View>

      {/* Quick Starter Templates: 2×2 grid so nothing clips off-screen */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionHeader
          kicker={t("notes.templates.kicker", "Start faster")}
          title={t("notes.templates.title", "Quick templates")}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {HEALTH_TEMPLATES.map((tmpl) => {
            const label = t(`notes.templates.${tmpl.id}`, tmpl.title);
            return (
              <Pressable
                key={tmpl.id}
                onPress={() => startNew(label, tmpl.body)}
                haptic="light"
                wrapperStyle={[{ flexGrow: 1, flexBasis: "40%" }, isDark ? null : shadow.xs]}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm + 2,
                  padding: spacing.md,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  backgroundColor: colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isDark ? colors.borderStrong : colors.hairline,
                }}
              >
                <IconTile icon={tmpl.icon} tone={tmpl.tone} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.label.md, { color: colors.text }]} numberOfLines={2}>
                    {label}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                    {t("notes.templates.prompts", { count: tmpl.prompts, defaultValue: `${tmpl.prompts} prompts` })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Search + filters */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionHeader
          kicker={t("notes.list.kicker", "Your entries")}
          title={t("notes.list.heading", "Journal")}
          count={notes.length}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? colors.borderStrong : colors.hairline,
            paddingHorizontal: 14,
            height: 48,
            ...(isDark ? null : shadow.xs),
          }}
        >
          <Search size={18} color={colors.textSubtle} strokeWidth={2.2} />
          <RNTextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("notes.searchPlaceholder", "Search notes, questions, symptoms…")}
            placeholderTextColor={colors.textSubtle}
            style={{
              flex: 1,
              paddingHorizontal: spacing.sm,
              fontSize: 15,
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

      {notes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.md }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
        >
          <FilterChip
            label={t("notes.filters.all", "All")}
            count={notes.length}
            active={selectedFilter === "all"}
            onPress={() => setSelectedFilter("all")}
          />
          <FilterChip
            icon={Pin}
            label={t("notes.filters.pinned", "Pinned")}
            count={pinnedCount}
            active={selectedFilter === "pinned"}
            onPress={() => setSelectedFilter("pinned")}
          />
          <FilterChip
            icon={MessageCircleQuestion}
            label={t("notes.filters.questions", "Questions")}
            count={questionsCount}
            active={selectedFilter === "questions"}
            onPress={() => setSelectedFilter("questions")}
          />
          <FilterChip
            icon={Activity}
            label={t("notes.filters.symptoms", "Symptoms")}
            count={symptomsCount}
            active={selectedFilter === "symptoms"}
            onPress={() => setSelectedFilter("symptoms")}
          />
        </ScrollView>
      )}

      {/* Notes List Content */}
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={130} radius={radius.card} />
          <Skeleton height={130} radius={radius.card} />
          <Skeleton height={130} radius={radius.card} />
        </View>
      ) : isError ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
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
            icon={isFiltering ? Search : StickyNote}
            title={isFiltering ? t("notes.emptySearch.title", "No matching notes") : t("notes.empty.title")}
            message={
              isFiltering
                ? t("notes.emptySearch.message", "Try searching with a different keyword.")
                : t("notes.empty.message")
            }
            actionLabel={isFiltering ? t("notes.emptySearch.clear", "Clear search") : t("notes.empty.action")}
            onAction={
              isFiltering
                ? () => {
                    setSearchQuery("");
                    setSelectedFilter("all");
                  }
                : () => startNew()
            }
          />
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
          {pinnedNotes.length > 0 && otherNotes.length > 0 && (
            <GroupLabel icon={Pin} label={t("notes.filters.pinned", "Pinned")} />
          )}
          {pinnedNotes.map(renderNote)}
          {pinnedNotes.length > 0 && otherNotes.length > 0 && (
            <GroupLabel icon={Clock} label={t("notes.list.recent", "Recent")} style={{ marginTop: spacing.sm }} />
          )}
          {otherNotes.map(renderNote)}
        </View>
      )}
    </Screen>
  );
}

function formatRelative(iso: string, locale: any, t?: (k: string, o?: any) => string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days === 0) return `${t ? t("notes.relative.today", "today") : "today"} · ${time}`;
  if (days === 1) return `${t ? t("notes.relative.yesterday", "yesterday") : "yesterday"} · ${time}`;
  return formatNoteDate(iso, locale);
}

function NoteCard({
  note: n,
  locale,
  untitled,
  onOpen,
  onTogglePin,
  onDelete,
}: {
  note: any;
  locale: any;
  untitled: string;
  onOpen: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography, scheme, shadow } = useTheme();
  const isDark = scheme === "dark";
  const tags = [
    isQuestionNote(n) && { label: t("notes.tags.question", "Question"), tone: "primary" as const, icon: MessageCircleQuestion },
    isSymptomNote(n) && { label: t("notes.tags.symptom", "Symptom"), tone: "danger" as const, icon: Activity },
  ].filter(Boolean) as { label: string; tone: any; icon: any }[];

  return (
    <Pressable
      onPress={onOpen}
      pressedScale={0.985}
      wrapperStyle={isDark ? null : shadow.sm}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? colors.borderStrong : colors.hairline,
        overflow: "hidden",
      }}
    >
      {n.pinned ? (
        <View
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.warning }}
        />
      ) : null}
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconTile icon={n.pinned ? Pin : StickyNote} tone={n.pinned ? "warning" : "primary"} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.title.md, { color: colors.text }]} numberOfLines={1}>
              {n.title || untitled}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <Clock size={12} color={colors.textSubtle} strokeWidth={2.2} />
              <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                {formatRelative(n.updatedAt || n.createdAt, locale, t).replace(/^./, (c) => c.toUpperCase())}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <CardAction
              icon={Pin}
              active={!!n.pinned}
              color={n.pinned ? colors.warning : colors.textMuted}
              bg={n.pinned ? colors.warningSoft : colors.well}
              onPress={onTogglePin}
              label={n.pinned ? t("notes.list.unpinLabel") : t("notes.list.pinLabel")}
            />
            <CardAction
              icon={Trash2}
              color={colors.danger}
              bg={colors.dangerSoft}
              onPress={onDelete}
              label={t("notes.list.deleteLabel")}
            />
          </View>
        </View>

        <Text
          style={[typography.body.md, { color: colors.textMuted, marginTop: spacing.md, lineHeight: 22 }]}
          numberOfLines={4}
        >
          {n.body}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
          }}
        >
          <View style={{ flexDirection: "row", gap: 6, flex: 1, flexWrap: "wrap" }}>
            {tags.length > 0 ? (
              tags.map((tag) => <TagPill key={tag.label} {...tag} />)
            ) : (
              <TagPill label={t("notes.tags.journal", "Journal")} tone="neutral" icon={StickyNote} />
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pencil size={13} color={colors.primary} strokeWidth={2.4} />
            <Text style={[typography.label.md, { color: colors.primary }]}>{t("notes.list.editLabel")}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function CardAction({
  icon: Icon,
  color,
  bg,
  active,
  onPress,
  label,
}: {
  icon: any;
  color: string;
  bg: string;
  active?: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
      haptic="light"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      <Icon size={15} color={color} fill={active ? color : "none"} strokeWidth={2.2} />
    </Pressable>
  );
}

function TagPill({ label, tone, icon: Icon }: { label: string; tone: any; icon: any }) {
  const { typography } = useTheme();
  const p = useTone(tone);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 9,
        height: 24,
        borderRadius: 12,
        backgroundColor: p.bg,
      }}
    >
      <Icon size={11} color={p.fg} strokeWidth={2.4} />
      <Text style={[typography.label.xs, { color: p.fg, letterSpacing: 0 }]}>{label}</Text>
    </View>
  );
}

function GroupLabel({ icon: Icon, label, style }: { icon: any; label: string; style?: any }) {
  const { colors, typography } = useTheme();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 }, style]}>
      <Icon size={12} color={colors.textSubtle} strokeWidth={2.4} />
      <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase" }]}>{label}</Text>
    </View>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  icon?: any;
}) {
  const { colors, spacing, radius, typography, scheme } = useTheme();
  const fg = active ? colors.onPrimary : colors.text;

  return (
    <Pressable
      onPress={onPress}
      hapticOnPress
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        height: 36,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
        borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
      }}
    >
      {Icon ? <Icon size={13} color={active ? colors.onPrimary : colors.textMuted} strokeWidth={2.4} /> : null}
      <Text style={[typography.label.md, { color: fg }]}>{label}</Text>
      <View
        style={{
          minWidth: 20,
          alignItems: "center",
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 999,
          backgroundColor: active ? "rgba(255, 255, 255, 0.25)" : colors.fill,
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
