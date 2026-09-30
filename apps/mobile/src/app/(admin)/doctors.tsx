import React, { useState } from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Stethoscope,
  BadgeCheck,
  ShieldOff,
  Star,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  IdCard,
  Hash,
  Mail,
  Phone,
  CalendarDays,
  UserRound,
} from "lucide-react-native";
import {
  Screen,
  Avatar,
  Button,
  BottomSheet,
  Pressable,
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
  AdminSegmented,
  RowDivider,
  ListSkeleton,
  AdminError,
} from "@/components/admin/ui";
import { fmtDate } from "@/lib/format";
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
  // Counts come from the unfiltered list so they don't change with the active tab.
  const { data: allData } = useAdminDoctors("all");
  const all = allData?.items;
  const counts = all
    ? {
        all: all.length,
        unverified: all.filter((d) => !d.slmcVerifiedAt).length,
        verified: all.filter((d) => !!d.slmcVerifiedAt).length,
      }
    : undefined;

  const heroSubtitle = !counts
    ? "SLMC registration verification"
    : counts.unverified > 0
    ? `${counts.unverified} doctor${counts.unverified === 1 ? "" : "s"} awaiting SLMC verification`
    : "Every doctor is SLMC verified";

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
    Alert.alert(
      "Revoke SLMC verification?",
      `${selected.name ?? "This doctor"} will lose the verified badge and return to the unverified queue.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Revoke", style: "destructive", onPress: doRevoke },
      ]
    );
  };

  const doRevoke = () => {
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
          subtitle={heroSubtitle}
          icon={Stethoscope}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <AdminSegmented
          options={FILTERS.map((f) => ({ ...f, count: counts?.[f.value as keyof typeof counts] }))}
          value={filter}
          onChange={(v) => setFilter(v as any)}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          marginTop: spacing.lg,
          paddingBottom: spacing.xl,
        }}
      >
        {isError ? (
          <AdminError
            title="Couldn't load doctors"
            message="Check your connection, then retry or pull to refresh."
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          isError ? null : (
            <EmptyDoctors filter={filter} onShowAll={filter !== "all" ? () => setFilter("all") : undefined} />
          )
        ) : (
          <AdminCard style={{ padding: 0 }}>
            {items.map((d, i) => (
              <React.Fragment key={d.doctorId}>
                {i > 0 ? <RowDivider inset={spacing.lg + 44 + spacing.md} /> : null}
                <DoctorRow d={d} onPress={() => setSelected(d)} />
              </React.Fragment>
            ))}
          </AdminCard>
        )}
      </View>

      {/* Doctor action sheet */}
      <BottomSheet
        visible={!!selected}
        onDismiss={() => setSelected(null)}
        title="Doctor details"
      >
        {selected ? (
          <DoctorSheet
            d={selected}
            locale={locale}
            busy={busy}
            onVerify={onVerify}
            onRevoke={onRevoke}
            onViewAccount={() => {
              const userId = selected.userId;
              setSelected(null);
              router.push({ pathname: "/(admin)/user-detail", params: { id: userId } } as any);
            }}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function DoctorSheet({
  d,
  locale,
  busy,
  onVerify,
  onRevoke,
  onViewAccount,
}: {
  d: AdminDoctorRow;
  locale: string;
  busy: boolean;
  onVerify: () => void;
  onRevoke: () => void;
  onViewAccount: () => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const verified = !!d.slmcVerifiedAt;
  const showRegNo = !!d.registrationNumber && d.registrationNumber !== d.slmcRegistrationNo;

  const rows: { icon: any; label: string; value: string; missing?: boolean }[] = [
    {
      icon: IdCard,
      label: "SLMC no.",
      value: d.slmcRegistrationNo ?? "Not provided",
      missing: !d.slmcRegistrationNo,
    },
    ...(showRegNo ? [{ icon: Hash, label: "Reg. number", value: d.registrationNumber! }] : []),
    ...(d.email ? [{ icon: Mail, label: "Email", value: d.email }] : []),
    ...(d.phone ? [{ icon: Phone, label: "Phone", value: d.phone }] : []),
    ...(d.createdAt
      ? [{ icon: CalendarDays, label: "Joined", value: fmtDate(d.createdAt, locale as any) }]
      : []),
  ];

  return (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      {/* Identity */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View>
          <Avatar name={d.name ?? "?"} size="lg" />
          {verified ? (
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                borderRadius: 12,
                backgroundColor: colors.surface,
                padding: 2,
              }}
            >
              <BadgeCheck size={20} color={colors.surface} fill={colors.success} strokeWidth={2.2} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title.lg, { color: colors.text }]} numberOfLines={1}>
            {d.name ?? "Unnamed"}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]} numberOfLines={1}>
            {d.specialization ?? "General practice"}
            {typeof d.experience === "number" && d.experience > 0 ? ` · ${d.experience} yrs` : ""}
          </Text>
        </View>
      </View>

      {/* Verification status banner */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          backgroundColor: verified ? colors.successSoft : colors.warningSoft,
        }}
      >
        {verified ? (
          <ShieldCheck size={20} color={colors.success} strokeWidth={2.2} />
        ) : (
          <ShieldAlert size={20} color={colors.warning} strokeWidth={2.2} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.label.md, { color: verified ? colors.success : colors.warning }]}>
            {verified ? "SLMC verified" : "Awaiting SLMC verification"}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
            {verified
              ? `Verified on ${fmtDate(d.slmcVerifiedAt!, locale as any)}`
              : d.slmcRegistrationNo
              ? "Check the number against the SLMC register before verifying."
              : "No SLMC number on file — confirm with SLMC before verifying."}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View
        style={{
          borderRadius: radius.lg,
          borderCurve: "continuous",
          backgroundColor: colors.surfaceMuted,
          paddingHorizontal: spacing.md,
        }}
      >
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <View
              key={r.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: colors.separator,
              }}
            >
              <Icon size={16} color={colors.textSubtle} strokeWidth={2.2} />
              <Text style={[typography.body.sm, { color: colors.textMuted, width: 92 }]}>{r.label}</Text>
              <Text
                style={[
                  typography.label.md,
                  { color: r.missing ? colors.danger : colors.text, flex: 1, textAlign: "right" },
                ]}
                numberOfLines={1}
                ellipsizeMode="middle"
                selectable
              >
                {r.value}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View style={{ gap: spacing.sm }}>
        {verified ? null : (
          <Button title="Verify SLMC registration" icon={BadgeCheck} onPress={onVerify} loading={busy} />
        )}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Full account" variant="secondary" icon={UserRound} onPress={onViewAccount} />
          </View>
          {verified ? (
            <View style={{ flex: 1 }}>
              <Button title="Revoke" variant="danger" icon={ShieldOff} onPress={onRevoke} loading={busy} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function EmptyDoctors({
  filter,
  onShowAll,
}: {
  filter: string;
  onShowAll?: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const caughtUp = filter === "unverified";
  const Icon = caughtUp ? BadgeCheck : Stethoscope;
  return (
    <AdminCard style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: caughtUp ? colors.successSoft : colors.well,
        }}
      >
        <Icon size={28} color={caughtUp ? colors.success : colors.textMuted} strokeWidth={2.2} />
      </View>
      <Text style={[typography.title.lg, { color: colors.text, marginTop: spacing.lg }]}>
        {caughtUp ? "All doctors verified" : filter === "verified" ? "No verified doctors yet" : "No doctors yet"}
      </Text>
      <Text
        style={[typography.body.sm, { color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 280 }]}
      >
        {caughtUp
          ? "New doctor sign-ups needing an SLMC check will appear here."
          : filter === "verified"
          ? "Doctors appear here once you verify their SLMC registration."
          : "Doctors will appear here once they sign up."}
      </Text>
      {onShowAll ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button title="Show all doctors" size="sm" variant="secondary" onPress={onShowAll} />
        </View>
      ) : null}
    </AdminCard>
  );
}

function DoctorRow({
  d,
  onPress,
}: {
  d: AdminDoctorRow;
  onPress: () => void;
}) {
  const { colors, spacing, typography, fontFamily } = useTheme();
  const verified = !!d.slmcVerifiedAt;
  const hasSlmc = !!d.slmcRegistrationNo;
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${d.name ?? "Unnamed"}, ${verified ? "verified" : "not verified"}`}
      style={({ pressed }: { pressed: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <View>
        <Avatar name={d.name ?? "?"} size={44} />
        {verified ? (
          <View
            style={{
              position: "absolute",
              right: -3,
              bottom: -3,
              borderRadius: 10,
              backgroundColor: colors.surface,
              padding: 1.5,
            }}
          >
            <BadgeCheck size={16} color={colors.surface} fill={colors.success} strokeWidth={2.2} />
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
          {d.name ?? "Unnamed"}
        </Text>
        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 1 }]} numberOfLines={1}>
          {d.specialization ?? "General practice"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {hasSlmc ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 7,
                height: 20,
                borderRadius: 6,
                backgroundColor: colors.well,
              }}
            >
              <Text style={[typography.label.xs, { color: colors.textSubtle, letterSpacing: 0.3 }]}>SLMC</Text>
              <Text style={[typography.label.xs, { color: colors.text, fontFamily: fontFamily.mono }]}>
                {d.slmcRegistrationNo}
              </Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 7,
                height: 20,
                borderRadius: 6,
                backgroundColor: colors.dangerSoft,
              }}
            >
              <AlertTriangle size={10} color={colors.danger} strokeWidth={2.6} />
              <Text style={[typography.label.xs, { color: colors.danger }]}>No SLMC no.</Text>
            </View>
          )}
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

      {verified ? (
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
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            height: 30,
            paddingLeft: 12,
            paddingRight: 8,
            borderRadius: 15,
            backgroundColor: colors.warningSoft,
          }}
        >
          <Text style={[typography.label.sm, { color: colors.warning }]}>Review</Text>
          <ChevronRight size={14} color={colors.warning} strokeWidth={2.6} />
        </View>
      )}
    </Pressable>
  );
}
