import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  ShieldAlert,
  CircleCheck,
  CircleX,
  ChevronRight,
  FileSearch,
  Banknote,
  UserRound,
  Building2,
  CalendarDays,
} from "lucide-react-native";
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
import { useAdminClaims, useDecideClaim } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  AdminSegmented,
  IconTile,
  RowDivider,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";
import { fmtDate, fmtDateTime, fmtLKR } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const PRIMARY = [
  { label: "Submitted", value: "submitted", tone: "warning" as const },
  { label: "In review", value: "under_review", tone: "info" as const },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];
const SECONDARY = [
  { label: "Paid", value: "paid" },
  { label: "All claims", value: "all" },
];

const OPEN = new Set(["submitted", "under_review"]);
const REJECT_REASONS = ["Not covered by policy", "Missing documents", "Duplicate claim", "Amount exceeds limit"];

function shortId(id?: string | null) {
  return id ? `${id.slice(0, 8)}…` : "—";
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const min = Math.floor((Date.now() - t) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : "";
}

export default function AdminClaimsScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale) as any;
  const toast = useToast();
  const [status, setStatus] = useState("submitted");
  const [selected, setSelected] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useAdminClaims(status);
  const decide = useDecideClaim();
  const items = data?.items ?? [];

  // Tab counts + value awaiting a decision (active tab shares the query cache).
  const submitted = useAdminClaims("submitted").data;
  const inReview = useAdminClaims("under_review").data;
  const approved = useAdminClaims("approved").data;
  const rejected = useAdminClaims("rejected").data;
  const count = (d?: { items: any[]; total: number }) => (d ? d.total ?? d.items.length : undefined);
  const counts: Record<string, number | undefined> = {
    submitted: count(submitted),
    under_review: count(inReview),
    approved: count(approved),
    rejected: count(rejected),
  };
  const openCount =
    counts.submitted !== undefined && counts.under_review !== undefined
      ? counts.submitted + counts.under_review
      : undefined;
  const openValue = [...(submitted?.items ?? []), ...(inReview?.items ?? [])].reduce(
    (s, c) => s + (Number(c.amount) || 0),
    0
  );

  const openSheet = (c: any) => {
    setSelected(c);
    setReason("");
  };

  const onDecide = (decision: "approve" | "reject") => {
    if (!selected) return;
    if (decision === "reject" && reason.trim().length < 3) return;
    setPendingDecision(decision);
    decide.mutate(
      {
        id: selected.id,
        decision,
        // A preset rejection reason shouldn't be recorded as an approval note.
        reason:
          decision === "approve" && REJECT_REASONS.includes(reason)
            ? undefined
            : reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.show(decision === "approve" ? "Claim approved" : "Claim rejected", "success");
          setSelected(null);
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
        onSettled: () => setPendingDecision(null),
      }
    );
  };

  const isSecondary = SECONDARY.some((o) => o.value === status);

  return (
    <Screen scroll padded={false} refreshing={isRefetching} onRefresh={refetch} edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Operations"
          title="Insurance claims"
          subtitle={
            openCount === undefined
              ? "Review and decide claims"
              : openCount === 0
              ? "No claims waiting for a decision"
              : `${openCount} claim${openCount === 1 ? "" : "s"} waiting for a decision`
          }
          stats={
            openCount
              ? [
                  { icon: ShieldAlert, value: String(openCount), label: "To decide" },
                  { icon: Banknote, value: fmtLKR(openValue, locale), label: "Value" },
                ]
              : undefined
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
            <Chip
              key={o.value}
              label={o.label}
              size="sm"
              selected={status === o.value}
              onPress={() => setStatus(o.value)}
            />
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md, paddingBottom: spacing.xxl }}>
        {isError ? (
          <AdminError
            title="Couldn't load claims"
            message="Check your connection, then retry or pull to refresh."
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          isError ? null : <EmptyClaims status={status} onShowAll={status !== "all" ? () => setStatus("all") : undefined} />
        ) : (
          <AdminCard style={{ padding: 0 }}>
            {items.map((c: any, i: number) => (
              <React.Fragment key={c.id}>
                {i > 0 ? <RowDivider inset={spacing.lg + 42 + spacing.md} /> : null}
                <ClaimRow c={c} locale={locale} onPress={() => openSheet(c)} />
              </React.Fragment>
            ))}
          </AdminCard>
        )}
      </View>

      <BottomSheet visible={!!selected} onDismiss={() => setSelected(null)} title="Claim details">
        {selected ? (
          <ClaimSheet
            c={selected}
            locale={locale}
            reason={reason}
            setReason={setReason}
            busy={decide.isPending}
            pendingDecision={pendingDecision}
            onDecide={onDecide}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function EmptyClaims({ status, onShowAll }: { status: string; onShowAll?: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const open = OPEN.has(status);
  const copy = open
    ? { title: "You're all caught up", body: "New claims from patients will appear here for a decision." }
    : status === "all"
    ? { title: "No claims yet", body: "Insurance claims submitted by patients will appear here." }
    : { title: `No ${status.replace(/_/g, " ")} claims`, body: "Try another status." };
  const Icon = open ? CircleCheck : FileSearch;
  return (
    <AdminCard style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: open ? colors.successSoft : colors.well,
        }}
      >
        <Icon size={28} color={open ? colors.success : colors.textMuted} strokeWidth={2.2} />
      </View>
      <Text style={[typography.title.lg, { color: colors.text, marginTop: spacing.lg }]}>{copy.title}</Text>
      <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 280 }]}>
        {copy.body}
      </Text>
      {onShowAll ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button title="View all claims" size="sm" variant="secondary" onPress={onShowAll} />
        </View>
      ) : null}
    </AdminCard>
  );
}

function ClaimRow({ c, locale, onPress }: { c: any; locale: any; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const status = c.status ?? "submitted";
  const open = OPEN.has(status);
  const when = timeAgo(c.createdAt) || (c.createdAt ? fmtDate(c.createdAt, locale) : "");
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`Claim ${fmtLKR(Number(c.amount ?? 0), locale)}, ${status}`}
      style={({ pressed }: { pressed: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <IconTile icon={ShieldAlert} tone={open ? "warning" : "info"} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title.md, { color: colors.text, fontVariant: ["tabular-nums"] }]} numberOfLines={1}>
          {fmtLKR(Number(c.amount ?? 0), locale)}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          Patient {shortId(c.patientId)}
          {when ? ` · ${when}` : ""}
        </Text>
        {c.notes ? (
          <Text style={[typography.caption, { color: colors.textSubtle, marginTop: 2 }]} numberOfLines={1}>
            “{c.notes}”
          </Text>
        ) : null}
      </View>
      {open ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            height: 30,
            paddingLeft: 12,
            paddingRight: 8,
            borderRadius: 15,
            backgroundColor: colors.warningSoft,
          }}
        >
          <Text style={[typography.label.sm, { color: colors.warning }]}>Review</Text>
          <ChevronRight size={14} color={colors.warning} strokeWidth={2.6} />
        </View>
      ) : (
        <>
          <StatusPill status={status} />
          <ChevronRight size={16} color={colors.textSubtle} />
        </>
      )}
    </Pressable>
  );
}

function ClaimSheet({
  c,
  locale,
  reason,
  setReason,
  busy,
  pendingDecision,
  onDecide,
}: {
  c: any;
  locale: any;
  reason: string;
  setReason: (v: string) => void;
  busy: boolean;
  pendingDecision: "approve" | "reject" | null;
  onDecide: (d: "approve" | "reject") => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const status = c.status ?? "submitted";
  const open = OPEN.has(status);
  const canReject = reason.trim().length >= 3;

  const rows: { icon: any; label: string; value: string }[] = [
    { icon: UserRound, label: "Patient", value: c.patientId ?? "—" },
    { icon: Building2, label: "Insurance", value: c.insuranceId ?? "—" },
    ...(c.createdAt ? [{ icon: CalendarDays, label: "Submitted", value: fmtDateTime(c.createdAt, locale) }] : []),
  ];

  return (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      {/* Amount */}
      <View style={{ alignItems: "center", gap: 6 }}>
        <Text style={[typography.overline, { color: colors.textSubtle }]}>CLAIM AMOUNT</Text>
        <Text style={[typography.display.md, { color: colors.text, fontVariant: ["tabular-nums"] }]}>
          {fmtLKR(Number(c.amount ?? 0), locale)}
        </Text>
        <StatusPill status={status} />
      </View>

      <View style={{ borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md }}>
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
              borderTopColor: colors.separator,
            }}
          >
            <r.icon size={16} color={colors.textSubtle} strokeWidth={2.2} />
            <Text style={[typography.body.sm, { color: colors.textMuted, width: 86 }]}>{r.label}</Text>
            <Text
              style={[typography.label.md, { color: colors.text, flex: 1, textAlign: "right" }]}
              numberOfLines={1}
              ellipsizeMode="middle"
              selectable
            >
              {r.value}
            </Text>
          </View>
        ))}
      </View>

      {c.notes ? (
        <View style={{ gap: 4 }}>
          <Text style={[typography.overline, { color: colors.textSubtle }]}>PATIENT NOTE</Text>
          <Text style={[typography.body.sm, { color: colors.text }]}>{c.notes}</Text>
        </View>
      ) : null}

      {open ? (
        <>
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.overline, { color: colors.textSubtle }]}>DECISION NOTE</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {REJECT_REASONS.map((r) => (
                <Chip key={r} label={r} size="sm" selected={reason === r} onPress={() => setReason(r)} />
              ))}
            </View>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Optional to approve · required to reject"
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: "top" }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Reject"
                variant="danger"
                icon={CircleX}
                onPress={() => onDecide("reject")}
                loading={busy && pendingDecision === "reject"}
                disabled={busy || !canReject}
              />
            </View>
            <View style={{ flex: 1.4 }}>
              <Button
                title="Approve"
                icon={CircleCheck}
                onPress={() => onDecide("approve")}
                loading={busy && pendingDecision === "approve"}
                disabled={busy}
              />
            </View>
          </View>
          {!canReject ? (
            <Text style={[typography.caption, { color: colors.textSubtle, textAlign: "center", marginTop: -spacing.sm }]}>
              Add a note to enable Reject
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
