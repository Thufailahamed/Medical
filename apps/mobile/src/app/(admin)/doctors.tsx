import React, { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  Stethoscope,
  BadgeCheck,
  ShieldOff,
  Star,
  ChevronRight,
} from "lucide-react-native";
import {
  Screen,
  Avatar,
  Button,
  BottomSheet,
  EmptyState,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminDoctors,
  useVerifySlmc,
  useRevokeSlmc,
  type AdminDoctorRow,
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
  { label: "All", value: "all" },
  { label: "Unverified", value: "unverified", tone: "warning" as const },
  { label: "Verified", value: "verified", tone: "success" as const },
];

export default function AdminDoctorsScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">(
    "unverified"
  );
  const [selected, setSelected] = useState<AdminDoctorRow | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } =
    useAdminDoctors(filter);
  const verify = useVerifySlmc();
  const revoke = useRevokeSlmc();
  const busy = verify.isPending || revoke.isPending;

  const items = data?.items ?? [];

  const onVerify = () => {
    if (!selected) return;
    verify.mutate(selected.doctorId, {
      onSuccess: () => {
        toast.show(`${selected.name ?? "Doctor"} verified`, "success");
        setSelected(null);
      },
      onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
    });
  };

  const onRevoke = () => {
    if (!selected) return;
    revoke.mutate(selected.doctorId, {
      onSuccess: () => {
        toast.show("SLMC verification revoked", "success");
        setSelected(null);
      },
      onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
    });
  };

  return (
    <Screen
      scroll
      padded={false}
      tabBarOffset
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          eyebrow="Directory"
          title="Doctors"
          subtitle="SLMC registration verification"
          icon={Stethoscope}
          stats={[
            { value: String(items.length), label: "Shown" },
            {
              value: String(
                items.filter((d) => !d.slmcVerifiedAt).length
              ),
              label: "Unverified",
            },
            {
              value: String(
                items.filter((d) => !!d.slmcVerifiedAt).length
              ),
              label: "Verified",
            },
          ]}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <FilterChips
          options={FILTERS}
          value={filter}
          onChange={(v) => setFilter(v as any)}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          marginTop: spacing.sm,
        }}
      >
        {isError ? <AdminError message="Couldn't load doctors." /> : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No doctors"
            message={
              filter === "unverified"
                ? "All doctors are verified."
                : "No doctors match this filter."
            }
          />
        ) : (
          items.map((d) => (
            <DoctorCard key={d.doctorId} d={d} onPress={() => setSelected(d)} />
          ))
        )}
      </View>

      {/* Doctor action sheet */}
      <BottomSheet
        visible={!!selected}
        onDismiss={() => setSelected(null)}
        title={selected?.name ?? "Doctor"}
      >
        {selected ? (
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <Avatar name={selected.name ?? "?"} size="lg" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[typography.title.md, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {selected.name ?? "Unnamed"}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {selected.specialization ?? "General"}
                </Text>
                <View style={{ marginTop: 4 }}>
                  <StatusPill
                    status={selected.slmcVerifiedAt ? "verified" : "pending"}
                  />
                </View>
              </View>
            </View>

            <InfoPanel icon={Stethoscope} title="Registration" tone="primary">
              <KV label="SLMC no." value={selected.slmcRegistrationNo} />
              <KV label="Reg. number" value={selected.registrationNumber} />
              <KV label="Email" value={selected.email} />
              <KV label="Phone" value={selected.phone} />
              <KV
                label="Joined"
                value={
                  selected.createdAt
                    ? fmtDateTime(selected.createdAt, locale as any)
                    : null
                }
              />
            </InfoPanel>

            <View style={{ marginTop: spacing.md }}>
              <Button
                title="View full account"
                variant="outline"
                size="sm"
                onPress={() => {
                  setSelected(null);
                  router.push({
                    pathname: "/(admin)/user-detail",
                    params: { id: selected.userId },
                  } as any);
                }}
              />
            </View>
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {selected.slmcVerifiedAt ? (
                <Button
                  title="Revoke SLMC verification"
                  variant="danger"
                  icon={ShieldOff}
                  onPress={onRevoke}
                  loading={busy}
                />
              ) : (
                <Button
                  title="Verify SLMC registration"
                  icon={BadgeCheck}
                  onPress={onVerify}
                  loading={busy}
                />
              )}
              <Button
                title="Close"
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

function DoctorCard({
  d,
  onPress,
}: {
  d: AdminDoctorRow;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const verified = !!d.slmcVerifiedAt;
  return (
    <AdminCard onPress={onPress}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
      >
        <Avatar name={d.name ?? "?"} size="md" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[typography.title.sm, { color: colors.text }]}
            numberOfLines={1}
          >
            {d.name ?? "Unnamed"}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {d.specialization ?? "General"} · SLMC {d.slmcRegistrationNo ?? "—"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
            }}
          >
            <StatusPill status={verified ? "verified" : "pending"} />
            {typeof d.rating === "number" && d.rating > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: colors.warningSoft,
                }}
              >
                <Star size={10} color={colors.warning} fill={colors.warning} />
                <Text
                  style={[
                    typography.caption,
                    {
                      color: colors.warning,
                      fontWeight: "800",
                      fontSize: 10,
                    },
                  ]}
                >
                  {d.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <ChevronRight size={18} color={colors.textSubtle} />
      </View>
    </AdminCard>
  );
}
