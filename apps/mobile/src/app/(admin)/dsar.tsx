import React, { useState } from "react";
import { View, Text } from "react-native";
import {
  ShieldQuestion,
  CircleCheck,
  CircleX,
  RotateCcw,
  ChevronRight,
  FileLock2,
} from "lucide-react-native";
import {
  Screen,
  Button,
  BottomSheet,
  TextInput,
  EmptyState,
  Pill,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminDsar, useDsarAction } from "@/hooks/useAdminApi";
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
  { label: "Queued", value: "queued", tone: "warning" as const },
  { label: "Approved", value: "approved" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed", tone: "success" as const },
  { label: "Failed", value: "failed", tone: "danger" as const },
  { label: "All", value: "all" },
];

const PURPOSE_TONE: Record<string, "primary" | "danger" | "warning"> = {
  export: "primary",
  erasure: "danger",
  rectification: "warning",
};

export default function AdminDsarScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const [status, setStatus] = useState("queued");
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<"complete" | "reject" | null>(null);
  const [text, setText] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminDsar(status);
  const action = useDsarAction();
  const items = data?.items ?? [];

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
            `Request ${
              act === "approve"
                ? "approved"
                : act === "complete"
                  ? "completed"
                  : act === "reject"
                    ? "rejected"
                    : "requeued"
            }`,
            "success"
          );
          setMode(null);
          setSelected(null);
          setText("");
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
          title="Privacy requests"
          subtitle="Data subject access requests (DSAR)"
          icon={FileLock2}
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
        {isError ? <AdminError message="Couldn't load DSAR requests." /> : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShieldQuestion}
            title="No requests"
            message="Privacy requests will appear here."
          />
        ) : (
          items.map((r: any) => (
            <AdminCard key={r.id} onPress={() => setSelected(r)}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <IconTile icon={FileLock2} tone="danger" size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Pill
                      label={r.purpose}
                      tone={PURPOSE_TONE[r.purpose] ?? "primary"}
                      size="sm"
                    />
                    <StatusPill status={r.status ?? "queued"} />
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginTop: 6 },
                    ]}
                  >
                    User {r.userId?.slice(0, 8)}… · requested{" "}
                    {r.requestedAt
                      ? fmtDateTime(r.requestedAt, locale as any)
                      : ""}
                  </Text>
                  {r.notes ? (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textSubtle, marginTop: 4 },
                      ]}
                      numberOfLines={2}
                    >
                      {r.notes}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={18} color={colors.textSubtle} />
              </View>
            </AdminCard>
          ))
        )}
      </View>

      {/* Detail / actions sheet */}
      <BottomSheet
        visible={!!selected && !mode}
        onDismiss={() => setSelected(null)}
        title="DSAR request"
      >
        {selected ? (
          <View>
            <InfoPanel
              icon={FileLock2}
              title="Request"
              tone="danger"
              style={{ marginBottom: spacing.md }}
            >
              <KV label="Purpose" value={selected.purpose} />
              <KV label="Status" value={selected.status} />
              <KV label="User" value={selected.userId} mono />
              <KV
                label="Requested"
                value={
                  selected.requestedAt
                    ? fmtDateTime(selected.requestedAt, locale as any)
                    : null
                }
              />
              {selected.resultUrl ? (
                <KV label="Result URL" value={selected.resultUrl} />
              ) : null}
            </InfoPanel>
            <View style={{ gap: spacing.sm }}>
              {selected.status === "queued" ? (
                <Button
                  title="Approve request"
                  icon={CircleCheck}
                  onPress={() => run(selected.id, "approve")}
                  loading={action.isPending}
                />
              ) : null}
              {selected.status === "approved" ||
              selected.status === "processing" ? (
                <Button
                  title="Complete (set result URL)"
                  icon={CircleCheck}
                  onPress={() => {
                    setText("");
                    setMode("complete");
                  }}
                />
              ) : null}
              {selected.status !== "completed" &&
              selected.status !== "failed" ? (
                <Button
                  title="Reject request"
                  variant="danger"
                  icon={CircleX}
                  onPress={() => {
                    setText("");
                    setMode("reject");
                  }}
                />
              ) : null}
              {selected.status === "failed" ? (
                <Button
                  title="Requeue"
                  variant="secondary"
                  icon={RotateCcw}
                  onPress={() => run(selected.id, "requeue")}
                  loading={action.isPending}
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

      {/* Complete / reject input sheet */}
      <BottomSheet
        visible={!!mode}
        onDismiss={() => setMode(null)}
        title={mode === "complete" ? "Complete request" : "Reject request"}
      >
        {selected && mode ? (
          <View>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                mode === "complete"
                  ? "Result URL (https://…)"
                  : "Rejection reason (min 3 chars)"
              }
              autoCapitalize="none"
              multiline={mode === "reject"}
              numberOfLines={mode === "reject" ? 3 : 1}
            />
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                title={mode === "complete" ? "Complete" : "Reject"}
                variant={mode === "complete" ? "primary" : "danger"}
                loading={action.isPending}
                disabled={text.trim().length < (mode === "complete" ? 8 : 3)}
                onPress={() =>
                  run(
                    selected.id,
                    mode,
                    mode === "complete"
                      ? { resultUrl: text.trim() }
                      : { reason: text.trim() }
                  )
                }
              />
              <Button
                title="Back"
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
