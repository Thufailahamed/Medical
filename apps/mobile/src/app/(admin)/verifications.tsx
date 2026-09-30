import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  CircleCheck,
  CircleX,
  ShieldOff,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  FileText,
  FileSearch,
  Mail,
  CalendarDays,
} from "lucide-react-native";
import {
  Screen,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  Chip,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminVerifications,
  useVerificationAction,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  AdminSegmented,
  RowDivider,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const FILTERS = [
  { label: "Pending", value: "pending", tone: "warning" as const },
  { label: "Approved", value: "approved", tone: "success" as const },
  { label: "Rejected", value: "rejected", tone: "danger" as const },
];

export default function AdminVerificationsScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<"reject" | "revoke" | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminVerifications(status);
  const act = useVerificationAction();
  const items = data?.verifications ?? [];

  const onApprove = () => {
    if (!selected) return;
    act.mutate(
      { kind: "approve", id: selected.id, reason: "Verified by admin" },
      {
        onSuccess: () => {
          toast.show("Caretaker verified", "success");
          setSelected(null);
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  const onConfirmReason = () => {
    if (!selected || !mode || reason.trim().length < 3) return;
    act.mutate(
      {
        kind: mode,
        id: mode === "revoke" ? selected.caretakerUserId : selected.id,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.show(
            mode === "reject" ? "Verification rejected" : "Verification revoked",
            "success"
          );
          setMode(null);
          setSelected(null);
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  // Counts per tab (the active tab's query is shared via the React Query cache).
  const { data: pendingData } = useAdminVerifications("pending");
  const { data: approvedData } = useAdminVerifications("approved");
  const { data: rejectedData } = useAdminVerifications("rejected");
  const counts: Record<string, number | undefined> = {
    pending: pendingData?.verifications?.length,
    approved: approvedData?.verifications?.length,
    rejected: rejectedData?.verifications?.length,
  };
  const pendingCount = counts.pending;

  const subtitle =
    pendingCount === undefined
      ? "Identity document review"
      : pendingCount === 0
      ? "No documents waiting for review"
      : `${pendingCount} document${pendingCount === 1 ? "" : "s"} waiting for review`;

  const openReason = (m: "reject" | "revoke") => {
    setReason("");
    setMode(m);
  };

  return (
    <Screen
      scroll
      padded={false}
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Operations"
          title="Caretaker verifications"
          subtitle={subtitle}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <AdminSegmented
          options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
          value={status}
          onChange={setStatus}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          marginTop: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
      >
        {isError ? (
          <AdminError
            title="Couldn't load verifications"
            message="Check your connection, then retry or pull to refresh."
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          isError ? null : (
            <EmptyVerifications
              status={status}
              onShowApproved={status === "pending" ? () => setStatus("approved") : undefined}
            />
          )
        ) : (
          <AdminCard style={{ padding: 0 }}>
            {items.map((v: any, i: number) => (
              <React.Fragment key={v.id}>
                {i > 0 ? <RowDivider inset={spacing.lg + 44 + spacing.md} /> : null}
                <VerificationRow v={v} locale={locale} onPress={() => setSelected(v)} />
              </React.Fragment>
            ))}
          </AdminCard>
        )}
      </View>

      <BottomSheet
        visible={!!selected && !mode}
        onDismiss={() => setSelected(null)}
        title="Verification details"
      >
        {selected ? (
          <VerificationSheet
            v={selected}
            locale={locale}
            busy={act.isPending}
            onApprove={onApprove}
            onReject={() => openReason("reject")}
            onRevoke={() => openReason("revoke")}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={!!mode}
        onDismiss={() => setMode(null)}
        title={mode === "reject" ? "Reject verification" : "Revoke verification"}
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {mode === "reject"
              ? `${selected?.caretakerName ?? "The caretaker"} will be notified with this reason and can resubmit.`
              : `${selected?.caretakerName ?? "The caretaker"} will lose the verified badge. The reason is recorded in the audit log.`}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {(mode === "reject" ? REJECT_REASONS : REVOKE_REASONS).map((r) => (
              <Chip
                key={r}
                label={r}
                size="sm"
                selected={reason === r}
                onPress={() => setReason(r)}
              />
            ))}
          </View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Or write a reason (min 3 characters)"
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />
          <Button
            title={mode === "reject" ? "Reject verification" : "Revoke verification"}
            variant="danger"
            onPress={onConfirmReason}
            loading={act.isPending}
            disabled={reason.trim().length < 3}
          />
          <Button title="Back" variant="ghost" onPress={() => setMode(null)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const REJECT_REASONS = ["Document unreadable", "Name doesn't match", "Document expired", "Wrong document type"];
const REVOKE_REASONS = ["Document found invalid", "Policy violation", "Requested by caretaker"];

function docLabel(t?: string | null) {
  if (!t) return "Document";
  const s = t.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  if (d < 30) return `${d}d ago`;
  return "";
}

function EmptyVerifications({
  status,
  onShowApproved,
}: {
  status: string;
  onShowApproved?: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const pending = status === "pending";
  const copy = pending
    ? { title: "You're all caught up", body: "New identity documents from caretakers will appear here for review." }
    : status === "approved"
    ? { title: "No approved verifications", body: "Caretakers you approve will be listed here." }
    : { title: "No rejected verifications", body: "Submissions you reject will be kept here." };
  const Icon = pending ? CircleCheck : FileSearch;
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
          backgroundColor: pending ? colors.successSoft : colors.well,
        }}
      >
        <Icon size={28} color={pending ? colors.success : colors.textMuted} strokeWidth={2.2} />
      </View>
      <Text style={[typography.title.lg, { color: colors.text, marginTop: spacing.lg }]}>{copy.title}</Text>
      <Text
        style={[typography.body.sm, { color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 280 }]}
      >
        {copy.body}
      </Text>
      {onShowApproved ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button title="View approved" size="sm" variant="secondary" onPress={onShowApproved} />
        </View>
      ) : null}
    </AdminCard>
  );
}

function VerificationRow({ v, locale, onPress }: { v: any; locale: string; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const status = v.status ?? "pending";
  const pending = status === "pending";
  const ago = timeAgo(v.submittedAt);
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${v.caretakerName ?? "Caretaker"}, ${docLabel(v.documentType)}, ${status}`}
      style={({ pressed }: { pressed: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <Avatar name={v.caretakerName ?? "?"} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
          {v.caretakerName ?? "Caretaker"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 7,
              height: 20,
              borderRadius: 6,
              backgroundColor: colors.well,
            }}
          >
            <FileText size={11} color={colors.textMuted} strokeWidth={2.4} />
            <Text style={[typography.label.xs, { color: colors.text }]} numberOfLines={1}>
              {docLabel(v.documentType)}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
            {ago || (v.submittedAt ? fmtDate(v.submittedAt, locale as any) : "")}
          </Text>
        </View>
      </View>
      {pending ? (
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

function VerificationSheet({
  v,
  locale,
  busy,
  onApprove,
  onReject,
  onRevoke,
}: {
  v: any;
  locale: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRevoke: () => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const status = v.status ?? "pending";
  const banner =
    status === "approved"
      ? { Icon: ShieldCheck, fg: colors.success, bg: colors.successSoft, title: "Verified", body: "This caretaker has a verified identity." }
      : status === "rejected"
      ? { Icon: CircleX, fg: colors.danger, bg: colors.dangerSoft, title: "Rejected", body: "The caretaker can submit a new document." }
      : { Icon: ShieldAlert, fg: colors.warning, bg: colors.warningSoft, title: "Awaiting review", body: "Check the document matches the caretaker's name and is still valid." };

  const rows: { icon: any; label: string; value: string }[] = [
    { icon: FileText, label: "Document", value: docLabel(v.documentType) },
    ...(v.caretakerEmail ? [{ icon: Mail, label: "Email", value: v.caretakerEmail }] : []),
    ...(v.submittedAt ? [{ icon: CalendarDays, label: "Submitted", value: fmtDateTime(v.submittedAt, locale as any) }] : []),
  ];

  return (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Avatar name={v.caretakerName ?? "?"} size="lg" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title.lg, { color: colors.text }]} numberOfLines={1}>
            {v.caretakerName ?? "Caretaker"}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}>Caretaker</Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          backgroundColor: banner.bg,
        }}
      >
        <banner.Icon size={20} color={banner.fg} strokeWidth={2.2} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.label.md, { color: banner.fg }]}>{banner.title}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>{banner.body}</Text>
        </View>
      </View>

      <View
        style={{
          borderRadius: radius.lg,
          borderCurve: "continuous",
          backgroundColor: colors.surfaceMuted,
          paddingHorizontal: spacing.md,
        }}
      >
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

      {v.decisionNote ? (
        <View style={{ gap: 4 }}>
          <Text style={[typography.overline, { color: colors.textSubtle }]}>DECISION NOTE</Text>
          <Text style={[typography.body.sm, { color: colors.text }]}>{v.decisionNote}</Text>
        </View>
      ) : null}

      {status === "pending" ? (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Reject" variant="secondary" icon={CircleX} onPress={onReject} disabled={busy} />
          </View>
          <View style={{ flex: 1.4 }}>
            <Button title="Approve" icon={CircleCheck} onPress={onApprove} loading={busy} />
          </View>
        </View>
      ) : status === "approved" && v.caretakerVerified ? (
        <Button title="Revoke verification" variant="danger" icon={ShieldOff} onPress={onRevoke} />
      ) : null}
    </View>
  );
}
