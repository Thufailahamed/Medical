// @ts-nocheck
// Operator claim detail: decide (approve/reject/more-info) and record
// payment. Claim messages are read-only here.

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Banknote,
  FileText,
  MessageSquare,
} from "lucide-react-native";
import {
  useOperatorClaim,
  useDecideOperatorClaim,
  usePayOperatorClaim,
} from "@/hooks/useApi";
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
  Divider,
} from "@/components/ui";

const ACTIONABLE = ["submitted", "under_review", "more_info_needed"];

export default function OperatorClaimDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const detail = useOperatorClaim(id);
  const decide = useDecideOperatorClaim();
  const pay = usePayOperatorClaim();

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [transactionRef, setTransactionRef] = useState("");

  const c = detail.data?.claim;
  const status: string = c?.status ?? "";
  const actionable = ACTIONABLE.includes(status);
  const payable = status === "approved";

  async function onDecide(decision: "approve" | "reject" | "more_info") {
    if (!id) return;
    const parsed = amount.trim() === "" ? undefined : Number(amount);
    if (decision === "approve" && amount.trim() !== "" && (!Number.isFinite(parsed) || (parsed as number) < 0)) {
      toast.show(t("common.error"), "danger");
      return;
    }
    try {
      await decide.mutateAsync({
        id,
        decision,
        amountApprovedLkr: decision === "approve" ? parsed : undefined,
        remarks: remarks.trim() || undefined,
      });
      setAmount("");
      setRemarks("");
      toast.show(t("operator.decided"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  async function onPay() {
    if (!id) return;
    if (!transactionRef.trim()) {
      toast.show(t("operator.transactionRef"), "danger");
      return;
    }
    const parsed = amount.trim() === "" ? undefined : Number(amount);
    try {
      await pay.mutateAsync({
        id,
        amountApprovedLkr: parsed,
        transactionRef: transactionRef.trim(),
      });
      setPayOpen(false);
      setAmount("");
      setTransactionRef("");
      toast.show(t("operator.paidToast"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={c?.policyNumber ?? t("operator.claimsTitle")}
        subtitle={c?.patientName ?? ""}
        kicker="INSURANCE"
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
        ) : detail.isError || !c ? (
          <ErrorState onRetry={() => detail.refetch()} />
        ) : (
          <>
            <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]}>
                  {c.treatmentType ?? c.diagnosis ?? "—"}
                </Text>
                <Chip label={t(`operator.statuses.${status}`, { defaultValue: status })} />
              </View>
              <Text style={[typography.body.md, { color: colors.text }]}>
                {t("operator.amountRequested")}: LKR {Number(c.amountRequestedLkr ?? 0).toLocaleString()}
              </Text>
              {typeof c.amountApprovedLkr === "number" ? (
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>
                  {t("operator.amountApproved")}: LKR {Number(c.amountApprovedLkr).toLocaleString()}
                </Text>
              ) : null}
              {c.facility ? (
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>{c.facility}</Text>
              ) : null}
              {c.diagnosis && c.treatmentType ? (
                <Text style={[typography.body.sm, { color: colors.textMuted }]}>{c.diagnosis}</Text>
              ) : null}
              {c.insurerRemarks ? (
                <Text style={[typography.caption, { color: colors.textSubtle }]}>{c.insurerRemarks}</Text>
              ) : null}
            </Card>

            {/* Documents */}
            {c.documents?.length ? (
              <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <FileText size={18} color={colors.primary} />
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {c.documents.length} documents
                  </Text>
                </View>
                {c.documents.map((d: any, i: number) => (
                  <View key={d.id ?? i}>
                    {i > 0 ? <Divider /> : null}
                    <Text style={[typography.body.sm, { color: colors.textMuted, paddingVertical: spacing.xs }]}>
                      {d.kind ?? "document"}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}

            {/* Messages (read-only) */}
            {c.messages?.length ? (
              <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <MessageSquare size={18} color={colors.primary} />
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {c.messages.length} messages
                  </Text>
                </View>
                {c.messages.slice(0, 10).map((m: any, i: number) => (
                  <View key={m.id ?? i}>
                    {i > 0 ? <Divider /> : null}
                    <View style={{ paddingVertical: spacing.xs, gap: 2 }}>
                      <Text style={[typography.caption, { color: colors.textSubtle }]}>
                        {m.senderName ?? m.senderRole ?? ""}
                      </Text>
                      <Text style={[typography.body.sm, { color: colors.text }]}>
                        {m.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}

            {/* Decision actions */}
            {actionable ? (
              <Card style={{ padding: spacing.lg, gap: spacing.md }}>
                <FormField label={t("operator.approvedAmount")}>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSubtle}
                  />
                </FormField>
                <FormField label={t("operator.remarks")}>
                  <TextInput
                    value={remarks}
                    onChangeText={setRemarks}
                    placeholder={t("operator.remarksPlaceholder")}
                    placeholderTextColor={colors.textSubtle}
                    multiline
                  />
                </FormField>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("operator.approve")}
                      icon={CheckCircle2}
                      onPress={() => onDecide("approve")}
                      loading={decide.isPending}
                      disabled={decide.isPending}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("operator.reject")}
                      icon={XCircle}
                      variant="danger"
                      onPress={() => onDecide("reject")}
                      loading={decide.isPending}
                      disabled={decide.isPending}
                    />
                  </View>
                </View>
                <Button
                  title={t("operator.requestInfo")}
                  icon={HelpCircle}
                  variant="secondary"
                  onPress={() => onDecide("more_info")}
                  loading={decide.isPending}
                  disabled={decide.isPending}
                />
              </Card>
            ) : null}

            {payable ? (
              <Button
                title={t("operator.pay")}
                icon={Banknote}
                size="lg"
                onPress={() => setPayOpen(true)}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Pay sheet */}
      <BottomSheet visible={payOpen} onDismiss={() => setPayOpen(false)} title={t("operator.pay")}>
        <View style={{ gap: spacing.md }}>
          <FormField label={t("operator.approvedAmount")}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholderTextColor={colors.textSubtle}
            />
          </FormField>
          <FormField label={t("operator.transactionRef")}>
            <TextInput
              value={transactionRef}
              onChangeText={setTransactionRef}
              placeholder={t("operator.transactionRefPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
            />
          </FormField>
          <Button
            title={t("operator.pay")}
            icon={Banknote}
            size="lg"
            onPress={onPay}
            loading={pay.isPending}
            disabled={pay.isPending}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
