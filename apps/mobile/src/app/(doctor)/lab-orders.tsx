// @ts-nocheck

import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDate } from "@/lib/format";
import {
  AlertTriangle,
  ChevronRight,
  FlaskConical,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  FileText,
  Loader,
  TestTube2,
  Users,
} from "lucide-react-native";
import { useLabOrders, useUpdateLabOrder } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  EmptyState,
  ErrorState,
  Skeleton,
  MetricStrip,
  useToast,
  Button,
  IconTile,
} from "@/components/ui";

type Filter = "" | "ordered" | "sample_collected" | "in_progress" | "completed";

const NEXT: Record<string, string> = {
  ordered: "sample_collected",
  sample_collected: "in_progress",
  in_progress: "completed",
};

function statusTone(s: string): any {
  switch (s) {
    case "completed":
      return "success";
    case "in_progress":
      return "warning";
    case "sample_collected":
      return "info";
    case "cancelled":
      return "danger";
    default:
      return "primary";
  }
}

function statusIcon(s: string) {
  switch (s) {
    case "completed":
      return CheckCircle2;
    case "in_progress":
      return CircleDot;
    case "sample_collected":
      return CircleDashed;
    default:
      return CircleDashed;
  }
}

function parseTests(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const isOpen = (o: any) => o.status !== "completed" && o.status !== "cancelled";
const isUrgent = (o: any) => o.priority === "stat" || o.priority === "urgent";

export default function LabOrdersList() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();

  const [status, setStatus] = useState<Filter>("");
  // One fetch for every stage so the filter counts and summary strip stay
  // in sync; filtering happens on the client.
  const { data, isLoading, isError, refetch, isRefetching } = useLabOrders();
  const updateOrder = useUpdateLabOrder();

  const all: any[] = data?.orders || [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      "": all.length,
      ordered: 0,
      sample_collected: 0,
      in_progress: 0,
      completed: 0,
      open: 0,
      urgent: 0,
    };
    for (const o of all) {
      if (o.status in c) c[o.status]++;
      if (isOpen(o)) {
        c.open++;
        if (isUrgent(o)) c.urgent++;
      }
    }
    return c;
  }, [all]);

  // Urgent open orders float to the top; otherwise keep the server's order.
  const orders = useMemo(() => {
    const list = status ? all.filter((o) => o.status === status) : all;
    return [...list].sort(
      (a, b) => Number(isOpen(b) && isUrgent(b)) - Number(isOpen(a) && isUrgent(a))
    );
  }, [all, status]);

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "", label: t("doctorLabOrders.tabs.all") },
    { value: "ordered", label: t("doctorLabOrders.tabs.ordered") },
    { value: "sample_collected", label: t("doctorLabOrders.tabs.sampleCollected") },
    { value: "in_progress", label: t("doctorLabOrders.tabs.inProgress") },
    { value: "completed", label: t("doctorLabOrders.tabs.completed") },
  ];

  const subtitle =
    isLoading || !all.length
      ? t("doctorLabOrders.subtitle")
      : counts.urgent
      ? `${t("doctorLabOrders.subtitleOpen", { count: counts.open })} · ${t("doctorLabOrders.subtitleUrgent", { count: counts.urgent })}`
      : t("doctorLabOrders.subtitleOpen", { count: counts.open });

  async function setOrderStatus(id: string, target: string) {
    try {
      await updateOrder.mutateAsync({ id, status: target as any });
      toast.show(
        t("doctorLabOrders.marked", {
          status: t(`doctorLabOrders.steps.${target}`, { defaultValue: target.replace(/_/g, " ") }),
        }),
        "success"
      );
    } catch (err: any) {
      toast.show(err?.message || t("doctorLabOrders.updateError"), "danger");
    }
  }

  const activeLabel = FILTERS.find((f) => f.value === status)?.label ?? "";

  return (
    <Screen
      padded={false}
      scroll
      edges={["top"]}
      bottomInset
      onRefresh={() => refetch()}
      refreshing={isRefetching && !isLoading}
    >
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorLabOrders.title")}
        subtitle={subtitle}
      />

      {!isLoading && !isError && all.length > 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <MetricStrip
            size="md"
            items={[
              {
                icon: TestTube2,
                label: t("doctorLabOrders.metrics.toCollect"),
                value: counts.ordered,
                tone: "primary",
                onPress: () => setStatus("ordered"),
              },
              {
                icon: Loader,
                label: t("doctorLabOrders.metrics.processing"),
                value: counts.sample_collected + counts.in_progress,
                tone: "warning",
              },
              {
                icon: AlertTriangle,
                label: t("doctorLabOrders.metrics.urgent"),
                value: counts.urgent,
                tone: counts.urgent ? "danger" : "neutral",
                live: counts.urgent > 0,
              },
              {
                icon: CheckCircle2,
                label: t("doctorLabOrders.metrics.done"),
                value: counts.completed,
                tone: "success",
                onPress: () => setStatus("completed"),
              },
            ]}
          />
        </View>
      ) : null}

      <StatusFilter
        options={FILTERS}
        value={status}
        onChange={setStatus}
        counts={isLoading || isError ? null : counts}
      />

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={168} radius={22} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load lab orders")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : orders.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {status && all.length ? (
            <EmptyState
              icon={FlaskConical}
              title={t("doctorLabOrders.emptyFilteredTitle")}
              message={t("doctorLabOrders.emptyFilteredBody", { stage: activeLabel })}
              tone="primary"
              actionLabel={t("doctorLabOrders.showAll")}
              onAction={() => setStatus("")}
            />
          ) : (
            <>
              <EmptyState
                icon={FlaskConical}
                title={t("doctorLabOrders.emptyTitle")}
                message={t("doctorLabOrders.emptyBody")}
                tone="primary"
                actionLabel={t("doctorLabOrders.cta")}
                onAction={() => router.push("/(doctor)/care-team" as any)}
              />
              <OrderHint />
            </>
          )}
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
          {orders.map((o: any) => (
            <LabOrderCard
              key={o.id}
              o={o}
              onAdvance={() => NEXT[o.status] && setOrderStatus(o.id, NEXT[o.status])}
              onComplete={() => setOrderStatus(o.id, "completed")}
              onOpenPatient={
                o.patientId
                  ? () =>
                      router.push({
                        pathname: "/(doctor)/patient-detail",
                        params: { id: o.patientId },
                      } as any)
                  : undefined
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

/** Single-line, horizontally scrolling stage filter with per-stage counts. */
function StatusFilter({
  options,
  value,
  onChange,
  counts,
}: {
  options: { value: Filter; label: string }[];
  value: Filter;
  onChange: (v: Filter) => void;
  counts: Record<string, number> | null;
}) {
  const { colors, spacing, typography, shadow, scheme } = useTheme();
  const isDark = scheme === "dark";
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      accessibilityRole="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const n = counts?.[opt.value];
        return (
          <Pressable
            key={opt.value || "all"}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={n != null ? `${opt.label}, ${n}` : opt.label}
            style={({ pressed }) => [
              {
                height: 38,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingLeft: 16,
                paddingRight: n != null ? 6 : 16,
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: active ? 0 : StyleSheet.hairlineWidth,
                borderColor: colors.hairline,
                opacity: pressed ? 0.8 : 1,
              },
              active
                ? { ...shadow.xs, shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }
                : isDark
                ? null
                : shadow.xs,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[typography.label.md, { color: active ? colors.onPrimary : colors.text }]}
            >
              {opt.label}
            </Text>
            {n != null ? (
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  paddingHorizontal: 7,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? "rgba(255,255,255,0.22)" : colors.well,
                }}
              >
                <Text
                  style={[
                    typography.label.sm,
                    {
                      fontSize: 11,
                      lineHeight: 14,
                      color: active ? colors.onPrimary : colors.textMuted,
                      fontVariant: ["tabular-nums"],
                    },
                  ]}
                >
                  {n}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function LabOrderCard({
  o,
  onAdvance,
  onComplete,
  onOpenPatient,
}: {
  o: any;
  onAdvance: () => void;
  onComplete: () => void;
  onOpenPatient?: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography } = useTheme();
  const danger = useTone("danger");
  const success = useTone("success");

  const tests = parseTests(o.tests);
  const open = isOpen(o);
  const urgent = open && isUrgent(o);
  const next = NEXT[o.status];
  const NextIcon = statusIcon(next ?? o.status);
  const ordered = o.orderedAt ? new Date(o.orderedAt) : null;

  const title = tests[0] || t("doctorLabOrders.fallbackName");
  const extra = tests.length - 1;
  const meta = [
    o.patientName || null,
    ordered && !isNaN(ordered.getTime()) ? fmtDate(ordered, locale) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Card padded={false}>
      {urgent ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 18,
            bottom: 18,
            width: 4,
            borderTopRightRadius: 2,
            borderBottomRightRadius: 2,
            backgroundColor: danger.fg,
          }}
        />
      ) : null}

      <Pressable
        onPress={onOpenPatient}
        disabled={!onOpenPatient}
        accessibilityRole={onOpenPatient ? "button" : undefined}
        accessibilityLabel={onOpenPatient ? `${title}. ${o.patientName ?? ""}` : undefined}
        style={({ pressed }) => ({
          padding: spacing.lg,
          gap: spacing.md,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconTile
            icon={FlaskConical}
            tone={urgent ? (o.priority === "stat" ? "danger" : "warning") : statusTone(o.status)}
            appearance="soft"
            size={44}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {meta ? (
              <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <PillCmp
              label={t(`status.${o.status}`, { defaultValue: String(o.status).replace(/_/g, " ") })}
              tone={statusTone(o.status)}
              size="sm"
            />
            {urgent ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <AlertTriangle size={11} color={danger.fg} strokeWidth={2.6} />
                <Text style={[typography.label.xs, { color: danger.fg, letterSpacing: 0.6 }]}>
                  {t(`doctorLabOrders.priority.${o.priority}`)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {extra > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {tests.slice(1, 5).map((name, i) => (
              <View
                key={`${name}-${i}`}
                style={{
                  paddingHorizontal: 10,
                  height: 26,
                  justifyContent: "center",
                  borderRadius: 13,
                  backgroundColor: colors.well,
                }}
              >
                <Text style={[typography.label.sm, { color: colors.textMuted }]} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
            {tests.length > 5 ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  height: 26,
                  justifyContent: "center",
                  borderRadius: 13,
                  backgroundColor: colors.well,
                }}
              >
                <Text style={[typography.label.sm, { color: colors.textMuted }]}>
                  +{tests.length - 5}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {o.status !== "cancelled" ? <LabProgress status={o.status} /> : null}

        {o.resultSummary ? (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: success.bg,
            }}
          >
            <FileText size={15} color={success.fg} strokeWidth={2.4} style={{ marginTop: 1 }} />
            <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]} numberOfLines={4}>
              {t("doctorLabOrders.result", { value: o.resultSummary })}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {next ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              title={t(`doctorLabOrders.next.${o.status}`)}
              icon={NextIcon}
              variant="primary"
              size="sm"
              onPress={onAdvance}
            />
          </View>
          {/* Skip-to-done shortcut; redundant once the next step *is* done. */}
          {next !== "completed" ? (
            <Pressable
              onPress={onComplete}
              accessibilityRole="button"
              accessibilityLabel={t("doctorLabOrders.complete")}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.successSoft : colors.well,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <CheckCircle2 size={18} color={colors.success} strokeWidth={2.4} />
            </Pressable>
          ) : null}
          {onOpenPatient ? (
            <Pressable
              onPress={onOpenPatient}
              accessibilityRole="button"
              accessibilityLabel={t("doctorFollowUps.openPatientA11y")}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.fillStrong : colors.well,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <ChevronRight size={18} color={colors.textMuted} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Explains where lab orders come from, so an empty list isn't a dead end. */
function OrderHint() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const primary = useTone("primary");
  const steps = [
    t("doctorLabOrders.hint.step1"),
    t("doctorLabOrders.hint.step2"),
    t("doctorLabOrders.hint.step3"),
  ];
  return (
    <Card variant="muted" style={{ marginTop: spacing.sm, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Users size={16} color={primary.fg} strokeWidth={2.4} />
        <Text style={[typography.label.md, { color: colors.text }]}>
          {t("doctorLabOrders.hint.title")}
        </Text>
      </View>
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: primary.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[typography.label.sm, { color: primary.fg }]}>{i + 1}</Text>
          </View>
          <Text style={[typography.body.sm, { color: colors.textMuted, flex: 1 }]}>{s}</Text>
        </View>
      ))}
    </Card>
  );
}

const LAB_STEPS = ["ordered", "sample_collected", "in_progress", "completed"] as const;
const LAB_STEP_LABELS: Record<string, string> = {
  ordered: "Ordered",
  sample_collected: "Collected",
  in_progress: "Processing",
  completed: "Done",
};

/** Four-segment progress rail: ordered → collected → processing → done. */
function LabProgress({ status }: { status: string }) {
  const { colors, typography } = useTheme();
  const { t } = useTranslation();
  const idx = Math.max(0, LAB_STEPS.indexOf(status as any));
  const done = status === "completed";
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {LAB_STEPS.map((step, i) => (
          <View
            key={step}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              backgroundColor:
                i <= idx ? (done ? colors.success : colors.primary) : colors.fill,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {LAB_STEPS.map((step, i) => (
          <Text
            key={step}
            style={[
              typography.caption,
              {
                fontSize: 10.5,
                color: i === idx ? colors.text : colors.textSubtle,
                fontWeight: i === idx ? "700" : "400",
              },
            ]}
          >
            {t(`doctorLabOrders.steps.${step}`, {
              defaultValue: LAB_STEP_LABELS[step],
            })}
          </Text>
        ))}
      </View>
    </View>
  );
}
