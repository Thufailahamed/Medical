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

export default function AuditLogScreen() {
  const { t, i18n } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit", "me", filter],
    queryFn: () => api<{ entries: AuditEntry[] }>(`/audit/me?limit=200&filter=${filter}`),
  });

  const entries = data?.entries ?? [];

  const grouped = useMemo(() => {
    const order = ["today", "yesterday", "this_week", "earlier"];
    const buckets: Record<string, AuditEntry[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const e of entries) {
      const k = bucketOf(e.createdAt);
      buckets[k].push(e);
    }
    return order
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({ key: k, items: buckets[k] }));
  }, [entries]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title={t("audit.title")}
        subtitle={t("audit.subtitle")}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(`audit.filter.${f}`)}
            selected={f === filter}
            onPress={() => setFilter(f)}
            tone="primary"
            size="md"
          />
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
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
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("audit.emptyTitle")}
            message={t("audit.emptyBody")}
          />
        ) : (
          <View style={{ gap: spacing.lg }}>
            {grouped.map((g) => (
              <View key={g.key}>
                <Text
                  style={[
                    typography.overline,
                    {
                      color: colors.textMuted,
                      letterSpacing: 1.1,
                      marginLeft: spacing.xs,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  {t(`audit.group.${g.key}`).toUpperCase()}
                </Text>
                <Card padded={false}>
                  {g.items.map((e, i) => {
                    const meta = metaFor(e.action, e.resource);
                    const detailText = formatDetails(e.details);
                    const actor =
                      e.actorName || e.actorId || t("audit.actorSystem");
                    return (
                      <View key={e.id}>
                        <AuditRow
                          icon={meta.icon}
                          tone={meta.tone}
                          title={humanize(e.action)}
                          subtitle={humanize(e.resource)}
                          actor={actor}
                          time={fmtTime(e.createdAt, i18n.language)}
                          details={detailText}
                        />
                        {i < g.items.length - 1 ? <Divider /> : null}
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Single audit entry: tone icon tile + humanized action + meta. */
function AuditRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  actor,
  time,
  details,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle: string;
  actor: string;
  time: string;
  details: string | null;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const pal = useTone(tone);
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
        alignItems: "flex-start",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          backgroundColor: pal.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={pal.fg} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <Text
            style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSubtle }]}
            numberOfLines={1}
          >
            {time}
          </Text>
        </View>
        <Text
          style={[typography.caption, { color: colors.textMuted }]}
          numberOfLines={2}
        >
          {subtitle} · {actor}
        </Text>
        {details ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, marginTop: 2 },
            ]}
            numberOfLines={2}
          >
            {details}
          </Text>
        ) : null}
      </View>
    </View>
  );
}