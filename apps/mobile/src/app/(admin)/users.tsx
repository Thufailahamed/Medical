import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Users as UsersIcon,
  CheckSquare,
  Square,
  X,
  Trash2,
  Ban,
  CircleCheck,
  CircleSlash,
  ChevronRight,
} from "lucide-react-native";
import {
  Screen,
  EmptyState,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  Pressable,
  SearchField,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import { withOpacity } from "@/constants/theme";
import {
  useAdminUsers,
  useBulkAction,
  type AdminUserRow,
  type BulkResult,
} from "@/hooks/useAdminApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AdminHero,
  FilterChips,
  ListSkeleton,
  AdminError,
  StatusPill,
  statusTone,
  roleTone,
  roleLabel,
} from "@/components/admin/ui";

const ROLE_OPTIONS = [
  { label: "All", value: "" },
  { label: "Patients", value: "patient" },
  { label: "Doctors", value: "doctor" },
  { label: "Caretakers", value: "caretaker" },
  { label: "Hospitals", value: "hospital_admin" },
  { label: "Labs", value: "laboratory" },
  { label: "Pharmacy", value: "pharmacy" },
  { label: "Insurance", value: "insurance" },
  { label: "Ambulance", value: "ambulance" },
];

const STATUS_OPTIONS = [
  { label: "Any status", value: "" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Suspended", value: "suspended" },
  { label: "Rejected", value: "rejected" },
];

type BulkActionKind = "approve" | "reject" | "suspend" | "unsuspend" | "delete";

const BULK_ACTIONS: {
  key: BulkActionKind;
  label: string;
  icon: any;
  danger?: boolean;
  needsReason?: boolean;
}[] = [
  { key: "approve", label: "Approve", icon: CircleCheck },
  { key: "reject", label: "Reject", icon: CircleSlash, danger: true, needsReason: true },
  { key: "suspend", label: "Suspend", icon: Ban, danger: true, needsReason: true },
  { key: "unsuspend", label: "Unsuspend", icon: CircleCheck },
  { key: "delete", label: "Delete", icon: Trash2, danger: true },
];

export default function AdminUsersScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const debouncedQ = useDebounce(q, 350);

  // Bulk selection (ADM-9)
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reasonAction, setReasonAction] = useState<BulkActionKind | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } = useAdminUsers({
    role: role || undefined,
    status: status || undefined,
    q: debouncedQ || undefined,
    limit: 100,
  });
  const bulk = useBulkAction();

  const items = useMemo(() => data?.items ?? [], [data]);
  const filtered = !!(q.trim() || role || status);
  const clearFilters = () => {
    setQ("");
    setRole("");
    setStatus("");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const showResult = (res: BulkResult) => {
    const failed = res.results.filter((r) => r.status === "error");
    if (failed.length === 0) {
      toast.show(`${res.successCount} updated`, "success");
      exitSelect();
      return;
    }
    Alert.alert(
      `Done with ${res.failureCount} failure(s)`,
      failed
        .slice(0, 5)
        .map((f) => `• ${f.code ?? "error"}: ${f.message ?? f.userId.slice(0, 8)}`)
        .join("\n")
        .concat(failed.length > 5 ? `\n…+${failed.length - 5} more` : "")
    );
    exitSelect();
  };

  const runBulk = (action: BulkActionKind, bodyReason?: string) => {
    const ids = [...selected];
    bulk.mutate(
      { action, userIds: ids, reason: bodyReason },
      {
        onSuccess: (res) => showResult(res),
        onError: (e: any) => toast.show(e?.message ?? "Bulk action failed", "danger"),
      }
    );
    setReasonAction(null);
    setReason("");
  };

  const onAction = (a: (typeof BULK_ACTIONS)[number]) => {
    if (selected.size === 0) return;
    if (a.needsReason) {
      setReason("");
      setReasonAction(a.key);
      return;
    }
    if (a.key === "delete") {
      Alert.alert(
        "Delete users",
        `Permanently delete ${selected.size} account(s)? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => runBulk("delete"),
          },
        ]
      );
      return;
    }
    runBulk(a.key);
  };

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          eyebrow="Directory"
          title={selectMode ? `${selected.size} selected` : "Users"}
          subtitle={
            selectMode
              ? "Tap rows to select"
              : `${data?.total ?? 0} accounts on the platform`
          }
          right={
            selectMode ? (
              <Pressable
                onPress={exitSelect}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel="Exit selection"
                hitSlop={8}
                style={heroPill}
              >
                <X size={16} color="#FFFFFF" strokeWidth={2.6} />
                <Text style={[typography.label.md, { color: "#FFFFFF" }]}>Done</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setSelectMode(true)}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel="Select users"
                hitSlop={8}
                style={heroPill}
              >
                <CheckSquare size={15} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={[typography.label.md, { color: "#FFFFFF" }]}>Select</Text>
              </Pressable>
            )
          }
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Search name, email or phone"
        />
      </View>

      {/* Wrapped so each horizontal row sizes to its chips instead of being squeezed */}
      <View style={{ marginTop: spacing.sm }}>
        <FilterChips options={ROLE_OPTIONS} value={role} onChange={setRole} size="sm" />
      </View>
      <View>
        <FilterChips
          options={STATUS_OPTIONS.map((o) => ({ ...o, tone: o.value ? statusTone(o.value) : undefined }))}
          value={status}
          onChange={setStatus}
          size="sm"
        />
      </View>

      {/* Result summary */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg + 4,
          marginTop: spacing.sm,
          minHeight: 28,
        }}
      >
        <Text style={[typography.label.md, { color: colors.textMuted }]}>
          {isLoading
            ? "Loading…"
            : `${data?.total ?? items.length} ${(data?.total ?? items.length) === 1 ? "user" : "users"}${
                filtered ? " match" : ""
              }`}
        </Text>
        {filtered ? (
          <Pressable
            onPress={clearFilters}
            haptic="light"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[typography.label.md, { color: colors.primary }]}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>

      {isError ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <AdminError
            title="Couldn't load users"
            message="Check your connection, then retry."
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        </View>
      ) : null}
      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <ListSkeleton rows={8} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: selectMode ? 220 : 140,
          }}
          ListEmptyComponent={
            isError ? null : (
              <EmptyState
                icon={UsersIcon}
                title="No users found"
                message={filtered ? "Try a different search or filter." : "No accounts yet."}
              />
            )
          }
          renderItem={({ item, index }) => (
            <UserRow
              user={item}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              selectMode={selectMode}
              selected={selected.has(item.id)}
              onPress={() =>
                selectMode
                  ? toggleSelect(item.id)
                  : router.push({
                      pathname: "/(admin)/user-detail",
                      params: { id: item.id },
                    } as any)
              }
            />
          )}
        />
      )}

      {/* Bulk action bar */}
      {selectMode ? (
        <View
          style={{
            position: "absolute",
            left: spacing.lg,
            right: spacing.lg,
            bottom: 110,
          }}
        >
          <View
            style={{
              borderRadius: 26,
              borderCurve: "continuous",
              overflow: "hidden",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.16)",
              shadowColor: "#062238",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={["#0B2440", "#0E3A5C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md + 2,
              }}
            >
              {BULK_ACTIONS.map((a) => {
                const Icon = a.icon;
                const disabled = selected.size === 0 || bulk.isPending;
                return (
                  <Pressable
                    key={a.key}
                    onPress={() => onAction(a)}
                    disabled={disabled}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={a.label}
                    style={{
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: spacing.xs,
                      opacity: disabled ? 0.35 : 1,
                    }}
                  >
                    <Icon
                      size={20}
                      color={a.danger ? "#FCA5A5" : "#7DD3FC"}
                      strokeWidth={2.25}
                    />
                    <Text
                      style={[
                        typography.label.xs,
                        { color: a.danger ? "#FCA5A5" : "rgba(255,255,255,0.8)" },
                      ]}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </LinearGradient>
          </View>
        </View>
      ) : null}

      {/* Reason sheet for reject / suspend */}
      <BottomSheet
        visible={reasonAction !== null}
        onDismiss={() => setReasonAction(null)}
        title={reasonAction === "reject" ? "Reject users" : "Suspend users"}
        height="auto"
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            This reason applies to {selected.size} account(s) and is recorded
            in the audit log.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (required)"
            multiline
            numberOfLines={3}
            style={{ minHeight: 72, textAlignVertical: "top" }}
          />
          <Button
            title={
              reasonAction === "reject"
                ? `Reject ${selected.size} user(s)`
                : `Suspend ${selected.size} user(s)`
            }
            variant="danger"
            disabled={!reason.trim()}
            loading={bulk.isPending}
            onPress={() => runBulk(reasonAction!, reason.trim())}
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => setReasonAction(null)}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

// Frosted glass pill button that sits on the admin hero gradient.
const heroPill = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  height: 38,
  paddingHorizontal: 14,
  borderRadius: 19,
  backgroundColor: "rgba(255,255,255,0.18)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.28)",
} as const;

const AVATAR = 44;

/** One row of the grouped directory card. Status shows as an avatar dot; a pill only when not active. */
function UserRow({
  user,
  isFirst,
  isLast,
  selectMode,
  selected,
  onPress,
}: {
  user: AdminUserRow;
  isFirst: boolean;
  isLast: boolean;
  selectMode: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography, radius, shadow, scheme } = useTheme();
  const status = user.status ?? "active";
  const sTone = useTone(statusTone(status) as any);
  const rTone = useTone(roleTone(user.role) as any);
  const isActive = status === "active";

  return (
    <Pressable
      onPress={onPress}
      haptic={selectMode ? "light" : undefined}
      accessibilityRole="button"
      accessibilityState={selectMode ? { selected } : undefined}
      accessibilityLabel={`${user.name ?? "Unnamed"}, ${roleLabel(user.role)}, ${status}`}
      style={({ pressed }: { pressed: boolean }) => [
        {
          backgroundColor: selected
            ? withOpacity(colors.primary, 0.08)
            : pressed
            ? colors.fill
            : colors.surface,
          borderTopLeftRadius: isFirst ? radius.card : 0,
          borderTopRightRadius: isFirst ? radius.card : 0,
          borderBottomLeftRadius: isLast ? radius.card : 0,
          borderBottomRightRadius: isLast ? radius.card : 0,
          borderCurve: "continuous",
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderTopWidth: isFirst ? StyleSheet.hairlineWidth : 0,
          borderBottomWidth: isLast ? StyleSheet.hairlineWidth : 0,
          borderColor: scheme === "dark" ? colors.borderStrong : colors.hairline,
        },
        isFirst && scheme !== "dark" ? shadow.card : null,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        {selectMode ? (
          <View style={{ width: 24, alignItems: "center" }}>
            {selected ? (
              <CheckSquare size={22} color={colors.primary} strokeWidth={2.3} />
            ) : (
              <Square size={22} color={colors.textSubtle} strokeWidth={2} />
            )}
          </View>
        ) : null}

        <View>
          <Avatar name={user.name ?? "?"} size={AVATAR} />
          <View
            style={{
              position: "absolute",
              right: -1,
              bottom: -1,
              width: 13,
              height: 13,
              borderRadius: 7,
              backgroundColor: sTone.fg,
              borderWidth: 2.5,
              borderColor: colors.surface,
            }}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
            {user.name ?? "Unnamed"}
          </Text>
          <Text
            style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]}
            numberOfLines={1}
          >
            {user.email ?? user.phone ?? "—"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 }}>
            <View
              style={{
                paddingHorizontal: 8,
                height: 20,
                borderRadius: 10,
                justifyContent: "center",
                backgroundColor: rTone.bg,
              }}
            >
              <Text style={[typography.label.xs, { color: rTone.fg }]}>{roleLabel(user.role)}</Text>
            </View>
            {!isActive ? <StatusPill status={status} /> : null}
          </View>
        </View>

        {!selectMode ? (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.well,
            }}
          >
            <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.4} />
          </View>
        ) : null}
      </View>

      {!isLast ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
            marginLeft: spacing.lg + (selectMode ? 24 + spacing.md : 0) + AVATAR + spacing.md,
          }}
        />
      ) : null}
    </Pressable>
  );
}
