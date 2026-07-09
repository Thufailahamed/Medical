// @ts-nocheck

import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Linking,
  Share,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong, intlLocale } from "@/lib/format";
import {
  ChevronLeft,
  FileText,
  Calendar,
  Hospital,
  User,
  ImageIcon,
  ExternalLink,
  Pill,
  Tag,
  Share2,
  Pencil,
  Users,
  Archive,
  RotateCcw,
  Trash2,
  X,
  Check,
  MoreHorizontal,
} from "lucide-react-native";
import {
  useMedicalRecord,
  useUpdateRecordTags,
  useArchiveRecord,
  useRestoreRecord,
  useMoveRecordToFamily,
  useReturnRecordToOwn,
  useDeleteRecord,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Card,
  Button,
  Pill as PillComponent,
  useToast,
  Screen,
  IconButton,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { metaFor, type RecordType } from "@/lib/recordImportance";
import { FamilyPickerSheet } from "@/components/FamilyPickerSheet";
import { TagPickerSheet } from "@/components/TagPickerSheet";

type BottomSheetAction =
  | "edit"
  | "editTags"
  | "moveToFamily"
  | "archive"
  | "restore"
  | "share"
  | "delete";

function buildTypeMeta(
  t: (k: string) => string,
  colors: any
): Record<RecordType, { label: string; icon: any; tone: string }> {
  const base = (key: string, fallback: string) =>
    t(`recordDetail.type.${key}`, { defaultValue: fallback });
  return {
    lab_report: {
      label: base("lab_report", "Lab Report"),
      icon: FileText,
      tone: "#9A7228",
    },
    prescription: {
      label: base("prescription", "Prescription"),
      icon: Pill,
      tone: colors.primary,
    },
    imaging: {
      label: base("imaging", "Imaging"),
      icon: ImageIcon,
      tone: "#4A90E2",
    },
    hospital_visit: {
      label: base("hospital_visit", "Visit"),
      icon: Hospital,
      tone: colors.primary,
    },
    vaccination: {
      label: base("vaccination", "Vaccination"),
      icon: Pill,
      tone: "#3E8E41",
    },
    surgery: {
      label: base("surgery", "Surgery"),
      icon: Hospital,
      tone: "#C4441A",
    },
    op_note: {
      label: base("op_note", "Op Note"),
      icon: FileText,
      tone: "#7A6A20",
    },
    discharge_summary: {
      label: base("discharge_summary", "Discharge"),
      icon: FileText,
      tone: "#7A6A20",
    },
    referral: {
      label: base("referral", "Referral"),
      icon: FileText,
      tone: colors.primary,
    },
    insurance: {
      label: base("insurance", "Insurance"),
      icon: FileText,
      tone: "#3E8E41",
    },
    pathology: {
      label: base("pathology", "Pathology"),
      icon: FileText,
      tone: "#9A7228",
    },
    dental: {
      label: base("dental", "Dental"),
      icon: FileText,
      tone: "#4A90E2",
    },
    other: {
      label: base("other", "Other"),
      icon: FileText,
      tone: colors.textMuted,
    },
  };
}

export default function RecordDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography, fontFamily } = useTheme();
  const toast = useToast();

  const TYPE_META = useMemo(() => buildTypeMeta(t, colors), [t, colors]);

  const { data: record, isLoading, isError, refetch } = useMedicalRecord(params.id);
  const updateTags = useUpdateRecordTags();
  const archiveRec = useArchiveRecord();
  const restoreRec = useRestoreRecord();
  const moveToFamily = useMoveRecordToFamily();
  const returnToOwn = useReturnRecordToOwn();
  const deleteRec = useDeleteRecord();

  const [showSheet, setShowSheet] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const recordId = record?.id;
  const attachments = useMemo(() => {
    if (!record) return [];
    if (Array.isArray(record.files)) return record.files;
    if (Array.isArray(record.attachments)) return record.attachments;
    return [];
  }, [record]);
  const lastActionRef = useRef<null | (() => Promise<void>)>(null);

  function doArchive() {
    if (!recordId) return;
    archiveRec.mutate(recordId, {
      onSuccess: () => {
        toast.show(t("recordDetail.toast.archived"), "success", {
          actionLabel: t("recordDetail.archivedBadge.restore"),
          onAction: () => doRestore(),
        });
      },
      onError: (err: any) =>
        toast.show(
          err?.message || t("recordDetail.toast.archiveError"),
          "danger"
        ),
    });
  }

  function doRestore() {
    if (!recordId) return;
    restoreRec.mutate(recordId, {
      onSuccess: () =>
        toast.show(t("recordDetail.toast.restored"), "success"),
      onError: (err: any) =>
        toast.show(
          err?.message || t("recordDetail.toast.restoreError"),
          "danger"
        ),
    });
  }

  function onPickFamily(memberId: string | null) {
    if (!recordId) return;
    const action = memberId ? moveToFamily : returnToOwn;
    action.mutate(
      { id: recordId, familyMemberId: memberId },
      {
        onSuccess: () => {
          toast.show(
            memberId
              ? t("recordDetail.toast.moveSuccess")
              : t("recordDetail.toast.returnSuccess"),
            "success"
          );
        },
        onError: (err: any) =>
          toast.show(
            err?.message || t("recordDetail.toast.moveError"),
            "danger"
          ),
      }
    );
  }

  function applyTags(nextTags: string[]) {
    if (!recordId) return;
    updateTags.mutate(
      { id: recordId, tags: nextTags },
      {
        onSuccess: () =>
          toast.show(t("recordDetail.toast.tagsUpdated"), "success"),
        onError: (err: any) =>
          toast.show(
            err?.message || t("recordDetail.toast.tagUpdateError"),
            "danger"
          ),
      }
    );
  }

  function doDelete(forever: boolean) {
    if (!recordId) return;
    setShowDeleteConfirm(false);
    if (forever) {
      deleteRec.mutate(recordId, {
        onSuccess: () =>
          toast.show(t("recordDetail.toast.deleted"), "success"),
        onError: (err: any) =>
          toast.show(
            err?.message || t("recordDetail.toast.deletedError"),
            "danger"
          ),
      });
    } else {
      archiveRec.mutate(recordId, {
        onSuccess: () =>
          toast.show(t("recordDetail.toast.archiveToggle"), "info", {
            actionLabel: t("recordDetail.archivedBadge.restore"),
            onAction: () => doRestore(),
          }),
        onError: (err: any) =>
          toast.show(
            err?.message || t("recordDetail.toast.archiveFailed"),
            "danger"
          ),
      });
    }
  }

  async function doShare() {
    if (!record) return;
    const diagnosis = record.diagnosis || record.summary || "";
    const followUp =
      record.followUpDate && record.followUpDate.length > 0
        ? new Date(record.followUpDate).toDateString()
        : "";
    const lines: string[] = [];
    lines.push(
      `${t("recordDetail.shareLabel.diagnosis")}: ${record.title}`
    );
    if (record.doctor?.name) {
      lines.push(
        `${t("recordDetail.shareLabel.doctor")}: ${record.doctor.name}`
      );
    }
    if (record.hospital?.name) {
      lines.push(
        `${t("recordDetail.shareLabel.hospital")}: ${record.hospital.name}`
      );
    }
    if (diagnosis) {
      lines.push(`${t("recordDetail.shareLabel.diagnosis")}: ${diagnosis}`);
    }
    if (followUp) {
      lines.push(`${t("recordDetail.shareLabel.followUp")}: ${followUp}`);
    }
    lines.push("");
    lines.push(t("recordDetail.shareFooter"));
    try {
      await Share.share({
        message: lines.join("\n"),
        title: t("recordDetail.shareTitleFallback"),
      });
    } catch {}
  }

  function onAction(act: BottomSheetAction) {
    setShowSheet(false);
    if (act === "edit") {
      router.push({
        pathname: "/(app)/edit-record",
        params: { id: params.id },
      });
      return;
    }
    if (act === "editTags") {
      setShowTagPicker(true);
      return;
    }
    if (act === "moveToFamily") {
      setShowFamilyPicker(true);
      return;
    }
    if (act === "archive") {
      doArchive();
      return;
    }
    if (act === "restore") {
      doRestore();
      return;
    }
    if (act === "share") {
      doShare();
      return;
    }
    if (act === "delete") {
      setShowDeleteConfirm(true);
      return;
    }
  }

  // Open the first attachment in the system viewer, via its r2Key.
  async function openAttachment(att: any) {
    if (!att?.r2Key) {
      toast.show(t("recordDetail.toast.noFileKey"), "warning");
      return;
    }
    const url = `${process.env.EXPO_PUBLIC_API_URL}/files/download/${encodeURIComponent(
      att.r2Key
    )}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        toast.show(t("recordDetail.toast.noFileKey"), "warning");
        return;
      }
      await Linking.openURL(url);
    } catch (err: any) {
      toast.show(
        err?.message || t("recordDetail.toast.openError"),
        "danger"
      );
    }
  }

  if (isLoading || (!record && !isError)) {
    return (
      <Screen padded={false} edges={["top"]}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="60%" height={28} radius={6} />
          <Skeleton width="40%" height={14} radius={4} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
            <Skeleton width={80} height={22} radius={11} />
            <Skeleton width={90} height={22} radius={11} />
          </View>
          <Skeleton width="100%" height={120} radius={12} style={{ marginTop: spacing.md }} />
          <Skeleton width="100%" height={120} radius={12} />
          <Skeleton width="100%" height={120} radius={12} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen padded={false} edges={["top"]}>
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load record")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen padded={false} edges={["top"]}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Card style={{ margin: spacing.lg, padding: spacing.lg }}>
            <Text style={[typography.title.md, { fontWeight: "700" }]}>
              {t("recordDetail.notFound.title")}
            </Text>
            <Text
              style={[
                typography.body.sm,
                {
                  color: colors.textMuted,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {t("recordDetail.notFound.body")}
            </Text>
            <Button
              title={t("recordDetail.notFound.back")}
              variant="primary"
              size="md"
              onPress={() => router.back()}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      </Screen>
    );
  }

  // `kind` is the canonical record-type field added in v3; `recordType`
  // is the legacy enum (17 values). Prefer `kind` when present, fall
  // back to `recordType` for older rows. Both come from
  // packages/shared/src/records.ts RECORD_KINDS.
  const recordKind = (record.kind ?? record.recordType) as RecordType | undefined;
  const meta =
    (recordKind && TYPE_META[recordKind]) || TYPE_META.other;
  const IconComp = meta.icon;
  const isArchived = !!record.archivedAt;
  const ownerLabel = record.familyMember?.name || t("common.you");

  return (
    <Screen padded={false} edges={["top"]}>
      {/* Top Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#F4F2F8",
        }}
      >
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel={t("recordDetail.notFound.back")}
          onPress={() => router.back()}
          variant="ghost"
          tint={colors.primary}
          size="md"
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <IconComp size={16} color={meta.tone} strokeWidth={2.25} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: meta.tone,
              letterSpacing: 1,
              fontFamily: fontFamily.displayBold,
            }}
          >
            {meta.label.toUpperCase()}
          </Text>
        </View>

        <Pressable
          onPress={() => setShowSheet(true)}
          accessibilityLabel={t("recordDetail.a11y.moreOptions")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MoreHorizontal size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={{ backgroundColor: "#FAF9FC" }}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Hero */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "500",
              color: "#7F7B8C",
              marginBottom: 6,
              fontFamily: fontFamily.body,
            }}
          >
            {ownerLabel} · {formatDate(record.date, locale)}
          </Text>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "800",
              color: "#1D1B20",
              lineHeight: 30,
              fontFamily: fontFamily.displayBold,
              marginBottom: spacing.sm,
            }}
          >
            {record.title}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {record.doctor?.name ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: "#F4F2F8",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                }}
              >
                <User size={12} color={colors.primary} strokeWidth={2.5} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.primary,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {record.doctor.name}
                </Text>
              </View>
            ) : null}
            {record.hospital?.name ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: "#F4F2F8",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                }}
              >
                <Hospital size={12} color={colors.primary} strokeWidth={2.5} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.primary,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {record.hospital.name}
                </Text>
              </View>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "#F4F2F8",
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
              }}
            >
              <Calendar size={12} color={colors.primary} strokeWidth={2.5} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.primary,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {formatDate(record.date, locale)}
              </Text>
            </View>
          </View>
        </View>

        {isArchived ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Card
              style={{
                borderColor: colors.warning,
                backgroundColor: `${colors.warning}10`,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Archive size={18} color={colors.warning} strokeWidth={2.25} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.warning,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {t("recordDetail.archivedBadge.title")}
                </Text>
              </View>
              <Text
                style={[
                  typography.body.sm,
                  {
                    color: colors.textMuted,
                    marginTop: 4,
                  },
                ]}
              >
                {t("recordDetail.archivedBadge.body")}
              </Text>
              <Button
                title={t("recordDetail.archivedBadge.restore")}
                variant="ghost"
                size="sm"
                onPress={doRestore}
                style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
              />
            </Card>
          </View>
        ) : null}

        {/* Sections */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.md,
            gap: spacing.md,
          }}
        >
          {[
            { key: "diagnosis", value: record.diagnosis },
            { key: "summary", value: record.summary },
            { key: "notes", value: record.notes },
            { key: "followUp", value: record.followUpDate },
          ].map((sec) => {
            if (!sec.value || (sec.key === "followUp" && !record.followUpDate))
              return null;
            return (
              <Card key={sec.key}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.textMuted,
                    letterSpacing: 1,
                    marginBottom: 6,
                    fontFamily: fontFamily.displayBold,
                  }}
                >
                  {t(`recordDetail.sections.${sec.key}`).toUpperCase()}
                </Text>
                {sec.key === "followUp" ? (
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#1D1B20",
                      fontFamily: fontFamily.displayBold,
                    }}
                  >
                    {new Date(sec.value).toDateString()}
                  </Text>
                ) : (
                  <Text
                    style={{
                      fontSize: 15,
                      color: "#1D1B20",
                      lineHeight: 22,
                      fontFamily: fontFamily.body,
                    }}
                  >
                    {sec.value}
                  </Text>
                )}
              </Card>
            );
          })}
        </View>

        {/* Tags */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Card>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: colors.textMuted,
                letterSpacing: 1,
                marginBottom: 8,
                fontFamily: fontFamily.displayBold,
              }}
            >
              {t("recordDetail.tagsHeading").toUpperCase()}
            </Text>
            {record.tags?.length ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {record.tags.map((tag: string) => (
                  <View
                    key={tag}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: `${colors.primary}14`,
                    }}
                  >
                    <Tag size={11} color={colors.primary} strokeWidth={2.5} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.primary,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                }}
              >
                {t("recordDetail.noTags")}
              </Text>
            )}
          </Card>
        </View>

        {/* Details (JSON pretty) */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Card>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: colors.textMuted,
                letterSpacing: 1,
                marginBottom: 8,
                fontFamily: fontFamily.displayBold,
              }}
            >
              {t("recordDetail.detailsHeading").toUpperCase()}
            </Text>
            {record.extractedData && Object.keys(record.extractedData).length ? (
              <Text
                style={{
                  fontSize: 13,
                  color: "#1D1B20",
                  fontFamily: fontFamily.mono,
                  lineHeight: 18,
                }}
              >
                {JSON.stringify(record.extractedData, null, 2)}
              </Text>
            ) : (
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  fontFamily: fontFamily.body,
                }}
              >
                {t("recordDetail.emptyDetails")}
              </Text>
            )}
          </Card>
        </View>

        {/* Attachments */}
        {attachments.length ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Card>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: colors.textMuted,
                  letterSpacing: 1,
                  marginBottom: 8,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                {t("recordDetail.attachments", {
                  count: attachments.length,
                })}
              </Text>
              <View style={{ gap: spacing.sm }}>
                {attachments.map((att: any) => {
                  const isImage = att.type === "image";
                  const sizeKb =
                    att.sizeBytes != null
                      ? att.sizeBytes / 1024
                      : att.fileSize != null
                      ? att.fileSize / 1024
                      : null;
                  const displayName =
                    att.filename ||
                    att.fileName ||
                    att.r2Key?.split("/").pop() ||
                    t("recordDetail.attachmentFallback", { defaultValue: "Attachment" });
                  return (
                    <Pressable
                      key={att.id}
                      onPress={() => openAttachment(att)}
                      accessibilityLabel={t("recordDetail.a11y.openFile")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        padding: spacing.sm,
                        borderRadius: 14,
                        backgroundColor: "#F4F2F8",
                      }}
                    >
                      {isImage && att.r2Key ? (
                        <Image
                          source={{
                            uri: `${process.env.EXPO_PUBLIC_API_URL}/files/download/${encodeURIComponent(
                              att.r2Key
                            )}?stream=1`,
                          }}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 10,
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 10,
                            backgroundColor: "#FFFFFF",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <FileText
                            size={20}
                            color={colors.primary}
                            strokeWidth={2}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#1D1B20",
                            fontFamily: fontFamily.bodyBold,
                          }}
                        >
                          {displayName}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textMuted,
                            fontFamily: fontFamily.body,
                          }}
                        >
                          {sizeKb != null
                            ? `${sizeKb.toFixed(1)} KB · ${att.type}`
                            : att.type}
                        </Text>
                      </View>
                      <ExternalLink
                        size={16}
                        color={colors.primary}
                        strokeWidth={2.25}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        ) : null}

        {/* Quick actions */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            flexDirection: "row",
            gap: spacing.sm,
          }}
        >
          <Button
            title={t("recordDetail.quickActions.edit")}
            variant="secondary"
            size="md"
            onPress={() =>
              router.push({
                pathname: "/(app)/edit-record",
                params: { id: params.id },
              })
            }
            style={{ flex: 1 }}
            leftIcon={<Pencil size={16} color={colors.primary} />}
          />
          <Button
            title={t("recordDetail.quickActions.share")}
            variant="ghost"
            size="md"
            onPress={doShare}
            style={{ flex: 1 }}
            leftIcon={<Share2 size={16} color={colors.primary} />}
          />
          <Button
            title={t("recordDetail.quickActions.link")}
            variant="ghost"
            size="md"
            onPress={() => router.push("/(app)/notifications")}
            style={{ flex: 1 }}
            leftIcon={<ExternalLink size={16} color={colors.primary} />}
          />
        </View>
      </ScrollView>

      {/* ─── Bottom-sheet of actions ─────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={showSheet}
        onRequestClose={() => setShowSheet(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          onPress={() => setShowSheet(false)}
        />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#E6E4EA",
              marginBottom: spacing.md,
            }}
          />
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#1D1B20",
              marginBottom: spacing.md,
              fontFamily: fontFamily.displayBold,
            }}
          >
            {t("recordDetail.actions.title")}
          </Text>

          <SheetRow
            icon={<Pencil size={20} color={colors.primary} />}
            label={t("recordDetail.actions.edit")}
            onPress={() => onAction("edit")}
          />
          <SheetRow
            icon={<Tag size={20} color={colors.primary} />}
            label={t("recordDetail.actions.editTags")}
            onPress={() => onAction("editTags")}
          />
          <SheetRow
            icon={<Users size={20} color={colors.primary} />}
            label={t("recordDetail.actions.moveToFamily")}
            onPress={() => onAction("moveToFamily")}
          />
          <SheetRow
            icon={
              isArchived ? (
                <RotateCcw size={20} color={colors.primary} />
              ) : (
                <Archive size={20} color={colors.primary} />
              )
            }
            label={
              isArchived
                ? t("recordDetail.actions.restore")
                : t("recordDetail.actions.archive")
            }
            onPress={() => onAction(isArchived ? "restore" : "archive")}
          />
          <SheetRow
            icon={<Share2 size={20} color={colors.primary} />}
            label={t("recordDetail.actions.share")}
            onPress={() => onAction("share")}
          />
          <SheetRow
            icon={<Trash2 size={20} color={colors.danger || "#FF3B30"} />}
            label={t("recordDetail.actions.delete")}
            destructive
            onPress={() => onAction("delete")}
          />
          <Button
            title={t("recordDetail.actions.cancel")}
            variant="ghost"
            size="md"
            onPress={() => setShowSheet(false)}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </Modal>

      {/* ─── Delete confirm dialog ───────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <Card style={{ width: "100%" }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "800",
                color: "#1D1B20",
                fontFamily: fontFamily.displayBold,
              }}
            >
              {t("recordDetail.deleteConfirm.title")}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                lineHeight: 20,
                fontFamily: fontFamily.body,
                marginTop: spacing.xs,
              }}
            >
              {t("recordDetail.deleteConfirm.body")}
            </Text>

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title={t("recordDetail.deleteConfirm.archive")}
                variant="secondary"
                size="md"
                onPress={() => doDelete(false)}
              />
              <Button
                title={t("recordDetail.deleteConfirm.deleteForever")}
                variant="primary"
                size="md"
                onPress={() => doDelete(true)}
              />
              <Button
                title={t("recordDetail.actions.cancel")}
                variant="ghost"
                size="md"
                onPress={() => setShowDeleteConfirm(false)}
              />
            </View>
          </Card>
        </View>
      </Modal>

      <TagPickerSheet
        visible={showTagPicker}
        onDismiss={() => setShowTagPicker(false)}
        currentTags={record.tags || []}
        onApply={applyTags}
      />
      <FamilyPickerSheet
        visible={showFamilyPicker}
        onDismiss={() => setShowFamilyPicker(false)}
        onPick={onPickFamily}
        excludeOwn={false}
      />
    </Screen>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { spacing, fontFamily } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: 12,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: destructive ? "#FF3B30" : "#1D1B20",
          fontFamily: fontFamily.bodySemibold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function formatDate(dateStr: string, locale: string) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat(intlLocale(locale as any), {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}