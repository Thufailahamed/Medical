// @ts-nocheck

import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Linking,
  Share,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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
  ChevronRight,
  MoreHorizontal,
  Plus,
  Sparkles,
  RefreshCw,
  FlaskConical,
  ScanLine,
  Syringe,
  ListChecks,
  Stethoscope,
  Activity,
} from "lucide-react-native";
import {
  useMedicalRecord,
  useUpdateRecordTags,
  useArchiveRecord,
  useRestoreRecord,
  useMoveRecordToFamily,
  useReturnRecordToOwn,
  useDeleteRecord,
  useRecordLabResults,
  useRecordImagingFindings,
  useRecordDischargeEvents,
  useRecordVaccinationDoses,
  useRecordPrescriptionItems,
  useReExtractRecord,
  usePresignFile,
} from "@/hooks/useApi";
import { api, getApiBaseUrl } from "@/lib/api";
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
import { DicomPreviewCard } from "@/components/records/DicomPreviewCard";

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

// Kind-graded gradient used for the hero icon tile — mirrors the palette
// on the Records hub cards so the detail view reads as the same object.
const DETAIL_GRADIENT: Record<string, readonly [string, string]> = {
  lab_report: ["#FBBF24", "#F59E0B"],
  prescription: ["#A78BFA", "#7C3AED"],
  imaging: ["#38BDF8", "#0284C7"],
  hospital_visit: ["#2DD4BF", "#0D9488"],
  vaccination: ["#FB923C", "#EA580C"],
  surgery: ["#F87171", "#DC2626"],
  op_note: ["#F472B6", "#DB2777"],
  discharge_summary: ["#A78BFA", "#6D28D9"],
  referral: ["#60A5FA", "#2563EB"],
  insurance: ["#34D399", "#059669"],
  pathology: ["#FBBF24", "#B45309"],
  dental: ["#38BDF8", "#0284C7"],
  other: ["#94A3B8", "#475569"],
};

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
  // Presign each attachment so `<Image source>` and `Linking.openURL` can
  // fetch the bytes without attaching a Bearer header. The proxy
  // `/files/download/:key` is auth-gated and would 401 on a raw Image.
  const presign = usePresignFile();
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = attachments
        .map((a: any) => a?.id)
        .filter((x: unknown): x is string => typeof x === "string");
      if (!ids.length) return;
      try {
        const results = await Promise.all(
          ids.map((id) =>
            api<{ token: string; url: string }>("/files/presign", {
              method: "POST",
              body: { fileId: id },
              silent401: true,
            }).catch(() => null)
          )
        );
        if (cancelled) return;
        const next: Record<string, string> = {};
        const base = getApiBaseUrl();
        results.forEach((r, i) => {
          if (r && ids[i]) {
            // r.url is a server-relative path; prepend the API origin.
            next[ids[i]] = r.url.startsWith("http")
              ? r.url
              : `${base}${r.url}`;
          }
        });
        setSignedUrls(next);
      } catch {
        // best-effort — thumbnails just won't render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

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

  // Open the first attachment in the system viewer. Uses the presigned
  // token (unauthenticated `/files/download/:token`) because Linking
  // cannot attach the Bearer header and the auth-gated proxy would 401.
  async function openAttachment(att: any) {
    const signed = att?.id ? signedUrls[att.id] : null;
    if (!signed) {
      toast.show(t("recordDetail.toast.noFileKey"), "warning");
      return;
    }
    try {
      const ok = await Linking.canOpenURL(signed);
      if (!ok) {
        toast.show(t("recordDetail.toast.noFileKey"), "warning");
        return;
      }
      await Linking.openURL(signed);
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
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      {/* Top Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 14,
          backgroundColor: "#F4F8FB",
          borderBottomWidth: 1,
          borderBottomColor: "#E2EBF1",
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

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 11,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E2EBF1",
            shadowColor: "#0F2742",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 1,
          }}
        >
          <IconComp size={15} color={meta.tone} strokeWidth={2.5} />
          <Text
            style={{
              fontSize: 12,
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
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E2EBF1",
            shadowColor: "#0F2742",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 1,
          }}
        >
          <MoreHorizontal size={20} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView
        style={{ backgroundColor: "#F4F8FB" }}
        contentContainerStyle={{ paddingBottom: 148 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: "#E2EBF1",
              shadowColor: "#16324A",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.08,
              shadowRadius: 22,
              elevation: 4,
              gap: 14,
            }}
          >
            {/* Kind identity row — gradient icon tile + type + owner/date */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: meta.tone,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  elevation: 3,
                }}
              >
                <LinearGradient
                  colors={DETAIL_GRADIENT[recordKind ?? "other"] ?? DETAIL_GRADIENT.other}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <IconComp size={21} color="#FFFFFF" strokeWidth={2.25} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "800",
                    color: meta.tone,
                    letterSpacing: 1.1,
                    fontFamily: fontFamily.displayBold,
                  }}
                  numberOfLines={1}
                >
                  {meta.label.toUpperCase()}
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: "600",
                    color: "#64748B",
                    fontFamily: fontFamily.body,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {ownerLabel} · {formatDate(record.date, locale)}
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: "#0F172A",
                lineHeight: 30,
                fontFamily: fontFamily.displayBold,
                letterSpacing: -0.4,
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
                    gap: 5,
                    backgroundColor: "#E0F2FE",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                  }}
                >
                  <User size={13} color="#0369A1" strokeWidth={2.5} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#0369A1",
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
                    gap: 5,
                    backgroundColor: "#CCFBF1",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                  }}
                >
                  <Hospital size={13} color="#0F766E" strokeWidth={2.5} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#0F766E",
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
                  gap: 5,
                  backgroundColor: "#F1F5F9",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <Calendar size={13} color="#475569" strokeWidth={2.5} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#475569",
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  {formatDate(record.date, locale)}
                </Text>
              </View>
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
            { key: "diagnosis", value: record.diagnosis, icon: Stethoscope, color: "#0D9488" },
            { key: "summary", value: record.summary, icon: FileText, color: "#0284C7" },
            { key: "notes", value: record.notes, icon: Pencil, color: "#9333EA" },
            { key: "followUp", value: record.followUpDate, icon: Calendar, color: "#EA580C" },
          ].map((sec) => {
            if (!sec.value || (sec.key === "followUp" && !record.followUpDate))
              return null;
            const SecIcon = sec.icon;
            return (
              <Card key={sec.key} style={{ borderRadius: 22, borderColor: "#E2EBF1", padding: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      backgroundColor: `${sec.color}16`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <SecIcon size={15} color={sec.color} strokeWidth={2.5} />
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: colors.textMuted,
                      letterSpacing: 1.1,
                      fontFamily: fontFamily.displayBold,
                    }}
                  >
                    {t(`recordDetail.sections.${sec.key}`).toUpperCase()}
                  </Text>
                </View>
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
                      color: "#1E293B",
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

        {/* Structured data (migration 0070) — child-table counts
            per extraction kind + re-extract button. Shown only for
            record kinds the extraction pipeline understands. */}
        {recordKind &&
        ["lab_report", "imaging", "discharge_summary", "vaccination", "prescription"].includes(
          recordKind,
        ) ? (
          <StructuredDataCard
            recordId={recordId as string}
            recordKind={recordKind}
          />
        ) : null}

        {/* Tags — tap anywhere on the card to edit */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Pressable
            onPress={() => setShowTagPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t("recordDetail.a11y.editTags", "Edit tags")}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card style={{ borderRadius: 22, borderColor: "#E2EBF1", padding: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    backgroundColor: `${colors.primary}16`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Tag size={15} color={colors.primary} strokeWidth={2.5} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.textMuted,
                    letterSpacing: 1.1,
                    fontFamily: fontFamily.displayBold,
                  }}
                >
                  {t("recordDetail.tagsHeading").toUpperCase()}
                </Text>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={15} color={colors.primary} strokeWidth={2.75} />
                </View>
              </View>
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
                        paddingHorizontal: 10,
                        paddingVertical: 5,
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
                <View
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: "#CBD8E2",
                    backgroundColor: "#F8FBFD",
                    paddingVertical: 16,
                    paddingHorizontal: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: colors.textMuted,
                      fontFamily: fontFamily.body,
                    }}
                  >
                    {t("recordDetail.noTags")}
                  </Text>
                </View>
              )}
            </Card>
          </Pressable>
        </View>

        {/* Details — extracted fields as key/value rows */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Card style={{ borderRadius: 22, borderColor: "#E2EBF1", padding: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  backgroundColor: "#E8F0F5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ListChecks size={16} color="#475569" strokeWidth={2.5} />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: colors.textMuted,
                  letterSpacing: 1.1,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                {t("recordDetail.detailsHeading").toUpperCase()}
              </Text>
            </View>
            {record.extractedData && Object.keys(record.extractedData).length ? (
              <View>
                {Object.entries(record.extractedData)
                  .slice(0, 14)
                  .map(([key, val], i) => (
                    <View
                      key={key}
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 12,
                        paddingVertical: 8,
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: "#E2E8F0",
                      }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 12.5,
                          fontWeight: "600",
                          color: colors.textMuted,
                          fontFamily: fontFamily.body,
                          textTransform: "capitalize",
                        }}
                        numberOfLines={1}
                      >
                        {prettifyDetailKey(key)}
                      </Text>
                      <Text
                        style={{
                          flex: 1.4,
                          fontSize: 12.5,
                          fontWeight: "700",
                          color: "#1E293B",
                          fontFamily: fontFamily.body,
                          textAlign: "right",
                        }}
                        numberOfLines={3}
                      >
                        {formatDetailValue(val)}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : (
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "#CBD8E2",
                  backgroundColor: "#F8FBFD",
                  paddingVertical: 16,
                  paddingHorizontal: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.textMuted,
                    fontFamily: fontFamily.body,
                    textAlign: "center",
                  }}
                >
                  {t("recordDetail.emptyDetails")}
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* DICOM metadata preview — only surfaces when the record
            carries extracted study/series/modality data (e.g. when the
            list endpoint joined document_dicom_metadata). */}
        {recordKind === "imaging" ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <DicomPreviewCard
              metadata={(() => {
                const first: any = attachments.find(
                  (a: any) => a?.dicomMetadata || a?.metadata?.dicom
                );
                const m =
                  first?.dicomMetadata ||
                  first?.metadata?.dicom ||
                  (record as any)?.dicomMetadata ||
                  null;
                if (!m) return null;
                return {
                  modality: m.modality ?? m.Modality ?? null,
                  bodyPart:
                    m.bodyPart ?? m.BodyPartExamined ?? null,
                  studyDate:
                    m.studyDate ?? m.StudyDate ?? m.study_date ?? null,
                  manufacturer: m.manufacturer ?? m.Manufacturer ?? null,
                };
              })()}
            />
          </View>
        ) : null}

        {/* Attachments */}
        {attachments.length ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Card style={{ borderRadius: 22, borderColor: "#E2EBF1", padding: 18 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: colors.textMuted,
                  letterSpacing: 1.1,
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
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderRadius: 16,
                        backgroundColor: pressed ? "#EDF4F8" : "#F8FBFD",
                        borderWidth: 1,
                        borderColor: "#DFE9F0",
                      })}
                    >
                      {isImage && att.id && signedUrls[att.id] ? (
                        <Image
                          source={{
                            uri: signedUrls[att.id],
                          }}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 14,
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            backgroundColor: "#E0F2FE",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <FileText
                            size={20}
                            color="#0284C7"
                            strokeWidth={2.25}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#0F172A",
                            fontFamily: fontFamily.bodyBold,
                          }}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#64748B",
                            fontFamily: fontFamily.body,
                            marginTop: 2,
                          }}
                        >
                          {sizeKb != null
                            ? `${sizeKb.toFixed(1)} KB · ${att.type}`
                            : att.type}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: "#F1F5F9",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ExternalLink
                          size={15}
                          color={colors.primary}
                          strokeWidth={2.25}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {/* Fixed elevated quick actions bar at bottom */}
      <View
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          right: 12,
          backgroundColor: "rgba(255,255,255,0.98)",
          borderWidth: 1,
          borderColor: "#DFE9F0",
          borderRadius: 24,
          paddingHorizontal: 10,
          paddingTop: 10,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          shadowColor: "#0B2942",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.14,
          shadowRadius: 24,
          elevation: 12,
        }}
      >
        <Button
          title={t("recordDetail.quickActions.edit")}
          variant="primary"
          size="md"
          onPress={() =>
            router.push({
              pathname: "/(app)/edit-record",
              params: { id: params.id },
            })
          }
          style={{ flex: 1, height: 48, borderRadius: 16 }}
          icon={Pencil}
        />
        <Button
          title={t("recordDetail.quickActions.share")}
          variant="secondary"
          size="md"
          onPress={doShare}
          style={{ flex: 1, height: 48, borderRadius: 16 }}
          icon={Share2}
        />
        <Button
          title={t("recordDetail.quickActions.link")}
          variant="outline"
          size="md"
          onPress={() => router.push("/(app)/notifications")}
          style={{ flex: 1, height: 48, borderRadius: 16 }}
          icon={ExternalLink}
        />
      </View>

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

// "hemoglobinValue" / "patient_dob" → "Hemoglobin value" / "Patient dob"
function prettifyDetailKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

function formatDetailValue(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number" || typeof val === "string") return String(val);
  if (Array.isArray(val)) {
    return val
      .slice(0, 4)
      .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
      .join(", ");
  }
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

// ─── Structured data card ───────────────────────────────
//
// Shown on lab_report / imaging / discharge_summary / vaccination /
// prescription records. Lists child-row counts per kind + a
// Re-extract button. Reads from the same query keys the trend chart
// uses, so the UI re-renders once the new rows land.
function StructuredDataCard({
  recordId,
  recordKind,
}: {
  recordId: string;
  recordKind: string;
}) {
  const { t } = useTranslation();
  const { spacing, typography, colors, fontFamily } = useTheme();
  const toast = useToast();
  const reExtract = useReExtractRecord();

  const lab = useRecordLabResults(recordKind === "lab_report" ? recordId : undefined);
  const img = useRecordImagingFindings(recordKind === "imaging" ? recordId : undefined);
  const dis = useRecordDischargeEvents(recordKind === "discharge_summary" ? recordId : undefined);
  const vac = useRecordVaccinationDoses(recordKind === "vaccination" ? recordId : undefined);
  const rx = useRecordPrescriptionItems(recordKind === "prescription" ? recordId : undefined);

  const counts: Array<{ key: string; label: string; icon: any; n: number }> = [];
  if (recordKind === "lab_report") {
    counts.push({
      key: "tests",
      label: t("recordDetail.structured.tests", "Test results"),
      icon: FlaskConical,
      n: lab.data?.results?.length ?? 0,
    });
  }
  if (recordKind === "imaging") {
    counts.push({
      key: "findings",
      label: t("recordDetail.structured.findings", "Imaging findings"),
      icon: ScanLine,
      n: img.data?.findings?.length ?? 0,
    });
  }
  if (recordKind === "discharge_summary") {
    counts.push({
      key: "events",
      label: t("recordDetail.structured.events", "Discharge events"),
      icon: ListChecks,
      n: dis.data?.events?.length ?? 0,
    });
  }
  if (recordKind === "vaccination") {
    counts.push({
      key: "doses",
      label: t("recordDetail.structured.doses", "Vaccination doses"),
      icon: Syringe,
      n: vac.data?.doses?.length ?? 0,
    });
  }
  if (recordKind === "prescription") {
    counts.push({
      key: "items",
      label: t("recordDetail.structured.items", "Prescription items"),
      icon: ListChecks,
      n: rx.data?.items?.length ?? 0,
    });
  }

  const totalCount = counts.reduce((s, c) => s + c.n, 0);
  const isLoading =
    lab.isLoading || img.isLoading || dis.isLoading || vac.isLoading || rx.isLoading;
  const isExtracting = reExtract.isPending;

  function onReExtract() {
    reExtract.mutate(recordId, {
      onSuccess: (res: any) => {
        if (res?.status === "completed") {
          toast.show(t("recordDetail.structured.reExtractOk"), "success");
        } else if (res?.status === "skipped") {
          toast.show(t("recordDetail.structured.reExtractSkip"), "info");
        } else {
          toast.show(
            res?.error || t("recordDetail.structured.reExtractFail"),
            "danger",
          );
        }
      },
      onError: () =>
        toast.show(t("recordDetail.structured.reExtractFail"), "danger"),
    });
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <Card style={{ borderRadius: 22, borderColor: "#E2EBF1", padding: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              backgroundColor: "#CCFBF1",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={16} color="#0D9488" strokeWidth={2.5} />
          </View>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: colors.textMuted,
              letterSpacing: 1.1,
              fontFamily: fontFamily.displayBold,
            }}
          >
            {t("recordDetail.structured.title", "STRUCTURED DATA").toUpperCase()}
          </Text>
        </View>
        {isLoading ? (
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {t("common.loading", "Loading…")}
          </Text>
        ) : totalCount === 0 ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 18, fontFamily: fontFamily.body }}>
              {t(
                "recordDetail.structured.empty",
                "No structured medical rows extracted yet. Tap below to run AI Multimodal Extraction.",
              )}
            </Text>
            <Button
              title={
                isExtracting
                  ? t("recordDetail.structured.reExtracting", "Extracting with AI…")
                  : t("recordDetail.structured.reExtract", "Re-extract with AI")
              }
              variant="primary"
              size="md"
              onPress={onReExtract}
              disabled={isExtracting}
              style={{ borderRadius: 12, height: 42 }}
              icon={<Sparkles size={15} color="#FFFFFF" />}
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={{ gap: 8, marginBottom: 4 }}>
              {counts.map((c) => {
                const Icon = c.icon;
                return (
                  <View
                    key={c.key}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <Icon size={15} color={colors.primary} strokeWidth={2.25} />
                    <Text
                      style={[
                        typography.body.sm,
                        { color: "#1E293B", fontFamily: fontFamily.body, fontWeight: "600" },
                      ]}
                    >
                      {c.label}
                    </Text>
                    <View
                      style={{
                        marginLeft: "auto",
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: `${colors.primary}14`,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: "800",
                          color: colors.primary,
                          fontFamily: fontFamily.bodyBold,
                        }}
                      >
                        {c.n}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <Button
              title={
                isExtracting
                  ? t("recordDetail.structured.reExtracting", "Extracting with AI…")
                  : t("recordDetail.structured.reExtract", "Re-extract with AI")
              }
              variant="secondary"
              size="sm"
              onPress={onReExtract}
              disabled={isExtracting}
              style={{ borderRadius: 10, height: 38 }}
              icon={<RefreshCw size={14} color={colors.primary} />}
            />
          </View>
        )}
      </Card>
    </View>
  );
}