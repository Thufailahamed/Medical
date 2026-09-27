# AGENTS.md

## Mobile app (apps/mobile — Expo SDK 51, RN 0.74, old architecture)

### Verification
- Typecheck: `cd apps/mobile && npx tsc --noEmit` (takes ~2–3 min). Do NOT wrap in `timeout` — it isn't installed on macOS and silently makes the check a no-op.
- Baseline has ~400 pre-existing errors, almost all `TS2786 ... cannot be used as a JSX component` (duplicate React types). Filter with `grep -v TS2786` and compare only files you touched.
- Many screens (e.g. `src/app/(app)/index.tsx`, `src/components/HomePrescriptionsSection.tsx`) start with `// @ts-nocheck`; to check them, copy with the first line stripped into a temp `zz_*.tsx`, run tsc, compare against the HEAD version, then delete the temp files.

### Design system
- Tokens: `src/constants/theme.ts` (consumed via `useTheme()`); tone mapping: `src/theme/tone.ts`. Keep the existing brand colours (sky/primary blue, emerald, coral).
- CSS `boxShadow` is NOT supported (RN 0.74) — use the `shadow.*` tokens (`xs`, `sm`, `card`, `md`, `lg`, `hero`, `primary`).
- Card edges use `colors.hairline` (whisper edge); in-card dividers keep `colors.separator`. Chevron/arrow wells use `colors.well`.
- Premium primitives in `src/components/ui/`: `Card` (`variant`: flat/elevated/floating/brand/muted/outline), `IconTile`, `PillAction`, `QuickAction(s)`, `MenuTile`/`MenuGrid`, `ListCard`/`ListSection`, `SectionHeader` (`kicker` + pill action), `StatCard` (`delta`, `onPress`), `IconButton` (`surface` / `glass` variants).
- i18n: add new strings to `src/i18n/locales/{en,si,ta}.json` via targeted text insert (a JSON round-trip reformats unrelated lines).
- Tab bar: every role's `(Tabs)` layout uses `tabBar={(p) => <IslandTabBar {...p} />}` from `src/components/ui/FloatingTabBar.tsx` (Dynamic Island capsule; hides itself when the focused screen sets `tabBarStyle: { display: "none" }`; skips `href: null` routes). `TabIcon` only draws glyph + badge — the bar draws the active pill.
