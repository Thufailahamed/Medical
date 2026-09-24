// Healthcare theme tokens — premium iOS-style system: grouped backgrounds,
// continuous corners, hairline separators, soft layered depth. Light + dark.
// All UI components must consume `useTheme()`; raw hex belongs only here.

import { Easing } from "react-native-reanimated";

// ---------- Palette (raw hex) ----------

export const palette = {
  cyan: {
    50: "#ECFEFF",
    100: "#CFFAFE",
    200: "#A5F3FC",
    300: "#67E8F9",
    400: "#22D3EE",
    500: "#06B6D4",
    600: "#0891B2",
    700: "#0E7490",
    800: "#155E75",
    900: "#164E63",
    950: "#083344",
  },
  emerald: {
    50: "#ECFDF5",
    100: "#D1FAE5",
    200: "#A7F3D0",
    300: "#6EE7B7",
    400: "#34D399",
    500: "#10B981",
    600: "#059669",
    700: "#047857",
    800: "#065F46",
    900: "#064E3B",
  },
  red: {
    50: "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA",
    300: "#FCA5A5",
    400: "#F87171",
    500: "#EF4444",
    600: "#DC2626",
    700: "#B91C1C",
    800: "#991B1B",
    900: "#7F1D1D",
  },
  amber: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    200: "#FDE68A",
    300: "#FCD34D",
    400: "#FBBF24",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
    800: "#92400E",
    900: "#78350F",
  },
  sky: {
    50: "#F0F9FF",
    100: "#E0F2FE",
    200: "#BAE6FD",
    300: "#7DD3FC",
    400: "#38BDF8",
    500: "#0EA5E9",
    600: "#0284C7",
    700: "#0369A1",
    800: "#075985",
    900: "#0C4A6E",
  },
  coral: {
    50: "#FFF7F4",
    100: "#FFEDE5",
    200: "#FFD6C5",
    300: "#FFB89B",
    400: "#FF9670",
    500: "#FF7A59",
    600: "#E85F3D",
    700: "#C24827",
    800: "#9A3A1F",
    900: "#7C3119",
  },
  teal: {
    50: "#F0FDFA",
    100: "#CCFBF1",
    200: "#99F6E4",
    300: "#5EEAD4",
    400: "#2DD4BF",
    500: "#14B8A6",
    600: "#0D9488",
    700: "#0F766E",
    800: "#115E59",
    900: "#134E4A",
  },
  slate: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
    950: "#020617",
  },
  white: "#FFFFFF",
  black: "#000000",
} as const;

// ---------- Semantic color tokens ----------
// Premium iOS-style semantics: grouped backgrounds, elevated surfaces,
// hairline separators and translucent fills (mirrors UIKit system colors).

type ColorScheme = {
  bg: string;
  bgElevated: string;
  bgMuted: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceSubtle: string;
  surfaceElevated: string;
  surface2: string;
  card: string;
  fill: string;
  fillStrong: string;
  separator: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  textSubtle: string;
  textInverse: string;
  border: string;
  borderSubtle: string;
  borderSoft: string;
  borderMuted: string;
  borderStrong: string;
  borderFocus: string;
  brand: string;
  primary: string;
  primaryStrong: string;
  primaryMuted: string;
  primarySoft: string;
  primaryGradientStart: string;
  primaryGradientEnd: string;
  onPrimary: string;
  secondary: string;
  secondaryMuted: string;
  secondarySoft: string;
  onSecondary: string;
  accent: string;
  accentMuted: string;
  accentSoft: string;
  onAccent: string;
  accent2: string;
  accent2Muted: string;
  accent2Soft: string;
  onAccent2: string;
  orb: string;
  orbDeep: string;
  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassOnPrimary: string;
  glassOnPrimarySoft: string;
  danger: string;
  dangerSoft: string;
  dangerMuted: string;
  onDanger: string;
  success: string;
  successSoft: string;
  successMuted: string;
  successBorder: string;
  onSuccess: string;
  warning: string;
  warningSoft: string;
  warningMuted: string;
  onWarning: string;
  info: string;
  infoSoft: string;
  infoMuted: string;
  onInfo: string;
  overlay: string;
  scrim: string;
  shadow: string;
};

const lightColors: ColorScheme = {
  bg: "#F2F4F8",
  bgElevated: palette.white,
  bgMuted: "#EBEEF3",
  background: "#F2F4F8",
  surface: palette.white,
  surfaceMuted: "#F4F6F9",
  surfaceSubtle: "#F7F8FA",
  surfaceElevated: palette.white,
  surface2: "#F4F6F9",
  card: palette.white,
  fill: "rgba(118, 118, 128, 0.10)",
  fillStrong: "rgba(118, 118, 128, 0.18)",
  separator: "rgba(60, 60, 67, 0.14)",
  text: "#0B1220",
  textMuted: "#586174",
  textSecondary: "#586174",
  textSubtle: "#98A0AE",
  textInverse: palette.white,
  border: "#E7EAF0",
  borderSubtle: "#EEF0F4",
  borderSoft: "#EEF0F4",
  borderMuted: "#EEF0F4",
  borderStrong: "#D3D8E0",
  borderFocus: palette.sky[500],
  brand: palette.sky[600],
  primary: palette.sky[600],
  primaryStrong: palette.sky[700],
  primaryMuted: palette.sky[700],
  primarySoft: "#E4F2FC",
  primaryGradientStart: "#0EA5E9",
  primaryGradientEnd: "#0369A1",
  onPrimary: palette.white,
  secondary: palette.sky[400],
  secondaryMuted: palette.sky[500],
  secondarySoft: palette.sky[50],
  onSecondary: palette.slate[900],
  accent: palette.emerald[600],
  accentMuted: palette.emerald[700],
  accentSoft: "#E6F7EF",
  onAccent: palette.white,
  accent2: palette.coral[500],
  accent2Muted: palette.coral[700],
  accent2Soft: "#FFF1EB",
  onAccent2: palette.white,
  orb: palette.sky[300],
  orbDeep: palette.sky[700],
  glass: "rgba(255, 255, 255, 0.78)",
  glassStrong: "rgba(255, 255, 255, 0.92)",
  glassBorder: "rgba(255, 255, 255, 0.9)",
  glassOnPrimary: "rgba(255, 255, 255, 0.18)",
  glassOnPrimarySoft: "rgba(255, 255, 255, 0.85)",
  danger: "#E5383B",
  dangerSoft: "#FDECEC",
  dangerMuted: palette.red[700],
  onDanger: palette.white,
  success: palette.emerald[600],
  successSoft: "#E6F7EF",
  successMuted: palette.emerald[700],
  successBorder: palette.emerald[200],
  onSuccess: palette.white,
  warning: palette.amber[600],
  warningSoft: "#FFF6E0",
  warningMuted: palette.amber[700],
  onWarning: palette.white,
  info: palette.sky[600],
  infoSoft: "#E4F2FC",
  infoMuted: palette.sky[700],
  onInfo: palette.white,
  overlay: "rgba(11, 18, 32, 0.40)",
  scrim: "rgba(11, 18, 32, 0.55)",
  shadow: "#0B1B3A",
};

const darkColors: ColorScheme = {
  bg: "#000000",
  bgElevated: "#1C1C1E",
  bgMuted: "#0E0E10",
  background: "#000000",
  surface: "#1C1C1E",
  surfaceMuted: "#2C2C2E",
  surfaceSubtle: "#242426",
  surfaceElevated: "#2C2C2E",
  surface2: "#2C2C2E",
  card: "#1C1C1E",
  fill: "rgba(118, 118, 128, 0.24)",
  fillStrong: "rgba(118, 118, 128, 0.36)",
  separator: "rgba(84, 84, 88, 0.60)",
  text: "#F5F7FA",
  textMuted: "#A9B0BC",
  textSecondary: "#A9B0BC",
  textSubtle: "#6E7582",
  textInverse: "#0B1220",
  border: "#2C2C2E",
  borderSubtle: "#242426",
  borderSoft: "#242426",
  borderMuted: "#242426",
  borderStrong: "#3A3A3C",
  borderFocus: palette.sky[400],
  brand: palette.sky[400],
  primary: palette.sky[400],
  primaryStrong: palette.sky[300],
  primaryMuted: palette.sky[300],
  primarySoft: "rgba(56, 189, 248, 0.16)",
  primaryGradientStart: "#38BDF8",
  primaryGradientEnd: "#0284C7",
  onPrimary: "#04121F",
  secondary: palette.sky[300],
  secondaryMuted: palette.sky[200],
  secondarySoft: "rgba(14, 165, 233, 0.10)",
  onSecondary: palette.slate[950],
  accent: palette.emerald[400],
  accentMuted: palette.emerald[300],
  accentSoft: "rgba(16, 185, 129, 0.16)",
  onAccent: palette.slate[950],
  accent2: palette.coral[400],
  accent2Muted: palette.coral[300],
  accent2Soft: "rgba(255, 122, 89, 0.16)",
  onAccent2: palette.slate[950],
  orb: palette.sky[500],
  orbDeep: palette.sky[900],
  glass: "rgba(28, 28, 30, 0.78)",
  glassStrong: "rgba(28, 28, 30, 0.92)",
  glassBorder: "rgba(255, 255, 255, 0.10)",
  glassOnPrimary: "rgba(255, 255, 255, 0.10)",
  glassOnPrimarySoft: "rgba(255, 255, 255, 0.78)",
  danger: "#FF6B6B",
  dangerSoft: "rgba(255, 107, 107, 0.16)",
  dangerMuted: palette.red[300],
  onDanger: palette.slate[950],
  success: palette.emerald[400],
  successSoft: "rgba(52, 211, 153, 0.16)",
  successMuted: palette.emerald[300],
  successBorder: "rgba(52, 211, 153, 0.35)",
  onSuccess: palette.slate[950],
  warning: palette.amber[400],
  warningSoft: "rgba(251, 191, 36, 0.16)",
  warningMuted: palette.amber[300],
  onWarning: palette.slate[950],
  info: palette.sky[400],
  infoSoft: "rgba(56, 189, 248, 0.16)",
  infoMuted: palette.sky[300],
  onInfo: palette.slate[950],
  overlay: "rgba(0, 0, 0, 0.6)",
  scrim: "rgba(0, 0, 0, 0.75)",
  shadow: "#000000",
};

export const colors = {
  light: lightColors,
  dark: darkColors,
} as const;

// ---------- Spacing scale ----------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 56,
} as const;

// ---------- Radius ----------

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
  xxxxl: 40,
  xxxxxl: 56,
  glass: 24,
  card: 22,
  button: 16,
  field: 14,
  pill: 9999,
  full: 9999,
} as const;

// ---------- Typography ----------

export const fontFamily = {
  display: "PlusJakartaSans_600SemiBold",
  displayBold: "PlusJakartaSans_700Bold",
  body: "PlusJakartaSans_400Regular",
  bodyMedium: "PlusJakartaSans_500Medium",
  bodySemibold: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
  heavy: "PlusJakartaSans_800ExtraBold",
  mono: "PlusJakartaSans_400Regular",
} as const;

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight?: "400" | "500" | "600" | "700";
};

const t = (
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number
): TypeStyle => ({ fontFamily, fontSize, lineHeight, letterSpacing });

// iOS-inspired type ramp (Large Title 34 -> Caption 12) with tight tracking
// on display sizes, the way SF Pro Display tightens as it grows.
export const typography = {
  display: {
    lg: t(fontFamily.heavy, 34, 41, -0.9),
    md: t(fontFamily.displayBold, 28, 34, -0.7),
    sm: t(fontFamily.displayBold, 22, 28, -0.45),
  },
  heading: {
    h1: t(fontFamily.heavy, 34, 41, -0.9),
    h2: t(fontFamily.displayBold, 28, 34, -0.7),
    h3: t(fontFamily.displayBold, 22, 28, -0.45),
  },
  title: {
    lg: t(fontFamily.displayBold, 20, 25, -0.35),
    md: t(fontFamily.bodyBold, 17, 22, -0.25),
    sm: t(fontFamily.bodySemibold, 15, 20, -0.15),
    xs: t(fontFamily.bodySemibold, 13, 18, -0.05),
  },
  body: {
    lg: t(fontFamily.body, 17, 24, -0.2),
    md: t(fontFamily.body, 15, 21, -0.1),
    sm: t(fontFamily.body, 13, 18, 0),
    xs: t(fontFamily.body, 12, 16, 0),
  },
  label: {
    lg: t(fontFamily.bodySemibold, 15, 20, -0.1),
    md: t(fontFamily.bodySemibold, 13, 18, 0),
    sm: t(fontFamily.bodySemibold, 12, 16, 0),
    xs: t(fontFamily.bodyBold, 11, 14, 0.2),
  },
  caption: t(fontFamily.bodyMedium, 12, 16, 0),
  overline: t(fontFamily.bodyBold, 11, 14, 0.8),
} as const;

// ---------- Shadow / elevation ----------

type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

const SHADOW_INK = "#0B1B3A";

// Soft, wide, low-opacity shadows: iOS cards float, they don't cast.
export const shadow = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } as ShadowStyle,
  xs: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  } as ShadowStyle,
  sm: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  } as ShadowStyle,
  md: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 4,
  } as ShadowStyle,
  lg: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 8,
  } as ShadowStyle,
  hero: {
    shadowColor: palette.sky[700],
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  } as ShadowStyle,
  glass: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 12,
  } as ShadowStyle,
  primary: {
    shadowColor: palette.sky[600],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  } as ShadowStyle,
  sos: {
    shadowColor: palette.red[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  } as ShadowStyle,
} as const;

// ---------- Motion ----------

export const motion = {
  duration: {
    instant: 80,
    fast: 120,
    base: 200,
    slow: 320,
    pulse: 1500,
    sosPulse: 800,
  },
  easing: {
    standard: Easing.bezier(0.4, 0, 0.2, 1),
    decelerate: Easing.bezier(0, 0, 0.2, 1),
    accelerate: Easing.bezier(0.4, 0, 1, 1),
    spring: Easing.elastic(1),
  },
  spring: {
    snappy: { damping: 18, stiffness: 240, mass: 0.6 },
    press: { damping: 20, stiffness: 420, mass: 0.5 },
    gentle: { damping: 22, stiffness: 180, mass: 0.8 },
    soft: { damping: 26, stiffness: 160, mass: 1 },
  },
} as const;

// ---------- Opacity ----------

export const opacity = {
  disabled: 0.4,
  pressed: 0.7,
  scrim: 0.5,
  hover: 0.85,
} as const;

// ---------- Layout ----------

export const layout = {
  hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
  minTouch: 44,
  tabBarHeight: 84,
  tabBarRadius: 30,
  headerHeight: 56,
  heroHeightRatio: 0.4,
  fabSize: 56,
} as const;

// Back-compat exports for existing code that still imports these names.
export { spacing as space };
export { radius as radii };
export { radius as borderRadius };
export { shadow as shadows };
export { typography as type };

// Convenience helpers
export function withOpacity(hex: string, alpha: number): string {
  // accepts #RRGGBB or rgba()
  if (hex.startsWith("rgba")) return hex;
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
