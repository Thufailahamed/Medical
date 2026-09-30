import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import {
  CircleCheck,
  CircleX,
  RotateCcw,
  FileLock2,
  Download,
  Trash2,
  PencilLine,
  UserRound,
  CalendarDays,
  Link2,
  Clock,
  ArrowLeft,
  Inbox,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  Screen,
  Button,
  BottomSheet,
  TextInput,
  Chip,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import type { Tone } from "@/theme/tone";
import { useAdminDsar, useDsarAction } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  AdminSegmented,
  AdminEmpty,
  ReviewPill,
  DetailRows,
  IconTile,
  RowDivider,
  ListSkeleton,
  AdminError,
  StatusPill,
  relTime,
} from "@/components/admin/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const PRIMARY = [
  { label: "Queued", value: "queued", tone: "warning" as const },
  { label: "Approved", value: "approved", tone: "info" as const },
  { label: "Processing", value: "processing", tone: "info" as const },
  { label: "Done", value: "completed" },
];
const SECONDARY = [
  { label: "Failed", value: "failed" },
  { label: "All requests", value: "all" },
];

// Response window shown to admins. Not enforced server-side — adjust to the
// applicable data-protection rule if it differs.
const RESPONSE_DAYS = 30;

const PURPOSE: Record<string, { label: string; icon: LucideIcon; tone: Tone; what: string }> = {
  export: { label: "Data export", icon: Download, tone: "primary", what: "Send the user a copy of their data." },
  erasure: { label: "Erasure", icon: Trash2, tone: "danger", what: "Permanently delete the user's personal data." },
  rectification: { label: "Correction", icon: PencilLine, tone: "warning", what: "Correct inaccurate data on the user's record." },
};
const purposeOf = (p?: string) =>
  PURPOSE[p ?? ""] ?? { label: p ?? "Request", icon: FileLock2, tone: "neutral" as Tone, what: "" };

const OPEN = new Set(["queued", "approved", "processing"]);

function daysLeft(requestedAt?: string | null): number | null {
  if (!requestedAt) return null;
  const t = new Date(requestedAt).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t + RESPONSE_DAYS * 86_400_000 - Date.now()) / 86_400_000);
}

function DueTag({ requestedAt }: { requestedAt?: string | null }) {
  const { colors, typography } = useTheme();
  const d = daysLeft(requestedAt);
  if (d === null) return null;
  const overdue = d < 0;
  const soon = d <= 7;
  const color = overdue ? colors.danger : soon ? colors.warning : colors.textSubtle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Clock size={11} color={color} strokeWidth={2.4} />
      <Text style={[typography.label.xs, { color }]}>
        {overdue ? `${-d}d overdue` : d === 0 ? "Due today" : `Due in ${d}d`}
      </Text>
    </View>
  );
}

export default function AdminDsarScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale) as any;
  const toast = useToast();
  const [status, setStatus] = useState("queued");
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<"complete" | "reject" | null>(null);
  const [text, setText] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } = useAdminDsar(status);
  const action = useDsarAction();
  const items = data?.items ?? [];

  const queued = useAdminDsar("queued").data;
  const approved = useAdminDsar("approved").data;
  const processing = useAdminDsar("processing").data;
  const completed = useAdminDsar("completed").data;
  const n = (d?: { items: any[]; total: number }) => (d ? d.total ?? d.items.length : undefined);
  const counts: Record<string, number | undefined> = {
    queued: n(queued),
    approved: n(approved),
    processing: n(processing),
    completed: n(completed),
  };
  const openItems = [...(queued?.items ?? []), ...(approved?.items ?? []), ...(processing?.items ?? [])];
  const openCount =
    queued && approved && processing ? (counts.queued ?? 0) + (counts.approved ?? 0) + (counts.processing ?? 0) : undefined;
  const overdue = openItems.filter((r) => (daysLeft(r.requestedAt) ?? 1) < 0).length;

  const closeSheet = () => {
    setSelected(null);
    setMode(null);
    setText("");
  };

  const run = (
    id: string,
    act: "approve" | "complete" | "reject" | "requeue",
    body: { reason?: string; resultUrl?: string } = {}
  ) => {
    action.mutate(
      { id, action: act, ...body },
      {
        onSuccess: () => {
          toast.show(
            act === "approve" ? "Request approved" : act === "complete" ? "Request completed" : act === "reject" ? "Request rejected" : "Request requeued",
            "success"
          );
          closeSheet();
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  const onApprove = (r: any) => {
    if (r.purpose === "erasure") {
      Alert.alert(
        "Approve erasure request?",
        "This approves permanent deletion of the user's personal data. Make sure there's no legal reason to retain it.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Approve", style: "destructive", onPress: () => run(r.id, "approve") },
        ]
      );
      return;
    }
    run(r.id, "approve");
  };

  const isSecondary = SECONDARY.some((o) => o.value === status);
  const urlValid = /^https?:\/\/\S+\.\S+/.test(text.trim());

  return (
    <Screen scroll padded={false} refreshing={isRefetching} onRefresh={refetch} edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Operations · DSAR"
          title="Privacy requests"
          subtitle={
            openCount === undefined
              ? "Data subject access requests"
              : openCount === 0
              ? "No open privacy requests"
              : `${openCount} open request${openCount === 1 ? "" : "s"}${overdue ? ` · ${overdue} overdue` : ""}`
          }
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm }}>
        <AdminSegmented
          options={PRIMARY.map((o) => ({ ...o, count: counts[o.value] }))}
          value={isSecondary ? "" : status}
          onChange={setStatus}
        />
        <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
          {SECONDARY.map((o) => (
            <Chip key={o.value} label={o.label} size="sm" selected={status === o.value} onPress={() => setStatus(o.value)} />
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md, paddingBottom: spacing.xxl }}>
        {isError ? (
          <AdminError
            title="Couldn't load privacy requests"
            message="Check your connection, then retry or pull to refresh."
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          isError ? null : OPEN.has(status) ? (
            <AdminEmpty
              icon={CircleCheck}
              positive
              title="You're all caught up"
              message={
                status === "queued"
                  ? "New export, erasure and correction requests from users will appear here."
                  : `No requests are ${status} right now.`
              }
              actionLabel="View all requests"
              onAction={() => setStatus("all")}
            />
          ) : (
            <AdminEmpty
              icon={Inbox}
              title={status === "all" ? "No privacy requests yet" : status === "completed" ? "Nothing completed yet" : "No failed requests"}
              message="Requests users make from their privacy settings appear here."
            />
          )
        ) : (
          <AdminCard style={{ padding: 0 }}>
            {items.map((r: any, i: number) => {
              const p = purposeOf(r.purpose);
              const st = r.status ?? "queued";
              const open = OPEN.has(st);
              const when = relTime(r.requestedAt) || (r.requestedAt ? fmtDate(r.requestedAt, locale) : "");
              return (
                <React.Fragment key={r.id}>
                  {i > 0 ? <RowDivider inset={spacing.lg + 42 + spacing.md} /> : null}
                  <Pressable
                    onPress={() => setSelected(r)}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={`${p.label} request, ${st}`}
                    style={({ pressed }: { pressed: boolean }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: pressed ? colors.fill : "transparent",
                    })}
                  >
                    <IconTile icon={p.icon} tone={p.tone} size={42} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
                        User {r.userId ? `${r.userId.slice(0, 8)}…` : "—"}
                        {when ? ` · ${when}` : ""}
                      </Text>
                      {open ? (
                        <View style={{ marginTop: 4 }}>
                          <DueTag requestedAt={r.requestedAt} />
                        </View>
                      ) : null}
                    </View>
                    {st === "queued" ? <ReviewPill /> : <StatusPill status={st} />}
                  </Pressable>
                </React.Fragment>
              );
            })}
          </AdminCard>
        )}
      </View>

      <BottomSheet
        visible={!!selected}
        onDismiss={closeSheet}
        title={mode === "complete" ? "Complete request" : mode === "reject" ? "Reject request" : "Privacy request"}
      >
        {selected ? (() => {
          const p = purposeOf(selected.purpose);
          const st = selected.status ?? "queued";
          return (
            <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
              {/* Purpose header */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile icon={p.icon} tone={p.tone} size={52} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={[typography.title.lg, { color: colors.text }]}>{p.label}</Text>
                    <StatusPill status={st} />
                  </View>
                  {p.what ? (
                    <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>{p.what}</Text>
                  ) : null}
                </View>
              </View>

              {mode === null ? (
                <>
                  <DetailRows
                    rows={[
                      { icon: UserRound, label: "User", value: selected.userId ?? "—" },
                      ...(selected.requestedAt
                        ? [{ icon: CalendarDays, label: "Requested", value: fmtDateTime(selected.requestedAt, locale) }]
                        : []),
                      ...(OPEN.has(st) && daysLeft(selected.requestedAt) !== null
                        ? [
                            {
                              icon: Clock,
                              label: "Respond by",
                              value: fmtDate(
                                new Date(new Date(selected.requestedAt).getTime() + RESPONSE_DAYS * 86_400_000),
                                locale
                              ),
                              tone: (daysLeft(selected.requestedAt) ?? 1) < 0 ? ("danger" as const) : undefined,
                            },
                          ]
                        : []),
                      ...(selected.resultUrl ? [{ icon: Link2, label: "Result", value: selected.resultUrl }] : []),
                    ]}
                  />
                  {selected.notes ? (
                    <View style={{ gap: 4 }}>
                      <Text style={[typography.overline, { color: colors.textSubtle }]}>NOTES</Text>
                      <Text style={[typography.body.sm, { color: colors.text }]}>{selected.notes}</Text>
                    </View>
                  ) : null}

                  {/* Actions for the request's current stage */}
                  {st === "queued" ? (
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Button title="Reject" variant="secondary" icon={CircleX} onPress={() => { setText(""); setMode("reject"); }} />
                      </View>
                      <View style={{ flex: 1.4 }}>
                        <Button title="Approve" icon={CircleCheck} onPress={() => onApprove(selected)} loading={action.isPending} />
                      </View>
                    </View>
                  ) : st === "approved" || st === "processing" ? (
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Button title="Reject" variant="secondary" icon={CircleX} onPress={() => { setText(""); setMode("reject"); }} />
                      </View>
                      <View style={{ flex: 1.4 }}>
                        <Button title="Complete" icon={CircleCheck} onPress={() => { setText(""); setMode("complete"); }} />
                      </View>
                    </View>
                  ) : st === "failed" ? (
                    <Button title="Requeue request" variant="secondary" icon={RotateCcw} onPress={() => run(selected.id, "requeue")} loading={action.isPending} />
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                    {mode === "complete"
                      ? selected.purpose === "export"
                        ? "Paste the secure link where the user can download their data export."
                        : "Paste a link to the completion record for this request."
                      : "The user is told the request was rejected, with this reason."}
                  </Text>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={mode === "complete" ? "https://…" : "Rejection reason (min 3 characters)"}
                    autoCapitalize="none"
                    autoCorrect={mode !== "complete"}
                    keyboardType={mode === "complete" ? "url" : "default"}
                    multiline={mode === "reject"}
                    numberOfLines={mode === "reject" ? 3 : 1}
                    style={mode === "reject" ? { minHeight: 80, textAlignVertical: "top" } : undefined}
                  />
                  {mode === "complete" && text.trim().length > 0 && !urlValid ? (
                    <Text style={[typography.caption, { color: colors.danger, marginTop: -spacing.sm }]}>
                      Enter a full link starting with https://
                    </Text>
                  ) : null}
                  <Button
                    title={mode === "complete" ? "Mark as completed" : "Reject request"}
                    variant={mode === "complete" ? "primary" : "danger"}
                    loading={action.isPending}
                    disabled={mode === "complete" ? !urlValid : text.trim().length < 3}
                    onPress={() =>
                      run(selected.id, mode, mode === "complete" ? { resultUrl: text.trim() } : { reason: text.trim() })
                    }
                  />
                  <Button title="Back" variant="ghost" icon={ArrowLeft} onPress={() => setMode(null)} />
                </>
              )}
            </View>
          );
        })() : null}
      </BottomSheet>
    </Screen>
  );
}
