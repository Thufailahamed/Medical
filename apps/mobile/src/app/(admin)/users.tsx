import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
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
} from "lucide-react-native";
import {
  Screen,
  EmptyState,
  ListItem,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminUsers,
  useBulkAction,
  type AdminUserRow,
  type BulkResult,
} from "@/hooks/useAdminApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AdminHero,
  SearchBar,
  FilterChips,
  ListSkeleton,
  AdminError,
  RolePill,
  StatusPill,
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
          icon={UsersIcon}
          right={
            selectMode ? (
              <Pressable
                onPress={exitSelect}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel="Exit selection"
                hitSlop={8}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <X size={20} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setSelectMode(true)}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel="Select users"
                hitSlop={8}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <CheckSquare size={19} color="#FFFFFF" strokeWidth={2.25} />
              </Pressable>
            )
          }
        />
      </View>

      <View
        style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}
      >
        <SearchBar
          value={q}
          onChangeText={setQ}
          placeholder="Search name, email or phone"
        />
      </View>
      <FilterChips options={ROLE_OPTIONS} value={role} onChange={setRole} />
      <FilterChips
        options={STATUS_OPTIONS}
        value={status}
        onChange={setStatus}
        size="sm"
      />

      {isError ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <AdminError message="Couldn't load users." />
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
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: selectMode ? 220 : 140,
            gap: spacing.sm,
          }}
          ListEmptyComponent={
            <EmptyState
              icon={UsersIcon}
              title="No users found"
              message="Try a different search or filter."
            />
          }
          renderItem={({ item }) => (
            <UserRow
              user={item}
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
              overflow: "hidden",
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
                paddingVertical: spacing.md,
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
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        letterSpacing: 0.2,
                        color: a.danger ? "#FCA5A5" : "rgba(255,255,255,0.75)",
                      }}
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

function UserRow({
  user,
  selectMode,
  selected,
  onPress,
}: {
  user: AdminUserRow;
  selectMode: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <ListItem
      variant="contact"
      mediaSlot={
        selectMode ? (
          selected ? (
            <CheckSquare size={22} color={colors.primary} />
          ) : (
            <Square size={22} color={colors.textSubtle} />
          )
        ) : (
          <Avatar name={user.name ?? "?"} size="md" />
        )
      }
      title={user.name ?? "Unnamed"}
      subtitle={user.email ?? user.phone ?? "—"}
      onPress={onPress}
      rightSlot={
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <RolePill role={user.role} />
          <StatusPill status={user.status ?? "active"} />
        </View>
      }
    />
  );
}
