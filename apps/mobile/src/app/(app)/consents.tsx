// @ts-nocheck

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ShieldCheck,
  Plus,
  Trash2,
  History,
  CheckCircle2,
  FileSignature,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  useConsentsMine,
  useConsentAudit,
  useIssueConsent,
  useRevokeConsent,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  TextInput,
  FormField,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
  Divider,
} from "@/components/ui";

const PURPOSES = [
  "care_coordination",
  "second_opinion",
  "insurance_claim",
  "research",
  "other",
] as const;

const DURATIONS = ["7", "30", "90", "365"] as const;

export default function ConsentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const locale = useLocaleStore((s) => s.locale);

  const mine = useConsentsMine();
  const audit = useConsentAudit();
  const issue = useIssueConsent();
  const revoke = useRevokeConsent();

  const [purpose, setPurpose] = useState<string>(PURPOSES[0]);
  const [durationDays, setDurationDays] = useState<string>("30");
  const [label, setLabel] = useState("");

  const grants = useMemo(() => mine.data?.items ?? [], [mine.data?.items]);
  const auditList = useMemo(() => audit.data?.items ?? [], [audit.data?.items]);
  const activeGrants = useMemo(
    () => grants.filter((c: any) => c.status === "active"),
    [grants]
  );

  async function onIssue() {
    try {
      await issue.mutateAsync({
        purpose,
        label: label.trim() || undefined,
        durationDays: Number(durationDays) || 30,
      });
      setLabel("");
      toast.show(t("consents.granted"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  function onRevoke(id: string) {
    Alert.alert(
      t("consents.revokeConfirmTitle"),
      t("consents.revokeConfirmBody"),
      [
        { text: t("consents.cancel"), style: "cancel" },
        {
          text: t("consents.revoke"),
          style: "destructive",
          onPress: async () => {
            try {
              await revoke.mutateAsync(id);
              toast.show(t("consents.revoked"), "success");
            } catch (e: any) {
              toast.show(e?.message || t("common.error"), "danger");
            }
          },
        },
      ]
    );
  }

  const isLoading = mine.isLoading || audit.isLoading;
  const isError = mine.isError || audit.isError;

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("consents.title")}
        subtitle={t("consents.subtitle")}
        kicker="PRIVACY"
        back={true}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
          paddingBottom: 120,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={(mine.isFetching && !mine.isLoading) || (audit.isFetching && !audit.isLoading)}
            onRefresh={() => {
              mine.refetch();
              audit.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Issue form ── */}
        <Card style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <FileSignature size={18} color={colors.primary} strokeWidth={2.3} />
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("consents.issueTitle")}
            </Text>
          </View>

          <FormField label={t("consents.purpose")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {PURPOSES.map((p) => (
                <Chip
                  key={p}
                  label={t(`consents.purposes.${p}`)}
                  selected={purpose === p}
                  onPress={() => setPurpose(p)}
                />
              ))}
            </View>
          </FormField>

          <FormField label={t("consents.duration")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {DURATIONS.map((d) => (
                <Chip
                  key={d}
                  label={t(`consents.durations.${d}`)}
                  selected={durationDays === d}
                  onPress={() => setDurationDays(d)}
                />
              ))}
            </View>
          </FormField>

          <FormField label={t("consents.labelHint")}>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={t("consents.labelPlaceholder")}
              placeholderTextColor={colors.textSubtle}
            />
          </FormField>

          <Button
            title={t("consents.grant")}
            icon={Plus}
            onPress={onIssue}
            loading={issue.isPending}
            disabled={issue.isPending}
            size="lg"
          />
        </Card>

        {/* ── Active grants ── */}
        <Card style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <ShieldCheck size={18} color={colors.primary} strokeWidth={2.3} />
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("consents.active")} ({activeGrants.length})
            </Text>
          </View>

          {isLoading ? (
            <Skeleton height={120} radius={16} />
          ) : isError ? (
            <ErrorState
              onRetry={() => {
                mine.refetch();
                audit.refetch();
              }}
            />
          ) : grants.length === 0 ? (
            <EmptyState
              title={t("consents.empty")}
              message={t("consents.emptyBody")}
            />
          ) : (
            grants.map((c: any, idx: number) => {
              const isActive = c.status === "active";
              return (
                <View key={c.id ?? idx}>
                  {idx > 0 ? <Divider /> : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingVertical: spacing.sm,
                    }}
                  >
                    <CheckCircle2
                      size={20}
                      color={isActive ? colors.success : colors.textMuted}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[typography.body.md, { color: colors.text, fontWeight: "600" }]}
                        numberOfLines={1}
                      >
                        {c.label || t(`consents.purposes.${c.purpose}`, { defaultValue: String(c.purpose ?? "").replace(/_/g, " ") })}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {t(`consents.purposes.${c.purpose}`, { defaultValue: String(c.purpose ?? "").replace(/_/g, " ") })}
                        {c.expiresAt ? ` · ${t("consents.expiresOn", { date: fmtDate(new Date(c.expiresAt), locale) })}` : ""}
                      </Text>
                    </View>
                    {isActive ? (
                      <Button
                        title={t("consents.revoke")}
                        icon={Trash2}
                        variant="danger"
                        size="sm"
                        onPress={() => onRevoke(c.id)}
                        loading={revoke.isPending}
                        disabled={revoke.isPending}
                      />
                    ) : (
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {String(c.status ?? "")}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* ── Audit trail ── */}
        <Card style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <History size={18} color={colors.primary} strokeWidth={2.3} />
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {t("consents.audit")} ({auditList.length})
            </Text>
          </View>

          {audit.isLoading ? (
            <Skeleton height={80} radius={16} />
          ) : auditList.length === 0 ? (
            <EmptyState title={t("consents.auditEmpty")} />
          ) : (
            auditList.slice(0, 20).map((entry: any, idx: number) => (
              <View key={entry.id ?? idx}>
                {idx > 0 ? <Divider /> : null}
                <View style={{ paddingVertical: spacing.sm, gap: 2 }}>
                  <Text
                    style={[typography.body.sm, { color: colors.text, fontWeight: "600", textTransform: "capitalize" }]}
                    numberOfLines={1}
                  >
                    {String(entry.action ?? "").replace(/_/g, " ")}
                  </Text>
                  {entry.purpose ? (
                    <Text style={[typography.caption, { color: colors.textMuted, textTransform: "capitalize" }]} numberOfLines={1}>
                      {String(entry.purpose).replace(/_/g, " ")}
                    </Text>
                  ) : null}
                  {entry.createdAt ? (
                    <Text style={[typography.caption, { color: colors.textSubtle }]}>
                      {fmtDateTime(new Date(entry.createdAt), locale)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
