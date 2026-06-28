// Healthcare theme tokens — cyan/teal palette, WCAG AAA light + dark.
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

type ColorScheme = {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  border: string;
  borderStrong: string;
  borderFocus: string;
  primary: string;
  primaryMuted: string;
  primarySoft: string;
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
  glassOnPrimary: string;
  glassOnPrimarySoft: string;
  danger: string;
  dangerSoft: string;
  dangerMuted: string;
  onDanger: string;
  success: string;
  successSoft: string;
  successMuted: string;
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
};

const lightColors: ColorScheme = {
  bg: palette.cyan[50],
  bgElevated: palette.white,
  surface: palette.white,
  surfaceMuted: palette.slate[50],
  text: palette.slate[900],
  textMuted: palette.slate[600],
  textSubtle: palette.slate[400],
  textInverse: palette.white,
  border: palette.slate[200],
  borderStrong: palette.slate[300],
  borderFocus: palette.cyan[500],
  primary: palette.cyan[600],
  primaryMuted: palette.cyan[700],
  primarySoft: palette.cyan[100],
  onPrimary: palette.white,
  secondary: palette.cyan[400],
  secondaryMuted: palette.cyan[500],
  secondarySoft: palette.cyan[50],
  onSecondary: palette.slate[900],
  accent: palette.emerald[600],
  accentMuted: palette.emerald[700],
  accentSoft: palette.emerald[50],
  onAccent: palette.white,
  accent2: palette.coral[500],
  accent2Muted: palette.coral[700],
  accent2Soft: palette.coral[50],
  onAccent2: palette.white,
  orb: palette.teal[400],
  orbDeep: palette.teal[800],
  glass: "rgba(255, 255, 255, 0.72)",
  glassOnPrimary: "rgba(255, 255, 255, 0.18)",
  glassOnPrimarySoft: "rgba(255, 255, 255, 0.85)",
  danger: palette.red[600],
  dangerSoft: palette.red[50],
  dangerMuted: palette.red[700],
  onDanger: palette.white,
  success: palette.emerald[600],
  successSoft: palette.emerald[50],
  successMuted: palette.emerald[700],
  onSuccess: palette.white,
  warning: palette.amber[600],
  warningSoft: palette.amber[50],
  warningMuted: palette.amber[700],
  onWarning: palette.white,
  info: palette.sky[600],
  infoSoft: palette.sky[50],
  infoMuted: palette.sky[700],
  onInfo: palette.white,
  overlay: "rgba(15, 23, 42, 0.5)",
  scrim: "rgba(15, 23, 42, 0.6)",
};

const darkColors: ColorScheme = {
  bg: palette.slate[950],
  bgElevated: palette.slate[900],
  surface: palette.slate[900],
  surfaceMuted: palette.slate[800],
  text: palette.slate[50],
  textMuted: palette.slate[300],
  textSubtle: palette.slate[500],
  textInverse: palette.slate[900],
  border: palette.slate[800],
  borderStrong: palette.slate[700],
  borderFocus: palette.cyan[400],
  primary: palette.cyan[400],
  primaryMuted: palette.cyan[300],
  primarySoft: "rgba(34, 211, 238, 0.12)",
  onPrimary: palette.slate[950],
  secondary: palette.cyan[300],
  secondaryMuted: palette.cyan[200],
  secondarySoft: "rgba(34, 211, 238, 0.08)",
  onSecondary: palette.slate[950],
  accent: palette.emerald[400],
  accentMuted: palette.emerald[300],
  accentSoft: "rgba(16, 185, 129, 0.12)",
  onAccent: palette.slate[950],
  accent2: palette.coral[400],
  accent2Muted: palette.coral[300],
  accent2Soft: "rgba(255, 122, 89, 0.14)",
  onAccent2: palette.slate[950],
  orb: palette.teal[500],
  orbDeep: palette.teal[900],
  glass: "rgba(15, 23, 42, 0.72)",
  glassOnPrimary: "rgba(255, 255, 255, 0.10)",
  glassOnPrimarySoft: "rgba(255, 255, 255, 0.78)",
  danger: palette.red[400],
  dangerSoft: "rgba(248, 113, 113, 0.14)",
  dangerMuted: palette.red[300],
  onDanger: palette.slate[950],
  success: palette.emerald[400],
  successSoft: "rgba(52, 211, 153, 0.14)",
  successMuted: palette.emerald[300],
  onSuccess: palette.slate[950],
  warning: palette.amber[400],
  warningSoft: "rgba(251, 191, 36, 0.14)",
  warningMuted: palette.amber[300],
  onWarning: palette.slate[950],
  info: palette.sky[400],
  infoSoft: "rgba(56, 189, 248, 0.14)",
  infoMuted: palette.sky[300],
  onInfo: palette.slate[950],
  overlay: "rgba(0, 0, 0, 0.6)",
  scrim: "rgba(0, 0, 0, 0.75)",
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
  full: 9999,
} as const;

// ---------- Typography ----------

export const fontFamily = {
  display: "Lexend_600SemiBold",
  displayBold: "Lexend_700Bold",
  body: "SourceSans3_400Regular",
  bodyMedium: "SourceSans3_500Medium",
  bodySemibold: "SourceSans3_600SemiBold",
  bodyBold: "SourceSans3_700Bold",
} as const;

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: "400" | "500" | "600" | "700";
};

export const typography = {
  display: {
    lg: {
      fontFamily: fontFamily.displayBold,
      fontSize: 36,
      lineHeight: 44,
      letterSpacing: -0.5,
      fontWeight: "700",
    } as TypeStyle,
    md: {
      fontFamily: fontFamily.displayBold,
      fontSize: 28,
      lineHeight: 36,
      letterSpacing: -0.4,
      fontWeight: "700",
    } as TypeStyle,
    sm: {
      fontFamily: fontFamily.display,
      fontSize: 22,
      lineHeight: 30,
      letterSpacing: -0.2,
      fontWeight: "600",
    } as TypeStyle,
  },
  title: {
    lg: {
      fontFamily: fontFamily.display,
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: -0.1,
      fontWeight: "600",
    } as TypeStyle,
    md: {
      fontFamily: fontFamily.bodySemibold,
      fontSize: 17,
      lineHeight: 24,
      letterSpacing: 0,
      fontWeight: "600",
    } as TypeStyle,
    sm: {
      fontFamily: fontFamily.bodySemibold,
      fontSize: 15,
      lineHeight: 22,
      letterSpacing: 0,
      fontWeight: "600",
    } as TypeStyle,
  },
  body: {
    lg: {
      fontFamily: fontFamily.body,
      fontSize: 17,
      lineHeight: 26,
      letterSpacing: 0,
      fontWeight: "400",
    } as TypeStyle,
    md: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 22,
      letterSpacing: 0,
      fontWeight: "400",
    } as TypeStyle,
    sm: {
      fontFamily: fontFamily.body,
      fontSize: 13,
      lineHeight: 20,
      letterSpacing: 0,
      fontWeight: "400",
    } as TypeStyle,
  },
  label: {
    lg: {
      fontFamily: fontFamily.bodySemibold,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: 0,
      fontWeight: "600",
    } as TypeStyle,
    md: {
      fontFamily: fontFamily.bodySemibold,
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.2,
      fontWeight: "600",
    } as TypeStyle,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    fontWeight: "400",
  } as TypeStyle,
  overline: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    fontWeight: "700",
  } as TypeStyle,
} as const;

// ---------- Shadow / elevation ----------

type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export const shadow = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } as ShadowStyle,
  sm: {
    shadowColor: palette.slate[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  } as ShadowStyle,
  md: {
    shadowColor: palette.slate[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  } as ShadowStyle,
  lg: {
    shadowColor: palette.slate[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 6,
  } as ShadowStyle,
  hero: {
    shadowColor: palette.teal[700],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  } as ShadowStyle,
  glass: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 5,
  } as ShadowStyle,
  primary: {
    shadowColor: palette.cyan[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
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
