// @ts-nocheck
// Pharmacy prescription detail: dispense (single-use token) or reject.
// Mirrors web `portal/(portal)/pharmacy/[id]` + doctor detail rhythm.

import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Pill,
  Stethoscope,
  PackageCheck,
  XCircle,
  CalendarDays,
  UserRound,
} from "lucide-react-native";
import {
  usePharmacyPrescription,
  usePharmacyDispense,
  usePharmacyReject,
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
  IconTile,
  useToast,
} from "@/components/ui";

export default function PharmacistPrescriptionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const locale = useLocaleStore((s) => s.locale);

  const { data, isLoading, isError, refetch } = usePharmacyPrescription(id);
  const dispense = usePharmacyDispense();
  const reject = usePharmacyReject();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const rx = data?.prescription;
  const status: string = rx?.status ?? "";
  const isSigned = status === "signed";

  async function onDispense() {
    if (!id) return;
    try {
      await dispense.mutateAsync({ id, dispenseToken: rx?.dispenseToken });
      toast.show(t("pharmacy.dispensed"), "success");
      router.back();
    } catch (e: any) {
      if (e?.message === "TOKEN_MISSING") {
        toast.show(t("pharmacy.tokenMissing"), "danger");
      } else {
        toast.show(e?.message || t("common.error"), "danger");
      }
    }
  }

  async function onRejectConfirm() {
    if (!id) return;
    try {
      await reject.mutateAsync({ id, reason: rejectReason.trim() || undefined });
      setRejectOpen(false);
      setRejectReason("");
      toast.show(t("pharmacy.rejected"), "success");
      router.back();
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("pharmacy.detailTitle")}
        subtitle={rx?.patient?.name ?? ""}
        kicker="PHARMACY"
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
        {isLoading ? (
          <Skeleton height={200} radius={20} />
        ) : isError || !rx ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            {/* Patient + status */}
            <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile icon={UserRound} tone="primary" appearance="soft" size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {rx.patient?.name ?? "—"}
                  </Text>
                  {rx.patient?.nic ? (
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      NIC {rx.patient.nic}
                    </Text>
                  ) : null}
                </View>
                <Chip label={t(`pharmacy.filters.${status}`, { defaultValue: status })} />
              </View>
              {rx.createdAt ? (
                <Text style={[typography.caption, { color: colors.textSubtle }]}>
                  <CalendarDays size={12} /> {fmtDate(new Date(rx.createdAt), locale)}
                </Text>
              ) : null}
              {rx.diagnosis ? (
                <Text style={[typography.body.md, { color: colors.text, lineHeight: 22 }]}>
                  {rx.diagnosis}
                </Text>
              ) : null}
              {rx.notes ? (
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  {rx.notes}
                </Text>
              ) : null}
            </Card>

            {/* Medicines */}
            <Card style={{ padding: spacing.lg }}>
              <Text
                style={[
                  typography.kicker,
                  { color: colors.textSubtle, marginBottom: spacing.sm, textTransform: "uppercase" },
                ]}
              >
                {t("pharmacy.medicines")}
              </Text>
              {rx.medicines?.length ? (
                <View>
                  {rx.medicines.map((med: any, i: number) => (
                    <View
                      key={med.id || i}
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: spacing.md,
                        paddingVertical: spacing.md,
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderColor: colors.separator,
                      }}
                    >
                      <IconTile icon={Pill} tone="primary" appearance="soft" size={36} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[typography.title.sm, { color: colors.text }]}>
                          {med.name}
                        </Text>
                        <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                          {[med.dosage, med.frequency, med.timing].filter(Boolean).join(" · ")}
                        </Text>
                        {med.instructions ? (
                          <Text style={[typography.caption, { color: colors.textSubtle, marginTop: 2 }]}>
                            {med.instructions}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>—</Text>
              )}
            </Card>

            {/* Prescriber */}
            {rx.doctorName ? (
              <Card style={{ padding: spacing.lg }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <IconTile icon={Stethoscope} tone="success" appearance="solid" size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.title.sm, { color: colors.text }]}>
                      {rx.doctorName}
                    </Text>
                    {rx.doctorSpecialization ? (
                      <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}>
                        {rx.doctorSpecialization}
                        {rx.doctorSlmcNo ? ` · SLMC ${rx.doctorSlmcNo}` : ""}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            ) : null}

            {/* Actions */}
            {isSigned ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t("pharmacy.dispense")}
                    icon={PackageCheck}
                    size="lg"
                    onPress={onDispense}
                    loading={dispense.isPending}
                    disabled={dispense.isPending || reject.isPending}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t("pharmacy.reject")}
                    icon={XCircle}
                    variant="danger"
                    size="lg"
                    onPress={() => setRejectOpen(true)}
                    disabled={dispense.isPending || reject.isPending}
                  />
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Reject sheet */}
      <BottomSheet
        visible={rejectOpen}
        onDismiss={() => setRejectOpen(false)}
        title={t("pharmacy.reject")}
      >
        <View style={{ gap: spacing.md }}>
          <FormField label={t("pharmacy.rejectReason")}>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t("pharmacy.rejectPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              multiline
            />
          </FormField>
          <Button
            title={t("pharmacy.reject")}
            icon={XCircle}
            variant="danger"
            size="lg"
            onPress={onRejectConfirm}
            loading={reject.isPending}
            disabled={reject.isPending}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
