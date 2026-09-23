import React, { useState } from "react";
import { View, Text } from "react-native";
import {
  UserCheck,
  CircleCheck,
  CircleX,
  ShieldOff,
  ChevronRight,
  BadgeCheck,
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
  useAdminVerifications,
  useVerificationAction,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  InfoPanel,
  FilterChips,
  ListSkeleton,
  AdminError,
  StatusPill,
  KV,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
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
          subtitle="Identity documents review queue"
          icon={BadgeCheck}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          marginTop: spacing.sm,
          paddingBottom: spacing.xxl,
        }}
      >
        {isError ? (
          <AdminError message="Couldn't load verifications." />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Queue is clear"
            message="No verification requests in this state."
          />
        ) : (
          items.map((v: any) => (
            <AdminCard key={v.id} onPress={() => setSelected(v)}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Avatar name={v.caretakerName ?? "?"} size="md" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[typography.title.sm, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {v.caretakerName ?? "Caretaker"}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {v.documentType?.replace(/_/g, " ") ?? "document"} ·{" "}
                    {v.submittedAt
                      ? fmtDateTime(v.submittedAt, locale as any)
                      : ""}
                  </Text>
                  <View style={{ marginTop: 5 }}>
                    <StatusPill status={v.status ?? "pending"} />
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textSubtle} />
              </View>
            </AdminCard>
          ))
        )}
      </View>

      <BottomSheet
        visible={!!selected && !mode}
        onDismiss={() => setSelected(null)}
        title={selected?.caretakerName ?? "Verification"}
      >
        {selected ? (
          <View>
            <InfoPanel
              icon={BadgeCheck}
              title="Submission"
              tone="primary"
              style={{ marginBottom: spacing.md }}
            >
              <KV label="Caretaker" value={selected.caretakerName} />
              <KV label="Email" value={selected.caretakerEmail} />
              <KV
                label="Document"
                value={selected.documentType?.replace(/_/g, " ")}
              />
              <KV label="Status" value={selected.status} />
              <KV
                label="Submitted"
                value={
                  selected.submittedAt
                    ? fmtDateTime(selected.submittedAt, locale as any)
                    : null
                }
              />
              {selected.decisionNote ? (
                <KV label="Decision note" value={selected.decisionNote} />
              ) : null}
            </InfoPanel>
            <View style={{ gap: spacing.sm }}>
              {selected.status === "pending" ? (
                <>
                  <Button
                    title="Approve verification"
                    icon={CircleCheck}
                    onPress={onApprove}
                    loading={act.isPending}
                  />
                  <Button
                    title="Reject"
                    variant="danger"
                    icon={CircleX}
                    onPress={() => {
                      setReason("");
                      setMode("reject");
                    }}
                  />
                </>
              ) : null}
              {selected.status === "approved" && selected.caretakerVerified ? (
                <Button
                  title="Revoke verification"
                  variant="danger"
                  icon={ShieldOff}
                  onPress={() => {
                    setReason("");
                    setMode("revoke");
                  }}
                />
              ) : null}
              <Button
                title="Close"
                variant="ghost"
                onPress={() => setSelected(null)}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={!!mode}
        onDismiss={() => setMode(null)}
        title={mode === "reject" ? "Reject verification" : "Revoke verification"}
      >
        <View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (required, min 3 chars)"
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <Button
              title={mode === "reject" ? "Reject" : "Revoke"}
              variant="danger"
              onPress={onConfirmReason}
              loading={act.isPending}
              disabled={reason.trim().length < 3}
            />
            <Button title="Back" variant="ghost" onPress={() => setMode(null)} />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
