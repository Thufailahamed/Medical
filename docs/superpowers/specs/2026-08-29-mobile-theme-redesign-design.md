# Mobile Theme + Home Redesign — Design Spec

**Date:** 2026-08-29
**Status:** Approved (design)
**Scope:** Expo mobile app, theme tokens + home screen only
**Audience:** Patient app (`apps/mobile`, patient role)

## Goal

Lift the patient mobile app visual identity to match the reference dashboard (indigo/white glassmorphism, airy spacing, distinct feature cards) and rebuild the home screen around an inner pill-segmented nav (Overview · Vitals · Wellness · Reports).

## Non-Goals

- No new API endpoints. No backend work.
- No new feature screens beyond home.
- No reskin of non-home tabs (Records, Medicines, Visits, Messages, Profile). They pick up new tokens automatically via `useTheme()`.
- No body-silhouette anatomy centerpiece with organ pins (deferred).
- No new theme variant (e.g. lavender scheme). Indigo is the new default.
- No new animations framework (Reanimated already in use).

## Decisions Locked

1. **Palette:** Indigo `#6366F1` becomes `primary`. Sky `#0EA5E9` is demoted to `info` tone. Lavender `#C084FC` becomes `accent2`.
2. **Anatomy silhouette:** skipped. Centerpiece becomes a `LifeQualityDonut` with category breakdown.
3. **Inner section nav:** `PillSegment` under `TopHeader` with 4 tabs (Overview, Vitals, Wellness, Reports). Local state, no router.
4. **Hero card:** navy gradient blob is removed. Replaced by clean white `TopHeader`.

---

## Architecture

### Tokens

Single source of truth: `apps/mobile/src/constants/theme.ts`.

**Additions to `palette`:**
- `indigo`: 50 → 950 scale, sourced from Tailwind indigo defaults.
- `lavender`: 50 → 500 short scale (used for `accent2` only).

**Semantic token reseed (light scheme):**

| Token | Old | New |
|---|---|---|
| `bg` | `sky[50]` | `#F5F7FB` (near-white with indigo wash) |
| `primary` | `sky[600]` | `indigo[600]` |
| `primarySoft` | `sky[100]` | `indigo[50]` |
| `primaryMuted` | `sky[700]` | `indigo[700]` |
| `borderFocus` | `sky[500]` | `indigo[500]` |
| `orb` | `sky[300]` | `indigo[300]` |
| `orbDeep` | `sky[700]` | `indigo[700]` |
| `info` | `sky[500]` | unchanged (`sky[500]`) |
| `accent` | `emerald[600]` | unchanged |
| `accent2` | `coral[500]` | `lavender[500]` |

Dark scheme mirrors with deep indigo (`indigo[950]`) backdrops and adjusted `primary` for AAA contrast against dark surface.

### New component primitives (`apps/mobile/src/components/ui/`)

- **`PillSegment.tsx`** — glass segmented control. Props: `value`, `onChange`, `options[]`, `size`. Indicator animation via `LayoutAnimation`. ARIA roles: `tablist` / `tab`.
- **`LifeQualityDonut.tsx`** — SVG donut, 3 conic-style arcs summing to 360°. Curved category labels around the rim. Center text = score. Animated stroke-dashoffset on mount via Reanimated.
- **`TopHeader.tsx`** — clean white header (64h), avatar slot + brand center + actions right. No gradient.
- **`GlassTile.tsx`** — generic white card, radius 24, hairline border, optional tone accent stripe top-left, optional `onPress`.

### Existing primitives unchanged

`Card`, `Button`, `StatCard`, `DoseRing`, `Sparkline`, `EmptyState`, `Skeleton`, `Screen`, `ScreenHeader`, `Pill`, `Chip`, `ListItem`, `Avatar`, `IconButton`, `TabIcon`, `BottomSheet`. They all consume `useTheme()` so the reseed propagates automatically.

### Home screen structure

`apps/mobile/src/app/(app)/index.tsx` rebuilds around a single `<Screen>` with:

```
Screen
├── TopHeader (avatar, brand, bell, plus)
├── PillSegment (Overview | Vitals | Wellness | Reports)
└── ScrollView (per-tab sections)
    ├── Overview:   GlassTile snapshot · QuickActions · Schedule · Upcoming visits
    ├── Vitals:     LifeQualityDonut · Category bars · VitalsGlance · AI Analytics card
    ├── Wellness:   WellnessCard · Tips carousel · Mini stats
    └── Reports:    HealthSnapshotCard · "Powered by AI" pill · DNA insights card
```

---

## Components

### PillSegment

```ts
type PillSegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  tone?: Tone;
};

type PillSegmentProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: PillSegmentOption<T>[];
  size?: "sm" | "md";
};
```

- Visual: white bg, hairline border, rounded 999. Active pill: `primarySoft` bg, `primary` text. Indicator slides via `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`.
- A11y: `accessibilityRole="tablist"`, options `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.

### LifeQualityDonut

```ts
type LifeQualityCategory = { label: string; value: number; tone: Tone };

type LifeQualityDonutProps = {
  score: number;                  // 0-100, center
  categories: LifeQualityCategory[]; // exactly 3
  size?: number;                  // default 220
  strokeWidth?: number;           // default 18
  trackColor?: string;
};
```

- SVG (`react-native-svg`): one `<G>` per category. Each arc = `<Path d="M..." />` computed from polar coords summing to 360°. Use `score/100` to scale total sweep; if `score < 100`, the missing arc is rendered as `trackColor` to maintain circle.
- Center: `<SvgText>` with `score%`, display-lg weight 800.
- Rim labels: small `<Text>` nodes absolutely positioned over the SVG using `transform: [{ translateX }, { translateY }, { rotate }]`. Each label = `category.label`.
- Animation: `useSharedValue(0)` for `progress`; `withTiming(score/100, { duration: 1200 })` on mount. Arcs use `strokeDashoffset` bound to `progress`.

### TopHeader

```ts
type TopHeaderProps = {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
};
```

- Visual: white bg, hairline bottom border (`colors.border`), `paddingHorizontal: spacing.lg`, height 64, flex-row, items-center, space-between.
- Default `left` = avatar circle (44x44, online dot 12px, same pattern as today's home). Default `right` = bell + plus in 40x40 glass squares.

### GlassTile

```ts
type GlassTileProps = {
  tone?: Tone;
  padding?: keyof Theme["spacing"] | number;
  onPress?: () => void;
  style?: ViewStyle;
  children: ReactNode;
};
```

- Visual: bg `colors.surface`, border `colors.border` 1px, radius 24, soft shadow `shadow.sm`. If `tone`: top-left 4px accent stripe in `tonePalette(tone).fg`.

### Home sections per tab

| Tab | Sections (top → bottom) |
|---|---|
| Overview | GlassTile "Today's snapshot" (next med + next appt) · QuickActions (4 tiles, 2x2 grid) · Schedule (morning/afternoon/evening cards) · Upcoming visits list |
| Vitals | LifeQualityDonut (centered, 240 size) · Category breakdown bars (3 rows: vitals/adherence/profile from `wellnessData.components`) · VitalsGlance row · AI Analytics card |
| Wellness | WellnessCard · Tips carousel · Mini stats row |
| Reports | HealthSnapshotCard · "Powered by AI" pill card · DNA insights card (uses existing AI hooks) |

---

## Data Flow

No new API calls. Existing hooks in `@/hooks/useApi` provide every input:

- `useTodayMedicines()` → Overview snapshot + Schedule
- `useMyAppointments()` → Overview snapshot + Upcoming visits
- `useWellness()` → LifeQualityDonut (score + 3 components) + WellnessCard + Wellness mini stats
- `useVitalsDerived()` → VitalsGlance tiles
- `useVitalsSparkline(type, days)` → sparkline data per vital
- `useHealthSnapshot()` → Reports tab
- `usePatientProfile()` → TopHeader avatar/name
- `useUnreadCount()` → TopHeader bell badge
- `useVaccinationsDue()`, `useAllergies()` → critical banner (kept on Overview top)

### `LifeQualityDonut` input derivation

```
const wellness = useWellness();
const components = wellness?.data?.components ?? [];
const categories: LifeQualityCategory[] = components.slice(0, 3).map(c => ({
  label: c.label,
  value: c.score / c.max, // ratio
  tone: COMPONENT_TONE[c.key] ?? "neutral",
}));
const score = wellness?.data?.score ?? 0;
```

When `wellness` is loading: render `<Skeleton>` circle 220x220 + 3 horizontal `<Skeleton>` bars below. When `wellness` is undefined but query done: render empty ring (`score = 0`, single neutral arc).

### PillSegment state

```ts
type HomeView = "overview" | "vitals" | "wellness" | "reports";
const [view, setView] = useState<HomeView>("overview");
```

Local only. Switching tabs does not push to router. Switching preserves `ScrollView` scroll position per tab via 4 separate refs.

### Refetch on focus

Existing `useFocusEffect` block in `HomeScreen` refetches all hooks when the screen regains focus. Unchanged. Pull-to-refresh also unchanged.

---

## Error Handling

### Loading

Per-section `<Skeleton>` (existing primitive). No global spinner. Pattern lifted from current `WellnessCard` and `AppointmentTimelineRow`.

### Empty

`EmptyState` (existing) per section:
- Overview: no meds today → "Add your first medicine" CTA → `/(app)/add-medicine`.
- Vitals: no readings → "Log a vital" CTA → `/(app)/vitals`.
- Wellness: undefined data → hide section silently (wellness is derived; absence is non-actionable).
- Reports: no snapshot → "Upload a record" CTA → `/(app)/add-record`.

### Error

`ErrorState` (existing) inline with retry button. Retry calls `refetch()`. Background refetch failures are silent; toast only on user-initiated action failures (current behavior).

### Donut edge cases

- `score = 0` → empty ring + `0%` text. No crash.
- `categories.length < 3` → fill remaining arcs with neutral tone + label `—`.
- Component unmount during animation → Reanimated shared values cleaned up automatically; no `setNativeProps` warnings.

### Avatar image fallback

Existing `onError` fallback to gradient initials. Unchanged.

### i18n

Every new copy key added to `src/i18n/locales/{en,si,ta}.json` with same plural rules as today. Missing keys render the key string (existing fallback; acceptable for theme pass).

---

## Testing

### Unit (Vitest, existing harness `apps/mobile/`)

- `PillSegment.test.tsx` — renders N options, fires `onChange` on tap, keyboard arrow navigation, a11y role assertions.
- `LifeQualityDonut.test.tsx` — renders 3 arcs summing to 360°, center text matches `score`, prop changes update SVG `d` attrs, snapshot for default state, unmount cleanup.
- `TopHeader.test.tsx` — renders slots, a11y labels, brand fallback.
- `GlassTile.test.tsx` — tone stripe color, press handler, default vs pressed bg.
- `theme.test.ts` — assert `colors.primary === '#6366F1'` in light scheme; dark variant returns valid hex; both schemes pass WCAG contrast spot-check on `text` over `surface`.

### Integration

- `HomeScreen.test.tsx` — mock `@/hooks/useApi`; assert each PillSegment tab renders expected section count; assert no `console.error`; assert i18n keys resolve for en/si/ta; assert `LifeQualityDonut` receives correct category mapping from mocked `useWellness`.

### Manual smoke

- Real device iOS + Android, light + dark.
- Each PillSegment tab with empty/loaded data.
- Locales: EN / SI / TA.
- Verify: tabs switch smoothly, donut animates in, indigo tokens render, no clipping on small phones (iPhone SE), VoiceOver/TalkBack reads segmented control correctly.

### Out of scope

- SVG arc visual diff snapshots (flaky in CI).
- Detox E2E (no current setup; bigger lift).

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Existing screens using hard-coded `#0EA5E9` look broken after reseed | Audit with grep; replace with `colors.primary` (indigo) only where visual intent matches; leave any purely informational blue as-is via `colors.info`. |
| Charts (victory) lose their blue palette | Override victory `colorScale` at chart mount with new indigo sequence. |
| Wellness `COMPONENT_TONE` mapping uses "primary" for adherence — turns indigo instead of sky | Acceptable; the score ring tinting now matches overall theme. |
| Pull-to-refresh on inner tabs feels disconnected | Single `<RefreshControl>` at outer ScrollView; inner tab content re-renders from same query cache. |
| Old home had a hero with avatar + greeting + adherence ring | Moved to `TopHeader` (avatar) + `GlassTile snapshot` (greeting implicit via first name in TopHeader subtitle) + `LifeQualityDonut` (adherence-as-score moves to Vitals tab). |

---

## Files Touched (estimated)

- `apps/mobile/src/constants/theme.ts` — palette + semantic tokens
- `apps/mobile/src/app/(app)/index.tsx` — full home rebuild
- `apps/mobile/src/components/ui/PillSegment.tsx` — new
- `apps/mobile/src/components/ui/LifeQualityDonut.tsx` — new
- `apps/mobile/src/components/ui/TopHeader.tsx` — new
- `apps/mobile/src/components/ui/GlassTile.tsx` — new
- `apps/mobile/src/components/ui/index.ts` — export new primitives
- `apps/mobile/src/components/ui/PillSegment.test.tsx` — new
- `apps/mobile/src/components/ui/LifeQualityDonut.test.tsx` — new
- `apps/mobile/src/components/ui/TopHeader.test.tsx` — new
- `apps/mobile/src/components/ui/GlassTile.test.tsx` — new
- `apps/mobile/src/__tests__/theme.test.ts` — new (or co-located)
- `apps/mobile/src/app/(app)/__tests__/HomeScreen.test.tsx` — new
- `apps/mobile/src/i18n/locales/en.json` — add keys
- `apps/mobile/src/i18n/locales/si.json` — add keys
- `apps/mobile/src/i18n/locales/ta.json` — add keys

Total: ~16 files. Single PR.