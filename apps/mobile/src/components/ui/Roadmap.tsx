import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
// Minimal ref shape — caller passes a ref to any ScrollView (regular or
// Animated) with `.current?.scrollTo({ y, animated })`. Typed as a structural
// interface so we don't have to lock the caller into one Animated variant.
type ScrollableRef = {
  current: { scrollTo?: (opts: { y: number; animated?: boolean }) => void } | null;
};
import { ChevronDown, MapPin } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";
import { intlLocale } from "@/lib/format";
import { useTone } from "@/theme/tone";
import { Skeleton } from "./Skeleton";
import { Pill } from "./Pill";
import { Pressable } from "./Pressable";

export type Rank = 1 | 2 | 3;

export type ImportanceMeta = {
  /** Visual weight — drives dot size and emphasis. */
  rank: Rank;
  /** Primary color for the dot and card accent border. */
  color: string;
  /** Short human label for the type ("Lab", "Surgery"). */
  label: string;
};

export type RoadmapItemBase = {
  /** Stable id used for scroll-jump and key extraction. */
  id: string;
  /** ISO date string or Date instance. */
  date: string | Date;
  /** Record type — looked up in `importance` for color/rank. */
  type: string;
};

export type RoadmapProps<T extends RoadmapItemBase> = {
  items: T[];
  /** Caller-supplied ref to the outer ScrollView — needed so the mini-map
   *  can scroll to a tapped record. Compatible with both regular and
   *  `Animated.ScrollView` refs. */
  scrollRef: ScrollableRef;
  /** Offset (px) the scroll target needs to account for chrome above the
   *  roadmap (hero, filter chips, etc.). Added to each item's local y before
   *  passing to `ScrollView.scrollTo`. Default 0. */
  topOffset?: number;
  /** Render the card body for a single item. */
  renderItem: (item: T) => React.ReactNode;
  /** Map type → { rank, color, label }. Missing keys default to neutral. */
  importance: Record<string, ImportanceMeta>;
  /** Override the dot/rail color for an individual item. */
  colorFor?: (item: T) => string | undefined;
  /** Days of silence before showing a gap callout. Default 180. */
  gapThresholdDays?: number;
  /** Show the bottom mini-map. Default true. */
  miniMap?: boolean;
  /** Outer container style. */
  style?: StyleProp<ViewStyle>;
};

// ─── helpers ──────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dotSizeFor(rank: Rank): number {
  return rank === 3 ? 18 : rank === 2 ? 14 : 10;
}

function diffInDays(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

function humanGap(days: number): string {
  const months = Math.round(days / 30);
  if (months >= 24) return `${Math.round(months / 12)} years between visits`;
  if (months >= 2) return `${months} months between visits`;
  const weeks = Math.max(1, Math.round(days / 7));
  return `${weeks} ${weeks === 1 ? "week" : "weeks"} between visits`;
}

function formatToday(locale: string, d = new Date()): string {
  return new Intl.DateTimeFormat(intlLocale(locale as any), {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
    .format(d)
    .toUpperCase();
}

// ─── Component ────────────────────────────────────────────

export function Roadmap<T extends RoadmapItemBase>({
  items,
  scrollRef,
  topOffset = 0,
  renderItem,
  importance,
  colorFor,
  gapThresholdDays = 180,
  miniMap = true,
  style,
}: RoadmapProps<T>) {
  const { colors, spacing, typography, radius, shadow } = useTheme();
  const locale = useLocaleStore((s) => s.locale);

  // ─── Year groups ────────────────────────────────────────
  const yearGroups = useMemo(() => {
    const map = new Map<number, T[]>();
    for (const it of items) {
      const d = toDate(it.date);
      const y = d ? d.getFullYear() : 0;
      const bucket = map.get(y) ?? [];
      bucket.push(it);
      map.set(y, bucket);
    }
    // newest year first
    return Array.from(map.entries()).sort(([a], [b]) => b - a);
  }, [items]);

  // ─── Per-item y-offsets (for mini-map jumps) ────────────
  const yOffsetsRef = useRef<Map<string, number>>(new Map());
  const captureOffset = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      yOffsetsRef.current.set(id, e.nativeEvent.layout.y);
    },
    []
  );

  const scrollToId = useCallback(
    (id: string) => {
      const y = yOffsetsRef.current.get(id);
      if (y == null) return;
      const target = Math.max(0, y + topOffset - 24);
      scrollRef.current?.scrollTo?.({ y: target, animated: true });
    },
    [scrollRef, topOffset]
  );

  const [miniOpen, setMiniOpen] = useState(false);

  // ─── Render ─────────────────────────────────────────────
  return (
    <View style={style}>
      {/* Today pin */}
      <View style={styles.todayRow}>
        <View
          style={[
            styles.todayDot,
            {
              backgroundColor: colors.primary,
              borderColor: colors.surface,
              marginRight: spacing.md,
            },
          ]}
        />
        <Pill
          label={`TODAY · ${formatToday(locale)}`}
          tone="primary"
          icon={MapPin}
          size="sm"
        />
      </View>

      {/* The rail + items */}
      <View style={{ position: "relative", marginTop: spacing.md }}>
        {/* Vertical rail (continuous, behind everything) */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: RAIL_INSET,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: colors.border,
            borderRadius: 1,
          }}
        />

        {yearGroups.map(([year, yearItems], gi) => {
          const visitCount = yearItems.filter(
            (i) => importance[i.type]?.rank === 3
          ).length;
          return (
            <View key={year || "undated"} style={{ marginBottom: spacing.lg }}>
              {/* Year checkpoint */}
              <YearCheckpoint
                year={year}
                count={yearItems.length}
                visits={visitCount}
                isFirst={gi === 0}
              />

              {/* Items under this year */}
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {yearItems.map((item, idx) => {
                  const meta = importance[item.type] ?? {
                    rank: 1 as Rank,
                    color: colors.textMuted,
                    label: item.type,
                  };
                  const dotColor = colorFor?.(item) ?? meta.color;
                  const prev = yearItems[idx - 1];
                  let gapDays: number | null = null;
                  if (prev) {
                    const a = toDate(prev.date);
                    const b = toDate(item.date);
                    if (a && b) {
                      const dd = diffInDays(a, b);
                      if (dd >= gapThresholdDays) gapDays = dd;
                    }
                  }
                  return (
                    <React.Fragment key={item.id}>
                      {gapDays != null ? (
                        <GapCallout days={gapDays} />
                      ) : null}
                      <ItemRow
                        item={item}
                        meta={meta}
                        dotColor={dotColor}
                        onLayoutCapture={captureOffset(item.id)}
                      >
                        {renderItem(item)}
                      </ItemRow>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          );
        })}

        {items.length === 0 ? null : (
          <View
            style={[
              styles.tailDot,
              {
                left: RAIL_INSET - 4,
                backgroundColor: colors.border,
                borderColor: colors.surface,
              },
            ]}
          />
        )}
      </View>

      {/* Mini-map */}
      {miniMap && items.length > 1 ? (
        <View style={{ marginTop: spacing.xl }}>
          <Pressable
            onPress={() => setMiniOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle journey map"
            haptic="light"
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.full,
              alignSelf: "center",
            }}
          >
            <Text
              style={[
                typography.label.md,
                { color: colors.primary, fontWeight: "700" },
              ]}
            >
              {miniOpen ? "Hide journey map" : "Show journey map"}
            </Text>
            <ChevronDown
              size={14}
              color={colors.primary}
              strokeWidth={2.5}
              style={{
                marginLeft: 6,
                transform: [{ rotate: miniOpen ? "180deg" : "0deg" }],
              }}
            />
          </Pressable>

          {miniOpen ? (
            <View
              style={[
                styles.miniWrap,
                {
                  marginTop: spacing.sm,
                  padding: spacing.md,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                },
                shadow.sm,
              ]}
            >
              <MiniMap
                items={items}
                importance={importance}
                colorFor={colorFor as ((item: RoadmapItemBase) => string | undefined) | undefined}
                onTap={scrollToId}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────

const RAIL_INSET = 19;

function YearCheckpoint({
  year,
  count,
  visits,
  isFirst,
}: {
  year: number;
  count: number;
  visits: number;
  isFirst: boolean;
}) {
  const { spacing, typography, colors, radius } = useTheme();
  const palette = useTone("primary");
  return (
    <View
      style={[
        styles.yearWrap,
        {
          paddingTop: isFirst ? 0 : spacing.lg,
          marginBottom: spacing.xs,
        },
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: isFirst ? 8 : spacing.lg + 14,
          height: 1,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          borderStyle: "dashed",
        }}
      />
      <View
        style={[
          styles.yearBadge,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
            borderRadius: radius.full,
          },
        ]}
      >
        <Text
          style={[
            typography.title.sm,
            { color: palette.fg, fontWeight: "800", letterSpacing: 0.5 },
          ]}
        >
          {year === 0 ? "UNDATED" : year}
        </Text>
      </View>
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, marginTop: 6, textAlign: "center" },
        ]}
      >
        {count} {count === 1 ? "record" : "records"}
        {visits > 0 ? ` · ${visits} ${visits === 1 ? "visit" : "visits"}` : ""}
      </Text>
    </View>
  );
}

function ItemRow({
  item,
  meta,
  dotColor,
  onLayoutCapture,
  children,
}: {
  item: RoadmapItemBase;
  meta: ImportanceMeta;
  dotColor: string;
  onLayoutCapture: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const { spacing, colors } = useTheme();
  const size = dotSizeFor(meta.rank);
  const isHigh = meta.rank === 3;
  return (
    <View
      onLayout={onLayoutCapture}
      style={[styles.row, { marginBottom: spacing.sm }]}
    >
      <View
        style={[
          styles.dotSlot,
          { width: RAIL_INSET * 2, marginRight: spacing.md },
        ]}
      >
        <View
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: dotColor,
              borderColor: colors.surface,
              borderWidth: meta.rank === 1 ? 2 : 3,
              ...(isHigh
                ? {
                    shadowColor: dotColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                    elevation: 4,
                  }
                : null),
            },
          ]}
        />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function GapCallout({ days }: { days: number }) {
  const { spacing, typography } = useTheme();
  return (
    <View style={[styles.row, { marginBottom: spacing.sm }]}>
      <View style={{ width: RAIL_INSET * 2, marginRight: spacing.md }} />
      <View style={{ flex: 1, alignItems: "center" }}>
        <Pill
          label={humanGap(days)}
          tone="warning"
          outlined
          size="sm"
        />
      </View>
    </View>
  );
}

function MiniMap({
  items,
  importance,
  colorFor,
  onTap,
}: {
  items: RoadmapItemBase[];
  importance: Record<string, ImportanceMeta>;
  colorFor?: (item: RoadmapItemBase) => string | undefined;
  onTap: (id: string) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const [trackW, setTrackW] = useState(1);

  const positions = useMemo(() => {
    if (items.length === 0)
      return [] as { id: string; left: number; color: string; rank: Rank }[];
    const times = items
      .map((it) => toDate(it.date)?.getTime())
      .filter((t): t is number => t != null);
    if (times.length < 2) {
      return items.map((it) => ({
        id: it.id,
        left: 0.5,
        color:
          colorFor?.(it) ?? importance[it.type]?.color ?? colors.textMuted,
        rank: importance[it.type]?.rank ?? 1,
      }));
    }
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(1, max - min);
    return items.map((it) => {
      const t = toDate(it.date)?.getTime() ?? min;
      return {
        id: it.id,
        left: (t - min) / span,
        color:
          colorFor?.(it) ?? importance[it.type]?.color ?? colors.textMuted,
        rank: importance[it.type]?.rank ?? 1,
      };
    });
  }, [items, importance, colorFor, colors.textMuted]);

  return (
    <View>
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, marginBottom: spacing.sm },
        ]}
      >
        Journey map — tap a dot to jump
      </Text>
      <View
        onLayout={(e) => setTrackW(Math.max(1, e.nativeEvent.layout.width))}
        style={[styles.miniTrack, { height: 56 }]}
      >
        {/* baseline */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 28,
            height: 2,
            backgroundColor: colors.border,
            borderRadius: 1,
          }}
        />

        {/* dots */}
        {positions.map((p) => {
          const size = p.rank === 3 ? 14 : p.rank === 2 ? 10 : 7;
          return (
            <Pressable
              key={p.id}
              onPress={() => onTap(p.id)}
              accessibilityRole="button"
              accessibilityLabel="Jump to record"
              hitSlop={10}
              haptic="light"
            >
              <View
                style={{
                  position: "absolute",
                  left: p.left * trackW - size / 2,
                  top: 28 - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: p.color,
                  borderWidth: 2,
                  borderColor: colors.surface,
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Skeleton variant ─────────────────────────────────────

export function RoadmapSkeleton({ count = 5 }: { count?: number }) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.md, gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", gap: spacing.md }}>
          <Skeleton width={18} height={18} radius={9} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="90%" height={14} />
            <Skeleton width="70%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: RAIL_INSET - 8,
  },
  todayDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  yearWrap: {
    alignItems: "center",
    position: "relative",
  },
  yearBadge: {
    zIndex: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  dotSlot: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 18,
  },
  dot: {
    zIndex: 2,
  },
  tailDot: {
    position: "absolute",
    bottom: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  miniWrap: {
    borderWidth: 1,
  },
  miniTrack: {
    position: "relative",
    width: "100%",
  },
});