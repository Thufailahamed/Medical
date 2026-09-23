import React, { useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Ambulance,
  ShieldCheck,
  Truck,
  Receipt,
  CheckCircle2,
  XCircle,
} from "lucide-react-native";
import {
  Screen,
  ListItem,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  EmptyState,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useOperatorUsers,
  useOperatorDispatches,
  useAcknowledgeDispatch,
  useOperatorClaims,
  useDecideOperatorClaim,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  AdminSection,
  IconTile,
  FilterChips,
  ListSkeleton,
  AdminError,
  StatusPill,
  RolePill,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const ROLE_TABS = [
  { label: "Ambulance", value: "ambulance" },
  { label: "Insurance", value: "insurance" },
];

const DISPATCH_FILTERS = [
  { label: "Queued", value: "queued", tone: "warning" as const },
  { label: "Acknowledged", value: "acknowledged" },
  { label: "Enroute", value: "enroute", tone: "info" as const },
  { label: "Completed", value: "completed", tone: "success" as const },
  { label: "All", value: "all" },
];

const CLAIM_FILTERS = [
  { label: "Submitted", value: "submitted", tone: "warning" as const },
  { label: "Under review", value: "under_review" },
  { label: "Approved", value: "approved", tone: "success" as const },
  { label: "Rejected", value: "rejected", tone: "danger" as const },
  { label: "Paid", value: "paid", tone: "success" as const },
  { label: "All", value: "all" },
];

export default function AdminOperatorsScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();
  const toast = useToast();

  const [role, setRole] = useState<"ambulance" | "insurance">(
    params.role === "insurance" ? "insurance" : "ambulance"
  );
  const [dispatchStatus, setDispatchStatus] = useState("queued");
  const [claimStatus, setClaimStatus] = useState("submitted");
  const [rejectingClaim, setRejectingClaim] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const users = useOperatorUsers(role);
  const dispatches = useOperatorDispatches(
    role === "ambulance" ? dispatchStatus : "all"
  );
  const claims = useOperatorClaims(
    role === "insurance" ? claimStatus : "all"
  );
  const ack = useAcknowledgeDispatch();
  const decide = useDecideOperatorClaim();

  const items = users.data?.items ?? [];
  const dispatchItems =
    role === "ambulance" ? (dispatches.data?.items ?? []) : [];
  const claimItems =
    role === "insurance" ? (claims.data?.items ?? []) : [];

  const onAcknowledge = (d: any) => {
    ack.mutate(d.id, {
      onSuccess: () => toast.show("Dispatch acknowledged", "success"),
      onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
    });
  };

  const onApproveClaim = (c: any) => {
    decide.mutate(
      { id: c.id, decision: "approve" },
      {
        onSuccess: () => toast.show("Claim approved", "success"),
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  const onRejectClaim = () => {
    if (!rejectingClaim) return;
    decide.mutate(
      {
        id: rejectingClaim.id,
        decision: "reject",
        reason: rejectReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.show("Claim rejected", "success");
          setRejectingClaim(null);
          setRejectReason("");
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  return (
    <Screen
      scroll
      padded={false}
      refreshing={
        users.isRefetching || dispatches.isRefetching || claims.isRefetching
      }
      onRefresh={() => {
        users.refetch();
        if (role === "ambulance") dispatches.refetch();
        if (role === "insurance") claims.refetch();
      }}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Operations"
          title="Operators"
          subtitle="Ambulance & insurance operator desks"
          icon={role === "ambulance" ? Ambulance : ShieldCheck}
          stats={[
            { value: String(users.data?.total ?? 0), label: "Accounts" },
            {
              value: String(
                role === "ambulance"
                  ? (dispatches.data?.total ?? 0)
                  : (claims.data?.total ?? 0)
              ),
              label: role === "ambulance" ? "Dispatches" : "Claims",
            },
          ]}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <FilterChips
          options={ROLE_TABS}
          value={role}
          onChange={(v) => setRole(v as any)}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
          marginTop: spacing.sm,
          paddingBottom: spacing.xxl,
        }}
      >
        {/* ─── Dispatch queue (ambulance only) ─── */}
        {role === "ambulance" ? (
          <View>
            <AdminSection
              title="Dispatch queue"
              count={dispatches.data?.total ?? 0}
            />
            <FilterChips
              options={DISPATCH_FILTERS}
              value={dispatchStatus}
              onChange={setDispatchStatus}
              size="sm"
              flush
            />
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              {dispatches.isError ? (
                <AdminError message="Couldn't load dispatches." />
              ) : dispatches.isLoading ? (
                <ListSkeleton rows={3} />
              ) : dispatchItems.length === 0 ? (
                <AdminCard>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textSubtle, textAlign: "center" },
                    ]}
                  >
                    No {dispatchStatus} dispatches
                  </Text>
                </AdminCard>
              ) : (
                dispatchItems.map((d: any) => (
                  <AdminCard key={d.id}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: spacing.md,
                      }}
                    >
                      <IconTile icon={Truck} tone="danger" size={38} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[typography.title.sm, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {d.pickupAddress}
                          {d.destinationAddress
                            ? ` → ${d.destinationAddress}`
                            : ""}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 5,
                            flexWrap: "wrap",
                          }}
                        >
                          <StatusPill status={d.status ?? "queued"} />
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSubtle },
                            ]}
                          >
                            {d.createdAt
                              ? fmtDateTime(d.createdAt, locale as any)
                              : ""}
                          </Text>
                        </View>
                        {d.status === "queued" ? (
                          <View style={{ marginTop: spacing.sm }}>
                            <Button
                              title="Acknowledge"
                              size="sm"
                              variant="secondary"
                              fullWidth={false}
                              onPress={() => onAcknowledge(d)}
                              loading={ack.isPending}
                            />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </AdminCard>
                ))
              )}
            </View>
          </View>
        ) : null}

        {/* ─── Operator claims (insurance only) ─── */}
        {role === "insurance" ? (
          <View>
            <AdminSection
              title="Claims queue"
              count={claims.data?.total ?? 0}
            />
            <FilterChips
              options={CLAIM_FILTERS}
              value={claimStatus}
              onChange={setClaimStatus}
              size="sm"
              flush
            />
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              {claims.isError ? (
                <AdminError message="Couldn't load claims." />
              ) : claims.isLoading ? (
                <ListSkeleton rows={3} />
              ) : claims.data?.hint === "no_org" ? (
                <AdminCard>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textSubtle, textAlign: "center" },
                    ]}
                  >
                    No operator organization linked — claims are scoped to an
                    org once assigned.
                  </Text>
                </AdminCard>
              ) : claimItems.length === 0 ? (
                <AdminCard>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.textSubtle, textAlign: "center" },
                    ]}
                  >
                    No {claimStatus.replace(/_/g, " ")} claims
                  </Text>
                </AdminCard>
              ) : (
                claimItems.map((c: any) => (
                  <AdminCard key={c.id}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: spacing.md,
                      }}
                    >
                      <IconTile icon={Receipt} tone="info" size={38} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[typography.title.sm, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          LKR {Number(c.amount ?? 0).toLocaleString()}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 5,
                            flexWrap: "wrap",
                          }}
                        >
                          <StatusPill status={c.status ?? "submitted"} />
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSubtle },
                            ]}
                          >
                            patient {c.patientId?.slice(0, 8)}…
                            {c.createdAt
                              ? ` · ${fmtDateTime(c.createdAt, locale as any)}`
                              : ""}
                          </Text>
                        </View>
                        {c.status === "submitted" ||
                        c.status === "under_review" ? (
                          <View
                            style={{
                              flexDirection: "row",
                              gap: spacing.sm,
                              marginTop: spacing.sm,
                            }}
                          >
                            <Button
                              title="Approve"
                              size="sm"
                              fullWidth={false}
                              icon={CheckCircle2}
                              onPress={() => onApproveClaim(c)}
                              loading={decide.isPending}
                            />
                            <Button
                              title="Reject"
                              size="sm"
                              variant="ghost"
                              fullWidth={false}
                              icon={XCircle}
                              onPress={() => {
                                setRejectReason("");
                                setRejectingClaim(c);
                              }}
                            />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </AdminCard>
                ))
              )}
            </View>
          </View>
        ) : null}

        {/* ─── Operator accounts ─── */}
        <View>
          <AdminSection
            title={
              role === "ambulance" ? "Ambulance accounts" : "Insurance accounts"
            }
            count={users.data?.total ?? 0}
          />
          {users.isError ? (
            <AdminError message="Couldn't load operator accounts." />
          ) : users.isLoading ? (
            <ListSkeleton rows={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={role === "ambulance" ? Ambulance : ShieldCheck}
              title="No operators"
              message={`No ${role} operator accounts found.`}
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {items.map((u) => (
                <ListItem
                  key={u.id}
                  variant="contact"
                  mediaSlot={<Avatar name={u.name ?? "?"} size="md" />}
                  title={u.name ?? "Unnamed"}
                  subtitle={u.email ?? u.phone ?? "—"}
                  onPress={() =>
                    router.push({
                      pathname: "/(admin)/user-detail",
                      params: { id: u.id },
                    } as any)
                  }
                  rightSlot={
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <RolePill role={u.role} />
                      <StatusPill status={u.status ?? "active"} />
                    </View>
                  }
                />
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Reject reason sheet */}
      <BottomSheet
        visible={rejectingClaim !== null}
        onDismiss={() => setRejectingClaim(null)}
        title="Reject claim"
        height="auto"
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            Optionally tell the claimant why this claim was rejected.
          </Text>
          <TextInput
            value={rejectReason}
            onChangeText={setRejectReason}
            placeholder="Reason (optional)"
            multiline
            numberOfLines={3}
            style={{ minHeight: 72, textAlignVertical: "top" }}
          />
          <Button
            title="Reject claim"
            variant="danger"
            onPress={onRejectClaim}
            loading={decide.isPending}
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => setRejectingClaim(null)}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
