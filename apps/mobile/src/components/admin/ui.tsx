import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, useTone, type Tone } from "@/theme/tone";
import {
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
  const label = (status ?? "unknown").replace(/_/g, " ");
  return (
    <Pill
      label={label}
      tone={statusTone(status)}
      size="sm"
      style={{ textTransform: "capitalize" } as any}
    />
  );
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: "row",
        gap: spacing.sm,
        paddingHorizontal: flush ? 0 : spacing.lg,
        paddingVertical: spacing.xs,
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

export function AdminError({ message }: { message?: string }) {
  const { colors, spacing, typography } = useTheme();
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
