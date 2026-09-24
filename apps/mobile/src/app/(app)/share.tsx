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
      toast.show({
        message: t("share.toast.created", { defaultValue: "Share link created" }),
        tone: "success",
      });
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

  async function onCopyLink(link: ShareLink) {
    try {
      const base = getPublicBaseUrl();
      const url = `${base}/share/${link.token}`;
      await Clipboard.setStringAsync(url);
      toast.show({
        message: "Link copied to clipboard",
        tone: "success",
      });
    } catch {
      toast.show({
        message: "Failed to copy link",
        tone: "danger",
      });
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
              toast.show({
                message: t("share.toast.revoked", {
                  defaultValue: "Link revoked successfully",
                }),
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
        {/* ── Clinical Sharing Overview Hero Card ── */}
        <Card
          style={{
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Globe size={20} color={colors.onPrimary} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text
                  style={[
                    typography.title.md,
                    { color: colors.text },
                  ]}
                >
                  Zero-Login Web Access
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSubtle },
                  ]}
                >
                  Direct Clinical Sharing
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor:
                  activeLinks.length > 0
                    ? colors.successSoft
                    : colors.fill,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    activeLinks.length > 0
                      ? colors.success || "#10B981"
                      : colors.textMuted,
                }}
              />
              <Text
                style={[
                  typography.label.xs,
                  {
                    color:
                      activeLinks.length > 0
                        ? colors.success
                        : colors.textMuted,
                  },
                ]}
              >
                {activeLinks.length}{" "}
                {activeLinks.length === 1 ? "Active Link" : "Active Links"}
              </Text>
            </View>
          </View>

          <Text
            style={[
              typography.body.sm,
              {
                color: colors.textMuted,
                marginBottom: spacing.lg,
              },
            ]}
          >
            Create secure, time-limited links that doctors or clinics can open on
            any device. No app installation or patient portal account is
            required for the doctor.
          </Text>

          {/* Dual Stat Metrics Strip */}
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: colors.fill,
                borderRadius: 16,
                borderCurve: "continuous",
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.successSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Share2 size={16} color={colors.success} />
              </View>
              <View>
                <Text
                  style={[typography.display.sm, { color: colors.text }]}
                >
                  {activeLinks.length}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textSubtle }]}
                >
                  Active Now
                </Text>
              </View>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: colors.fill,
                borderRadius: 16,
                borderCurve: "continuous",
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={16} color={colors.primary} />
              </View>
              <View>
                <Text
                  style={[typography.display.sm, { color: colors.text }]}
                >
                  {links.length}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textSubtle }]}
                >
                  Total Created
                </Text>
              </View>
            </View>
          </View>

          {/* Primary Action Button */}
          <Button
            title={t("share.createButton", {
              defaultValue: "Create New Share Link",
            })}
            icon={Plus}
            onPress={() => setSheetOpen(true)}
            size="md"
            variant="primary"
            style={{ width: "100%" }}
          />
        </Card>

        {/* ── Segmented Filter Tabs ── */}
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
        ) : displayedLinks.length === 0 ? (
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
            {filterTab === "all" && (
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onPress={() => setSheetOpen(true)}
              >
                Create Share Link
              </Button>
            )}
          </Card>
        ) : (
          displayedLinks.map((l) => {
            const expired = isExpired(l);
            const isRevoked = !!l.revoked;
            const isLinkActive = !expired && !isRevoked;

            return (
              <Card
                key={l.id}
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
                          typography.title.md,
                          {
                            color: colors.text,
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

                    {/* Scope & Family Member Badges */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <Pill
                        label={
                          l.scope === "recent6m"
                            ? "Last 6 Months"
                            : "Full Record"
                        }
                        tone="neutral"
                        size="sm"
                      />
                      {l.familyMemberId && (
                        <Pill
                          label={
                            l.familyMember?.name ||
                            prefillFmName ||
                            "Family Member"
                          }
                          tone="info"
                          size="sm"
                          icon={User}
                        />
                      )}
                    </View>

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

        {/* ── What Doctors See Transparency Card ── */}
        <Card
          style={{
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={18} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, flex: 1 },
              ]}
            >
              What data does the doctor see?
            </Text>
          </View>

          <Text
            style={[typography.body.sm, { color: colors.textMuted, marginBottom: spacing.md }]}
          >
            Links provide a clean, read-only summary optimized for clinical
            review:
          </Text>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={15} color={colors.success || "#10B981"} />
              <Text
                style={[typography.label.md, { color: colors.text, flex: 1 }]}
              >
                Active prescriptions, dosages & schedules
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color={colors.success || "#10B981"} />
              <Text
                style={[typography.label.md, { color: colors.text, flex: 1 }]}
              >
                Documented drug & food allergies
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color={colors.success || "#10B981"} />
              <Text
                style={[typography.label.md, { color: colors.text, flex: 1 }]}
              >
                Vital trends & diagnostic lab reports
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color={colors.success || "#10B981"} />
              <Text
                style={[typography.label.md, { color: colors.text, flex: 1 }]}
              >
                Medical timeline entries & consultation summaries
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: spacing.lg,
              paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
            }}
          >
            <Lock size={14} color={colors.textSubtle} />
            <Text
              style={[typography.caption, { color: colors.textSubtle, flex: 1 }]}
            >
              Account credentials, payment data, and private personal notes are
              strictly excluded.
            </Text>
          </View>
        </Card>
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