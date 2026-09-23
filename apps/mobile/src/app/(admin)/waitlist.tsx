import React, { useState } from "react";
import { View, Alert } from "react-native";
import { MailPlus, Trash2, ListChecks, CalendarClock } from "lucide-react-native";
import {
  Screen,
  ListItem,
  EmptyState,
  IconButton,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminWaitlist,
  useInviteWaitlist,
  useRemoveWaitlist,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  FilterChips,
  ListSkeleton,
  AdminError,
  StatusPill,
  roleLabel,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const FILTERS = [
  { label: "Pending", value: "pending", tone: "warning" as const },
  { label: "Invited", value: "invited", tone: "success" as const },
  { label: "All", value: "all" },
];

export default function AdminWaitlistScreen() {
  const { spacing } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const [status, setStatus] = useState<"all" | "pending" | "invited">("pending");

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminWaitlist(status);
  const invite = useInviteWaitlist();
  const remove = useRemoveWaitlist();
  const items = data?.items ?? [];

  const onInvite = (id: string) => {
    invite.mutate(id, {
      onSuccess: () => toast.show("Invite recorded", "success"),
      onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
    });
  };

  const onRemove = (id: string, email: string) => {
    Alert.alert("Remove entry", `Remove ${email} from the waitlist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => toast.show("Entry removed", "success"),
            onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
          }),
      },
    ]);
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
          title="Waitlist"
          subtitle={`${data?.total ?? 0} signups`}
          icon={CalendarClock}
          stats={[
            { value: String(data?.total ?? items.length), label: "Signups" },
            {
              value: String(items.filter((w: any) => !!w.invitedAt).length),
              label: "Invited",
            },
            {
              value: String(items.filter((w: any) => !w.invitedAt).length),
              label: "Pending",
            },
          ]}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <FilterChips
          options={FILTERS}
          value={status}
          onChange={(v) => setStatus(v as any)}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
          marginTop: spacing.sm,
          paddingBottom: spacing.xxl,
        }}
      >
        {isError ? <AdminError message="Couldn't load the waitlist." /> : null}
        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No entries"
            message="Waitlist signups will appear here."
          />
        ) : (
          items.map((w: any) => (
            <ListItem
              key={w.id}
              title={w.email}
              subtitle={`${roleLabel(w.role)} · ${
                w.createdAt ? fmtDateTime(w.createdAt, locale as any) : ""
              }`}
              rightSlot={
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {!w.invitedAt ? (
                    <IconButton
                      icon={MailPlus}
                      variant="soft"
                      size="sm"
                      onPress={() => onInvite(w.id)}
                      accessibilityLabel="Send invite"
                    />
                  ) : (
                    <StatusPill status="invited" />
                  )}
                  <IconButton
                    icon={Trash2}
                    variant="danger"
                    size="sm"
                    onPress={() => onRemove(w.id, w.email)}
                    accessibilityLabel="Remove entry"
                  />
                </View>
              }
            />
          ))
        )}
      </View>
    </Screen>
  );
}
