// @ts-nocheck

import { useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, StyleSheet, LayoutAnimation } from "react-native";
import { useRouter } from "expo-router";
import {
  History,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Bell,
  ShieldAlert,
  ShieldCheck,
  QrCode,
  Download,
  Pill as PillIcon,
  CalendarDays,
  FileText,
  KeyRound,
  Share2,
  ChevronDown,
  Globe,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuditLog } from "@/hooks/useApi";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
import { fmtRelative } from "@/components/records/visual";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Skeleton,
  EmptyState,
  ErrorState,
  Pressable,
  IconTile,
  Button,
} from "@/components/ui";

type Kind = "records" | "prescriptions" | "appointments" | "security" | "other";
type Filter = "all" | Exclude<Kind, "other">;

// Known action codes get a translated verb; everything else is humanized.
const ACTION_LABEL: Record<string, string> = {
  "emergency.sos": "activity.action.emergencySos",
  "record.view": "activity.action.recordView",
  "record.create": "activity.action.recordCreate",
  "record.update": "activity.action.recordUpdate",
  "record.delete": "activity.action.recordDelete",
  "notification.send": "activity.action.notificationSend",
};

function humanize(s: string): string {
  return String(s || "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bQr\b/g, "QR")
    .replace(/\bDsar\b/g, "DSAR");
}

function metaFor(action: string, resource: string): { icon: any; tone: Tone; kind: Kind } {
  const s = `${action} ${resource}`.toLowerCase();
  if (/sos|emergency|revok|denied|fail|breach|unauthoriz/.test(s))
    return { icon: ShieldAlert, tone: "danger", kind: "security" };
  if (/login|auth|session|password|mfa|pin/.test(s)) return { icon: KeyRound, tone: "warning", kind: "security" };
  if (/health_id|qr/.test(s)) return { icon: QrCode, tone: "primary", kind: "security" };
  if (/share|consent|grant/.test(s)) return { icon: Share2, tone: "info", kind: "security" };
  if (/prescription|rx|medicin/.test(s)) return { icon: PillIcon, tone: "accent2", kind: "prescriptions" };
  if (/appoint|visit|consult/.test(s)) return { icon: CalendarDays, tone: "primary", kind: "appointments" };
  if (/dsar|export|download/.test(s)) return { icon: Download, tone: "info", kind: "records" };
  if (/delete/.test(s)) return { icon: Trash2, tone: "danger", kind: "records" };
  if (/create/.test(s)) return { icon: Plus, tone: "success", kind: "records" };
  if (/update|edit/.test(s)) return { icon: Pencil, tone: "warning", kind: "records" };
  if (/view|read|open/.test(s)) return { icon: Eye, tone: "primary", kind: "records" };
  if (/notification/.test(s)) return { icon: Bell, tone: "accent2", kind: "other" };
  if (/record|document|file|lab|imaging/.test(s)) return { icon: FileText, tone: "info", kind: "records" };
  return { icon: History, tone: "neutral", kind: "other" };
}

function formatDetails(d: any): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  if (typeof d !== "object") return String(d);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (v == null || v === "") continue;
    if (/id$/i.test(k) && typeof v === "string" && v.length > 12) continue;
    parts.push(`${humanize(k)}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.length ? parts.join("\n") : null;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "unknown" : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useAuditLog();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // The API responds with `{ entries }`; older builds read `auditLogs`,
  // which never existed — that's why this screen was always empty.
  const entries: any[] = (data as any)?.entries ?? (data as any)?.auditLogs ?? [];

  const withMeta = useMemo(
    () => entries.map((e) => ({ ...e, meta: metaFor(e.action, e.resource) })),
    [entries]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: withMeta.length, records: 0, prescriptions: 0, appointments: 0, security: 0 };
    for (const e of withMeta) if (e.meta.kind in c) c[e.meta.kind]++;
    return c;
  }, [withMeta]);

  const monthAgo = Date.now() - 30 * 86_400_000;
  const last30 = withMeta.filter((e) => new Date(e.createdAt).getTime() >= monthAgo).length;
  const alerts = withMeta.filter((e) => e.meta.tone === "danger").length;

  const groups = useMemo(() => {
    const list = filter === "all" ? withMeta : withMeta.filter((e) => e.meta.kind === filter);
    const out: { key: string; label: string; items: any[] }[] = [];
    const today = dayKey(new Date().toISOString());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = dayKey(y.toISOString());
    for (const e of list) {
      const k = dayKey(e.createdAt);
      let g = out[out.length - 1];
      if (!g || g.key !== k) {
        const label =
          k === today
            ? t("activity.today", "Today")
            : k === yesterday
            ? t("activity.yesterday", "Yesterday")
            : fmtDateLong(new Date(e.createdAt), locale);
        g = { key: k, label, items: [] };
        out.push(g);
      }
      g.items.push(e);
    }
    return out;
  }, [withMeta, filter, locale, t]);

  const toggle = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === id ? null : id));
  }, []);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t("activity.filter.all", "All") },
    { key: "records", label: t("activity.filter.records", "Records") },
    { key: "prescriptions", label: t("activity.filter.prescriptions", "Prescriptions") },
    { key: "appointments", label: t("activity.filter.appointments", "Appointments") },
    { key: "security", label: t("activity.filter.security", "Security") },
  ];

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader back title={t("activity.title")} subtitle={t("activity.subtitle")} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xs, paddingBottom: 120, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.primary} />
        }
      >
        {/* Privacy summary */}
        <Card variant="brand" padded={false}>
          <ShieldCheck
            size={130}
            color="#FFFFFF"
            strokeWidth={1}
            style={{ position: "absolute", right: -26, bottom: -30, opacity: 0.1 }}
            pointerEvents="none"
          />
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <IconTile icon={ShieldCheck} appearance="glass" size={48} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.kicker, { color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }]}>
                  {t("activity.hero.kicker", "Right of access")}
                </Text>
                <Text style={[typography.title.lg, { color: "#FFFFFF", marginTop: 2 }]}>
                  {t("activity.hero.title", "Your record, fully traceable")}
                </Text>
              </View>
            </View>
            <Text style={[typography.body.sm, { color: "rgba(255,255,255,0.88)" }]}>
              {t("activity.hero.body", "Every time your record is opened, changed or shared, it's logged here with who did it and when.")}
            </Text>
            {!isLoading && !isError && entries.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.24)",
                  paddingVertical: spacing.md,
                }}
              >
                <HeroStat value={String(last30)} label={t("activity.hero.last30", "Events · 30d")} />
                <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.3)" }} />
                <HeroStat value={fmtRelative(withMeta[0]?.createdAt, locale) || "—"} label={t("activity.hero.latest", "Latest")} small />
                <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.3)" }} />
                <HeroStat value={String(alerts)} label={t("activity.hero.alerts", "Alerts")} />
              </View>
            ) : null}
          </View>
        </Card>

        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={64} radius={16} />
            <Skeleton height={64} radius={16} />
            <Skeleton height={64} radius={16} />
          </View>
        ) : isError ? (
          <ErrorState
            title={t("recordDetail.errorTitle", "Couldn't load activity")}
            message={t("recordDetail.errorBody", "Check your connection and try again.")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : entries.length === 0 ? (
          <View style={{ gap: spacing.md }}>
            <EmptyState
              icon={History}
              title={t("activity.empty.title")}
              message={t("activity.empty.message")}
              tone="primary"
              style={{ paddingVertical: spacing.xl }}
            />
            <LoggedCard />
            <Button
              title={t("activity.shareCta", "Share records with a doctor")}
              icon={Share2}
              variant="secondary"
              onPress={() => router.push("/(app)/share" as any)}
            />
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -spacing.lg, flexGrow: 0 }}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
            >
              {FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => {
                const on = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    haptic="light"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      height: 36,
                      paddingLeft: 14,
                      paddingRight: 6,
                      borderRadius: 18,
                      backgroundColor: on ? colors.primary : colors.surface,
                      borderWidth: on ? 0 : StyleSheet.hairlineWidth,
                      borderColor: colors.hairline,
                    }}
                  >
                    <Text style={[typography.label.md, { color: on ? colors.onPrimary : colors.text }]}>{f.label}</Text>
                    <View
                      style={{
                        minWidth: 24,
                        height: 24,
                        paddingHorizontal: 7,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: on ? "rgba(255,255,255,0.22)" : colors.well,
                      }}
                    >
                      <Text style={[typography.label.xs, { color: on ? colors.onPrimary : colors.textMuted, letterSpacing: 0 }]}>
                        {counts[f.key]}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {groups.map((g) => (
              <View key={g.key} style={{ gap: spacing.sm }}>
                <Text style={[typography.overline, { color: colors.textSubtle, textTransform: "uppercase", marginLeft: 2 }]}>
                  {g.label}
                </Text>
                <Card padded={false}>
                  {g.items.map((e, i) => (
                    <EntryRow
                      key={e.id || `${g.key}-${i}`}
                      e={e}
                      last={i === g.items.length - 1}
                      open={openId === e.id}
                      onToggle={() => toggle(e.id)}
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

function HeroStat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  const { typography } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 1, paddingHorizontal: 4 }}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[small ? typography.title.sm : typography.title.lg, { color: "#FFFFFF", lineHeight: 28 }]}
      >
        {value}
      </Text>
      <Text style={[typography.caption, { color: "rgba(255,255,255,0.82)" }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function EntryRow({ e, last, open, onToggle }: { e: any; last: boolean; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const Icon = e.meta.icon;
  const title = ACTION_LABEL[e.action] ? t(ACTION_LABEL[e.action]) : humanize(e.action);
  const time = (() => {
    const d = new Date(e.createdAt);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  })();
  const details = formatDetails(e.details);
  const actor = e.actorName || t("activity.actorSystem", "System");
  const expandable = !!details || !!e.ip;

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
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingRight: spacing.lg,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        }}
      >
        <IconTile icon={Icon} tone={e.meta.tone} size={38} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {[t("activity.byActor", { name: actor, defaultValue: `by ${actor}` }), e.resource ? humanize(e.resource) : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {open ? (
            <View style={{ marginTop: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.well, gap: 4 }}>
              {details ? (
                <Text style={[typography.caption, { color: colors.text }]}>{details}</Text>
              ) : null}
              {e.ip ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Globe size={11} color={colors.textSubtle} strokeWidth={2.4} />
                  <Text style={[typography.caption, { color: colors.textSubtle }]}>{e.ip}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4, alignSelf: "flex-start", paddingTop: 2 }}>
          <Text style={[typography.caption, { color: colors.textSubtle, fontVariant: ["tabular-nums"] }]}>{time}</Text>
          {expandable ? (
            <ChevronDown
              size={14}
              color={colors.textSubtle}
              strokeWidth={2.4}
              style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** What the log captures — so an empty log reads as "nothing happened", not "broken". */
function LoggedCard() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const rows = [
    { icon: Eye, tone: "primary", text: t("activity.logged.views", "When a doctor or hospital opens your record") },
    { icon: Pencil, tone: "warning", text: t("activity.logged.changes", "Records, prescriptions and appointments added or changed") },
    { icon: Share2, tone: "info", text: t("activity.logged.sharing", "Share links, Health ID scans and data exports") },
  ];
  return (
    <Card variant="muted" style={{ gap: spacing.md }}>
      <Text style={[typography.kicker, { color: colors.textSubtle, textTransform: "uppercase" }]}>
        {t("activity.logged.title", "What gets logged")}
      </Text>
      {rows.map((r) => (
        <View key={r.text} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconTile icon={r.icon} tone={r.tone as Tone} size={32} />
          <Text style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}>{r.text}</Text>
        </View>
      ))}
    </Card>
  );
}
