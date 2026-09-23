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
  const { spacing, colors, typography, radius } = useTheme();
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
          gap: spacing.md,
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
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            padding: spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Globe size={20} color={colors.primary} />
              </View>
              <View>
                <Text
                  style={[
                    typography.title.xs,
                    { color: colors.text, fontWeight: "800", fontSize: 16 },
                  ]}
                >
                  Zero-Login Web Access
                </Text>
                <Text
                  style={[
                    typography.body.xs,
                    { color: colors.textMuted, fontSize: 11 },
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
                    ? colors.successSoft || "#ECFDF5"
                    : colors.surfaceMuted,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor:
                  activeLinks.length > 0
                    ? colors.successBorder || "#A7F3D0"
                    : colors.borderSoft,
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
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color:
                    activeLinks.length > 0
                      ? colors.success || "#059669"
                      : colors.textMuted,
                }}
              >
                {activeLinks.length}{" "}
                {activeLinks.length === 1 ? "Active Link" : "Active Links"}
              </Text>
            </View>
          </View>

          <Text
            style={[
              typography.body.xs,
              {
                color: colors.textMuted,
                lineHeight: 18,
                marginBottom: spacing.md,
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
              gap: 10,
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: colors.bg,
                borderRadius: 14,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.borderSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: colors.successSoft || "#ECFDF5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Share2 size={16} color={colors.success || "#059669"} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  {activeLinks.length}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    fontWeight: "600",
                  }}
                >
                  Active Now
                </Text>
              </View>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: colors.bg,
                borderRadius: 14,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.borderSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={16} color={colors.primary} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  {links.length}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    fontWeight: "600",
                  }}
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
            backgroundColor: colors.surface,
            padding: 4,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => setFilterTab("all")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor:
                filterTab === "all" ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: filterTab === "all" ? "#FFFFFF" : colors.textMuted,
              }}
            >
              All ({links.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilterTab("active")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor:
                filterTab === "active" ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: filterTab === "active" ? "#FFFFFF" : colors.textMuted,
              }}
            >
              Active ({activeLinks.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilterTab("expired")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor:
                filterTab === "expired" ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: filterTab === "expired" ? "#FFFFFF" : colors.textMuted,
              }}
            >
              Expired ({expiredLinks.length})
            </Text>
          </Pressable>
        </View>

        {/* ── Links List ── */}
        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton width="100%" height={90} radius={16} />
            <Skeleton width="100%" height={90} radius={16} />
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
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSoft,
              borderRadius: 16,
              padding: spacing.xl,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.sm,
              }}
            >
              <Share2 size={22} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.title.xs,
                { color: colors.text, fontWeight: "700", marginBottom: 4 },
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
                typography.body.xs,
                {
                  color: colors.textMuted,
                  textAlign: "center",
                  lineHeight: 18,
                  marginBottom: filterTab === "all" ? spacing.md : 0,
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
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: isLinkActive ? colors.primary : colors.border,
                  borderRadius: 18,
                  padding: spacing.md,
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
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: isLinkActive
                        ? colors.successSoft || "#ECFDF5"
                        : colors.bg,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: isLinkActive
                        ? colors.successBorder || "#A7F3D0"
                        : colors.borderSoft,
                    }}
                  >
                    {isLinkActive ? (
                      <Share2 size={20} color={colors.success || "#059669"} />
                    ) : isRevoked ? (
                      <XCircle size={20} color={colors.danger || "#DC2626"} />
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
                            color: colors.text,
                            fontWeight: "700",
                            fontSize: 15,
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
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
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
                      paddingTop: spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: colors.borderSoft,
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
                        paddingVertical: 9,
                        borderRadius: 10,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Share2 size={14} color="#FFFFFF" />
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontWeight: "700",
                          fontSize: 12,
                        }}
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
                        paddingVertical: 9,
                        borderRadius: 10,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Copy size={14} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.primary,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
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
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: colors.dangerSoft || "#FEE2E2",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <Trash2 size={16} color={colors.danger || "#DC2626"} />
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={18} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.title.xs,
                { color: colors.text, fontWeight: "800", fontSize: 15 },
              ]}
            >
              What data does the doctor see?
            </Text>
          </View>

          <Text
            style={{
              fontSize: 12,
              color: colors.textMuted,
              lineHeight: 18,
              marginBottom: 12,
            }}
          >
            Links provide a clean, read-only summary optimized for clinical
            review:
          </Text>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color={colors.success || "#10B981"} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.text,
                  fontWeight: "600",
                }}
              >
                Active prescriptions, dosages & schedules
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color={colors.success || "#10B981"} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.text,
                  fontWeight: "600",
                }}
              >
                Documented drug & food allergies
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color={colors.success || "#10B981"} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.text,
                  fontWeight: "600",
                }}
              >
                Vital trends & diagnostic lab reports
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color={colors.success || "#10B981"} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.text,
                  fontWeight: "600",
                }}
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
              marginTop: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.borderSoft,
            }}
          >
            <Lock size={14} color={colors.textMuted} />
            <Text
              style={{
                fontSize: 11,
                color: colors.textMuted,
                flex: 1,
                lineHeight: 16,
              }}
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
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                fontSize: 15,
              }}
            />
            {/* Quick Suggestion Chips */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 6,
              }}
            >
              {QUICK_LABELS.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setLabel(item)}
                  style={{
                    backgroundColor: colors.bg,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.borderSoft,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: colors.textMuted,
                    }}
                  >
                    + {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </FormField>

          {/* Scope Selector */}
          <FormField label="Records Included">
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setScope("all")}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor:
                    scope === "all" ? colors.primarySoft : colors.surface,
                  borderWidth: 1,
                  borderColor:
                    scope === "all" ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: scope === "all" ? colors.primary : colors.text,
                    marginBottom: 2,
                  }}
                >
                  Full History
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  Complete medical timeline
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setScope("recent6m")}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor:
                    scope === "recent6m"
                      ? colors.primarySoft
                      : colors.surface,
                  borderWidth: 1,
                  borderColor:
                    scope === "recent6m" ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color:
                      scope === "recent6m" ? colors.primary : colors.text,
                    marginBottom: 2,
                  }}
                >
                  Last 6 Months
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
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
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: isSelected ? "#FFFFFF" : colors.text,
                        marginBottom: 2,
                      }}
                    >
                      {d.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 9.5,
                        fontWeight: "600",
                        color: isSelected
                          ? "rgba(255,255,255,0.8)"
                          : colors.textMuted,
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
              gap: spacing.xs,
              padding: spacing.sm,
              backgroundColor: colors.warningSoft || "#FEF3C7",
              borderRadius: radius.md,
            }}
          >
            <Lock size={15} color={colors.warning || "#D97706"} />
            <Text
              style={[
                typography.caption,
                { color: colors.text, flex: 1, lineHeight: 17, fontSize: 11 },
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