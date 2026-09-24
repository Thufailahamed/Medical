import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  UserCheck,
  Check,
  X,
  Stethoscope,
  FlaskConical,
  Clock,
} from "lucide-react-native";
import {
  Screen,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  EmptyState,
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
          subtitle={`${data?.total ?? 0} ${status} applications`}
          icon={UserCheck}
        />
      </View>

      <View style={{ marginTop: spacing.lg, gap: 2 }}>
        <FilterChips
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />
        <FilterChips
          options={ROLE_OPTIONS}
          value={role}
          onChange={setRole}
          size="sm"
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          marginTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
      >
        {isError ? <AdminError message="Couldn't load applications." /> : null}
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Nothing to review"
            message={`No ${status} applications right now.`}
          />
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
