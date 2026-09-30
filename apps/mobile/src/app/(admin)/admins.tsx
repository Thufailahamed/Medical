import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Ban,
  CheckCircle2,
  Activity,
  Clock,
  Info,
  AlertTriangle,
  Fingerprint,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  Screen,
  Avatar,
  BottomSheet,
  TextInput,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useAdminAdmins, useAdminAction } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  AdminSection,
  AdminEmpty,
  ListSkeleton,
  AdminError,
  StatusPill,
  SheetField,
  SheetForm,
  relTime,
} from "@/components/admin/ui";
import { fmtDate } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";
import { useAuthStore } from "@/stores/auth";

type SheetMode =
  | { kind: "promote" }
  | { kind: "demote" | "suspend"; admin: any }
  | null;

const SHEET_COPY = {
  promote: {
    title: "Promote to super admin",
    warning:
      "Super admins get full platform access, including user data, payouts and other admins.",
    submit: "Promote",
    icon: ShieldCheck,
    variant: "primary" as const,
  },
  demote: {
    title: "Demote admin",
    warning:
      "They lose all admin access immediately and become a regular patient account.",
    submit: "Demote to patient",
    icon: ShieldOff,
    variant: "danger" as const,
  },
  suspend: {
    title: "Suspend admin",
    warning:
      "They are signed out and can't sign in until reactivated. Their role is kept.",
    submit: "Suspend",
    icon: Ban,
    variant: "danger" as const,
  },
};

export default function AdminAdminsScreen() {
  const { spacing } = useTheme();
  const toast = useToast();
  const me = useAuthStore((s) => s.user);

  const { data, isLoading, isError, refetch, isRefetching } = useAdminAdmins();
  const action = useAdminAction();

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");

  const items = data?.items ?? [];
  const activeCount = items.filter(
    (a: any) => (a.status ?? "active") === "active"
  ).length;
  const actions30d = items.reduce(
    (n: number, a: any) => n + Number(a.auditCountLast30d ?? 0),
    0
  );

  const openSheet = (mode: NonNullable<SheetMode>) => {
    setReason("");
    setTargetUserId("");
    setSheet(mode);
  };

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

  const copy = sheet ? SHEET_COPY[sheet.kind] : null;

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
          eyebrow="Access control"
          title="Administrators"
          subtitle="Super admin accounts with full platform access"
          icon={ShieldCheck}
          stats={[
            { icon: ShieldCheck, value: items.length, label: "Admins" },
            { icon: CheckCircle2, value: activeCount, label: "Active" },
            { icon: Activity, value: actions30d, label: "Actions 30d" },
          ]}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
          gap: spacing.lg,
        }}
      >
        <View>
          <AdminSection
            title="Accounts"
            count={items.length}
            action={
              <PromotePill onPress={() => openSheet({ kind: "promote" })} />
            }
          />
          <View style={{ gap: spacing.md }}>
            {isError ? (
              <AdminError
                title="Load failed"
                message="Couldn't load admins."
                onRetry={refetch}
                retrying={isRefetching}
              />
            ) : isLoading ? (
              <ListSkeleton rows={3} />
            ) : items.length === 0 ? (
              <AdminEmpty
                icon={ShieldCheck}
                title="No admins"
                message="Super admin accounts will appear here."
              />
            ) : (
              items.map((a: any) => (
                <AdminAccountCard
                  key={a.id}
                  a={a}
                  isSelf={a.id === me?.id}
                  busy={action.isPending}
                  onSuspend={() => openSheet({ kind: "suspend", admin: a })}
                  onDemote={() => openSheet({ kind: "demote", admin: a })}
                  onReactivate={() => onUnsuspend(a)}
                />
              ))
            )}
          </View>
        </View>

        <Callout
          icon={Fingerprint}
          text="Every admin action is written to the audit log with the reason you give."
        />
      </View>

      <BottomSheet
        visible={!!sheet}
        onDismiss={() => setSheet(null)}
        title={copy?.title}
      >
        {sheet && copy ? (
          <SheetForm
            submitLabel={copy.submit}
            submitVariant={copy.variant}
            submitIcon={copy.icon}
            onSubmit={submit}
            onCancel={() => setSheet(null)}
            loading={action.isPending}
            disabled={
              reason.trim().length < 3 ||
              (sheet.kind === "promote" && !targetUserId.trim())
            }
          >
            <View style={{ gap: spacing.lg }}>
              {sheet.kind !== "promote" ? (
                <TargetRow admin={sheet.admin} />
              ) : null}
              <Callout
                icon={sheet.kind === "promote" ? Info : AlertTriangle}
                tone={sheet.kind === "promote" ? "info" : "danger"}
                text={copy.warning}
              />
              {sheet.kind === "promote" ? (
                <SheetField label="User ID" required hint="from the user's profile">
                  <TextInput
                    value={targetUserId}
                    onChangeText={setTargetUserId}
                    placeholder="e.g. usr_8f2c…"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </SheetField>
              ) : null}
              <SheetField
                label="Reason"
                required
                hint={
                  reason.trim().length < 3
                    ? `${3 - reason.trim().length} more character${3 - reason.trim().length === 1 ? "" : "s"}`
                    : "Recorded in audit log"
                }
              >
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Why is this change needed?"
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 88, textAlignVertical: "top" }}
                />
              </SheetField>
            </View>
          </SheetForm>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function PromotePill({ onPress }: { onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel="Promote a user to admin"
      hitSlop={6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 34,
        paddingLeft: 11,
        paddingRight: 14,
        borderRadius: 17,
        backgroundColor: colors.primary,
      }}
    >
      <UserPlus size={15} color={colors.onPrimary} strokeWidth={2.5} />
      <Text style={[typography.label.sm, { color: colors.onPrimary }]}>
        Promote
      </Text>
    </Pressable>
  );
}

function AdminAccountCard({
  a,
  isSelf,
  busy,
  onSuspend,
  onDemote,
  onReactivate,
}: {
  a: any;
  isSelf: boolean;
  busy: boolean;
  onSuspend: () => void;
  onDemote: () => void;
  onReactivate: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const suspended = a.status === "suspended";
  const lastSeen = a.lastLoginAt
    ? relTime(a.lastLoginAt) || fmtDate(a.lastLoginAt, locale as any)
    : "Never";
  const count = Number(a.auditCountLast30d ?? 0);

  return (
    <AdminCard style={{ padding: 0 }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar name={a.name ?? "?"} size="lg" />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {a.name ?? "Unnamed"}
              </Text>
              {isSelf ? (
                <View
                  style={{
                    height: 20,
                    paddingHorizontal: 7,
                    borderRadius: 10,
                    justifyContent: "center",
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Text style={[typography.label.xs, { color: colors.primary }]}>
                    You
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[typography.caption, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {a.email ?? "—"}
            </Text>
          </View>
          <StatusPill status={a.status ?? "active"} />
        </View>

        <View
          style={{
            flexDirection: "row",
            padding: spacing.md,
            borderRadius: 14,
            borderCurve: "continuous",
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Stat icon={Activity} label="Actions (30d)" value={String(count)} />
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginHorizontal: spacing.md }} />
          <Stat icon={Clock} label="Last sign-in" value={lastSeen} />
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          backgroundColor: colors.surfaceMuted,
          minHeight: 48,
        }}
      >
        {isSelf ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, flex: 1, paddingHorizontal: spacing.lg },
            ]}
          >
            Another admin must change your access.
          </Text>
        ) : (
          <>
            {suspended ? (
              <FooterAction
                icon={CheckCircle2}
                label="Reactivate"
                color={colors.success}
                onPress={onReactivate}
                disabled={busy}
              />
            ) : (
              <FooterAction
                icon={Ban}
                label="Suspend"
                color={colors.danger}
                onPress={onSuspend}
              />
            )}
            <View style={{ width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.separator }} />
            <FooterAction
              icon={ShieldOff}
              label="Demote"
              color={colors.textMuted}
              onPress={onDemote}
            />
          </>
        )}
      </View>
    </AdminCard>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon size={12} color={colors.textSubtle} strokeWidth={2.4} />
        <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={[typography.title.sm, { color: colors.text, marginTop: 2 }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function FooterAction({
  icon: Icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        height: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={15} color={color} strokeWidth={2.4} />
      <Text style={[typography.label.md, { color }]}>{label}</Text>
    </Pressable>
  );
}

function TargetRow({ admin }: { admin: any }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        borderCurve: "continuous",
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.hairline,
      }}
    >
      <Avatar name={admin?.name ?? "?"} size="md" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
          {admin?.name ?? "Admin"}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {admin?.email ?? "—"}
        </Text>
      </View>
    </View>
  );
}

function Callout({
  icon: Icon,
  text,
  tone = "info",
}: {
  icon: LucideIcon;
  text: string;
  tone?: "info" | "danger";
}) {
  const { colors, spacing, typography } = useTheme();
  const fg = tone === "danger" ? colors.danger : colors.primary;
  const bg = tone === "danger" ? colors.dangerSoft : colors.primarySoft;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: 14,
        borderCurve: "continuous",
        backgroundColor: bg,
      }}
    >
      <Icon size={16} color={fg} strokeWidth={2.4} style={{ marginTop: 1 }} />
      <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
        {text}
      </Text>
    </View>
  );
}
