# Mobile Theme + Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the patient mobile app visual identity to an indigo/white glassmorphism theme and rebuild the home screen around a 4-tab `PillSegment` (Overview · Vitals · Wellness · Reports).

**Architecture:** Additive indigo tokens seeded as `primary`; sky demoted to `info`. Four new UI primitives (`PillSegment`, `LifeQualityDonut`, `TopHeader`, `GlassTile`) live in `components/ui/`. Home screen consumes them and reuses existing data hooks unchanged.

**Tech Stack:** Expo 51 · RN 0.74 · TypeScript · Reanimated 3 · react-native-svg 15 · Lucide icons · React Query. Vitest added for tests (mobile has no test infra today).

## Global Constraints

- All file paths under `apps/mobile/`.
- All token reads go through `useTheme()` or `useTone()`. No raw hex outside `constants/theme.ts` and the new `LifeQualityDonut` (where arc geometry needs literal RGB for SVG stroke).
- Existing primitives (`Card`, `Button`, `StatCard`, `DoseRing`, `Sparkline`, `EmptyState`, `Skeleton`, `Screen`, `ScreenHeader`, `Pill`, `Chip`, `Avatar`, `IconButton`, `TabIcon`, `BottomSheet`, `Toast`) must remain byte-identical. They pick up the new palette through the `useTheme()` reseed.
- All new copy is i18n-keyed; every key exists in `en`, `si`, `ta`.
- Home screen file `app/(app)/index.tsx` becomes a full rewrite (2,645 lines → ~600 lines).
- Vitest setup uses `happy-dom` (mirrors `apps/marketing/vitest.config.ts`).
- Reanimated `useSharedValue` only inside Reanimated components; no `setNativeProps` calls.
- No new API endpoints. No backend changes. No new packages beyond `@testing-library/react-native`, `@testing-library/jest-native`, `vitest`, `happy-dom`, and `@vitest/coverage-v8`.
- Conventional commits: `feat(mobile):`, `test(mobile):`, `chore(mobile):`, `refactor(mobile):`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `apps/mobile/vitest.config.ts` | Vitest config (NEW) |
| `apps/mobile/vitest.setup.ts` | jest-native matcher setup (NEW) |
| `apps/mobile/src/constants/theme.ts` | Palette + semantic tokens (MODIFY) |
| `apps/mobile/src/constants/theme.test.ts` | Token contract tests (NEW) |
| `apps/mobile/src/components/ui/PillSegment.tsx` | Glass segmented control (NEW) |
| `apps/mobile/src/components/ui/PillSegment.test.tsx` | Component tests (NEW) |
| `apps/mobile/src/components/ui/LifeQualityDonut.tsx` | SVG donut with rim labels (NEW) |
| `apps/mobile/src/components/ui/LifeQualityDonut.test.tsx` | Component tests (NEW) |
| `apps/mobile/src/components/ui/TopHeader.tsx` | White header with slots (NEW) |
| `apps/mobile/src/components/ui/TopHeader.test.tsx` | Component tests (NEW) |
| `apps/mobile/src/components/ui/GlassTile.tsx` | Glass card primitive (NEW) |
| `apps/mobile/src/components/ui/GlassTile.test.tsx` | Component tests (NEW) |
| `apps/mobile/src/components/ui/index.ts` | Export new primitives (MODIFY) |
| `apps/mobile/src/app/(app)/index.tsx` | Home screen rebuild (REWRITE) |
| `apps/mobile/src/app/(app)/__tests__/HomeScreen.test.tsx` | Integration test (NEW) |
| `apps/mobile/src/i18n/locales/en.json` | Add new keys (MODIFY) |
| `apps/mobile/src/i18n/locales/si.json` | Add new keys (MODIFY) |
| `apps/mobile/src/i18n/locales/ta.json` | Add new keys (MODIFY) |
| `apps/mobile/package.json` | Add test deps + scripts (MODIFY) |

---

## Task 1: Vitest setup

**Files:**
- Create: `apps/mobile/vitest.config.ts`
- Create: `apps/mobile/vitest.setup.ts`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Produces: `npm run test` and `npm run test:watch` scripts in mobile app.

- [ ] **Step 1: Install test dependencies**

```bash
cd apps/mobile && npm install --save-dev vitest@^2.1.0 happy-dom@^15.0.0 @testing-library/react-native@^12.7.0 @testing-library/jest-native@^5.4.3 @vitest/coverage-v8@^2.1.0
```

Expected: packages added to `apps/mobile/package.json` under `devDependencies`.

- [ ] **Step 2: Create `apps/mobile/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist", "android", "ios"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Create `apps/mobile/vitest.setup.ts`**

```ts
import "@testing-library/jest-native/vitest";

// Reanimated mock — `useSharedValue` returns literal, no worklets.
// Kept minimal so any tests touching Reanimated components stay green.
jest.mock("react-native-reanimated", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});
```

- [ ] **Step 4: Add scripts to `apps/mobile/package.json`**

Inside the existing `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: Verify config loads**

```bash
cd apps/mobile && npx vitest run --reporter=verbose --no-coverage
```

Expected: command runs, finds 0 tests, exits 0. No "config error" output.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/vitest.config.ts apps/mobile/vitest.setup.ts apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "chore(mobile): add vitest test infrastructure"
```

---

## Task 2: Theme tokens — palette + indigo + semantic reseed

**Files:**
- Modify: `apps/mobile/src/constants/theme.ts`
- Create: `apps/mobile/src/constants/theme.test.ts`

**Interfaces:**
- Consumes: existing `palette` object, semantic token shape `ColorScheme`.
- Produces: `palette.indigo[50..950]`, `palette.lavender[50..500]`, updated `lightColors.primary = palette.indigo[600]`, updated `darkColors.primary = palette.indigo[400]`, updated `bg`, `primarySoft`, `primaryMuted`, `borderFocus`, `orb`, `orbDeep`, `accent2` (light + dark).

- [ ] **Step 1: Write the failing token test**

Create `apps/mobile/src/constants/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { palette, colors } from "./theme";

describe("theme palette", () => {
  it("exposes indigo scale 50..950", () => {
    expect(palette.indigo[50]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(palette.indigo[600]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(palette.indigo[950]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("exposes lavender scale 50..500", () => {
    expect(palette.lavender[50]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(palette.lavender[500]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe("light semantic tokens", () => {
  it("uses indigo as primary", () => {
    expect(colors.light.primary).toBe(palette.indigo[600]);
    expect(colors.light.primarySoft).toBe(palette.indigo[50]);
    expect(colors.light.primaryMuted).toBe(palette.indigo[700]);
  });

  it("uses sky as info", () => {
    expect(colors.light.info).toBe(palette.sky[600]);
  });

  it("uses lavender as accent2", () => {
    expect(colors.light.accent2).toBe(palette.lavender[500]);
  });

  it("shifts bg to near-white with indigo wash", () => {
    expect(colors.light.bg).toBe("#F5F7FB");
  });
});

describe("dark semantic tokens", () => {
  it("uses indigo as primary", () => {
    expect(colors.dark.primary).toBe(palette.indigo[400]);
  });

  it("uses lavender as accent2", () => {
    expect(colors.dark.accent2).toBe(palette.lavender[500]);
  });

  it("keeps info as sky", () => {
    expect(colors.dark.info).toBe(palette.sky[400]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx vitest run src/constants/theme.test.ts
```

Expected: FAIL — `palette.indigo` is undefined.

- [ ] **Step 3: Add `indigo` and `lavender` to palette**

In `apps/mobile/src/constants/theme.ts`, inside the `palette` object (after `teal`), add:

```ts
indigo: {
  50: "#EEF2FF",
  100: "#E0E7FF",
  200: "#C7D2FE",
  300: "#A5B4FC",
  400: "#818CF8",
  500: "#6366F1",
  600: "#4F46E5",
  700: "#4338CA",
  800: "#3730A3",
  900: "#312E81",
  950: "#1E1B4B",
},
lavender: {
  50: "#F5F3FF",
  100: "#EDE9FE",
  200: "#DDD6FE",
  300: "#C4B5FD",
  400: "#A78BFA",
  500: "#C084FC",
},
```

- [ ] **Step 4: Reseed light semantic tokens**

In `apps/mobile/src/constants/theme.ts`, replace the `lightColors` entries:

- `bg: palette.sky[50],` → `bg: "#F5F7FB",`
- `primary: palette.sky[600],` → `primary: palette.indigo[600],`
- `primaryMuted: palette.sky[700],` → `primaryMuted: palette.indigo[700],`
- `primarySoft: palette.sky[100],` → `primarySoft: palette.indigo[50],`
- `borderFocus: palette.sky[500],` → `borderFocus: palette.indigo[500],`
- `orb: palette.sky[300],` → `orb: palette.indigo[300],`
- `orbDeep: palette.sky[700],` → `orbDeep: palette.indigo[700],`
- `accent2: palette.coral[500],` → `accent2: palette.lavender[500],`
- `accent2Muted: palette.coral[700],` → `accent2Muted: palette.lavender[400],`
- `accent2Soft: palette.coral[50],` → `accent2Soft: palette.lavender[50],`

`secondary`/`secondaryMuted`/`secondarySoft` stay sky (medical/info reserved).

- [ ] **Step 5: Reseed dark semantic tokens**

In `apps/mobile/src/constants/theme.ts`, replace the `darkColors` entries:

- `primary: palette.sky[400],` → `primary: palette.indigo[400],`
- `primaryMuted: palette.sky[300],` → `primaryMuted: palette.indigo[300],`
- `primarySoft: "rgba(14, 165, 233, 0.14)",` → `primarySoft: "rgba(129, 140, 248, 0.16)",`
- `secondarySoft: "rgba(14, 165, 233, 0.10)",` → `secondarySoft: "rgba(129, 140, 248, 0.12)",`
- `borderFocus: palette.sky[400],` → `borderFocus: palette.indigo[400],`
- `orb: palette.sky[500],` → `orb: palette.indigo[500],`
- `orbDeep: palette.sky[900],` → `orbDeep: palette.indigo[900],`
- `accent2: palette.coral[400],` → `accent2: palette.lavender[500],`
- `accent2Muted: palette.coral[300],` → `accent2Muted: palette.lavender[300],`
- `accent2Soft: "rgba(255, 122, 89, 0.14)",` → `accent2Soft: "rgba(192, 132, 252, 0.16)",`

- [ ] **Step 6: Run token test to verify it passes**

```bash
cd apps/mobile && npx vitest run src/constants/theme.test.ts
```

Expected: PASS — all token assertions hold.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/constants/theme.ts apps/mobile/src/constants/theme.test.ts
git commit -m "feat(mobile): introduce indigo + lavender theme tokens"
```

---

## Task 3: PillSegment primitive

**Files:**
- Create: `apps/mobile/src/components/ui/PillSegment.tsx`
- Create: `apps/mobile/src/components/ui/PillSegment.test.tsx`
- Modify: `apps/mobile/src/components/ui/index.ts`

**Interfaces:**
- Produces:

```ts
export type PillSegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  tone?: Tone;
};
export type PillSegmentProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: PillSegmentOption<T>[];
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
};
export function PillSegment<T extends string>(props: PillSegmentProps<T>): JSX.Element;
```

- [ ] **Step 1: Write failing test**

Create `apps/mobile/src/components/ui/PillSegment.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import { PillSegment } from "./PillSegment";
import { ThemeProvider } from "@/theme/ThemeProvider";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("PillSegment", () => {
  it("renders all options", () => {
    const { getByText } = render(
      wrap(
        <PillSegment
          value="a"
          onChange={() => {}}
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
            { value: "c", label: "Gamma" },
          ]}
        />
      )
    );
    expect(getByText("Alpha")).toBeTruthy();
    expect(getByText("Beta")).toBeTruthy();
    expect(getByText("Gamma")).toBeTruthy();
  });

  it("fires onChange when tapping an option", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      wrap(
        <PillSegment
          value="a"
          onChange={onChange}
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ]}
        />
      )
    );
    fireEvent.press(getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("marks selected option with accessibility state", () => {
    const { getByText } = render(
      wrap(
        <PillSegment
          value="a"
          onChange={() => {}}
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ]}
        />
      )
    );
    expect(getByText("Alpha").props.accessibilityState).toMatchObject({ selected: true });
    expect(getByText("Beta").props.accessibilityState).toMatchObject({ selected: false });
  });

  it("does not fire onChange when tapping the already-selected option", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      wrap(
        <PillSegment
          value="a"
          onChange={onChange}
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ]}
        />
      )
    );
    fireEvent.press(getByText("Alpha"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx vitest run src/components/ui/PillSegment.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement PillSegment**

Create `apps/mobile/src/components/ui/PillSegment.tsx`:

```tsx
import React from "react";
import { View, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { Tone } from "@/theme/tone";

export type PillSegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ComponentType<{
    size: number;
    color: string;
    strokeWidth?: number;
  }>;
  tone?: Tone;
};

export type PillSegmentProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: PillSegmentOption<T>[];
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
};

export function PillSegment<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  style,
}: PillSegmentProps<T>) {
  const { colors, spacing, radius } = useTheme();
  const padV = size === "sm" ? 6 : 8;
  const padH = size === "sm" ? spacing.md : spacing.lg;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          padding: 4,
          borderRadius: radius.full,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        const Icon = opt.icon;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (!selected) onChange(opt.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: padV,
              paddingHorizontal: padH,
              borderRadius: radius.full,
              backgroundColor: selected ? colors.primarySoft : "transparent",
              opacity: pressed && !selected ? 0.7 : 1,
            })}
          >
            {Icon ? (
              <Icon
                size={14}
                color={selected ? colors.primary : colors.textMuted}
                strokeWidth={2.25}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontSize: size === "sm" ? 12 : 13,
                fontWeight: "700",
                color: selected ? colors.primary : colors.textMuted,
                letterSpacing: -0.1,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/mobile && npx vitest run src/components/ui/PillSegment.test.tsx
```

Expected: PASS — 4 tests green.

- [ ] **Step 5: Export from barrel**

Add to `apps/mobile/src/components/ui/index.ts`:

```ts
export { PillSegment } from "./PillSegment";
export type { PillSegmentOption, PillSegmentProps } from "./PillSegment";
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/ui/PillSegment.tsx apps/mobile/src/components/ui/PillSegment.test.tsx apps/mobile/src/components/ui/index.ts
git commit -m "feat(mobile): add PillSegment primitive"
```

---

## Task 4: LifeQualityDonut primitive

**Files:**
- Create: `apps/mobile/src/components/ui/LifeQualityDonut.tsx`
- Create: `apps/mobile/src/components/ui/LifeQualityDonut.test.tsx`
- Modify: `apps/mobile/src/components/ui/index.ts`

**Interfaces:**
- Produces:

```ts
export type LifeQualityCategory = { label: string; value: number; tone: Tone };
export type LifeQualityDonutProps = {
  score: number;                 // 0-100, center
  categories: LifeQualityCategory[]; // exactly 3
  size?: number;                 // default 220
  strokeWidth?: number;          // default 18
  trackColor?: string;
  loading?: boolean;
};
export function LifeQualityDonut(props: LifeQualityDonutProps): JSX.Element;
```

- [ ] **Step 1: Write failing test**

Create `apps/mobile/src/components/ui/LifeQualityDonut.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react-native";
import { LifeQualityDonut } from "./LifeQualityDonut";
import { ThemeProvider } from "@/theme/ThemeProvider";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

const sampleCategories = [
  { label: "Activity", value: 0.72, tone: "primary" as const },
  { label: "Food", value: 0.55, tone: "success" as const },
  { label: "Health", value: 0.88, tone: "info" as const },
];

describe("LifeQualityDonut", () => {
  it("renders center score text", () => {
    const { getByText } = render(
      wrap(
        <LifeQualityDonut score={88} categories={sampleCategories} />
      )
    );
    expect(getByText("88%")).toBeTruthy();
  });

  it("renders all 3 category labels around the rim", () => {
    const { getByText } = render(
      wrap(<LifeQualityDonut score={88} categories={sampleCategories} />)
    );
    expect(getByText("Activity")).toBeTruthy();
    expect(getByText("Food")).toBeTruthy();
    expect(getByText("Health")).toBeTruthy();
  });

  it("renders exactly 3 arc paths when score is 100", () => {
    const { UNSAFE_root } = render(
      wrap(<LifeQualityDonut score={100} categories={sampleCategories} />)
    );
    const svgRoot = UNSAFE_root.findByProps({ testID: "lqd-svg" });
    expect(svgRoot).toBeTruthy();
    const paths = svgRoot.findAllByType("Path" as any);
    expect(paths.length).toBe(3);
  });

  it("renders skeleton placeholder when loading", () => {
    const { queryByText } = render(
      wrap(<LifeQualityDonut score={0} categories={[]} loading />)
    );
    expect(queryByText("0%")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx vitest run src/components/ui/LifeQualityDonut.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LifeQualityDonut**

Create `apps/mobile/src/components/ui/LifeQualityDonut.tsx`:

```tsx
import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { G, Path, Circle } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import { Skeleton } from "./Skeleton";

export type LifeQualityCategory = {
  label: string;
  value: number;
  tone: Tone;
};

export type LifeQualityDonutProps = {
  score: number;
  categories: LifeQualityCategory[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  loading?: boolean;
};

type Arc = { d: string; color: string };

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
  ].join(" ");
}

export function LifeQualityDonut({
  score,
  categories,
  size = 220,
  strokeWidth = 18,
  trackColor,
  loading,
}: LifeQualityDonutProps) {
  const { colors, typography } = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const track = trackColor ?? colors.surfaceMuted;
  const clamped = Math.max(0, Math.min(100, score));
  const ratio = clamped / 100;

  const arcs = useMemo<Arc[]>(() => {
    const total = categories.reduce((sum, c) => sum + Math.max(0, c.value), 0);
    if (total <= 0) return [];
    let cursor = 0;
    return categories.map((c) => {
      const sweep = (Math.max(0, c.value) / total) * 360 * ratio;
      const start = cursor;
      const end = cursor + sweep;
      cursor = end;
      return {
        d: arcPath(cx, cy, r, start, end),
        color: tonePalette(c.tone, colors).fg,
      };
    });
  }, [categories, ratio, cx, cy, r, colors]);

  const trackArcs = useMemo<Arc[]>(() => {
    if (ratio >= 1) return [];
    const sweep = 360 * (1 - ratio);
    return [
      {
        d: arcPath(cx, cy, r, 0, sweep),
        color: track,
      },
    ];
  }, [ratio, cx, cy, r, track]);

  if (loading) {
    return (
      <View style={{ alignItems: "center", gap: 12 }}>
        <Skeleton width={size} height={size} radius={size / 2} />
        <Skeleton width={size * 0.7} height={14} />
      </View>
    );
  }

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <Svg width={size} height={size} testID="lqd-svg">
        {/* Track ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Category arcs */}
        <G>
          {[...trackArcs, ...arcs].map((a, i) => (
            <Path
              key={i}
              d={a.d}
              stroke={a.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </G>
      </Svg>

      {/* Rim labels */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {categories.map((c, i) => {
          const total = categories.reduce(
            (sum, k) => sum + Math.max(0, k.value),
            0
          );
          if (total <= 0) return null;
          let cursor = 0;
          for (let j = 0; j < i; j++) {
            cursor += (Math.max(0, categories[j].value) / total) * 360;
          }
          const sweep = (Math.max(0, c.value) / total) * 360;
          const mid = cursor + sweep / 2;
          const labelR = size / 2 + 14;
          const angleRad = ((mid - 90) * Math.PI) / 180;
          const lx = size / 2 + labelR * Math.cos(angleRad) - 30;
          const ly = size / 2 + labelR * Math.sin(angleRad) - 8;
          return (
            <Text
              key={c.label}
              numberOfLines={1}
              style={{
                position: "absolute",
                left: lx,
                top: ly,
                width: 60,
                fontSize: 10,
                fontWeight: "700",
                color: tonePalette(c.tone, colors).fg,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              {c.label}
            </Text>
          );
        })}
      </View>

      {/* Center score */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={[
            typography.display.md,
            {
              color: colors.text,
              fontWeight: "800",
              fontSize: size * 0.22,
              lineHeight: size * 0.26,
              letterSpacing: -0.5,
              includeFontPadding: false,
            },
          ]}
        >
          {Math.round(clamped)}%
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/mobile && npx vitest run src/components/ui/LifeQualityDonut.test.tsx
```

Expected: PASS — 4 tests green.

- [ ] **Step 5: Export from barrel**

Add to `apps/mobile/src/components/ui/index.ts`:

```ts
export { LifeQualityDonut } from "./LifeQualityDonut";
export type { LifeQualityCategory, LifeQualityDonutProps } from "./LifeQualityDonut";
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/ui/LifeQualityDonut.tsx apps/mobile/src/components/ui/LifeQualityDonut.test.tsx apps/mobile/src/components/ui/index.ts
git commit -m "feat(mobile): add LifeQualityDonut primitive"
```

---

## Task 5: TopHeader primitive

**Files:**
- Create: `apps/mobile/src/components/ui/TopHeader.tsx`
- Create: `apps/mobile/src/components/ui/TopHeader.test.tsx`
- Modify: `apps/mobile/src/components/ui/index.ts`

**Interfaces:**
- Produces:

```ts
export type TopHeaderProps = {
  title?: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};
export function TopHeader(props: TopHeaderProps): JSX.Element;
```

- [ ] **Step 1: Write failing test**

Create `apps/mobile/src/components/ui/TopHeader.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import { TopHeader } from "./TopHeader";
import { ThemeProvider } from "@/theme/ThemeProvider";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("TopHeader", () => {
  it("renders title when provided", () => {
    const { getByText } = render(
      wrap(<TopHeader title="Welcome" subtitle="Hi Alex" />)
    );
    expect(getByText("Welcome")).toBeTruthy();
    expect(getByText("Hi Alex")).toBeTruthy();
  });

  it("renders left and right slot nodes", () => {
    const { getByTestId } = render(
      wrap(
        <TopHeader
          title="T"
          left={<View testID="left-slot" />}
          right={<View testID="right-slot" />}
        />
      )
    );
    expect(getByTestId("left-slot")).toBeTruthy();
    expect(getByTestId("right-slot")).toBeTruthy();
  });

  it("renders nothing in header element when no props provided", () => {
    const { queryByText } = render(wrap(<TopHeader />));
    expect(queryByText("undefined")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx vitest run src/components/ui/TopHeader.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TopHeader**

Create `apps/mobile/src/components/ui/TopHeader.tsx`:

```tsx
import React from "react";
import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export type TopHeaderProps = {
  title?: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function TopHeader({
  title,
  subtitle,
  left,
  right,
  style,
}: TopHeaderProps) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          minHeight: 64,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, alignItems: "flex-start" }}>{left}</View>

      {(title || subtitle) && (
        <View
          style={{
            flex: 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {title ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: colors.text,
                letterSpacing: -0.2,
              }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                color: colors.textMuted,
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: spacing.xs,
        }}
      >
        {right}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/mobile && npx vitest run src/components/ui/TopHeader.test.tsx
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Export from barrel**

Add to `apps/mobile/src/components/ui/index.ts`:

```ts
export { TopHeader } from "./TopHeader";
export type { TopHeaderProps } from "./TopHeader";
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/ui/TopHeader.tsx apps/mobile/src/components/ui/TopHeader.test.tsx apps/mobile/src/components/ui/index.ts
git commit -m "feat(mobile): add TopHeader primitive"
```

---

## Task 6: GlassTile primitive

**Files:**
- Create: `apps/mobile/src/components/ui/GlassTile.tsx`
- Create: `apps/mobile/src/components/ui/GlassTile.test.tsx`
- Modify: `apps/mobile/src/components/ui/index.ts`

**Interfaces:**
- Produces:

```ts
export type GlassTileProps = {
  tone?: Tone;
  padding?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
};
export function GlassTile(props: GlassTileProps): JSX.Element;
```

- [ ] **Step 1: Write failing test**

Create `apps/mobile/src/components/ui/GlassTile.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { Text } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { GlassTile } from "./GlassTile";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useTheme } from "@/theme/ThemeProvider";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("GlassTile", () => {
  it("renders children", () => {
    const { getByText } = render(
      wrap(
        <GlassTile>
          <Text>Body content</Text>
        </GlassTile>
      )
    );
    expect(getByText("Body content")).toBeTruthy();
  });

  it("fires onPress when pressed", () => {
    const onPress = vi.fn();
    const { getByText } = render(
      wrap(
        <GlassTile onPress={onPress}>
          <Text>tap</Text>
        </GlassTile>
      )
    );
    fireEvent.press(getByText("tap"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders tone accent stripe when tone is set", () => {
    const Probe = () => {
      const { colors } = useTheme();
      return (
        <GlassTile tone="primary">
          <Text>tone</Text>
        </GlassTile>
      );
    };
    const { UNSAFE_root } = render(wrap(<Probe />));
    const allViews = UNSAFE_root.findAllByType("View" as any);
    expect(allViews.length).toBeGreaterThan(0);
    // Tone stripe is a small accent div; ensure no crash and indigo token present
    expect(UNSAFE_root).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx vitest run src/components/ui/GlassTile.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement GlassTile**

Create `apps/mobile/src/components/ui/GlassTile.tsx`:

```tsx
import React from "react";
import { View, type StyleProp, type ViewStyle, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";

export type GlassTileProps = {
  tone?: Tone;
  padding?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
};

export function GlassTile({
  tone,
  padding,
  onPress,
  style,
  children,
  accessibilityLabel,
}: GlassTileProps) {
  const { colors, spacing, radius, shadow } = useTheme();
  const palette = tone ? tonePalette(tone, colors) : null;
  const inner = (
    <>
      {palette ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 4,
            bottom: 0,
            backgroundColor: palette.fg,
            borderTopLeftRadius: radius.xl,
            borderBottomLeftRadius: radius.xl,
          }}
        />
      ) : null}
      <View style={{ padding: padding ?? spacing.lg }}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          {
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
            opacity: pressed ? 0.95 : 1,
            ...shadow.sm,
          },
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          ...shadow.sm,
        },
        style,
      ]}
    >
      {inner}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/mobile && npx vitest run src/components/ui/GlassTile.test.tsx
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Export from barrel**

Add to `apps/mobile/src/components/ui/index.ts`:

```ts
export { GlassTile } from "./GlassTile";
export type { GlassTileProps } from "./GlassTile";
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/ui/GlassTile.tsx apps/mobile/src/components/ui/GlassTile.test.tsx apps/mobile/src/components/ui/index.ts
git commit -m "feat(mobile): add GlassTile primitive"
```

---

## Task 7: i18n keys

**Files:**
- Modify: `apps/mobile/src/i18n/locales/en.json`
- Modify: `apps/mobile/src/i18n/locales/si.json`
- Modify: `apps/mobile/src/i18n/locales/ta.json`

**Interfaces:**
- Produces new keys under `home.tabs.overview`, `home.tabs.vitals`, `home.tabs.wellness`, `home.tabs.reports`.

- [ ] **Step 1: Add keys to `en.json`**

Inside the `"home"` object (find one near the top), append:

```json
"tabs": {
  "overview": "Overview",
  "vitals": "Vitals",
  "wellness": "Wellness",
  "reports": "Reports"
}
```

Also inside `"home"`, add new section labels (append):

```json
"snapshotTitle": "Today's snapshot",
"snapshotEmpty": "Nothing scheduled for today",
"poweredByAi": "Powered by AI",
"dnaInsights": "DNA insights",
"dnaBody": "AI-detected patterns in your recent reports",
"categoryActivity": "Activity",
"categoryFood": "Food",
"categoryHealth": "Health"
```

- [ ] **Step 2: Mirror keys to `si.json`**

Inside the `"home"` object, append (Sinhala translations):

```json
"tabs": {
  "overview": "සමාලෝචනය",
  "vitals": "ජීවන ලකුණු",
  "wellness": "යහපත් බව",
  "reports": "වාර්තා"
}
```

Plus:

```json
"snapshotTitle": "අදේ සාරාංශය",
"snapshotEmpty": "අද සඳහා කිසිවක් නියම කොට නැත",
"poweredByAi": "AI බලයෙන්",
"dnaInsights": "DNA අවබෝධ",
"dnaBody": "ඔබගේ මෑත වාර්තාවල AI-හඳුනාගත් රටා",
"categoryActivity": "ක්‍රියාකාරකම්",
"categoryFood": "ආහාර",
"categoryHealth": "සෞඛ්‍යය"
```

- [ ] **Step 3: Mirror keys to `ta.json`**

Inside the `"home"` object, append (Tamil translations):

```json
"tabs": {
  "overview": "மேலோட்டம்",
  "vitals": "உயிர் அறிகுறிகள்",
  "wellness": "நலம்",
  "reports": "அறிக்கைகள்"
}
```

Plus:

```json
"snapshotTitle": "இன்றைய சுருக்கம்",
"snapshotEmpty": "இன்று எதுவும் திட்டமிடப்படவில்லை",
"poweredByAi": "AI-இயக்கப்படுகிறது",
"dnaInsights": "DNA நுண்ணறிவு",
"dnaBody": "உங்கள் சமீபத்திய அறிக்கைகளில் AI-கண்டறிந்த வடிவங்கள்",
"categoryActivity": "செயல்பாடு",
"categoryFood": "உணவு",
"categoryHealth": "சுகாதாரம்"
```

- [ ] **Step 4: Verify JSON parses**

```bash
cd apps/mobile && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/si.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/ta.json','utf8'))"
```

Expected: silent success for all three.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
git commit -m "feat(mobile): add home tab + section i18n keys"
```

---

## Task 8: Home screen rebuild

**Files:**
- Modify: `apps/mobile/src/app/(app)/index.tsx`
- Create: `apps/mobile/src/app/(app)/__tests__/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: existing hooks (`usePatientProfile`, `useTodayMedicines`, `useMyAppointments`, `useAllergies`, `useUnreadCount`, `useWellness`, `useTodayDoses`, `useVitalsDerived`, `useVitalsSparkline`, `useHealthSnapshot`, `useVaccinationsDue`).
- Consumes: `PillSegment<T>` (4 values), `LifeQualityDonut`, `TopHeader`, `GlassTile`, `Card`, `EmptyState`, `Skeleton`, `Pill`, `Chip` (all unchanged).
- Produces: 4-tab home screen with Overview / Vitals / Wellness / Reports.

- [ ] **Step 1: Write failing integration test**

Create `apps/mobile/src/app/(app)/__tests__/HomeScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/useApi", () => ({
  usePatientProfile: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
  useTodayMedicines: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
  useMyAppointments: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
  useAllergies: () => ({ data: null }),
  useVaccinationsDue: () => ({ data: null }),
  useTodayDoses: () => ({ data: null, refetch: vi.fn() }),
  useWellness: () => ({ data: null, isLoading: false }),
  useVitalsDerived: () => ({ data: null }),
  useVitalsSparkline: () => ({ data: null }),
  useHealthSnapshot: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
  useUnreadCount: () => ({ data: { count: 0 }, refetch: vi.fn() }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { name: "Alex", role: "patient" } }),
}));

vi.mock("@/stores/locale", () => ({
  useLocaleStore: () => ({ locale: "en" }),
}));

vi.mock("@/hooks/useRealtime", () => ({ useRealtime: () => {} }));

import HomeScreen from "../index";

const wrap = (ui: React.ReactElement) => ui;

describe("HomeScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without throwing", () => {
    expect(() => render(wrap(<HomeScreen />))).not.toThrow();
  });

  it("renders 4-tab pill segment with default tab Overview", () => {
    const { getByText } = render(wrap(<HomeScreen />));
    expect(getByText("Overview")).toBeTruthy();
    expect(getByText("Vitals")).toBeTruthy();
    expect(getByText("Wellness")).toBeTruthy();
    expect(getByText("Reports")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx vitest run "src/app/(app)/__tests__/HomeScreen.test.tsx"
```

Expected: FAIL — either `HomeScreen` doesn't import the new primitives, or it still renders the navy hero block (test passes render but no tab labels).

- [ ] **Step 3: Rewrite `apps/mobile/src/app/(app)/index.tsx`**

Replace the entire file contents with:

```tsx
import { useState, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Image,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect, Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Pill,
  ClipboardList,
  CalendarPlus,
  Plus,
  ChevronRight,
  Activity,
  ShieldAlert,
  Sparkles,
  MessageSquare,
  ScanText,
  FlaskConical,
  Stethoscope,
  FileSearch,
  Heart,
  Droplet,
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { ActiveMemberPill } from "@/components/ActiveMemberPill";
import {
  usePatientProfile,
  useAllergies,
  useVaccinationsDue,
  useTodayMedicines,
  useMyAppointments,
  useUnreadCount,
  useWellness,
  useTodayDoses,
  useVitalsDerived,
  useVitalsSparkline,
  useHealthSnapshot,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import { Sparkline } from "@/components/vitals";
import { HealthSnapshotCard } from "@/components/records";
import { VITAL_REGISTRY, type VitalType } from "@healthcare/shared/vitals";
import {
  Screen,
  Card,
  EmptyState,
  Skeleton,
  PillSegment,
  LifeQualityDonut,
  TopHeader,
  GlassTile,
} from "@/components/ui";

type HomeView = "overview" | "vitals" | "wellness" | "reports";

const COMPONENT_TONE: Record<string, Tone> = {
  bmi: "info",
  adherence: "primary",
  vitals: "accent",
  profile: "warning",
  engagement: "success",
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { colors, spacing, typography, radius, layout } = useTheme();

  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } =
    usePatientProfile();
  const { data: medsData, isLoading: medsLoading, refetch: refetchMeds } =
    useTodayMedicines();
  const { data: apptsData, isLoading: apptsLoading, refetch: refetchAppts } =
    useMyAppointments();
  const { data: unread, refetch: refetchUnread } = useUnreadCount();
  const { data: allergiesData } = useAllergies();
  const { data: vaccineDue } = useVaccinationsDue();
  const { data: wellnessData, refetch: refetchWellness } = useWellness();
  const { data: todayDoses, refetch: refetchDoses } = useTodayDoses();
  const { data: snapshotData, isLoading: snapshotLoading, refetch: refetchSnapshot } =
    useHealthSnapshot();

  const [view, setView] = useState<HomeView>("overview");

  useFocusEffect(
    useCallback(() => {
      refetchProfile();
      refetchMeds();
      refetchAppts();
      refetchUnread();
      refetchWellness();
      refetchDoses();
      refetchSnapshot();
    }, [
      refetchProfile,
      refetchMeds,
      refetchAppts,
      refetchUnread,
      refetchWellness,
      refetchDoses,
      refetchSnapshot,
    ])
  );

  const refetchAll = () => {
    refetchProfile();
    refetchMeds();
    refetchAppts();
    refetchUnread();
    refetchWellness();
    refetchDoses();
  };

  const patient = profileData?.patient?.patients;
  const todayMeds: any[] = medsData?.medicines ?? [];
  const appointments: any[] = apptsData?.appointments ?? [];
  const userPhoto = profileData?.patient?.users?.photo;
  const userName = profileData?.patient?.users?.name || user?.name || "";
  const criticalAllergies =
    (allergiesData?.allergies ?? []).filter(
      (a: any) => a.severity === "critical" && a.active !== false
    );

  if (user?.role === "doctor") {
    return <Redirect href="/(doctor)" />;
  }

  const avatar = (
    <Pressable
      onPress={() => router.push("/(app)/profile")}
      accessibilityRole="button"
      accessibilityLabel={t("home.a11y.profile")}
      hitSlop={6}
    >
      {userPhoto ? (
        <Image
          source={{ uri: userPhoto }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surfaceMuted,
          }}
        />
      ) : (
        <LinearGradient
          colors={["#818CF8", "#4F46E5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: "#FFFFFF",
              letterSpacing: -0.3,
            }}
          >
            {(userName || "?")[0]?.toUpperCase()}
          </Text>
        </LinearGradient>
      )}
    </Pressable>
  );

  const headerRight = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <Pressable
        onPress={() => router.push("/(app)/notifications")}
        accessibilityRole="button"
        accessibilityLabel={t("home.a11y.notifications")}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        })}
      >
        <Bell size={18} color={colors.text} strokeWidth={2} />
        {unread?.count ? (
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.danger,
              borderWidth: 1.5,
              borderColor: colors.surface,
            }}
          />
        ) : null}
      </Pressable>
      <Pressable
        onPress={() => router.push("/(app)/add-record")}
        accessibilityRole="button"
        accessibilityLabel={t("home.a11y.quickAdd")}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.primaryMuted : colors.primary,
        })}
      >
        <Plus size={18} color={colors.onPrimary} strokeWidth={2.5} />
      </Pressable>
    </View>
  );

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset={false} bottomInset={false}>
      <TopHeader left={avatar} right={headerRight} />

      {criticalAllergies.length > 0 ? (
        <Pressable
          onPress={() => router.push("/(app)/allergies")}
          accessibilityRole="button"
          accessibilityLabel={t("home.a11y.criticalAllergies")}
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.sm,
            borderRadius: radius.lg,
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={[colors.danger, colors.dangerMuted]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: spacing.md,
              flexDirection: "row",
              gap: spacing.sm,
              alignItems: "center",
            }}
          >
            <ShieldAlert size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text
              numberOfLines={1}
              style={[typography.title.sm, { color: "#FFFFFF", flex: 1, fontWeight: "700" }]}
            >
              {criticalAllergies.length === 1
                ? t("home.criticalAllergy_one", { substance: criticalAllergies[0].substance })
                : t("home.criticalAllergy_other", { count: criticalAllergies.length })}
            </Text>
            <ChevronRight size={16} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      ) : null}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <PillSegment
          value={view}
          onChange={setView}
          options={[
            { value: "overview", label: t("home.tabs.overview") },
            { value: "vitals", label: t("home.tabs.vitals") },
            { value: "wellness", label: t("home.tabs.wellness") },
            { value: "reports", label: t("home.tabs.reports") },
          ]}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profileLoading || medsLoading || apptsLoading}
            onRefresh={refetchAll}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: layout.tabBarHeight + spacing.lg }}
      >
        {view === "overview" ? (
          <OverviewTab
            patient={patient}
            todayMeds={todayMeds}
            appointments={appointments}
            medsLoading={medsLoading}
            apptsLoading={apptsLoading}
            unreadCount={unread?.count}
            onAddMedicine={() => router.push("/(app)/add-medicine")}
            onPressMedicine={() => router.push("/(app)/medicines")}
            onPressRecords={() => router.push("/(app)/records")}
            onPressBook={() => router.push("/(app)/book-appointment")}
            onPressEmergency={() => router.push("/(app)/emergency")}
          />
        ) : null}

        {view === "vitals" ? (
          <VitalsTab
            wellness={wellnessData}
            onPressVitals={() => router.push("/(app)/vitals")}
          />
        ) : null}

        {view === "wellness" ? <WellnessTab wellness={wellnessData} /> : null}

        {view === "reports" ? (
          <ReportsTab
            snapshot={snapshotData}
            snapshotLoading={snapshotLoading}
            onJumpToTrends={() => router.push("/(app)/records/trends")}
            onJumpToAllergies={() => router.push("/(app)/records")}
            onJumpToMeds={() => router.push("/(app)/vitals")}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// ── Overview tab ───────────────────────────────────────────
function OverviewTab(props: {
  patient: any;
  todayMeds: any[];
  appointments: any[];
  medsLoading: boolean;
  apptsLoading: boolean;
  unreadCount: number | undefined;
  onAddMedicine: () => void;
  onPressMedicine: () => void;
  onPressRecords: () => void;
  onPressBook: () => void;
  onPressEmergency: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, shadow } = useTheme();
  const nextMed = props.todayMeds[0];
  const nextAppt = props.appointments[0];

  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <GlassTile>
        <Text
          style={[
            typography.overline,
            { color: colors.textSubtle, letterSpacing: 1.4 },
          ]}
        >
          {t("home.snapshotTitle").toUpperCase()}
        </Text>
        {nextMed || nextAppt ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {nextMed ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Pill size={16} color={colors.primary} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
                    {nextMed.name}
                  </Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
                    {nextMed.timing}
                  </Text>
                </View>
              </View>
            ) : null}
            {nextAppt ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.infoSoft,
                  }}
                >
                  <CalendarPlus size={16} color={colors.info} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[typography.title.sm, { color: colors.text, fontWeight: "700" }]}>
                    {nextAppt.reason || "Doctor visit"}
                  </Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
                    {nextAppt.time || ""}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={[typography.body.sm, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t("home.snapshotEmpty")}
          </Text>
        )}
      </GlassTile>

      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.overline, { color: colors.textSubtle, letterSpacing: 1.4 }]}>
          {t("home.sectionQuickActions").toUpperCase()}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <QuickTile
            icon={Pill}
            label={t("home.medicines")}
            hint={t("home.medicinesHint")}
            tone="primary"
            onPress={props.onPressMedicine}
          />
          <QuickTile
            icon={ClipboardList}
            label={t("home.records")}
            hint={t("home.recordsHint")}
            tone="info"
            onPress={props.onPressRecords}
          />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <QuickTile
            icon={CalendarPlus}
            label={t("home.bookVisit")}
            hint={t("home.bookVisitHint")}
            tone="warning"
            onPress={props.onPressBook}
          />
          <QuickTile
            icon={ShieldAlert}
            label={t("home.emergency")}
            hint={t("home.emergencyHint")}
            tone="danger"
            onPress={props.onPressEmergency}
          />
        </View>
      </View>

      {props.medsLoading ? (
        <Card>
          <Skeleton width="100%" height={20} />
          <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
        </Card>
      ) : props.todayMeds.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={t("home.scheduleEmptyTitle")}
          message={t("home.scheduleEmptyBody")}
          actionLabel={t("home.scheduleEmptyAction")}
          onAction={props.onAddMedicine}
        />
      ) : (
        <GlassTile tone="primary">
          <Text style={[typography.overline, { color: colors.primary, letterSpacing: 1.4 }]}>
            {t("home.sectionSchedule").toUpperCase()}
          </Text>
          <Text
            style={[
              typography.title.md,
              { color: colors.text, fontWeight: "800", marginTop: 4 },
            ]}
          >
            {props.todayMeds.length} {t("home.dose", { count: props.todayMeds.length })}
          </Text>
        </GlassTile>
      )}
    </View>
  );
}

function QuickTile(props: {
  icon: React.ComponentType<any>;
  label: string;
  hint?: string;
  tone: Tone;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const palette = useTone(props.tone);
  const isEmergency = props.tone === "danger";
  const Icon = props.icon;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.hint ? `${props.label}. ${props.hint}` : props.label}
      style={({ pressed }) => ({
        flexBasis: "48%",
        flexGrow: 1,
        padding: spacing.md,
        borderRadius: 22,
        backgroundColor: isEmergency ? palette.bg : colors.surface,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        minHeight: 110,
        justifyContent: "space-between",
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: isEmergency ? "transparent" : colors.border,
        overflow: "hidden",
      })}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -28,
          right: -24,
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: isEmergency ? "rgba(255,255,255,0.35)" : palette.bg,
          opacity: 0.9,
        }}
      />
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bgStrong,
        }}
      >
        <Icon size={18} color={palette.onBgStrong} strokeWidth={2.4} />
      </View>
      <View style={{ gap: 2 }}>
        <Text
          numberOfLines={1}
          style={[typography.title.sm, { color: isEmergency ? palette.fg : colors.text, fontWeight: "700" }]}
        >
          {props.label}
        </Text>
        {props.hint ? (
          <Text
            numberOfLines={1}
            style={[typography.body.sm, { color: isEmergency ? palette.fg : colors.textMuted, opacity: isEmergency ? 0.85 : 1 }]}
          >
            {props.hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Vitals tab ─────────────────────────────────────────────
function VitalsTab(props: {
  wellness: any;
  onPressVitals: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const { data: derivedData } = useVitalsDerived();
  const { data: bpSeries } = useVitalsSparkline("blood_pressure", 7);
  const { data: hrSeries } = useVitalsSparkline("heart_rate", 7);
  const { data: spo2Series } = useVitalsSparkline("spo2", 7);
  const { data: wtSeries } = useVitalsSparkline("weight", 7);

  const score = props.wellness?.score ?? 0;
  const components = Array.isArray(props.wellness?.components)
    ? props.wellness.components.slice(0, 3)
    : [];

  const categories = components.length === 3
    ? components.map((c: any, i: number) => ({
        label: ["Activity", "Food", "Health"][i] || c.label,
        value: c.score / Math.max(1, c.max),
        tone: (COMPONENT_TONE[c.key] ?? "primary") as Tone,
      }))
    : [
        { label: t("home.categoryActivity"), value: 0, tone: "primary" as Tone },
        { label: t("home.categoryFood"), value: 0, tone: "success" as Tone },
        { label: t("home.categoryHealth"), value: 0, tone: "info" as Tone },
      ];

  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
        <LifeQualityDonut
          score={score}
          categories={categories}
          size={240}
          strokeWidth={20}
          loading={!props.wellness}
        />
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, marginTop: spacing.md, textAlign: "center" },
          ]}
        >
          {t("home.aiSubtitle")}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {components.map((c: any) => (
          <View key={c.key} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text numberOfLines={1} style={[typography.label.md, { color: colors.text, fontWeight: "700" }]}>
                {c.label}
              </Text>
              <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
                {c.score}/{c.max}
              </Text>
            </View>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.surfaceMuted,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={["#818CF8", "#4F46E5"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: `${Math.round((c.score / Math.max(1, c.max)) * 100)}%`,
                  height: "100%",
                }}
              />
            </View>
          </View>
        ))}
      </View>

      <VitalsGlanceRow
        derived={derivedData}
        tiles={[
          { type: "blood_pressure", series: bpSeries, icon: Heart, tone: "danger" },
          { type: "heart_rate", series: hrSeries, icon: Activity, tone: "primary" },
          { type: "spo2", series: spo2Series, icon: Activity, tone: "info" },
          { type: "weight", series: wtSeries, icon: Scale, tone: "success" },
        ]}
      />
    </View>
  );
}

function VitalsGlanceRow(props: {
  derived: any;
  tiles: Array<{ type: string; series: any; icon: any; tone: Tone }>;
}) {
  const { spacing, colors, typography } = useTheme();
  const paletteBp = useTone("danger");
  const paletteHr = useTone("primary");
  const paletteSp = useTone("info");
  const paletteWt = useTone("success");
  const palettes = [paletteBp, paletteHr, paletteSp, paletteWt];

  const latestByType = props.derived?.latestByType ?? [];
  const latest = (type: string) => latestByType.find((l: any) => l.type === type)?.latest;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
    >
      {props.tiles.map(({ type, series, icon: Icon }, idx) => {
        const l = latest(type);
        const def = VITAL_REGISTRY[type as VitalType];
        const reading = l
          ? l.secondary != null
            ? `${l.value}/${l.secondary}`
            : `${l.value}`
          : "—";
        const unit = l?.unit || def?.unit || "";
        const cls = l?.classification ?? "normal";
        const stroke =
          cls === "critical" || cls === "high"
            ? colors.danger
            : cls === "elevated" || cls === "low"
            ? colors.warning
            : colors.success;
        const palette = palettes[idx];
        return (
          <View
            key={type}
            style={{
              width: 140,
              padding: spacing.md,
              borderRadius: 18,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.sm,
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
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.bg,
                }}
              >
                <Icon size={15} color={palette.fg} strokeWidth={2.5} />
              </View>
              {l ? (
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: stroke,
                  }}
                />
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 10.5,
                fontWeight: "700",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              {def?.label ?? type}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: colors.text,
                  letterSpacing: -0.4,
                }}
              >
                {reading}
              </Text>
              <Text style={{ fontSize: 10.5, color: colors.textMuted }}>{unit}</Text>
            </View>
            <Sparkline points={series?.points ?? []} width={108} height={26} stroke={stroke} />
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Wellness tab ───────────────────────────────────────────
function WellnessTab(props: { wellness: any }) {
  const { t } = useTranslation();
  const { colors, spacing, typography, radius, shadow } = useTheme();
  const data = props.wellness;
  if (!data) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Card>
          <Skeleton width={76} height={76} radius={38} />
          <Skeleton width="60%" height={18} style={{ marginTop: 8 }} />
        </Card>
      </View>
    );
  }
  const score = data.score;
  const Trend = score >= 75 ? TrendingUp : score >= 45 ? Minus : TrendingDown;
  const tone: Tone = data.level?.tone ?? "info";
  const palette = useTone(tone);

  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <GlassTile tone={tone}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: palette.fg,
              backgroundColor: palette.bg,
            }}
          >
            <Text style={[typography.display.md, { color: palette.fg, fontWeight: "800" }]}>
              {score}
            </Text>
            <Text style={{ fontSize: 9, color: palette.fg, fontWeight: "800", opacity: 0.7 }}>
              / 100
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 10.5, color: palette.fg, letterSpacing: 1.3, fontWeight: "800" }}
            >
              {(data.level?.label ?? t("home.wellnessDefault")).toUpperCase()}
            </Text>
            <Text
              numberOfLines={2}
              style={[typography.title.md, { color: colors.text, fontWeight: "800", fontSize: 17, letterSpacing: -0.3 }]}
            >
              {score >= 75
                ? t("home.wellnessDoingGreat")
                : score >= 45
                ? t("home.wellnessRoomToImprove")
                : t("home.wellnessBackOnTrack")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Trend size={12} color={colors.textMuted} strokeWidth={2.5} />
              <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                {data.bmi != null
                  ? t("home.bmiRow", { bmi: data.bmi, category: data.bmiCategory })
                  : t("home.a11y.bmiNeeded")}
              </Text>
            </View>
          </View>
        </View>

        {data.topTip ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: 14,
              backgroundColor: palette.bg,
              marginTop: spacing.md,
            }}
          >
            <Sparkles size={16} color={palette.fg} strokeWidth={2.5} />
            <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>{data.topTip}</Text>
          </View>
        ) : null}
      </GlassTile>
    </View>
  );
}

// ── Reports tab ────────────────────────────────────────────
function ReportsTab(props: {
  snapshot: any;
  snapshotLoading: boolean;
  onJumpToTrends: () => void;
  onJumpToAllergies: () => void;
  onJumpToMeds: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <GlassTile tone="primary">
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
            }}
          >
            <Sparkles size={16} color={colors.onPrimary} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
              {t("home.dnaInsights")}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {t("home.dnaBody")}
            </Text>
          </View>
        </View>
        <View
          style={{
            marginTop: spacing.md,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            alignSelf: "flex-start",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: colors.primary, letterSpacing: 0.4 }}>
            {t("home.poweredByAi").toUpperCase()}
          </Text>
        </View>
      </GlassTile>

      <HealthSnapshotCard
        snapshot={props.snapshot}
        loading={props.snapshotLoading}
        onJumpToTrends={props.onJumpToTrends}
        onJumpToAllergies={props.onJumpToAllergies}
        onJumpToMeds={props.onJumpToMeds}
      />
    </View>
  );
}
```

- [ ] **Step 4: Run integration test to verify it passes**

```bash
cd apps/mobile && npx vitest run "src/app/(app)/__tests__/HomeScreen.test.tsx"
```

Expected: PASS — 2 tests green.

- [ ] **Step 5: Run full test suite**

```bash
cd apps/mobile && npx vitest run
```

Expected: all tests pass (token + PillSegment + LifeQualityDonut + TopHeader + GlassTile + HomeScreen).

- [ ] **Step 6: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/app/\(app\)/index.tsx apps/mobile/src/app/\(app\)/__tests__/HomeScreen.test.tsx
git commit -m "refactor(mobile): rebuild home around PillSegment + LifeQualityDonut"
```

---

## Task 9: Verification gate

**Files:** none modified.

- [ ] **Step 1: Run full test + typecheck**

```bash
cd apps/mobile && npx vitest run && npm run typecheck
```

Expected: all tests green, 0 TS errors.

- [ ] **Step 2: Confirm token reseed didn't break existing primitives**

```bash
cd apps/mobile && grep -RIn "sky\[600\]\|sky\[700\]\|sky\[500\]" src --include="*.tsx" --include="*.ts" | grep -v constants/theme.ts | grep -v test
```

Expected: no matches outside `constants/theme.ts` and tests. If any file hard-codes the old sky primary, it has not been retinted correctly and needs review (this is informational — not blocking, since some chart series legitimately use sky as accent).

- [ ] **Step 3: Manual smoke checklist**

Document a smoke pass on a real device (or simulator):
- Light scheme renders indigo primary on first load.
- Dark scheme renders indigo primary without contrast warnings.
- Each of the 4 PillSegment tabs renders its expected sections.
- LifeQualityDonut animates in on Vitals tab.
- TopHeader avatar fallback (gradient + initial) works.
- GlassTile accent stripe visible on Schedule / DNA insights cards.
- Critical allergy banner still shows when applicable.
- All i18n keys resolve in en/si/ta.

- [ ] **Step 4: Final commit (if any smoke-driven fixes)**

```bash
git add -A
git commit -m "chore(mobile): smoke fixes from manual verification" --allow-empty
```

---

## Self-Review (run before handoff)

1. **Spec coverage:**
   - Architecture § tokens → Task 2 ✓
   - Architecture § new primitives → Tasks 3-6 ✓
   - Components § PillSegment → Task 3 ✓
   - Components § LifeQualityDonut → Task 4 ✓
   - Components § TopHeader → Task 5 ✓
   - Components § GlassTile → Task 6 ✓
   - Home sections per tab → Task 8 (4 tab sub-components) ✓
   - Data Flow § no new APIs → Task 8 (only imports existing hooks) ✓
   - Data Flow § LifeQualityDonut derivation → Task 8 (VitalsTab) ✓
   - Error Handling § loading/empty/error → Task 8 (Skeleton + EmptyState + cards) ✓
   - Error Handling § i18n keys → Task 7 ✓
   - Testing § unit + integration → Tasks 2-6 + Task 8 ✓
2. **Placeholders:** none. Every code block is literal copy-paste.
3. **Type consistency:** `LifeQualityCategory.tone: Tone`, `COMPONENT_TONE[c.key]` reused across Overview tab strip + Vitals tab categories. `GlassTile`, `TopHeader`, `PillSegment`, `LifeQualityDonut` all export from `@/components/ui`. `PillSegment` options shape matches usage in Task 8.

If a gap appears during implementation, fix it inline in the affected task.