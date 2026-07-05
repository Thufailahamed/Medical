import React, { useMemo } from "react";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import type { VitalsPoint } from "@/hooks/useApi";

type Props = {
  points: VitalsPoint[];
  width: number;
  height?: number;
  stroke?: string;
};

/**
 * Tiny sparkline for the home-screen vital cards. No axes, no labels —
 * just a smoothed line so the eye can read the trend at a glance.
 */
export function Sparkline({ points, width, height = 36, stroke }: Props) {
  const { colors } = useTheme();

  const path = useMemo(() => {
    if (points.length === 0) return "";
    const vals = points.map((p) => p.value).filter((v) => Number.isFinite(v));
    if (vals.length === 0) return "";
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const padY = 4;
    const innerH = height - padY * 2;
    return points
      .map((p, i) => {
        if (!Number.isFinite(p.value)) return null;
        const x = (i / Math.max(1, points.length - 1)) * width;
        const y = padY + innerH - ((p.value - min) / range) * innerH;
        const cmd = i === 0 ? "M" : "L";
        return `${cmd}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  }, [points, width, height]);

  if (!path) return null;

  const lastIdx = points.length - 1;
  const lastX = lastIdx >= 0 ? (lastIdx / Math.max(1, lastIdx)) * width : 0;
  const vals = points.map((p) => p.value).filter((v) => Number.isFinite(v));
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const range = max - min || 1;
  const lastY = 4 + (height - 8) - ((points[lastIdx]?.value - min) / range) * (height - 8);

  return (
    <Svg width={width} height={height}>
      <Path d={path} stroke={stroke ?? colors.primary} strokeWidth={1.8} fill="none" />
      <Circle cx={lastX} cy={lastY} r={2.5} fill={stroke ?? colors.primary} />
    </Svg>
  );
}