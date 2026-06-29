import React from "react";
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";

export type TimelineGroupKey = "today" | "week" | "later" | "past" | string;

type GroupMeta = {
  label: string;
  tone: Tone;
};

const GROUP_META: Record<string, GroupMeta> = {
  today: { label: "Today", tone: "primary" },
  week: { label: "This week", tone: "info" },
  later: { label: "Later", tone: "neutral" },
  past: { label: "Past", tone: "neutral" },
};

type Props<T> = {
  data: T[];
  groupBy: (item: T) => TimelineGroupKey;
  renderItem: (item: T, index: number, groupKey: TimelineGroupKey) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  /** Map from group key → meta label/tone. Falls back to title-cased key. */
  groupMeta?: Partial<Record<string, GroupMeta>>;
  emptyState?: React.ReactNode;
  /** Hide the vertical track line. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Timeline<T>({
  data,
  groupBy,
  renderItem,
  keyExtractor,
  groupMeta,
  emptyState,
  flush,
  style,
}: Props<T>) {
  const { colors, spacing, typography } = useTheme();

  if (!data || data.length === 0) {
    return <View style={style}>{emptyState ?? null}</View>;
  }

  const grouped = new Map<TimelineGroupKey, T[]>();
  for (const item of data) {
    const key = groupBy(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  // Preserve insertion order of first-seen group keys.
  const order = Array.from(grouped.keys());

  return (
    <View style={[{ gap: spacing.xl }, style]}>
      {order.map((groupKey, gIdx) => {
        const items = grouped.get(groupKey)!;
        const meta = groupMeta?.[groupKey] ?? GROUP_META[groupKey] ?? {
          label: titleCase(groupKey),
          tone: "neutral" as Tone,
        };
        const isLast = gIdx === order.length - 1;
        return (
          <View key={groupKey} style={{ gap: spacing.md }}>
            <GroupHeader
              label={meta.label}
              count={items.length}
              tone={meta.tone}
            />
            <View
              style={[
                styles.list,
                !flush && {
                  paddingLeft: 4,
                  borderLeftWidth: 1.5,
                  borderLeftColor: colors.border,
                  marginLeft: 7,
                },
              ]}
            >
              {items.map((item, idx) => {
                const isLastItem = idx === items.length - 1 && isLast;
                return (
                  <View
                    key={keyExtractor(item, idx)}
                    style={[
                      styles.itemWrap,
                      idx < items.length - 1 && { marginBottom: spacing.sm },
                    ]}
                  >
                    {!flush ? (
                      <NodeDot tone={meta.tone} dim={isLastItem} />
                    ) : null}
                    <View style={[!flush && { paddingLeft: spacing.md }]}>
                      {renderItem(item, idx, groupKey)}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function GroupHeader({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: Tone;
}) {
  const { spacing, typography, radius } = useTheme();
  const { fg, bg } = useTone(tone);
  return (
    <View
      style={[
        styles.groupHeader,
        {
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: 3,
          backgroundColor: bg,
          borderRadius: radius.full,
          alignSelf: "flex-start",
        },
      ]}
    >
      <Text
        style={[
          typography.overline,
          { color: fg },
        ]}
      >
        {label.toUpperCase()} · {count}
      </Text>
    </View>
  );
}

function NodeDot({ tone, dim }: { tone: Tone; dim: boolean }) {
  const { fg, bg } = useTone(tone);
  return (
    <View
      style={[
        styles.node,
        {
          backgroundColor: bg,
          borderColor: fg,
          top: 18,
        },
        dim && { opacity: 0.3 },
      ]}
    />
  );
}

function titleCase(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  list: {},
  itemWrap: {
    position: "relative",
  },
  node: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    left: -8,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
});
