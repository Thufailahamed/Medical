import React, { useState } from "react";
import { View, Text, FlatList } from "react-native";
import { ScrollText } from "lucide-react-native";
import { Screen, EmptyState, Pill, type PillTone } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminAudit, type AuditRow } from "@/hooks/useAdminApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AdminHero,
  AdminCard,
  SearchBar,
  ListSkeleton,
  AdminError,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

export default function AdminAuditScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const [actionQ, setActionQ] = useState("");
  const debouncedAction = useDebounce(actionQ, 350);

  const { data, isLoading, isError, refetch, isRefetching } = useAdminAudit({
    action: debouncedAction || undefined,
    limit: 150,
  });

  const items = data?.items ?? [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="System"
          title="Audit log"
          subtitle={`${data?.total ?? 0} events recorded`}
          icon={ScrollText}
        />
      </View>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginTop: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
        <SearchBar
          value={actionQ}
          onChangeText={setActionQ}
          placeholder="Filter by action (e.g. approve)"
        />
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListSkeleton rows={8} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 140,
            gap: spacing.sm,
          }}
          ListEmptyComponent={
            isError ? (
              <AdminError message="Couldn't load the audit log." />
            ) : (
              <EmptyState
                icon={ScrollText}
                title="No audit events"
                message="Admin activity will be recorded here."
              />
            )
          }
          renderItem={({ item }) => <AuditRowCard row={item} locale={locale} />}
        />
      )}
    </Screen>
  );
}

function actionTone(action: string): PillTone {
  if (/delete|remove|revoke|suspend|reject|fail|anonymis/i.test(action))
    return "danger";
  if (/approve|verify|invite|complete|paid|promote|unsuspend/i.test(action))
    return "success";
  if (/login|auth|step_up|impersonat/i.test(action)) return "info";
  return "neutral";
}

function AuditRowCard({ row, locale }: { row: AuditRow; locale: string }) {
  const { colors, spacing, typography } = useTheme();
  let details: string | null = null;
  if (row.details) {
    try {
      const parsed = JSON.parse(row.details);
      details = Object.entries(parsed)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`)
        .join("  ·  ");
    } catch {
      details = row.details;
    }
  }
  return (
    <AdminCard style={{ padding: spacing.md + 2 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            marginTop: 3,
            backgroundColor:
              actionTone(row.action) === "danger"
                ? colors.danger
                : actionTone(row.action) === "success"
                  ? colors.success
                  : actionTone(row.action) === "info"
                    ? colors.info
                    : colors.textSubtle,
          }}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <Pill
              label={row.action.replace(/_/g, " ")}
              tone={actionTone(row.action)}
              size="sm"
            />
            {row.resource ? (
              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                {row.resource}
                {row.resourceId ? ` ${row.resourceId.slice(0, 8)}…` : ""}
              </Text>
            ) : null}
          </View>
          {details ? (
            <Text
              style={[
                typography.caption,
                { color: colors.textMuted, marginTop: 4 },
              ]}
              numberOfLines={2}
            >
              {details}
            </Text>
          ) : null}
          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, marginTop: 4 },
            ]}
          >
            {fmtDateTime(row.createdAt, locale as any)}
            {row.ip ? ` · ${row.ip}` : ""}
          </Text>
        </View>
      </View>
    </AdminCard>
  );
}
