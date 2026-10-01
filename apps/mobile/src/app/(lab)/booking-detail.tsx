// @ts-nocheck
// Lab booking detail with status-gated workflow actions.
// Action visibility copies web `lab-portal/.../bookings/[id]`.

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  UserPlus,
  Truck,
  Beaker,
  Upload,
  XCircle,
  Phone,
  MapPin,
} from "lucide-react-native";
import {
  useLabBookingDetail,
  useLabPhlebotomists,
  useLabConfirmBooking,
  useLabAssignPhlebotomist,
  useLabMarkEnRoute,
  useLabCollectSample,
  useLabCompleteBooking,
  useLabCancelBooking,
} from "@/hooks/useApi";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  Skeleton,
  ErrorState,
  TextInput,
  BottomSheet,
  FormField,
  useToast,
} from "@/components/ui";

export default function LabBookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const locale = useLocaleStore((s) => s.locale);

  const detail = useLabBookingDetail(id);
  const roster = useLabPhlebotomists();
  const confirm = useLabConfirmBooking();
  const assign = useLabAssignPhlebotomist();
  const enRoute = useLabMarkEnRoute();
  const collect = useLabCollectSample();
  const complete = useLabCompleteBooking();
  const cancel = useLabCancelBooking();

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPhleb, setSelectedPhleb] = useState<any | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [resultSummary, setResultSummary] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const b = detail.data?.booking;
  const status: string = b?.status ?? "";
  const busy =
    confirm.isPending || assign.isPending || enRoute.isPending ||
    collect.isPending || complete.isPending || cancel.isPending;

  async function run(promise: Promise<any>, okMsg: string, after?: () => void) {
    try {
      await promise;
      toast.show(okMsg, "success");
      after?.();
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  function onAssign() {
    if (!id) return;
    if (selectedPhleb) {
      run(
        assign.mutateAsync({ id, phlebotomistId: selectedPhleb.id }),
        t("lab.assigned"),
        () => { setAssignOpen(false); setSelectedPhleb(null); },
      );
    } else if (manualName.trim()) {
      run(
        assign.mutateAsync({
          id,
          phlebotomistName: manualName.trim(),
          phlebotomistPhone: manualPhone.trim() || undefined,
        }),
        t("lab.assigned"),
        () => { setAssignOpen(false); setManualName(""); setManualPhone(""); },
      );
    } else {
      toast.show(t("lab.selectPhlebotomist"), "danger");
    }
  }

  const canCancel = status && !["completed", "cancelled"].includes(status);

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={b?.itemName ?? t("lab.bookingsTitle")}
        subtitle={b?.patientName ?? ""}
        kicker="LABORATORY"
        back={true}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {detail.isLoading ? (
          <Skeleton height={220} radius={20} />
        ) : detail.isError || !b ? (
          <ErrorState onRetry={() => detail.refetch()} />
        ) : (
          <>
            <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]}>
                  {b.patientName ?? "—"}
                </Text>
                <Chip label={t(`lab.statuses.${status}`, { defaultValue: status })} />
              </View>
              {b.patientPhone ? (
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  <Phone size={12} /> {b.patientPhone}
                </Text>
              ) : null}
              <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                {b.scheduledDate ? fmtDate(new Date(b.scheduledDate), locale) : ""}
                {b.scheduledTimeSlot ? ` · ${b.scheduledTimeSlot}` : ""}
                {typeof b.totalPrice === "number" ? ` · ${t("lab.price", { amount: b.totalPrice.toLocaleString() })}` : ""}
              </Text>
              {b.collectionAddress ? (
                <Text style={[typography.body.sm, { color: colors.textMuted }]} numberOfLines={2}>
                  <MapPin size={12} /> {[b.collectionAddress.line1, b.collectionAddress.city, b.collectionAddress.district].filter(Boolean).join(", ")}
                </Text>
              ) : null}
              {b.phlebotomistName ? (
                <Text style={[typography.caption, { color: colors.textSubtle }]}>
                  {b.phlebotomistName}{b.phlebotomistPhone ? ` · ${b.phlebotomistPhone}` : ""}
                </Text>
              ) : null}
              {status === "cancelled" && b.cancellationReason ? (
                <Text style={[typography.body.sm, { color: colors.danger }]}>
                  {b.cancellationReason}
                </Text>
              ) : null}
              {status === "completed" && b.resultSummary ? (
                <Text style={[typography.body.sm, { color: colors.text }]}>
                  {b.resultSummary}
                </Text>
              ) : null}
            </Card>

            {/* ── Workflow actions (status-gated, web parity) ── */}
            <View style={{ gap: spacing.sm }}>
              {status === "pending" ? (
                <Button
                  title={t("lab.confirm")}
                  icon={CheckCircle2}
                  size="lg"
                  onPress={() => id && run(confirm.mutateAsync({ id }), t("lab.confirmed"))}
                  loading={confirm.isPending}
                  disabled={busy}
                />
              ) : null}

              {status === "confirmed" || status === "pending" ? (
                <Button
                  title={t("lab.assign")}
                  icon={UserPlus}
                  size="lg"
                  variant="secondary"
                  onPress={() => setAssignOpen(true)}
                  disabled={busy}
                />
              ) : null}

              {status === "phlebotomist_assigned" ? (
                <Button
                  title={t("lab.enRoute")}
                  icon={Truck}
                  size="lg"
                  onPress={() => id && run(enRoute.mutateAsync({ id }), t("lab.saved"))}
                  loading={enRoute.isPending}
                  disabled={busy}
                />
              ) : null}

              {status === "phlebotomist_assigned" || status === "sample_collection_en_route" ? (
                <Button
                  title={t("lab.collect")}
                  icon={Beaker}
                  size="lg"
                  onPress={() => id && run(collect.mutateAsync({ id }), t("lab.saved"))}
                  loading={collect.isPending}
                  disabled={busy}
                />
              ) : null}

              {status === "sample_collected" || status === "in_progress" ? (
                <Button
                  title={t("lab.complete")}
                  icon={Upload}
                  size="lg"
                  onPress={() => setCompleteOpen(true)}
                  disabled={busy}
                />
              ) : null}

              {canCancel ? (
                <Button
                  title={t("lab.cancelBooking")}
                  icon={XCircle}
                  variant="danger"
                  onPress={() => setCancelOpen(true)}
                  disabled={busy}
                />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      {/* Assign sheet */}
      <BottomSheet visible={assignOpen} onDismiss={() => setAssignOpen(false)} title={t("lab.assign")}>
        <View style={{ gap: spacing.md }}>
          <FormField label={t("lab.selectPhlebotomist")}>
            <View style={{ gap: spacing.xs }}>
              {(roster.data?.phlebotomists ?? []).filter((p: any) => p.isActive !== false).map((p: any) => (
                <Button
                  key={p.id}
                  title={`${p.name}${p.phone ? ` · ${p.phone}` : ""}`}
                  variant={selectedPhleb?.id === p.id ? "primary" : "secondary"}
                  onPress={() => setSelectedPhleb(p)}
                />
              ))}
            </View>
          </FormField>
          <FormField label={t("lab.manualPhlebotomist")}>
            <TextInput
              value={manualName}
              onChangeText={(v: string) => { setManualName(v); setSelectedPhleb(null); }}
              placeholder={t("lab.name")}
              placeholderTextColor={colors.textSubtle}
            />
            <TextInput
              value={manualPhone}
              onChangeText={setManualPhone}
              placeholder={t("lab.phone")}
              placeholderTextColor={colors.textSubtle}
              keyboardType="phone-pad"
            />
          </FormField>
          <Button
            title={t("lab.assign")}
            icon={UserPlus}
            size="lg"
            onPress={onAssign}
            loading={assign.isPending}
            disabled={assign.isPending}
          />
        </View>
      </BottomSheet>

      {/* Complete sheet */}
      <BottomSheet visible={completeOpen} onDismiss={() => setCompleteOpen(false)} title={t("lab.complete")}>
        <View style={{ gap: spacing.md }}>
          <FormField label={t("lab.resultSummary")}>
            <TextInput
              value={resultSummary}
              onChangeText={setResultSummary}
              placeholder={t("lab.resultSummaryPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              multiline
            />
          </FormField>
          <Button
            title={t("lab.complete")}
            icon={Upload}
            size="lg"
            onPress={() =>
              id &&
              run(
                complete.mutateAsync({ id, resultSummary: resultSummary.trim() || undefined }),
                t("lab.completedToast"),
                () => { setCompleteOpen(false); setResultSummary(""); },
              )
            }
            loading={complete.isPending}
            disabled={complete.isPending}
          />
        </View>
      </BottomSheet>

      {/* Cancel sheet */}
      <BottomSheet visible={cancelOpen} onDismiss={() => setCancelOpen(false)} title={t("lab.cancelBooking")}>
        <View style={{ gap: spacing.md }}>
          <FormField label={t("lab.cancelReason")}>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder={t("lab.cancelReasonPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              multiline
            />
          </FormField>
          <Button
            title={t("lab.cancelBooking")}
            icon={XCircle}
            variant="danger"
            size="lg"
            onPress={() =>
              id &&
              run(
                cancel.mutateAsync({ id, reason: cancelReason.trim() || undefined }),
                t("lab.cancelledToast"),
                () => { setCancelOpen(false); setCancelReason(""); },
              )
            }
            loading={cancel.isPending}
            disabled={cancel.isPending}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
