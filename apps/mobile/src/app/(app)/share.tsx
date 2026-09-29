// @ts-nocheck

import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Share as RNShare,
  RefreshControl,
  StyleSheet,
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
  ShieldCheck,
  Lock,
  Globe,
  ArrowRight,
  Sparkles,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
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
  Pill,
  Pressable,
  EmptyState,
  BottomSheet,
  FormField,
  TextInput,
  ErrorState,
  Skeleton,
  useToast,
} from "@/components/ui";

type FilterTab = "all" | "active" | "expired";

export default function ShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillFmId?: string;
    prefillFmName?: string;
  }>();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();
  const segOn = {
    backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface,
    ...(scheme === "dark" ? null : shadow.xs),
  };
  const toast = useToast();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isLoading, isError, refetch, isFetching } = useShareLinks();
  const create = useCreateShareLink();
  const revoke = useRevokeShareLink();

  const DURATIONS = [
    { value: 1, label: "1 Hour", sub: "Quick consult" },
    { value: 24, label: "24 Hours", sub: "Appointment" },
    { value: 168, label: "7 Days", sub: "Follow-up" },
    { value: 720, label: "30 Days", sub: "Treatment" },
  ];

  const QUICK_LABELS = [
    "Doctor Consultation",
    "Second Opinion",
    "Hospital Admission",
  ];

  const links: ShareLink[] = data?.links || [];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("all");
  const [hours, setHours] = useState(24);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [prefillFmId, setPrefillFmId] = useState<string | null>(null);
  const [prefillFmName, setPrefillFmName] = useState<string | null>(null);

  useEffect(() => {
    if (params.prefillFmId) {
      setPrefillFmId(String(params.prefillFmId));
      setPrefillFmName(
        params.prefillFmName ? String(params.prefillFmName) : null
      );
      setSheetOpen(true);
    }
  }, [params.prefillFmId, params.prefillFmName]);

  async function onCreate() {
    try {
      const res = await create.mutateAsync({
        label: label.trim() || t("share.link.labelFallback"),
        scope,
        expiresInHours: hours,
        familyMemberId: prefillFmId,
      });
      setSheetOpen(false);
      setLabel("");
      setPrefillFmId(null);
      setPrefillFmName(null);
      toast.show(t("share.toast.created", { defaultValue: "Share link created" }), "success");
    } catch (e: any) {
      toast.show(e?.message || t("share.toast.createError"), "danger");
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
      toast.show(e?.message || t("share.toast.shareError"), "danger");
    }
  }

  async function onCopyLink(link: ShareLink) {
    try {
      const base = getPublicBaseUrl();
      const url = `${base}/share/${link.token}`;
      await Clipboard.setStringAsync(url);
      toast.show("Link copied to clipboard", "success");
    } catch {
      toast.show("Failed to copy link", "danger");
    }
  }

  function onRevoke(link: ShareLink) {
    Alert.alert(
      t("share.deleteConfirm.title", { defaultValue: "Revoke Share Link?" }),
      t("share.deleteConfirm.body", {
        defaultValue:
          "Anyone who has this link will immediately lose access to your records.",
      }),
      [
        { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
        {
          text: t("share.link.revokeButton", { defaultValue: "Revoke Access" }),
          style: "destructive",
          onPress: async () => {
            try {
              await revoke.mutateAsync(link.id);
              toast.show(t("share.toast.revoked", {
                  defaultValue: "Link revoked successfully",
                }), "success");
            } catch (e: any) {
              toast.show(e?.message || t("share.toast.revokeError"), "danger");
            }
          },
        },
      ]
    );
  }

  function isExpired(l: ShareLink) {
    return new Date(l.expiresAt) < new Date();
  }

  const activeLinks = useMemo(
    () => links.filter((l) => !l.revoked && !isExpired(l)),
    [links]
  );
  const expiredLinks = useMemo(
    () => links.filter((l) => l.revoked || isExpired(l)),
    [links]
  );

  const displayedLinks = useMemo(() => {
    if (filterTab === "active") return activeLinks;
    if (filterTab === "expired") return expiredLinks;
    return links;
  }, [links, activeLinks, expiredLinks, filterTab]);

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("share.title", { defaultValue: "Share with doctor" })}
        subtitle={t("share.subtitle", {
          defaultValue: "Time-limited, encrypted access to your record",
        })}
        kicker="PATIENT ACCESS"
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
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro: what a share link is, in plain words ── */}
        <Card style={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LinkIcon size={22} color={colors.primary} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {t("share.intro.title", "Private link for your doctor")}
              </Text>
              <Text style={[typography.body.sm, { color: colors.textMuted, lineHeight: 20 }]}>
                {t(
                  "share.intro.body",
                  "Your doctor opens it in any browser — no app or account needed."
                )}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {[
              { icon: Globe, label: t("share.intro.anyDevice", "Any device") },
              { icon: Clock, label: t("share.intro.expires", "Auto-expires") },
              { icon: Lock, label: t("share.intro.revoke", "Revoke anytime") },
            ].map(({ icon: Icon, label: text }) => (
              <View
                key={text}
                style={{
                  flex: 1,
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: spacing.sm + 2,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                }}
              >
                <Icon size={16} color={colors.primary} strokeWidth={2.3} />
                <Text style={[typography.caption, { color: colors.text, fontWeight: "600" }]} numberOfLines={1}>
                  {text}
                </Text>
              </View>
            ))}
          </View>

          <Button
            title={t("share.createButton", { defaultValue: "Create share link" })}
            icon={Plus}
            onPress={() => setSheetOpen(true)}
            size="lg"
          />
        </Card>

        {/* ── Segmented Filter Tabs ── */}
        {links.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.fill,
            padding: 3,
            gap: 2,
            borderRadius: 12,
            borderCurve: "continuous",
          }}
        >
          <Pressable
            onPress={() => setFilterTab("all")}
            style={{
              flex: 1,
              minHeight: 34,
              paddingVertical: 8,
              borderRadius: 10,
              borderCurve: "continuous",
              ...(filterTab === "all" ? segOn : { backgroundColor: "transparent" }),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={[
                typography.label.md,
                { color: filterTab === "all" ? colors.text : colors.textMuted },
              ]}
            >
              All ({links.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilterTab("active")}
            style={{
              flex: 1,
              minHeight: 34,
              paddingVertical: 8,
              borderRadius: 10,
              borderCurve: "continuous",
              ...(filterTab === "active" ? segOn : { backgroundColor: "transparent" }),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={[
                typography.label.md,
                { color: filterTab === "active" ? colors.text : colors.textMuted },
              ]}
            >
              Active ({activeLinks.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilterTab("expired")}
            style={{
              flex: 1,
              minHeight: 34,
              paddingVertical: 8,
              borderRadius: 10,
              borderCurve: "continuous",
              ...(filterTab === "expired" ? segOn : { backgroundColor: "transparent" }),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={[
                typography.label.md,
                { color: filterTab === "expired" ? colors.text : colors.textMuted },
              ]}
            >
              Expired ({expiredLinks.length})
            </Text>
          </Pressable>
        </View>
        ) : null}

        {/* ── Links List ── */}
        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton width="100%" height={110} radius={radius.card} />
            <Skeleton width="100%" height={110} radius={radius.card} />
          </View>
        ) : isError ? (
          <ErrorState
            title={t("common.errorTitle", { defaultValue: "Failed to load" })}
            message={t("common.errorLoad", {
              defaultValue: "Could not retrieve share links.",
            })}
            actionLabel={t("common.retry", { defaultValue: "Retry" })}
            onAction={() => refetch()}
          />
        ) : links.length === 0 ? null : displayedLinks.length === 0 ? (
          <Card
            style={{
              padding: spacing.xl,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              }}
            >
              <Share2 size={26} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, marginBottom: 4, textAlign: "center" },
              ]}
            >
              {filterTab === "active"
                ? "No active share links"
                : filterTab === "expired"
                ? "No expired links"
                : "No share links created yet"}
            </Text>
            <Text
              style={[
                typography.body.sm,
                {
                  color: colors.textMuted,
                  textAlign: "center",
                  marginBottom: filterTab === "all" ? spacing.lg : 0,
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              {filterTab === "active"
                ? "Generate a new time-limited link when you want to share records with a doctor."
                : filterTab === "expired"
                ? "Past expired links will be archived here."
                : "Generate a secure link to share your medical summary with a healthcare professional."}
            </Text>
          </Card>
        ) : (
          displayedLinks.map((l) => {
            const expired = isExpired(l);
            const isRevoked = !!l.revoked;
            const isLinkActive = !expired && !isRevoked;

            return (
              <Card
                key={l.id}
                variant={isLinkActive ? "flat" : "muted"}
                style={{
                  padding: spacing.lg,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  {/* Status-aware Icon */}
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      backgroundColor: isLinkActive
                        ? colors.successSoft
                        : isRevoked
                        ? colors.dangerSoft
                        : colors.fill,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isLinkActive ? (
                      <Share2 size={19} color={colors.success} />
                    ) : isRevoked ? (
                      <XCircle size={19} color={colors.danger} />
                    ) : (
                      <Clock size={20} color={colors.textMuted} />
                    )}
                  </View>

                  {/* Details */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={[
                          typography.title.sm,
                          {
                            color: isLinkActive ? colors.text : colors.textMuted,
                            flex: 1,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {l.label || t("share.link.labelFallback")}
                      </Text>
                      <Pill
                        label={
                          isRevoked
                            ? "Revoked"
                            : expired
                            ? "Expired"
                            : "Active"
                        }
                        tone={
                          isRevoked
                            ? "danger"
                            : expired
                            ? "neutral"
                            : "success"
                        }
                        size="sm"
                      />
                    </View>

                    {/* Scope & family member */}
                    <Text
                      style={[typography.body.sm, { color: colors.textMuted, marginBottom: 2 }]}
                      numberOfLines={1}
                    >
                      {[
                        l.scope === "recent6m"
                          ? t("share.scope.recent", "Last 6 months")
                          : t("share.scope.full", "Full record"),
                        l.familyMemberId
                          ? l.familyMember?.name || prefillFmName || t("share.familyMember", "Family member")
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>

                    {/* Timestamp */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Clock size={12} color={colors.textSubtle} />
                      <Text style={[typography.caption, { color: colors.textSubtle }]}>
                        {isLinkActive
                          ? `Expires ${fmtDateTime(
                              new Date(l.expiresAt),
                              locale
                            )}`
                          : isRevoked
                          ? "Access manually revoked"
                          : `Expired on ${fmtDate(
                              new Date(l.expiresAt),
                              locale
                            )}`}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Active Link Actions Toolbar */}
                {isLinkActive && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: spacing.md,
                      paddingTop: spacing.md,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    <Pressable
                      onPress={() => onShareLink(l)}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        backgroundColor: colors.primary,
                        height: 38,
                        borderRadius: 19,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Share2 size={14} color={colors.onPrimary} />
                      <Text
                        style={[typography.label.md, { color: colors.onPrimary }]}
                      >
                        Share
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onCopyLink(l)}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        backgroundColor: colors.primarySoft,
                        height: 38,
                        borderRadius: 19,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Copy size={14} color={colors.primary} />
                      <Text
                        style={[typography.label.md, { color: colors.primary }]}
                      >
                        Copy Link
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onRevoke(l)}
                      accessibilityRole="button"
                      accessibilityLabel="Revoke link"
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: colors.dangerSoft,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                )}
              </Card>
            );
          })
        )}

        {/* ── What the doctor sees ── */}
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase", paddingHorizontal: 2 }]}>
            {t("share.sees.title", "What your doctor sees")}
          </Text>
          <Card style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.md }}>
              {[
                t("share.sees.meds", "Prescriptions & doses"),
                t("share.sees.allergies", "Allergies"),
                t("share.sees.labs", "Vitals & lab reports"),
                t("share.sees.timeline", "Visits & timeline"),
              ].map((text) => (
                <View key={text} style={{ width: "50%", flexDirection: "row", alignItems: "center", gap: 8, paddingRight: spacing.sm }}>
                  <CheckCircle2 size={16} color={colors.success} strokeWidth={2.4} />
                  <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>{text}</Text>
                </View>
              ))}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingTop: spacing.md,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
              }}
            >
              <Lock size={14} color={colors.textSubtle} />
              <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                {t(
                  "share.sees.excluded",
                  "Read-only. Your login, payments and private notes are never included."
                )}
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* ── Modern Create Share Link Bottom Sheet ── */}
      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => {
          setSheetOpen(false);
          setPrefillFmId(null);
          setPrefillFmName(null);
        }}
        title="Create Secure Share Link"
      >
        <View style={{ gap: spacing.md }}>
          {prefillFmId && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                padding: spacing.md,
                backgroundColor: colors.primarySoft,
                borderRadius: 14,
                borderCurve: "continuous",
              }}
            >
              <User size={16} color={colors.primary} />
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.text, flex: 1, lineHeight: 18 },
                ]}
              >
                Scoping access specifically to:{" "}
                <Text style={{ fontWeight: "700" }}>
                  {prefillFmName || "Family Member"}
                </Text>
              </Text>
            </View>
          )}

          {/* Label Field */}
          <FormField label="Purpose / Label">
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Dr. Silva Consultation"
              placeholderTextColor={colors.textSubtle}
              style={{
                backgroundColor: colors.fill,
                borderRadius: 14,
                borderCurve: "continuous",
                padding: spacing.md,
                minHeight: 48,
                color: colors.text,
                fontSize: 16,
              }}
            />
            {/* Quick Suggestion Chips */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
                marginTop: spacing.sm,
              }}
            >
              {QUICK_LABELS.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setLabel(item)}
                  style={{
                    backgroundColor: colors.fill,
                    paddingHorizontal: 12,
                    height: 30,
                    justifyContent: "center",
                    borderRadius: 15,
                  }}
                >
                  <Text
                    style={[typography.label.sm, { color: colors.textMuted }]}
                  >
                    + {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </FormField>

          {/* Scope Selector */}
          <FormField label="Records Included">
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setScope("all")}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor:
                    scope === "all" ? colors.primarySoft : colors.fill,
                  borderWidth: 1.5,
                  borderColor:
                    scope === "all" ? colors.primary : "transparent",
                }}
              >
                <Text
                  style={[
                    typography.title.xs,
                    { color: scope === "all" ? colors.primary : colors.text, marginBottom: 2 },
                  ]}
                >
                  Full History
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Complete medical timeline
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setScope("recent6m")}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor:
                    scope === "recent6m"
                      ? colors.primarySoft
                      : colors.fill,
                  borderWidth: 1.5,
                  borderColor:
                    scope === "recent6m" ? colors.primary : "transparent",
                }}
              >
                <Text
                  style={[
                    typography.title.xs,
                    { color: scope === "recent6m" ? colors.primary : colors.text, marginBottom: 2 },
                  ]}
                >
                  Last 6 Months
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Recent care & medications
                </Text>
              </Pressable>
            </View>
          </FormField>

          {/* Duration Selector */}
          <FormField label="Link Expiration Duration">
            <View
              style={{
                flexDirection: "row",
                gap: 6,
              }}
            >
              {DURATIONS.map((d) => {
                const isSelected = hours === d.value;
                return (
                  <Pressable
                    key={d.value}
                    onPress={() => setHours(d.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      alignItems: "center",
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.fill,
                    }}
                  >
                    <Text
                      style={[
                        typography.label.md,
                        { color: isSelected ? colors.onPrimary : colors.text, marginBottom: 2 },
                      ]}
                    >
                      {d.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: isSelected
                          ? colors.onPrimary
                          : colors.textMuted,
                        opacity: isSelected ? 0.8 : 1,
                      }}
                    >
                      {d.sub}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          {/* Security Advisory */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              padding: spacing.md,
              backgroundColor: colors.warningSoft,
              borderRadius: 14,
              borderCurve: "continuous",
            }}
          >
            <Lock size={15} color={colors.warning} />
            <Text
              style={[
                typography.caption,
                { color: colors.text, flex: 1 },
              ]}
            >
              Anyone with this link can view the selected records until it
              expires. You can revoke it anytime.
            </Text>
          </View>

          {/* Sheet Actions */}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 4 }}>
            <Button
              title={t("common.cancel", { defaultValue: "Cancel" })}
              variant="outline"
              onPress={() => setSheetOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              title="Generate Link"
              icon={CheckCircle2}
              onPress={onCreate}
              loading={create.isPending}
              variant="primary"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}