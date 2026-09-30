import React, { useState } from "react";
import { View, Text } from "react-native";
import {
  Banknote,
  CircleCheck,
  CircleX,
  Wallet,
  Stethoscope,
  CalendarRange,
  Activity,
  Receipt,
  ArrowLeft,
} from "lucide-react-native";
import {
  Screen,
  Button,
  BottomSheet,
  TextInput,
  Pressable,
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
  AdminSegmented,
  AdminEmpty,
  ReviewPill,
  DetailRows,
  IconTile,
  RowDivider,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";
import { fmtDate, fmtLKR } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const FILTERS = [
  { label: "Pending", value: "pending", tone: "warning" as const },
  { label: "Paid", value: "paid" },
  { label: "Failed", value: "failed", tone: "danger" as const },
  { label: "All", value: "all" },
];

function period(p: any, locale: any) {
  const f = (d?: string) => {
    if (!d) return "—";
    const t = new Date(d);
    return isNaN(t.getTime()) ? d : fmtDate(t, locale);
  };
  return `${f(p.periodStart)} – ${f(p.periodEnd)}`;
}

function shortId(id?: string | null) {
  return id ? `${id.slice(0, 8)}…` : "—";
}

export default function AdminPayoutsScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale) as any;
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<"paid" | "failed" | null>(null);
  const [text, setText] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } = useAdminPayouts(status);
  const markPaid = useMarkPayoutPaid();
  const markFailed = useMarkPayoutFailed();
  const busy = markPaid.isPending || markFailed.isPending;
  const items = data?.items ?? [];

  // Counts per tab + amount still owed (queries shared with the active tab via cache).
  const pending = useAdminPayouts("pending").data;
  const paid = useAdminPayouts("paid").data;
  const failed = useAdminPayouts("failed").data;
  const all = useAdminPayouts("all").data;
  const n = (d?: { items?: any[] }) => d?.items?.length;
  const counts: Record<string, number | undefined> = {
    pending: n(pending),
    paid: n(paid),
    failed: n(failed),
    all: n(all),
  };
  const owed = (pending?.items ?? []).reduce((s: number, p: any) => s + (Number(p.amountLkr) || 0), 0);
  const pendingCount = counts.pending;

  const openSheet = (p: any) => {
    setSelected(p);
    setMode(null);
    setText("");
  };
  const closeSheet = () => {
    setSelected(null);
    setMode(null);
  };

  const onConfirm = () => {
    if (!selected || !mode) return;
    const done = (msg: string) => ({
      onSuccess: () => {
        toast.show(msg, "success");
        closeSheet();
      },
      onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
    });
    if (mode === "paid") {
      if (!text.trim()) return;
      markPaid.mutate({ id: selected.id, reference: text.trim() }, done("Payout marked as paid"));
    } else {
      if (text.trim().length < 3) return;
      markFailed.mutate({ id: selected.id, reason: text.trim() }, done("Payout marked as failed"));
    }
  };

  return (
    <Screen scroll padded={false} refreshing={isRefetching} onRefresh={refetch} edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Operations"
          title="Payouts"
          subtitle={
            pendingCount === undefined
              ? "Doctor payout ledger"
              : pendingCount === 0
              ? "Every doctor has been paid"
              : `${pendingCount} payout${pendingCount === 1 ? "" : "s"} waiting to be sent`
          }
          stats={
            pendingCount
              ? [
                  { icon: Wallet, value: String(pendingCount), label: "To pay" },
                  { icon: Banknote, value: fmtLKR(owed, locale), label: "Owed" },
                ]
              : undefined
          }
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <AdminSegmented
          options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
          value={status}
          onChange={setStatus}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.lg, paddingBottom: spacing.xxl }}>
        {isError ? (
          <AdminError
            title="Couldn't load payouts"
            message="Check your connection, then retry or pull to refresh."
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          isError ? null : status === "pending" ? (
            <AdminEmpty
              icon={CircleCheck}
              positive
              title="Nothing to pay"
              message="Doctor earnings ready for payout will appear here."
              actionLabel="View payout history"
              onAction={() => setStatus("all")}
            />
          ) : (
            <AdminEmpty
              icon={Receipt}
              title={status === "all" ? "No payouts yet" : `No ${status} payouts`}
              message={
                status === "failed"
                  ? "Payouts that couldn't be sent will appear here."
                  : "Payout records will appear here."
              }
            />
          )
        ) : (
          <AdminCard style={{ padding: 0 }}>
            {items.map((p: any, i: number) => {
              const isPending = (p.status ?? "pending") === "pending";
              return (
                <React.Fragment key={p.id}>
                  {i > 0 ? <RowDivider inset={spacing.lg + 42 + spacing.md} /> : null}
                  <Pressable
                    onPress={() => openSheet(p)}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={`Payout ${fmtLKR(Number(p.amountLkr ?? 0), locale)}, ${p.status}`}
                    style={({ pressed }: { pressed: boolean }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: pressed ? colors.fill : "transparent",
                    })}
                  >
                    <IconTile icon={Banknote} tone={isPending ? "warning" : p.status === "failed" ? "danger" : "success"} size={42} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[typography.title.md, { color: colors.text, fontVariant: ["tabular-nums"] }]} numberOfLines={1}>
                        {fmtLKR(Number(p.amountLkr ?? 0), locale)}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
                        {period(p, locale)}
                        {typeof p.eventCount === "number" ? ` · ${p.eventCount} consult${p.eventCount === 1 ? "" : "s"}` : ""}
                      </Text>
                    </View>
                    {isPending ? <ReviewPill label="Pay" /> : <StatusPill status={p.status} />}
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
        title={mode === "paid" ? "Confirm payment" : mode === "failed" ? "Mark as failed" : "Payout details"}
      >
        {selected ? (
          <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={[typography.overline, { color: colors.textSubtle }]}>PAYOUT AMOUNT</Text>
              <Text style={[typography.display.md, { color: colors.text, fontVariant: ["tabular-nums"] }]}>
                {fmtLKR(Number(selected.amountLkr ?? 0), locale)}
              </Text>
              <StatusPill status={selected.status ?? "pending"} />
            </View>

            {mode === null ? (
              <>
                <DetailRows
                  rows={[
                    { icon: Stethoscope, label: "Doctor", value: selected.doctorId ?? "—" },
                    { icon: CalendarRange, label: "Period", value: period(selected, locale) },
                    ...(typeof selected.eventCount === "number"
                      ? [{ icon: Activity, label: "Consults", value: String(selected.eventCount) }]
                      : []),
                    ...(selected.reference ? [{ icon: Receipt, label: "Reference", value: selected.reference }] : []),
                  ]}
                />
                {(selected.status ?? "pending") === "pending" ? (
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button title="Failed" variant="secondary" icon={CircleX} onPress={() => { setText(""); setMode("failed"); }} />
                    </View>
                    <View style={{ flex: 1.4 }}>
                      <Button title="Mark as paid" icon={CircleCheck} onPress={() => { setText(""); setMode("paid"); }} />
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  {mode === "paid"
                    ? `Enter the bank transfer reference for the payment to doctor ${shortId(selected.doctorId)}.`
                    : "Say why the transfer didn't go through. It's recorded on the payout."}
                </Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={mode === "paid" ? "Bank transfer reference" : "Failure reason (min 3 characters)"}
                  autoCapitalize={mode === "paid" ? "characters" : "sentences"}
                  multiline={mode === "failed"}
                  numberOfLines={mode === "failed" ? 3 : 1}
                  style={mode === "failed" ? { minHeight: 80, textAlignVertical: "top" } : undefined}
                />
                <Button
                  title={mode === "paid" ? "Confirm payment" : "Mark as failed"}
                  variant={mode === "paid" ? "primary" : "danger"}
                  onPress={onConfirm}
                  loading={busy}
                  disabled={text.trim().length < (mode === "paid" ? 1 : 3)}
                />
                <Button title="Back" variant="ghost" icon={ArrowLeft} onPress={() => setMode(null)} />
              </>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
