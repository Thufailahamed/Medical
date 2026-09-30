import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Switch,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  RotateCw,
  Search,
  X,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, useTone, type Tone } from "@/theme/tone";
import {
  Button,
  Card,
  Chip,
  ListItem,
  Pill,
  Skeleton,
  TextInput,
  Pressable,
  type PillTone,
} from "@/components/ui";

// ─── Status → tone maps ─────────────────────────────────────

export function statusTone(status?: string | null): PillTone {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "approved":
    case "verified":
    case "paid":
    case "completed":
    case "invited":
    case "resolved":
      return "success";
    case "pending":
    case "queued":
    case "submitted":
    case "under_review":
    case "processing":
    case "new":
      return "warning";
    case "suspended":
    case "rejected":
    case "failed":
    case "cancelled":
    case "revoked":
      return "danger";
    case "contacted":
    case "closed":
      return "info";
    default:
      return "neutral";
  }
}

export function StatusPill({ status }: { status?: string | null }) {
  const raw = (status ?? "unknown").replace(/_/g, " ");
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return <Pill label={label} tone={statusTone(status)} size="sm" />;
}

const ROLE_LABELS: Record<string, string> = {
  patient: "Patient",
  doctor: "Doctor",
  caretaker: "Caretaker",
  hospital_admin: "Hospital admin",
  hospital_staff: "Hospital staff",
  laboratory: "Laboratory",
  pharmacy: "Pharmacy",
  insurance: "Insurance",
  ambulance: "Ambulance",
  super_admin: "Super admin",
};

export function roleLabel(role?: string | null): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export function roleTone(role?: string | null): PillTone {
  switch (role) {
    case "doctor":
      return "primary";
    case "patient":
      return "accent";
    case "super_admin":
      return "danger";
    case "hospital_admin":
    case "hospital_staff":
      return "info";
    case "laboratory":
    case "pharmacy":
      return "accent2";
    default:
      return "neutral";
  }
}

export function RolePill({ role }: { role?: string | null }) {
  return <Pill label={roleLabel(role)} tone={roleTone(role)} size="sm" />;
}

// ─── Premium hero header ────────────────────────────────────
// Deep navy → teal gradient card with ambient orbs, glass chips
// and an optional stat strip. Used at the top of every admin page.

export const ADMIN_GRADIENT = ["#082247", "#0A4874", "#0C7888"] as const;

export type HeroStat = {
  icon?: LucideIcon;
  value: string | number;
  label: string;
};

export function AdminHero({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  right,
  stats,
  back = false,
  children,
  compact = false,
  style,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
  stats?: HeroStat[];
  back?: boolean;
  children?: React.ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, typography, radius, scheme } = useTheme();
  const router = useRouter();

  return (
    <View
      style={[
        {
          marginHorizontal: spacing.lg,
          borderRadius: 28,
          borderCurve: "continuous",
          overflow: "hidden",
        },
        scheme === "dark" ? null : shadowHero,
        style,
      ]}
      accessibilityRole="header"
    >
      <LinearGradient
        colors={ADMIN_GRADIENT as unknown as string[]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ambient orbs */}
      <View
        style={{
          position: "absolute",
          top: -56,
          right: -36,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -70,
          left: -46,
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: "rgba(255,255,255,0.05)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 30,
          left: "42%",
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: "rgba(125,211,252,0.10)",
        }}
      />

      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: compact ? spacing.lg : spacing.xl,
          paddingBottom: spacing.lg,
        }}
      >
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(admin)" as any))}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.28)",
              marginBottom: spacing.lg,
              marginLeft: -4,
            }}
          >
            <ArrowLeft size={18} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            {eyebrow ? (
              <Text
                style={[
                  typography.overline,
                  { color: "rgba(255,255,255,0.72)", marginBottom: 6 },
                ]}
                numberOfLines={1}
              >
                {eyebrow.toUpperCase()}
              </Text>
            ) : null}
            <Text
              style={[
                compact ? typography.display.sm : typography.display.md,
                { color: "#FFFFFF" },
              ]}
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  typography.body.md,
                  { color: "rgba(255,255,255,0.78)", marginTop: 4 },
                ]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {Icon ? (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              <Icon size={22} color="#FFFFFF" strokeWidth={2.1} />
            </View>
          ) : null}
          {right}
        </View>

        {children}

        {stats && stats.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginTop: spacing.lg,
            }}
          >
            {stats.map((s, i) => (
              <HeroStatChip key={i} stat={s} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function HeroStatChip({ stat }: { stat: HeroStat }) {
  const { spacing, typography } = useTheme();
  const Icon = stat.icon;
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        borderCurve: "continuous",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 4,
        backgroundColor: "rgba(255,255,255,0.14)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.28)",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        }}
      >
        {Icon ? (
          <Icon size={12} color="rgba(255,255,255,0.85)" strokeWidth={2.4} />
        ) : null}
        <Text
          style={[
            typography.label.xs,
            { color: "rgba(255,255,255,0.78)" },
          ]}
          numberOfLines={1}
        >
          {stat.label}
        </Text>
      </View>
      <Text
        style={[
          typography.display.sm,
          { color: "#FFFFFF", marginTop: 4, fontVariant: ["tabular-nums"] },
        ]}
        numberOfLines={1}
      >
        {stat.value}
      </Text>
    </View>
  );
}

const shadowHero = {
  shadowColor: "#062238",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.28,
  shadowRadius: 24,
  elevation: 8,
} as const;

// ─── Section header ─────────────────────────────────────────

export function AdminSection({
  title,
  count,
  action,
  style,
}: {
  title: string;
  count?: number | string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
          paddingHorizontal: 4,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 }}>
        <Text
          style={[typography.title.lg, { color: colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {count !== undefined ? (
          <View
            style={{
              minWidth: 24,
              height: 22,
              borderRadius: 11,
              paddingHorizontal: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.fill,
            }}
          >
            <Text
              style={[
                typography.label.sm,
                { color: colors.textMuted, fontVariant: ["tabular-nums"] },
              ]}
            >
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      {action}
    </View>
  );
}

// ─── Metric tile ────────────────────────────────────────────

export function AdminStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  onPress,
  style,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, radius, typography, shadow, scheme } = useTheme();
  const { bg, fg } = useTone(tone);

  const body = (
    <View
      style={{
        padding: spacing.lg,
        gap: spacing.md,
        minHeight: 116,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
          }}
        >
          <Icon size={17} color={fg} strokeWidth={2.25} />
        </View>
        {onPress ? (
          <ChevronRight size={16} color={colors.textSubtle} />
        ) : null}
      </View>
      <View>
        <Text
          style={[
            typography.display.md,
            { color: colors.text, fontVariant: ["tabular-nums"] },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        <Text
          style={[typography.label.md, { color: colors.textMuted, marginTop: 2 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, marginTop: 1, fontSize: 11 },
            ]}
            numberOfLines={1}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const container: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
      overflow: "hidden",
    },
    scheme === "dark" ? null : shadow.sm,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={container}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={container}>{body}</View>;
}

/** Two-column responsive grid for AdminStat tiles. */
export function StatGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: number;
}) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.md,
      }}
    >
      {React.Children.map(children, (child) => (
        <View
          style={{
            flexBasis: columns === 2 ? "47%" : "30%",
            flexGrow: 1,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

// ─── Tonal icon tile ────────────────────────────────────────

export function IconTile({
  icon: Icon,
  tone = "primary",
  size = 44,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: number;
}) {
  const { bg, fg } = useTone(tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      <Icon size={size * 0.44} color={fg} strokeWidth={2.25} />
    </View>
  );
}

// ─── Count badge ────────────────────────────────────────────

export function CountBadge({
  count,
  hot,
}: {
  count: number;
  hot?: boolean;
}) {
  const { colors } = useTheme();
  const isHot = hot ?? count > 0;
  return (
    <View
      style={{
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        paddingHorizontal: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isHot ? colors.danger : colors.fill,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "800",
          color: isHot ? colors.onDanger : colors.textMuted,
          fontVariant: ["tabular-nums"],
        }}
      >
        {count}
      </Text>
    </View>
  );
}

// ─── Card list row ──────────────────────────────────────────

export function AdminCard({
  children,
  onPress,
  style,
  tone,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: Tone;
}) {
  const { colors, spacing, radius, shadow, scheme } = useTheme();
  const palette = tone ? tonePalette(tone, colors) : null;
  const container: StyleProp<ViewStyle> = [
    {
      backgroundColor: palette ? palette.bg : colors.surface,
      borderRadius: radius.card,
      borderCurve: "continuous",
      padding: spacing.lg,
      borderWidth: palette ? 0 : StyleSheet.hairlineWidth,
      borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
      overflow: "hidden",
    },
    scheme === "dark" || palette ? null : shadow.sm,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        haptic="light"
        accessibilityRole="button"
        style={container}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={container}>{children}</View>;
}

// ─── Detail sub-panel (muted inset box inside a card) ───────

export function InfoPanel({
  icon: Icon,
  title,
  tone = "primary",
  children,
  style,
}: {
  icon?: LucideIcon;
  title?: string;
  tone?: Tone;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { fg } = useTone(tone);
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          padding: spacing.md,
        },
        style,
      ]}
    >
      {title ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}
        >
          {Icon ? <Icon size={14} color={fg} strokeWidth={2.4} /> : null}
          <Text style={[typography.label.md, { color: fg }]}>
            {title}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

// ─── Divider for inside cards ───────────────────────────────

export function RowDivider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.separator,
        marginLeft: inset,
      }}
    />
  );
}

// ─── Search bar ─────────────────────────────────────────────

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      leadingIcon={Search}
      trailingIcon={value ? X : undefined}
      onTrailingIconPress={() => onChangeText("")}
      tone="soft"
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
    />
  );
}

// ─── Filter chips row ───────────────────────────────────────

export type FilterOption = {
  label: string;
  value: string;
  tone?: Tone;
};

export function FilterChips({
  options,
  value,
  onChange,
  size = "md",
  flush = false,
}: {
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
  /** When true, removes horizontal padding — use inside already-padded containers. */
  flush?: boolean;
}) {
  const { spacing } = useTheme();
  // Extra vertical room (cancelled by negative margin) so the selected chip's
  // coloured shadow isn't clipped into a hard rectangle by the ScrollView.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginVertical: -8, overflow: "visible" }}
      contentContainerStyle={{
        flexDirection: "row",
        gap: spacing.sm,
        paddingHorizontal: flush ? 0 : spacing.lg,
        paddingVertical: spacing.xs + 8,
      }}
    >
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          selected={value === opt.value}
          onPress={() => onChange(opt.value)}
          tone={opt.tone === "neutral" ? undefined : (opt.tone as any)}
          size={size}
        />
      ))}
    </ScrollView>
  );
}

// ─── Segmented control (fixed set of 2–4 filters) ───────────

export function AdminSegmented({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string; count?: number; tone?: Tone }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors, typography, shadow, scheme } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 4,
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: colors.fill,
      }}
      accessibilityRole="tablist"
    >
      {options.map((o) => (
        <SegmentButton
          key={o.value}
          option={o}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
          colors={colors}
          typography={typography}
          lift={scheme !== "dark" ? shadow.xs : null}
        />
      ))}
    </View>
  );
}

function SegmentButton({
  option,
  selected,
  onPress,
  colors,
  typography,
  lift,
}: {
  option: { label: string; count?: number; tone?: Tone };
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  typography: ReturnType<typeof useTheme>["typography"];
  lift: ViewStyle | null;
}) {
  const tone = useTone(option.tone ?? "neutral");
  const hasCount = typeof option.count === "number";
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={hasCount ? `${option.label}, ${option.count}` : option.label}
      style={[
        {
          flex: 1,
          height: 38,
          borderRadius: 12,
          borderCurve: "continuous",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingHorizontal: 6,
          backgroundColor: selected ? colors.surface : "transparent",
        },
        selected ? lift : null,
      ]}
    >
      <Text
        style={[typography.label.md, { color: selected ? colors.text : colors.textMuted, flexShrink: 1 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {option.label}
      </Text>
      {hasCount ? (
        <View
          style={{
            minWidth: 20,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 5,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: option.tone && option.count! > 0 ? tone.bg : selected ? colors.fill : colors.surface,
          }}
        >
          <Text
            style={[
              typography.label.xs,
              {
                color: option.tone && option.count! > 0 ? tone.fg : colors.textMuted,
                fontVariant: ["tabular-nums"],
                letterSpacing: 0,
              },
            ]}
          >
            {option.count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Compact empty state card ───────────────────────────────

export function AdminEmpty({
  icon: Icon,
  title,
  message,
  positive = false,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  /** Green "all caught up" treatment instead of neutral grey. */
  positive?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <AdminCard style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: positive ? colors.successSoft : colors.well,
        }}
      >
        <Icon size={28} color={positive ? colors.success : colors.textMuted} strokeWidth={2.2} />
      </View>
      <Text style={[typography.title.lg, { color: colors.text, marginTop: spacing.lg, textAlign: "center" }]}>
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 280 },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          haptic="light"
          accessibilityRole="button"
          hitSlop={6}
          style={{
            marginTop: spacing.lg,
            height: 36,
            paddingHorizontal: spacing.lg,
            borderRadius: 18,
            justifyContent: "center",
            backgroundColor: colors.fill,
          }}
        >
          <Text style={[typography.label.md, { color: colors.text }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </AdminCard>
  );
}

// ─── "Review ›" call-to-action pill for queue rows ──────────

export function ReviewPill({ label = "Review", tone = "warning" }: { label?: string; tone?: Tone }) {
  const { typography } = useTheme();
  const { bg, fg } = useTone(tone);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        height: 30,
        paddingLeft: 12,
        paddingRight: 8,
        borderRadius: 15,
        backgroundColor: bg,
      }}
    >
      <Text style={[typography.label.sm, { color: fg }]}>{label}</Text>
      <ChevronRight size={14} color={fg} strokeWidth={2.6} />
    </View>
  );
}

// ─── Icon + label + value rows inside a muted panel ─────────

export function DetailRows({
  rows,
}: {
  rows: { icon: LucideIcon; label: string; value: string; tone?: "danger" }[];
}) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing.md,
      }}
    >
      {rows.map((r, i) => {
        const Icon = r.icon;
        return (
          <View
            key={r.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
              borderTopColor: colors.separator,
            }}
          >
            <Icon size={16} color={colors.textSubtle} strokeWidth={2.2} />
            <Text style={[typography.body.sm, { color: colors.textMuted, width: 86 }]}>{r.label}</Text>
            <Text
              style={[
                typography.label.md,
                { color: r.tone === "danger" ? colors.danger : colors.text, flex: 1, textAlign: "right" },
              ]}
              numberOfLines={1}
              ellipsizeMode="middle"
              selectable
            >
              {r.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** "5m ago" / "3d ago"; empty string past 30 days so callers can fall back to a date. */
export function relTime(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const min = Math.floor((Date.now() - t) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : "";
}

// ─── Key-value row for detail cards ─────────────────────────

export function KV({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  const { colors, spacing, typography, fontFamily } = useTheme();
  const display =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: spacing.md,
        paddingVertical: spacing.sm + 3,
      }}
    >
      <Text style={[typography.body.md, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[
          typography.body.md,
          {
            color: colors.text,
            fontWeight: "600",
            fontFamily: mono ? fontFamily.mono : fontFamily.bodySemibold,
            flex: 1,
            textAlign: "right",
          },
        ]}
        numberOfLines={3}
      >
        {display}
      </Text>
    </View>
  );
}

// ─── Loading skeleton rows ──────────────────────────────────

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const { colors, spacing, radius, scheme } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            gap: spacing.md,
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: scheme === "dark" ? colors.borderStrong : colors.separator,
            padding: spacing.lg,
          }}
        >
          <Skeleton width={40} height={40} radius={12} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={11} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Error card ─────────────────────────────────────────────

export function AdminError({
  message,
  title,
  onRetry,
  retrying,
}: {
  message?: string;
  /** When set, renders the richer icon + title + retry layout. */
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  if (!title && !onRetry) {
    return (
      <Card tone="danger" style={{ marginVertical: spacing.sm }}>
        <Text
          style={[
            typography.body.sm,
            { color: colors.danger, fontWeight: "600" },
          ]}
        >
          {message ?? "Something went wrong"}
        </Text>
      </Card>
    );
  }
  return (
    <Card tone="danger" style={{ padding: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <AlertTriangle size={19} color={colors.danger} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <Text
            style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}
            numberOfLines={2}
          >
            {message ?? "Something went wrong"}
          </Text>
        </View>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            disabled={retrying}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Retry"
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              height: 34,
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
              backgroundColor: colors.danger,
              opacity: retrying ? 0.6 : 1,
            }}
          >
            <RotateCw size={13} color={colors.onDanger} strokeWidth={2.6} />
            <Text style={[typography.label.sm, { color: colors.onDanger }]}>
              {retrying ? "Retrying" : "Retry"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

// ─── List row used across admin screens ─────────────────────

export function AdminRow({
  icon,
  iconTone = "primary",
  title,
  subtitle,
  status,
  pill,
  onPress,
}: {
  icon?: LucideIcon;
  iconTone?: Tone;
  title: string;
  subtitle?: string;
  status?: string | null;
  pill?: { label: string; tone?: PillTone };
  onPress?: () => void;
}) {
  return (
    <ListItem
      icon={icon}
      iconTone={iconTone}
      title={title}
      subtitle={subtitle}
      pill={
        pill ??
        (status
          ? {
              label: (status ?? "").replace(/_/g, " "),
              tone: statusTone(status),
            }
          : undefined)
      }
      onPress={onPress}
      showChevron={!!onPress}
    />
  );
}

// ─── Form kit for admin create/edit sheets ──────────────────

/** Titled group of fields inside a sheet. */
export function FormGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.title.sm, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

/** Lays children out in equal-width columns. */
export function FormRow({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {React.Children.map(children, (c) =>
        c ? <View style={{ flex: 1 }}>{c}</View> : null
      )}
    </View>
  );
}

/** Sentence-case label (+ red asterisk / muted hint) above an input. */
export function SheetField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const { colors, typography } = useTheme();
  return (
    <View>
      <Text
        style={[
          typography.label.sm,
          { color: colors.textMuted, marginBottom: 6, marginLeft: 2 },
        ]}
        numberOfLines={1}
      >
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        {hint ? (
          <Text style={{ color: colors.textSubtle, fontWeight: "400" }}>
            {"  "}
            {hint}
          </Text>
        ) : null}
      </Text>
      {children}
    </View>
  );
}

export type ToggleItem = {
  key: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  value: boolean;
  onChange: (v: boolean) => void;
};

/** Grouped list of labelled switches in a muted panel. */
export function ToggleList({ items }: { items: ToggleItem[] }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing.md,
      }}
    >
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <View
            key={it.key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
              borderTopColor: colors.separator,
            }}
          >
            {Icon ? (
              <Icon size={18} color={colors.textMuted} strokeWidth={2.2} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[typography.label.md, { color: colors.text }]}>
                {it.label}
              </Text>
              {it.hint ? (
                <Text style={[typography.caption, { color: colors.textSubtle }]}>
                  {it.hint}
                </Text>
              ) : null}
            </View>
            <Switch
              value={it.value}
              onValueChange={it.onChange}
              trackColor={{ true: colors.primary, false: colors.fillStrong }}
              accessibilityLabel={it.label}
            />
          </View>
        );
      })}
    </View>
  );
}

/** Scrollable sheet body with Cancel / primary action pinned below. */
export function SheetForm({
  children,
  submitLabel,
  onSubmit,
  onCancel,
  loading,
  disabled,
  submitVariant = "primary",
  submitIcon,
}: {
  children: React.ReactNode;
  submitLabel: string;
  submitVariant?: "primary" | "danger";
  submitIcon?: LucideIcon;
  onSubmit: () => void;
  onCancel: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <>
      <ScrollView
        style={{ flexShrink: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xl, paddingBottom: spacing.md }}>
          {children}
        </View>
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingTop: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            title={submitLabel}
            variant={submitVariant}
            icon={submitIcon}
            onPress={onSubmit}
            loading={loading}
            disabled={disabled}
          />
        </View>
      </View>
    </>
  );
}

/** Small grey icon + text tag (e.g. "24h turnaround"). */
export function MetaTag({ icon: Icon, label }: { icon?: LucideIcon; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 26,
        paddingHorizontal: 9,
        borderRadius: 13,
        backgroundColor: colors.well,
      }}
    >
      {Icon ? <Icon size={12} color={colors.textMuted} strokeWidth={2.3} /> : null}
      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
