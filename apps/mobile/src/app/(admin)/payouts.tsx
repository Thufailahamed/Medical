import React, { useState } from "react";
import { View, Text } from "react-native";
import { Banknote, CircleCheck, CircleX, Wallet } from "lucide-react-native";
import {
  Screen,
  Button,
  BottomSheet,
  TextInput,
  EmptyState,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminPayouts,
  useMarkPayoutPaid,
  useMarkPayoutFailed,
} from "@/hooks/useAdminApi";
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

const FILTERS = [
  { label: "Pending", value: "pending", tone: "warning" as const },
  { label: "Paid", value: "paid", tone: "success" as const },
  { label: "Failed", value: "failed", tone: "danger" as const },
  { label: "All", value: "all" },
];

export default function AdminPayoutsScreen() {
  const { colors, spacing, typography } = useTheme();
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<"paid" | "failed" | null>(null);
  const [text, setText] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminPayouts(status);
  const markPaid = useMarkPayoutPaid();
  const markFailed = useMarkPayoutFailed();
  const busy = markPaid.isPending || markFailed.isPending;

  const items = data?.items ?? [];
  const totalLkr = items.reduce(
    (s: number, p: any) => s + (Number(p.amountLkr) || 0),
    0
  );

  const open = (p: any, m: "paid" | "failed") => {
    setSelected(p);
    setMode(m);
    setText("");
  };

  const onConfirm = () => {
    if (!selected || !mode) return;
    if (mode === "paid") {
      if (!text.trim()) return;
      markPaid.mutate(
        { id: selected.id, reference: text.trim() },
        {
          onSuccess: () => {
            toast.show("Payout marked as paid", "success");
            setMode(null);
          },
          onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
        }
      );
    } else {
      if (text.trim().length < 3) return;
      markFailed.mutate(
        { id: selected.id, reason: text.trim() },
        {
          onSuccess: () => {
            toast.show("Payout marked as failed", "success");
            setMode(null);
          },
          onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
        }
      );
    }
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
          title="Payouts"
          subtitle="Doctor payout ledger"
          icon={Wallet}
          stats={[
            { value: String(items.length), label: "Records" },
            {
              value: `LKR ${totalLkr.toLocaleString()}`,
              label: "Shown total",
            },
          ]}
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
        {isError ? <AdminError message="Couldn't load payouts." /> : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payouts"
            message="Payout records will appear here."
          />
        ) : (
          items.map((p: any) => (
            <AdminCard key={p.id}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <IconTile icon={Banknote} tone="success" size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    LKR {Number(p.amountLkr ?? 0).toLocaleString()}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {p.periodStart} → {p.periodEnd} · {p.eventCount} events
                  </Text>
                  <View style={{ marginTop: 5 }}>
                    <StatusPill status={p.status ?? "pending"} />
                  </View>
                </View>
              </View>
              {p.status === "pending" ? (
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.sm,
                    marginTop: spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Mark paid"
                      size="sm"
                      icon={CircleCheck}
                      onPress={() => open(p, "paid")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Failed"
                      size="sm"
                      variant="danger"
                      icon={CircleX}
                      onPress={() => open(p, "failed")}
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
        title={mode === "paid" ? "Mark payout as paid" : "Mark payout as failed"}
      >
        {selected ? (
          <View>
            <InfoPanel
              icon={Wallet}
              title="Payout"
              tone="success"
              style={{ marginBottom: spacing.md }}
            >
              <KV
                label="Amount"
                value={`LKR ${Number(selected.amountLkr ?? 0).toLocaleString()}`}
              />
              <KV
                label="Period"
                value={`${selected.periodStart} → ${selected.periodEnd}`}
              />
              <KV label="Doctor" value={selected.doctorId} mono />
            </InfoPanel>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                mode === "paid"
                  ? "Bank transfer reference"
                  : "Failure reason (min 3 chars)"
              }
              multiline={mode === "failed"}
              numberOfLines={mode === "failed" ? 3 : 1}
            />
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                title={mode === "paid" ? "Confirm payment" : "Confirm failure"}
                variant={mode === "paid" ? "primary" : "danger"}
                onPress={onConfirm}
                loading={busy}
                disabled={text.trim().length < (mode === "paid" ? 1 : 3)}
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
