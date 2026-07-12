// @ts-nocheck

import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Share as RNShare,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Share2,
  Link as LinkIcon,
  Clock,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  User,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { getPublicBaseUrl } from "@/lib/api";
import {
  useShareLinks,
  useCreateShareLink,
  useRevokeShareLink,
  type ShareLink,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  ChipGroup,
  EmptyState,
  BottomSheet,
  FormField,
  TextInput,
  ErrorState,
  Skeleton,
  useToast,
} from "@/components/ui";

export default function ShareScreen() {
  const router = useRouter();
  // Phase 2.3: prefill FM scope when navigated to from family.tsx or
  // edit-medicine.tsx. Both screens push us with prefillFmId + name.
  const params = useLocalSearchParams<{ prefillFmId?: string; prefillFmName?: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading, isError, refetch } = useShareLinks();
  const create = useCreateShareLink();
  const revoke = useRevokeShareLink();

  const DURATIONS = [
    { value: 1, key: "share.duration.1" },
    { value: 24, key: "share.duration.24" },
    { value: 168, key: "share.duration.168" },
    { value: 720, key: "share.duration.720" },
  ];

  const links: ShareLink[] = data?.links || [];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("all");
  const [hours, setHours] = useState(24);
  const [lastToken, setLastToken] = useState<string | null>(null);
  // Phase 2.3: prefill from route params (set by family.tsx or
  // edit-medicine.tsx). Persists for the lifetime of the screen; cleared
  // when the user dismisses the sheet.
  const [prefillFmId, setPrefillFmId] = useState<string | null>(null);
  const [prefillFmName, setPrefillFmName] = useState<string | null>(null);

  useEffect(() => {
    if (params.prefillFmId) {
      setPrefillFmId(String(params.prefillFmId));
      setPrefillFmName(params.prefillFmName ? String(params.prefillFmName) : null);
      setSheetOpen(true);
    }
  }, [params.prefillFmId, params.prefillFmName]);

  async function onCreate() {
    try {
      const res = await create.mutateAsync({
        label: label.trim() || t("share.link.labelFallback"),
        scope,
        expiresInHours: hours,
        // Phase 2.3: explicit familyMemberId when the user came in via
        // an FM entry point. No silent inference from the active FM
        // header — share actions are high-stakes.
        familyMemberId: prefillFmId,
      });
      setLastToken(res.token);
      setSheetOpen(false);
      setLabel("");
      setPrefillFmId(null);
      setPrefillFmName(null);
      toast.show({ message: t("share.toast.created"), tone: "success" });
    } catch (e: any) {
      toast.show({
        message: e?.message || t("share.toast.createError"),
        tone: "danger",
      });
    }
  }

  async function onShareLink(link: ShareLink) {
    try {
      const base = getPublicBaseUrl();
      const url = `${base}/share/${link.token}`;
      await RNShare.share({
        message: t("share.shareMessage", {
          label: link.label || t("share.link.labelFallback"),
          url,
          date: fmtDateTime(new Date(link.expiresAt), locale),
        }),
      });
    } catch (e: any) {
      toast.show({
        message: e?.message || t("share.toast.shareError"),
        tone: "danger",
      });
    }
  }

  function onRevoke(link: ShareLink) {
    Alert.alert(
      t("share.deleteConfirm.title"),
      t("share.deleteConfirm.body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("share.link.revokeButton"),
          style: "destructive",
          onPress: async () => {
            try {
              await revoke.mutateAsync(link.id);
              toast.show({
                message: t("share.toast.revoked"),
                tone: "success",
              });
            } catch (e: any) {
              toast.show({
                message: e?.message || t("share.toast.revokeError"),
                tone: "danger",
              });
            }
          },
        },
      ]
    );
  }

  function isExpired(l: ShareLink) {
    return new Date(l.expiresAt) < new Date();
  }

  function statusChip(l: ShareLink) {
    if (l.revoked) return { label: t("share.link.statusRevoked"), tone: "neutral" };
    if (isExpired(l)) return { label: t("share.link.statusExpired"), tone: "neutral" };
    return { label: t("share.link.statusActive"), tone: "success" };
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("share.title")}
        subtitle={t("share.subtitle")}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <LinkIcon size={20} color={colors.primary} />
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "800", flex: 1 },
              ]}
            >
              {t("share.explanation.title")}
            </Text>
          </View>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
            ]}
          >
            {t("share.explanation.body")}
          </Text>
        </Card>

        <Button
          title={t("share.createButton")}
          icon={Plus}
          onPress={() => setSheetOpen(true)}
          size="lg"
        />

        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton width="100%" height={72} radius={radius.md} />
            <Skeleton width="100%" height={72} radius={radius.md} />
            <Skeleton width="100%" height={72} radius={radius.md} />
            <Skeleton width="100%" height={72} radius={radius.md} />
          </View>
        ) : isError ? (
          <ErrorState
            style={{ marginTop: spacing.lg }}
            title={t("common.errorTitle")}
            message={t("common.errorLoad")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : links.length === 0 ? (
          <EmptyState
            icon={Share2}
            title={t("share.empty.title")}
            message={t("share.empty.message")}
          />
        ) : (
          links.map((l) => {
            const expired = isExpired(l) || l.revoked;
            const chip = statusChip(l);
            return (
              <Card key={l.id}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700", flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {l.label || t("share.link.labelFallback")}
                  </Text>
                  <Chip label={chip.label} tone={chip.tone as any} size="sm" />
                </View>
                {/* Phase 2.3: family-member scope badge. Surfaces which FM
                    this link is for, even when the user is far from the
                    family-detail screen. */}
                {l.familyMemberId ? (
                  <View style={{ marginTop: 4 }}>
                    <Chip
                      label={t("share.link.scopeForMember", {
                        name:
                          l.familyMember?.name ||
                          prefillFmName ||
                          t("share.link.scopeMemberFallback"),
                      })}
                      tone="info"
                      size="sm"
                      icon={User}
                    />
                  </View>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  <Clock size={12} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {expired
                      ? t("share.link.expiredOn", {
                          date: fmtDate(new Date(l.expiresAt), locale),
                        })
                      : t("share.link.expiresOn", {
                          date: fmtDateTime(new Date(l.expiresAt), locale),
                        })}
                  </Text>
                </View>

                {!expired && (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.xs,
                      marginTop: spacing.sm,
                    }}
                  >
                    <Button
                      title={t("share.link.shareButton")}
                      icon={Share2}
                      onPress={() => onShareLink(l)}
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <Button
                      title={t("share.link.revokeButton")}
                      icon={Trash2}
                      variant="outline"
                      tone="danger"
                      onPress={() => onRevoke(l)}
                      size="sm"
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => {
          setSheetOpen(false);
          setPrefillFmId(null);
          setPrefillFmName(null);
        }}
        title={
          prefillFmId
            ? t("share.sheet.titleForMember", {
                name: prefillFmName || t("share.link.scopeMemberFallback"),
              })
            : t("share.sheet.title")
        }
      >
        <View style={{ gap: spacing.md }}>
          {/* Phase 2.3: visible scope callout. Tells the user exactly
              which family member's data the link will expose. */}
          {prefillFmId ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                padding: spacing.sm,
                backgroundColor: colors.primarySoft,
                borderRadius: radius.md,
              }}
            >
              <User size={16} color={colors.primary} />
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.text, flex: 1, lineHeight: 18 },
                ]}
              >
                {t("share.sheet.scopingTo", {
                  name:
                    prefillFmName || t("share.link.scopeMemberFallback"),
                })}
              </Text>
            </View>
          ) : null}

          <FormField label={t("share.field.labelLabel")}>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={
                prefillFmId
                  ? t("share.field.labelPlaceholderForMember", {
                      name: prefillFmName || "",
                    })
                  : t("share.field.labelPlaceholder")
              }
              placeholderTextColor={colors.textSubtle}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </FormField>

          <FormField label={t("share.field.scopeLabel")}>
            <ChipGroup
              options={[
                { value: "all", label: t("share.scope.all") },
                { value: "recent6m", label: t("share.scope.recent6m") },
              ]}
              value={scope}
              onChange={setScope}
            />
          </FormField>

          <FormField label={t("share.field.durationLabel")}>
            <ChipGroup
              options={DURATIONS.map((d) => ({
                value: String(d.value),
                label: t(d.key),
              }))}
              value={String(hours)}
              onChange={(v) => setHours(parseInt(v, 10))}
            />
          </FormField>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              padding: spacing.sm,
              backgroundColor: colors.warningSoft,
              borderRadius: radius.md,
            }}
          >
            <XCircle size={16} color={colors.warning} />
            <Text
              style={[
                typography.caption,
                { color: colors.text, flex: 1, lineHeight: 18 },
              ]}
            >
              {t("share.sheet.warning")}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title={t("common.cancel")}
              variant="outline"
              onPress={() => setSheetOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              title={t("share.createButton")}
              icon={CheckCircle2}
              onPress={onCreate}
              loading={create.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}