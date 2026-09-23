import React, { useState } from "react";
import { View, Text } from "react-native";
import { ShieldAlert, CircleCheck, CircleX } from "lucide-react-native";
import {
  Screen,
  Button,
  BottomSheet,
  TextInput,
  EmptyState,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminClaims, useDecideClaim } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  InfoPanel,
  IconTile,
  FilterChips,
  ListSkeleton,
  AdminError,
  StatusPill,
  KV,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const FILTERS = [
  { label: "Submitted", value: "submitted", tone: "warning" as const },
  { label: "Under review", value: "under_review" },
  { label: "Approved", value: "approved", tone: "success" as const },
  { label: "Rejected", value: "rejected", tone: "danger" as const },
  { label: "Paid", value: "paid", tone: "success" as const },
  { label: "All", value: "all" },
];

export default function AdminClaimsScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const [status, setStatus] = useState("submitted");
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminClaims(status);
  const decide = useDecideClaim();
  const items = data?.items ?? [];

  const open = (c: any, m: "approve" | "reject") => {
    setSelected(c);
    setMode(m);
    setReason("");
  };

  const onConfirm = () => {
    if (!selected || !mode) return;
    if (mode === "reject" && reason.trim().length < 3) return;
    decide.mutate(
      { id: selected.id, decision: mode, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.show(
            mode === "approve" ? "Claim approved" : "Claim rejected",
            "success"
          );
          setMode(null);
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
          title="Insurance claims"
          subtitle="Review and decide claims"
          icon={ShieldAlert}
          stats={[{ value: String(data?.total ?? items.length), label: status.replace(/_/g, " ") }]}
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
        {isError ? <AdminError message="Couldn't load claims." /> : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No claims"
            message="Insurance claims will appear here."
          />
        ) : (
          items.map((c: any) => (
            <AdminCard key={c.id}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <IconTile icon={ShieldAlert} tone="info" size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    LKR {Number(c.amount ?? 0).toLocaleString()}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    Patient {c.patientId?.slice(0, 8)}… ·{" "}
                    {c.createdAt ? fmtDateTime(c.createdAt, locale as any) : ""}
                  </Text>
                  <View style={{ marginTop: 5 }}>
                    <StatusPill status={c.status ?? "submitted"} />
                  </View>
                </View>
              </View>
              {c.notes ? (
                <Text
                  style={[
                    typography.caption,
                    {
                      color: colors.textSubtle,
                      marginTop: spacing.sm,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {c.notes}
                </Text>
              ) : null}
              {c.status === "submitted" || c.status === "under_review" ? (
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
                      icon={CircleCheck}
                      onPress={() => open(c, "approve")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Reject"
                      size="sm"
                      variant="danger"
                      icon={CircleX}
                      onPress={() => open(c, "reject")}
                    />
                  </View>
                </View>
              ) : null}
            </AdminCard>
          ))
        )}
      </View>

      <BottomSheet
        visible={!!mode}
        onDismiss={() => setMode(null)}
        title={mode === "approve" ? "Approve claim" : "Reject claim"}
      >
        {selected ? (
          <View>
            <InfoPanel
              icon={ShieldAlert}
              title="Claim"
              tone="info"
              style={{ marginBottom: spacing.md }}
            >
              <KV
                label="Amount"
                value={`LKR ${Number(selected.amount ?? 0).toLocaleString()}`}
              />
              <KV label="Patient" value={selected.patientId} mono />
              <KV label="Insurance" value={selected.insuranceId} mono />
            </InfoPanel>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={
                mode === "reject"
                  ? "Rejection reason (required)"
                  : "Note (optional)"
              }
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                title={mode === "approve" ? "Approve claim" : "Reject claim"}
                variant={mode === "approve" ? "primary" : "danger"}
                onPress={onConfirm}
                loading={decide.isPending}
                disabled={mode === "reject" && reason.trim().length < 3}
              />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setMode(null)}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
