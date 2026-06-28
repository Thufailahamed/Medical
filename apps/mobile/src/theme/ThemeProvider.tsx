import React, { createContext, useContext, useMemo, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { useThemeStore, type ThemeScheme } from "@/stores/theme";
import {
  colors,
  spacing,
  radius,
  typography,
  shadow,
  motion,
  opacity,
  layout,
  fontFamily,
} from "@/constants/theme";

export type ColorScheme = "light" | "dark";

export type Theme = {
  scheme: ColorScheme;
  preferred: ThemeScheme;
  colors: (typeof colors)["light"];
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  motion: typeof motion;
  opacity: typeof opacity;
  layout: typeof layout;
  fontFamily: typeof fontFamily;
};

const ThemeContext = createContext<Theme | null>(null);

function resolveScheme(preferred: ThemeScheme, system: "light" | "dark" | null | undefined): ColorScheme {
  if (preferred === "light" || preferred === "dark") return preferred;
  return system === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preferred = useThemeStore((s) => s.scheme);
  const system = useColorScheme();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const theme = useMemo<Theme>(() => {
    const scheme = resolveScheme(preferred, system);
    return {
      scheme,
      preferred,
      colors: colors[scheme],
      typography,
      spacing,
      radius,
      shadow,
      motion,
      opacity,
      layout,
      fontFamily,
    };
  }, [preferred, system]);

  // Avoid theme flicker before hydration: still render children, just don't depend on persisted value.
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback to light scheme if used outside provider (e.g. tests).
    return {
      scheme: "light",
      preferred: "system",
      colors: colors.light,
      typography,
      spacing,
      radius,
      shadow,
      motion,
      opacity,
      layout,
      fontFamily,
    };
  }
  return ctx;
}
