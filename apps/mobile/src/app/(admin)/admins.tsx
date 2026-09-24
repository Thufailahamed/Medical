import React, { useState } from "react";
import { View, Text } from "react-native";
import {
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Ban,
  CheckCircle2,
} from "lucide-react-native";
import {
  Screen,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  EmptyState,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminAdmins, useAdminAction } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  AdminSection,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";
import { useAuthStore } from "@/stores/auth";

type SheetMode =
  | { kind: "promote" }
  | { kind: "demote" | "suspend"; admin: any }
  | null;

export default function AdminAdminsScreen() {
  const { colors, spacing, typography } = useTheme();
  const toast = useToast();
  const me = useAuthStore((s) => s.user);

  const { data, isLoading, isError, refetch, isRefetching } = useAdminAdmins();
  const action = useAdminAction();

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");

  const items = data?.items ?? [];

  const submit = () => {
    if (!sheet) return;
    const userId =
      sheet.kind === "promote" ? targetUserId.trim() : sheet.admin.id;
    if (!userId || reason.trim().length < 3) return;
    action.mutate(
      { action: sheet.kind, userId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.show(
            sheet.kind === "promote"
              ? "Admin promoted"
              : sheet.kind === "demote"
                ? "Admin demoted"
                : "Admin suspended",
            "success"
          );
          setSheet(null);
          setReason("");
          setTargetUserId("");
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  const onUnsuspend = (a: any) => {
    action.mutate(
      { action: "unsuspend", userId: a.id },
      {
        onSuccess: () => toast.show("Admin reactivated", "success"),
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
          eyebrow="Directory"
          title="Administrators"
          subtitle={`${items.length} super admin account${items.length === 1 ? "" : "s"}`}
          icon={ShieldCheck}
          right={
            <Pressable
              onPress={() => {
                setReason("");
                setTargetUserId("");
                setSheet({ kind: "promote" });
              }}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Promote admin"
              hitSlop={8}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
              }}
            >
              <UserPlus size={19} color="#FFFFFF" strokeWidth={2.25} />
            </Pressable>
          }
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        <AdminSection title="Accounts" count={items.length} />
        <View style={{ gap: spacing.md }}>
          {isError ? <AdminError message="Couldn't load admins." /> : null}
          {isLoading ? (
            <ListSkeleton rows={4} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No admins"
              message="Super admin accounts will appear here."
            />
          ) : (
            items.map((a: any) => {
              const isSelf = a.id === me?.id;
              const suspended = a.status === "suspended";
              return (
                <AdminCard key={a.id}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <Avatar name={a.name ?? "?"} size="md" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[typography.title.sm, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {a.name ?? "Unnamed"}
                        {isSelf ? " (you)" : ""}
                      </Text>
                      <Text
                        style={[typography.caption, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {a.email ?? "—"} · {a.auditCountLast30d ?? 0}{" "}
                        actions/30d
                      </Text>
                      <View style={{ marginTop: 5 }}>
                        <StatusPill status={a.status ?? "active"} />
                      </View>
                    </View>
                  </View>
                  {!isSelf ? (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: spacing.sm,
                        marginTop: spacing.md,
                      }}
                    >
                      {suspended ? (
                        <View style={{ flex: 1 }}>
                          <Button
                            title="Reactivate"
                            size="sm"
                            icon={CheckCircle2}
                            onPress={() => onUnsuspend(a)}
                            loading={action.isPending}
                          />
                        </View>
                      ) : (
                        <View style={{ flex: 1 }}>
                          <Button
                            title="Suspend"
                            size="sm"
                            variant="danger"
                            icon={Ban}
                            onPress={() => {
                              setReason("");
                              setSheet({ kind: "suspend", admin: a });
                            }}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Demote"
                          size="sm"
                          variant="outline"
                          icon={ShieldOff}
                          onPress={() => {
                            setReason("");
                            setSheet({ kind: "demote", admin: a });
                          }}
                        />
                      </View>
                    </View>
                  ) : null}
                </AdminCard>
              );
            })
          )}
        </View>
      </View>

      <BottomSheet
        visible={!!sheet}
        onDismiss={() => setSheet(null)}
        title={
          sheet?.kind === "promote"
            ? "Promote user to admin"
            : sheet?.kind === "demote"
              ? `Demote ${sheet.admin?.name ?? "admin"}`
              : `Suspend ${(sheet as any)?.admin?.name ?? "admin"}`
        }
      >
        {sheet ? (
          <View style={{ gap: spacing.md }}>
            {sheet.kind === "promote" ? (
              <TextInput
                value={targetUserId}
                onChangeText={setTargetUserId}
                placeholder="User ID to promote"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (required, min 3 chars)"
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <Button
              title={
                sheet.kind === "promote"
                  ? "Promote to super admin"
                  : sheet.kind === "demote"
                    ? "Demote to patient"
                    : "Suspend admin"
              }
              variant={sheet.kind === "promote" ? "primary" : "danger"}
              icon={sheet.kind === "promote" ? ShieldCheck : ShieldOff}
              onPress={submit}
              loading={action.isPending}
              disabled={
                reason.trim().length < 3 ||
                (sheet.kind === "promote" && !targetUserId.trim())
              }
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setSheet(null)}
            />
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
