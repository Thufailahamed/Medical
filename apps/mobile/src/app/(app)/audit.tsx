// @ts-nocheck

// Patient-visible access log. Shows every PHI access against the
// caller's record in the recent past so the patient can spot anything
// unexpected. Same payload as the web `/audit/me` route — the server
// filters rows so only entries where the patient is the resource
// owner are returned.

import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  ScrollText,
  QrCode,
  Download,
  FileImage,
  Pill as PillIcon,
  CalendarDays,
  FileText,
  KeyRound,
  ShieldAlert,
  RefreshCw,
  Activity,
  ScanLine,
  ShieldX,
  ShieldCheck,
  ChevronDown,
  Globe,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  Skeleton,
  EmptyState,
  ErrorState,
  Divider,
} from "@/components/ui";
import { intlLocale } from "@/lib/format";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { Pressable, IconTile } from "@/components/ui";
import { LayoutAnimation, StyleSheet } from "react-native";

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorId: string | null;
  actorName?: string | null;
  details: string | Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

// `details` arrives as a parsed object (e.g. {purpose, rotationSeconds})
// or a plain string. Flatten it to a compact "key: value · key: value"
// line, skipping opaque id fields which mean nothing to the patient.
function formatDetails(d: AuditEntry["details"]): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  if (typeof d !== "object") return String(d);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (v == null || v === "") continue;
    if (/id$/i.test(k) && typeof v === "string" && v.length > 12) continue;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${k}: ${val}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

// "health_id.issued" → "Health ID Issued"; fixes common acronyms.
function humanize(s: string): string {
  return s
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bDsar\b/g, "DSAR")
    .replace(/\bQr\b/g, "QR");
}

// Icon + tone per entry, chosen from the action/resource semantics.
function metaFor(action: string, resource: string): { icon: LucideIcon; tone: Tone } {
  const s = `${action} ${resource}`.toLowerCase();
  if (/revok|denied|fail|breach|unauthoriz/.test(s))
    return { icon: ShieldAlert, tone: "danger" };
  if (/superseded|rotat|expir/.test(s))
    return { icon: RefreshCw, tone: "warning" };
  if (/health_id|qr_access/.test(s)) return { icon: QrCode, tone: "primary" };
  if (/dsar|export|download/.test(s)) return { icon: Download, tone: "info" };
  if (/imaging|image|lab|study/.test(s)) return { icon: FileImage, tone: "accent" };
  if (/prescription|rx|medicin/.test(s)) return { icon: PillIcon, tone: "accent2" };
  if (/appoint|visit|consult/.test(s)) return { icon: CalendarDays, tone: "primary" };
  if (/login|auth|session|password/.test(s)) return { icon: KeyRound, tone: "warning" };
  if (/record|document|file/.test(s)) return { icon: FileText, tone: "info" };
  return { icon: Activity, tone: "neutral" };
}

type FilterKey = "all" | "records" | "prescriptions" | "appointments";

const FILTERS: FilterKey[] = ["all", "records", "prescriptions", "appointments"];

function fmtTime(d: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale as any), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(d));
  } catch {
    return d;
  }
}

// Day-bucket: "today" / "yesterday" / "this_week" / "earlier".
// Bucket key used as i18n suffix so all copy is translated.
function bucketOf(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const startOfDay = (t: number) => {
    const x = new Date(t);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const today = startOfDay(now);
  const that = startOfDay(d.getTime());
  const diffDays = Math.floor((today - that) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "this_week";
  return "earlier";
}

// Patient-facing copy for audit actions we know. `hidden` rows are
// bookkeeping the patient never needs to see (e.g. the old QR being
// superseded every time a new one is shown).
type Known = {
  titleKey: string;
  fallback: string;
  icon: LucideIcon;
  tone: Tone;
  hidden?: (d: any) => boolean;
  summary?: (d: any, t: any) => string | null;
};
const KNOWN: Record<string, Known> = {
  "health_id.issued": {
    titleKey: "audit.event.healthIdIssued",
    fallback: "Health ID QR shown",
    icon: QrCode,
    tone: "primary",
    summary: (d, t) =>
      [
        d?.purpose === "all" ? t("audit.detail.fullRecord", "Full record") : d?.purpose ? humanize(String(d.purpose)) : null,
        d?.ttlHours ? t("audit.detail.validFor", { hours: d.ttlHours, defaultValue: `valid ${d.ttlHours} h` }) : null,
        d?.rotationSeconds
          ? t("audit.detail.rotates", { seconds: d.rotationSeconds, defaultValue: `code refreshes every ${d.rotationSeconds}s` })
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
  },
  "health_id.superseded": {
    titleKey: "audit.event.healthIdSuperseded",
    fallback: "Previous QR retired",
    icon: RefreshCw,
    tone: "warning",
    hidden: (d) => d?.reason === "new_issue",
  },
  "health_id.revoked": {
    titleKey: "audit.event.healthIdRevoked",
    fallback: "Health ID QR revoked",
    icon: ShieldX,
    tone: "warning",
  },
  "health_id.scanned": {
    titleKey: "audit.event.healthIdScanned",
    fallback: "Health ID scanned",
    icon: ScanLine,
    tone: "info",
    summary: (d, t) =>
      d?.remainingScans != null
        ? t("audit.detail.scansLeft", { count: d.remainingScans, defaultValue: `${d.remainingScans} scans left` })
        : null,
  },
  "health_id.scan_rejected": {
    titleKey: "audit.event.healthIdRejected",
    fallback: "Scan blocked",
    icon: ShieldAlert,
    tone: "danger",
    summary: (d) => (d?.reason ? humanize(String(d.reason)) : null),
  },
  qr_token_issued: { titleKey: "audit.event.emergencyQrIssued", fallback: "Emergency QR created", icon: QrCode, tone: "danger" },
  qr_token_scanned: { titleKey: "audit.event.emergencyQrScanned", fallback: "Emergency QR scanned", icon: ScanLine, tone: "danger" },
  qr_token_revoked: { titleKey: "audit.event.emergencyQrRevoked", fallback: "Emergency QR revoked", icon: ShieldX, tone: "warning" },
};

type Row = {
  key: string;
  entry: AuditEntry;
  count: number;
  firstAt: string; // oldest in the run
  lastAt: string; // newest in the run
};

function clock(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale as any), { hour: "2-digit", minute: "2-digit", hour12: false }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

export default function AuditLogScreen() {
  const { t, i18n } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const myId = useAuthStore((s) => s.user?.id);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit", "me", filter],
    queryFn: () => api<{ entries: AuditEntry[] }>(`/audit/me?limit=200&filter=${filter}`),
  });

  const entries = data?.entries ?? [];

  // Drop bookkeeping rows, then collapse runs of the same event by the same
  // actor into one row ("×4 · 16:51–20:16") so repeated QR refreshes don't
  // bury everything else.
  const grouped = useMemo(() => {
    const visible = entries.filter((e) => !KNOWN[e.action]?.hidden?.(e.details));
    const order = ["today", "yesterday", "this_week", "earlier"];
    const buckets: Record<string, Row[]> = { today: [], yesterday: [], this_week: [], earlier: [] };
    for (const e of visible) {
      const b = bucketOf(e.createdAt);
      const list = buckets[b];
      const prev = list[list.length - 1];
      if (prev && prev.entry.action === e.action && prev.entry.resource === e.resource && prev.entry.actorId === e.actorId) {
        prev.count += 1;
        prev.firstAt = e.createdAt;
      } else {
        list.push({ key: e.id, entry: e, count: 1, firstAt: e.createdAt, lastAt: e.createdAt });
      }
    }
    return order.filter((k) => buckets[k].length > 0).map((k) => ({ key: k, items: buckets[k] }));
  }, [entries]);

  const shownCount = grouped.reduce((n, g) => n + g.items.reduce((m, r) => m + r.count, 0), 0);
  const othersCount = entries.filter((e) => e.actorId && myId && e.actorId !== myId).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const toggle = (k: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey((cur) => (cur === k ? null : k));
  };

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader back title={t("audit.title")} subtitle={t("audit.subtitle")} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}
      >
        {FILTERS.map((f) => {
          const on = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              haptic="light"
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{
                height: 36,
                paddingHorizontal: 16,
                justifyContent: "center",
                borderRadius: 18,
                backgroundColor: on ? colors.primary : colors.surface,
                borderWidth: on ? 0 : StyleSheet.hairlineWidth,
                borderColor: colors.hairline,
              }}
            >
              <Text style={[typography.label.md, { color: on ? colors.onPrimary : colors.text }]}>
                {t(`audit.filter.${f}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.lg,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error ? (
          <ErrorState
            title={t("audit.errorTitle")}
            message={t("audit.errorBody")}
            actionLabel={t("audit.retry")}
            onAction={() => refetch()}
          />
        ) : isLoading ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={64} radius={16} />
            <Skeleton height={64} radius={16} />
            <Skeleton height={64} radius={16} />
          </View>
        ) : grouped.length === 0 ? (
          <EmptyState icon={ScrollText} title={t("audit.emptyTitle")} message={t("audit.emptyBody")} tone="primary" />
        ) : (
          <>
            {/* Reassurance line: who touched the record */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: 16,
                backgroundColor: othersCount ? colors.warningSoft : colors.successSoft,
              }}
            >
              {othersCount ? (
                <ShieldAlert size={16} color={colors.warning} strokeWidth={2.4} />
              ) : (
                <ShieldCheck size={16} color={colors.success} strokeWidth={2.4} />
              )}
              <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>
                {othersCount
                  ? t("audit.summary.others", { count: othersCount, defaultValue: `${othersCount} actions by other people — review them below.` })
                  : t("audit.summary.onlyYou", { count: shownCount, defaultValue: `All ${shownCount} events were made by you.` })}
              </Text>
            </View>

            {grouped.map((g) => (
              <View key={g.key} style={{ gap: spacing.sm }}>
                <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase", marginLeft: 2 }]}>
                  {t(`audit.group.${g.key}`)}
                </Text>
                <Card padded={false}>
                  {g.items.map((r, i) => (
                    <AuditRow
                      key={r.key}
                      row={r}
                      mine={!!myId && r.entry.actorId === myId}
                      showDate={g.key === "this_week" || g.key === "earlier"}
                      locale={i18n.language}
                      last={i === g.items.length - 1}
                      open={openKey === r.key}
                      onToggle={() => toggle(r.key)}
                    />
                  ))}
                </Card>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function AuditRow({
  row,
  mine,
  showDate,
  locale,
  last,
  open,
  onToggle,
}: {
  row: Row;
  mine: boolean;
  showDate: boolean;
  locale: string;
  last: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const e = row.entry;
  const known = KNOWN[e.action];
  const fallbackMeta = metaFor(e.action, e.resource);
  const Icon = known?.icon ?? fallbackMeta.icon;
  const tone = known?.tone ?? fallbackMeta.tone;
  const title = known ? t(known.titleKey, known.fallback) : humanize(e.action);
  const summary = known?.summary ? known.summary(e.details, t) : formatDetails(e.details);
  const actor = mine ? t("audit.you", "You") : e.actorName || t("audit.actorSystem");

  const when =
    row.count > 1
      ? `${clock(row.firstAt, locale)}–${clock(row.lastAt, locale)}`
      : showDate
      ? fmtTime(e.createdAt, locale)
      : clock(e.createdAt, locale);

  const raw = formatDetails(e.details);
  const expandable = !!raw || !!e.ip;

  return (
    <Pressable
      onPress={expandable ? onToggle : undefined}
      disabled={!expandable}
      accessibilityRole={expandable ? "button" : undefined}
      accessibilityState={expandable ? { expanded: open } : undefined}
      style={{ paddingLeft: spacing.lg }}
    >
      <View
        style={{
          flexDirection: "row",
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingRight: spacing.lg,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        }}
      >
        <View>
          <IconTile icon={Icon} tone={tone} size={40} />
          {row.count > 1 ? (
            <View
              style={{
                position: "absolute",
                right: -6,
                top: -6,
                minWidth: 22,
                height: 20,
                paddingHorizontal: 5,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.text,
                borderWidth: 2,
                borderColor: colors.surface,
              }}
            >
              <Text style={[typography.label.xs, { color: colors.surface, letterSpacing: 0, fontSize: 10 }]}>
                ×{row.count}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
            <Text style={[typography.title.sm, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[typography.caption, { color: colors.textSubtle, fontVariant: ["tabular-nums"] }]} numberOfLines={1}>
              {when}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                paddingHorizontal: 7,
                height: 20,
                borderRadius: 10,
                justifyContent: "center",
                backgroundColor: mine ? colors.well : colors.warningSoft,
              }}
            >
              <Text style={[typography.label.xs, { color: mine ? colors.textMuted : colors.warning, letterSpacing: 0 }]}>
                {actor}
              </Text>
            </View>
            {summary ? (
              <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
                {summary}
              </Text>
            ) : null}
            {expandable ? (
              <ChevronDown
                size={14}
                color={colors.textSubtle}
                strokeWidth={2.4}
                style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
              />
            ) : null}
          </View>
          {open ? (
            <View style={{ marginTop: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.well, gap: 4 }}>
              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                {humanize(e.resource)}
                {e.resourceId ? ` · ${e.resourceId}` : ""}
              </Text>
              {raw ? <Text style={[typography.caption, { color: colors.text }]}>{raw}</Text> : null}
              {e.ip ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Globe size={11} color={colors.textSubtle} strokeWidth={2.4} />
                  <Text style={[typography.caption, { color: colors.textSubtle }]}>{e.ip}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
