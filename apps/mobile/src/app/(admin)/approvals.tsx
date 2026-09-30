import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  UserCheck,
  Check,
  X,
  Stethoscope,
  FlaskConical,
  Clock,
  CheckCircle2,
  Inbox,
} from "lucide-react-native";
import {
  Screen,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminApprovals,
  useApproveUser,
  useRejectUser,
  type AdminApprovalItem,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminSegmented,
  FilterChips,
  ListSkeleton,
  AdminError,
  AdminCard,
  InfoPanel,
  RolePill,
  StatusPill,
  KV,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Rejected", value: "rejected" },
  { label: "Suspended", value: "suspended" },
];

const ROLE_OPTIONS = [
  { label: "All roles", value: "" },
  { label: "Doctor", value: "doctor" },
  { label: "Patient", value: "patient" },
  { label: "Caretaker", value: "caretaker" },
  { label: "Hospital admin", value: "hospital_admin" },
  { label: "Laboratory", value: "laboratory" },
  { label: "Pharmacy", value: "pharmacy" },
];

export default function ApprovalsScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [role, setRole] = useState("");
  const [rejectTarget, setRejectTarget] = useState<AdminApprovalItem | null>(
    null
  );
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminApprovals(status, role || undefined);
  const approve = useApproveUser();
  const reject = useRejectUser();

  const busy = approve.isPending || reject.isPending;

  const onApprove = (item: AdminApprovalItem) => {
    approve.mutate(
      { userId: item.user.id },
      {
        onSuccess: () =>
          toast.show(`${item.user.name ?? "User"} approved`, "success"),
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  const onReject = () => {
    if (!rejectTarget || reason.trim().length < 3) return;
    reject.mutate(
      { userId: rejectTarget.user.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.show("Application rejected", "success");
          setRejectTarget(null);
          setReason("");
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
  const roleLabel = ROLE_OPTIONS.find((o) => o.value === role)?.label;
  const noun = total === 1 ? "application" : "applications";

  const heroSubtitle = isLoading
    ? "Loading applications…"
    : isError && !data
    ? "Couldn't load the queue"
    : total === 0
    ? `No ${status} ${role ? `${roleLabel?.toLowerCase()} ` : ""}applications`
    : `${total} ${status} ${role ? `${roleLabel?.toLowerCase()} ` : ""}${noun}`;

  return (
    <Screen
      scroll
      padded={false}
      tabBarOffset
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          eyebrow="Review queue"
          title="Approvals"
          subtitle={heroSubtitle}
          icon={UserCheck}
        />
      </View>

      {/* Status: one segmented control instead of a second chip row */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <AdminSegmented options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </View>

      {/* Role filter */}
      <View style={{ marginTop: spacing.md }}>
        <Text
          style={[
            typography.overline,
            { color: colors.textSubtle, paddingHorizontal: spacing.lg + 4, marginBottom: 4 },
          ]}
        >
          ROLE
        </Text>
        <FilterChips options={ROLE_OPTIONS} value={role} onChange={setRole} size="sm" />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          marginTop: spacing.lg,
          paddingBottom: spacing.xl,
        }}
      >
        {isError ? (
          <AdminError
            title="Couldn't load applications"
            message="Check your connection, then retry or pull to refresh."
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : items.length === 0 ? (
          isError ? null : (
            <EmptyQueue
              status={status}
              statusLabel={statusLabel}
              roleLabel={role ? roleLabel : undefined}
              onClearRole={role ? () => setRole("") : undefined}
              onShowActive={status !== "active" ? () => setStatus("active") : undefined}
            />
          )
        ) : (
          items.map((item) => (
            <ApprovalCard
              key={item.user.id}
              item={item}
              busy={busy}
              locale={locale}
              onApprove={() => onApprove(item)}
              onReject={() => setRejectTarget(item)}
            />
          ))
        )}
      </View>

      {/* Reject reason sheet */}
      <BottomSheet
        visible={!!rejectTarget}
        onDismiss={() => setRejectTarget(null)}
        title="Reject application"
      >
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted, marginBottom: spacing.md },
          ]}
        >
          Tell {rejectTarget?.user.name ?? "the applicant"} why their
          application was rejected. This is sent as a notification.
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason (required)"
          multiline
          numberOfLines={3}
          style={{ minHeight: 88, textAlignVertical: "top" }}
        />
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button
            title="Reject application"
            variant="danger"
            onPress={onReject}
            loading={reject.isPending}
            disabled={reason.trim().length < 3}
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => setRejectTarget(null)}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const EMPTY_COPY: Record<string, { title: string; body: string }> = {
  pending: {
    title: "You're all caught up",
    body: "New sign-ups that need approval will appear here.",
  },
  active: { title: "No active accounts", body: "Approved accounts will be listed here." },
  rejected: { title: "No rejected applications", body: "Applications you reject will be kept here." },
  suspended: { title: "No suspended accounts", body: "Suspended accounts will be listed here." },
};

function EmptyQueue({
  status,
  statusLabel,
  roleLabel,
  onClearRole,
  onShowActive,
}: {
  status: string;
  statusLabel: string;
  roleLabel?: string;
  onClearRole?: () => void;
  onShowActive?: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const copy = EMPTY_COPY[status] ?? { title: "Nothing here", body: "" };
  const isPending = status === "pending";
  const Icon = isPending ? CheckCircle2 : Inbox;
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
          backgroundColor: isPending ? colors.successSoft : colors.well,
        }}
      >
        <Icon size={28} color={isPending ? colors.success : colors.textMuted} strokeWidth={2.2} />
      </View>
      <Text style={[typography.title.lg, { color: colors.text, marginTop: spacing.lg, textAlign: "center" }]}>
        {copy.title}
      </Text>
      <Text
        style={[
          typography.body.sm,
          { color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 280 },
        ]}
      >
        {roleLabel
          ? `No ${statusLabel.toLowerCase()} ${roleLabel.toLowerCase()} applications. Try another role.`
          : copy.body}
      </Text>
      {onClearRole || onShowActive ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          {onClearRole ? (
            <Button title="Show all roles" size="sm" variant="secondary" onPress={onClearRole} />
          ) : onShowActive ? (
            <Button title="View active accounts" size="sm" variant="secondary" onPress={onShowActive} />
          ) : null}
        </View>
      ) : null}
    </AdminCard>
  );
}

function ApprovalCard({
  item,
  busy,
  locale,
  onApprove,
  onReject,
}: {
  item: AdminApprovalItem;
  busy: boolean;
  locale: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const u = item.user;
  const pending = u.status === "pending";

  return (
    <AdminCard>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <Avatar name={u.name ?? "?"} size="lg" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[typography.title.md, { color: colors.text }]}
            numberOfLines={1}
          >
            {u.name ?? "Unnamed"}
          </Text>
          <Text
            style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}
            numberOfLines={1}
          >
            {u.email ?? u.phone ?? "—"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
            }}
          >
            <RolePill role={u.role} />
            <StatusPill status={u.status} />
          </View>
        </View>
      </View>

      {/* Role-specific details */}
      {item.doctorProfile ? (
        <InfoPanel
          icon={Stethoscope}
          title="Doctor profile"
          tone="primary"
          style={{ marginTop: spacing.md }}
        >
          <KV label="Specialization" value={item.doctorProfile.specialization} />
          <KV label="SLMC no." value={item.doctorProfile.slmcRegistrationNo} />
        </InfoPanel>
      ) : null}

      {item.labProfile ? (
        <InfoPanel
          icon={FlaskConical}
          title="Lab profile"
          tone="accent2"
          style={{ marginTop: spacing.md }}
        >
          <KV
            label="License"
            value={
              item.labProfile.licenseNumber ??
              item.labProfile.license_number ??
              null
            }
          />
          <KV label="City" value={item.labProfile.city} />
        </InfoPanel>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <Clock size={13} color={colors.textSubtle} />
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          Applied {u.createdAt ? fmtDateTime(u.createdAt, locale as any) : "—"}
        </Text>
      </View>

      {pending ? (
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              title="Approve"
              size="sm"
              icon={Check}
              onPress={onApprove}
              disabled={busy}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Reject"
              size="sm"
              icon={X}
              variant="danger"
              onPress={onReject}
              disabled={busy}
            />
          </View>
        </View>
      ) : null}
    </AdminCard>
  );
}
