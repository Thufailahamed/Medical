import { useTheme } from "./ThemeProvider";

// Single source of truth for tone → bg/fg mapping.
// All UI components (Pill, Chip, Card, StatCard, EmptyState, Avatar, IconButton,
// ListItem, NextActionCard, Timeline, DoseRing, FloatingActionButton, page-level
// chips/badges) MUST go through this helper — no inline ternary chains.

export type Tone =
  | "primary"
  | "accent"
  | "accent2"
  | "warning"
  | "danger"
  | "info"
  | "success"
  | "neutral";

type ThemeColors = ReturnType<typeof useTheme>["colors"];

export type TonePalette = {
  bg: string;
  bgStrong: string;
  fg: string;
  border: string;
};

export function tonePalette(tone: Tone, colors: ThemeColors): TonePalette {
  switch (tone) {
    case "primary":
      return {
        bg: colors.primarySoft,
        bgStrong: colors.primary,
        fg: colors.primary,
        border: colors.primary,
      };
    case "accent":
      return {
        bg: colors.accentSoft,
        bgStrong: colors.accent,
        fg: colors.accent,
        border: colors.accent,
      };
    case "accent2":
      return {
        bg: colors.accent2Soft,
        bgStrong: colors.accent2,
        fg: colors.accent2,
        border: colors.accent2,
      };
    case "warning":
      return {
        bg: colors.warningSoft,
        bgStrong: colors.warning,
        fg: colors.warning,
        border: colors.warning,
      };
    case "danger":
      return {
        bg: colors.dangerSoft,
        bgStrong: colors.danger,
        fg: colors.danger,
        border: colors.danger,
      };
    case "info":
      return {
        bg: colors.infoSoft,
        bgStrong: colors.info,
        fg: colors.info,
        border: colors.info,
      };
    case "success":
      return {
        bg: colors.successSoft,
        bgStrong: colors.success,
        fg: colors.success,
        border: colors.success,
      };
    case "neutral":
    default:
      return {
        bg: colors.surfaceMuted,
        bgStrong: colors.textMuted,
        fg: colors.textMuted,
        border: colors.borderStrong,
      };
  }
}

export function useTone(tone: Tone): TonePalette {
  const { colors } = useTheme();
  return tonePalette(tone, colors);
}
