import React, { useState } from "react";
import { View, Text } from "react-native";
import { MessagesSquare, ChevronRight, ClipboardList } from "lucide-react-native";
import {
  Screen,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  EmptyState,
  ChipGroup,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminDemoRequests,
  useRespondDemoRequest,
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
  { label: "New", value: "new", tone: "warning" as const },
  { label: "Contacted", value: "contacted" },
  { label: "Closed", value: "closed", tone: "success" as const },
  { label: "All", value: "all" },
];

const STATUS_OPTS = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Closed", value: "closed" },
];

export default function AdminDemoRequestsScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const [status, setStatus] = useState("new");
  const [selected, setSelected] = useState<any | null>(null);
  const [nextStatus, setNextStatus] = useState("contacted");
  const [reply, setReply] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminDemoRequests(status);
  const respond = useRespondDemoRequest();
  const items = data?.items ?? [];

  const open = (r: any) => {
    setSelected(r);
    setNextStatus(r.status === "new" ? "contacted" : r.status ?? "contacted");
    setReply("");
  };

  const onSave = () => {
    if (!selected) return;
    respond.mutate(
      {
        id: selected.id,
        status: nextStatus as any,
        reply: reply.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.show("Demo request updated", "success");
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
          eyebrow="Growth"
          title="Demo requests"
          subtitle="Sales pipeline from the marketing site"
          icon={ClipboardList}
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
          <AdminError message="Couldn't load demo requests." />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No demo requests"
            message="Requests from the website will appear here."
          />
        ) : (
          items.map((r: any) => (
            <AdminCard key={r.id} onPress={() => open(r)}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Avatar name={r.clinicName ?? r.contactName ?? "?"} size="md" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[typography.title.sm, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {r.clinicName ?? r.contactName}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {r.contactName}
                    {r.contactRole ? ` · ${r.contactRole}` : ""} · {r.phone}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      marginTop: 5,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <StatusPill status={r.status ?? "new"} />
                    <Text
                      style={[typography.caption, { color: colors.textSubtle }]}
                    >
                      {r.createdAt
                        ? fmtDateTime(r.createdAt, locale as any)
                        : ""}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textSubtle} />
              </View>
            </AdminCard>
          ))
        )}
      </View>

      <BottomSheet
        visible={!!selected}
        onDismiss={() => setSelected(null)}
        title={selected?.clinicName ?? "Demo request"}
        height={560}
      >
        {selected ? (
          <View>
            <InfoPanel
              icon={MessagesSquare}
              title="Request details"
              tone="info"
              style={{ marginBottom: spacing.md }}
            >
              <KV label="Contact" value={selected.contactName} />
              <KV label="Role" value={selected.contactRole} />
              <KV label="Phone" value={selected.phone} />
              <KV label="Email" value={selected.email} />
              <KV label="SLMC" value={selected.slmcRegistrationNo} />
              <KV label="Specialty" value={selected.specialty} />
              <KV label="Clinic size" value={selected.clinicSize} />
              {selected.message ? (
                <View style={{ paddingTop: spacing.xs }}>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                  >
                    {selected.message}
                  </Text>
                </View>
              ) : null}
            </InfoPanel>

            <Text
              style={[
                typography.caption,
                {
                  color: colors.textMuted,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: spacing.xs,
                },
              ]}
            >
              Set status
            </Text>
            <ChipGroup
              options={STATUS_OPTS}
              value={nextStatus}
              onChange={(v: string) => setNextStatus(v)}
            />
            <View style={{ marginTop: spacing.md }}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Internal note (optional)"
                multiline
                numberOfLines={3}
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </View>
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                title="Save"
                onPress={onSave}
                loading={respond.isPending}
              />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setSelected(null)}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
