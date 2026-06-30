// Healthcare theme tokens — blue + green brand identity, WCAG AAA light + dark.
// Brand: blue (primary) + emerald (accent) + teal (secondary). Coral/orange
// removed so the playful/decorative tones stay inside the blue-green family.
// Semantic tones preserved: danger=red, warning=amber (universal UX meaning).
// All UI components must consume `useTheme()`; raw hex belongs only here.

import { Easing } from "react-native-reanimated";

// ---------- Palette (raw hex) ----------

export const palette = {
  blue: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
    950: "#172554",
  },
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
  green: {
    50: "#F0FDF4",
    100: "#DCFCE7",
    200: "#BBF7D0",
    300: "#86EFAC",
    400: "#4ADE80",
    500: "#22C55E",
    600: "#16A34A",
    700: "#15803D",
    800: "#166534",
    900: "#14532D",
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
  bg: palette.blue[50],
  bgElevated: palette.white,
  surface: palette.white,
  surfaceMuted: palette.slate[50],
  text: palette.slate[900],
  textMuted: palette.slate[600],
  textSubtle: palette.slate[400],
  textInverse: palette.white,
  border: palette.slate[200],
  borderStrong: palette.slate[300],
  borderFocus: palette.blue[500],
  primary: palette.blue[600],
  primaryMuted: palette.blue[700],
  primarySoft: palette.blue[100],
  onPrimary: palette.white,
  secondary: palette.teal[500],
  secondaryMuted: palette.teal[600],
  secondarySoft: palette.teal[50],
  onSecondary: palette.white,
  accent: palette.emerald[600],
  accentMuted: palette.emerald[700],
  accentSoft: palette.emerald[50],
  onAccent: palette.white,
  accent2: palette.teal[400],
  accent2Muted: palette.teal[600],
  accent2Soft: palette.teal[50],
  onAccent2: palette.slate[900],
  orb: palette.blue[300],
  orbDeep: palette.emerald[700],
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
  info: palette.blue[500],
  infoSoft: palette.blue[50],
  infoMuted: palette.blue[700],
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
  borderFocus: palette.blue[400],
  primary: palette.blue[400],
  primaryMuted: palette.blue[300],
  primarySoft: "rgba(59, 130, 246, 0.16)",
  onPrimary: palette.slate[950],
  secondary: palette.teal[400],
  secondaryMuted: palette.teal[300],
  secondarySoft: "rgba(20, 184, 166, 0.14)",
  onSecondary: palette.slate[950],
  accent: palette.emerald[400],
  accentMuted: palette.emerald[300],
  accentSoft: "rgba(16, 185, 129, 0.14)",
  onAccent: palette.slate[950],
  accent2: palette.teal[300],
  accent2Muted: palette.teal[200],
  accent2Soft: "rgba(45, 212, 191, 0.14)",
  onAccent2: palette.slate[950],
  orb: palette.blue[500],
  orbDeep: palette.emerald[700],
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
  info: palette.blue[400],
  infoSoft: "rgba(59, 130, 246, 0.16)",
  infoMuted: palette.blue[300],
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
  display: "Outfit_600SemiBold",
  displayBold: "Outfit_700Bold",
  body: "Outfit_400Regular",
  bodyMedium: "Outfit_500Medium",
  bodySemibold: "Outfit_600SemiBold",
  bodyBold: "Outfit_700Bold",
  heavy: "Outfit_800ExtraBold",
  mono: "Outfit_400Regular",
} as const;

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight?: "400" | "500" | "600" | "700";
};

export const typography = {
  display: {
    lg: {
      fontFamily: fontFamily.displayBold,
      fontSize: 36,
      lineHeight: 44,
      letterSpacing: -0.5,
    } as TypeStyle,
    md: {
      fontFamily: fontFamily.displayBold,
      fontSize: 28,
      lineHeight: 36,
      letterSpacing: -0.4,
    } as TypeStyle,
    sm: {
      fontFamily: fontFamily.display,
      fontSize: 22,
      lineHeight: 30,
      letterSpacing: -0.2,
    } as TypeStyle,
  },
  title: {
    lg: {
      fontFamily: fontFamily.display,
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: -0.1,
    } as TypeStyle,
    md: {
      fontFamily: fontFamily.bodySemibold,
      fontSize: 17,
      lineHeight: 24,
      letterSpacing: 0,
    } as TypeStyle,
    sm: {
      fontFamily: fontFamily.bodySemibold,
      fontSize: 15,
      lineHeight: 22,
      letterSpacing: 0,
    } as TypeStyle,
  },
  body: {
    lg: {
      fontFamily: fontFamily.body,
      fontSize: 17,
      lineHeight: 26,
      letterSpacing: 0,
    } as TypeStyle,
    md: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      lineHeight: 22,
      letterSpacing: 0,
    } as TypeStyle,
    sm: {
      fontFamily: fontFamily.body,
      fontSize: 13,
      lineHeight: 20,
      letterSpacing: 0,
    } as TypeStyle,
  },
  label: {
    lg: {
      fontFamily: fontFamily.bodySemibold,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: 0,
    } as TypeStyle,
    md: {
      fontFamily: fontFamily.bodySemibold,
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.2,
    } as TypeStyle,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  } as TypeStyle,
  overline: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
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
    shadowColor: palette.blue[700],
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
    shadowColor: palette.blue[600],
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
