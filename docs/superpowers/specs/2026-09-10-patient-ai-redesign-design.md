# Patient AI Redesign — Premium, Portal-Native, Correct Components — Design Spec

Date: 2026-09-10
Status: Approved via brainstorming (layout choices A/A approved in visual companion)
Scope: `apps/marketing` (web patient portal) — `/patient/ai` family
Depends on: uncommitted working-tree changes present at spec time (patient globals.css, ai pages, sidebar, dashboard v2). This spec builds on the working tree, not on HEAD.

## 1. Goal & Constraints

Goal: redesign the `/patient/ai` hub and align the full AI family (chat, lab-explain, lab-trend, ocr, clinical-note, vaccination-card) to one premium, enterprise-grade, portal-native design system. Fix silent styling bugs caused by tokens never being registered with Tailwind v4.

Constraints:
- No backend changes; no new API endpoints; no new AI capabilities (reorganize existing features only).
- Next.js 16.2.10 is a modified Next (see `apps/marketing/AGENTS.md`) — consult `apps/marketing/node_modules/next/dist/docs/` before writing code.
- Keep every `ai/*/page.tsx` file and route intact (`src/patient/parity.test.ts` + `docs/parity-manifest.md` require `done` rows to resolve).
- No new dependencies. React 19 + TanStack Query 5 + Tailwind v4 + lucide-react only.
- No dark mode, no i18n for this work (AI pages stay hardcoded English).
- Keep `/patient/ai/chat` full-bleed (`PatientShell` `fullBleed` branch stays).
- Snapshots disabled; tests use Vitest + Testing Library + user-event.

## 2. Design Tokens — make them real (foundation fix)

Problem: `apps/marketing/src/app/patient/globals.css` defines tokens in plain `:root`. Tailwind v4 only generates utilities from `@theme`, so `bg-brand`, `text-text`, `rounded-pill`, `bg-success-soft`, `shadow-card`, etc. are dead classes portal-wide (verified empirically against tailwindcss 4.3.2).

Change: convert the token block in `src/app/patient/globals.css` to a `@theme` block. Keep the **same variable names and values**; `@theme` still emits the same CSS custom properties to `:root`, so existing raw classes (`.patient-card`, `.t-*`, `.dashboard-hero`, `.patient-ink-glow`) keep working unchanged.

Tokens to register:
- Colors: `--color-canvas`, `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-surface-3`, `--color-ink-card`, `--color-text`, `--color-text-soft`, `--color-text-muted`, `--color-brand`, `--color-brand-soft`, `--color-brand-strong`, `--color-ink`, `--color-border`, `--color-border-strong`, `--color-success`, `--color-success-soft`, `--color-warn`, `--color-warn-soft`, `--color-danger`, `--color-danger-soft`
- Radii: `--radius-plate`, `--radius-card`, `--radius-inner`, `--radius-pill`
- Shadows: `--shadow-card`, `--shadow-md`, `--shadow-float`, `--shadow-brand`
- Font: `--font-patient`

Any non-token `:root` entries stay in `:root` if not theme-namespaced.

Acceptance: `rounded-card`, `rounded-inner`, `rounded-pill`, `bg-brand`, `bg-brand-soft`, `text-text`, `text-text-soft`, `text-text-muted`, `border-border`, `bg-success-soft`, `text-success`, `bg-warn-soft`, `bg-danger-soft`, `shadow-card` all generate CSS; raw-class visuals unchanged.

## 3. Hub `/patient/ai` — "Command center" (approved layout A)

File: `src/app/patient/(app)/ai/page.tsx` — becomes a thin composition (~150–200 lines) over new shared components.

Container: `mx-auto flex w-full max-w-6xl flex-col gap-5 px-1 pb-6 pt-1 sm:gap-6 sm:px-2` (matches dashboard).

Order:
1. **Hero** (reuses `.dashboard-hero`): "Clinical intelligence" badge, `h1` "AI health assistant", one-sentence value copy, embedded **command bar**, quick-prompt chips, trust strip.
2. **Primary cards row** (`grid-cols-1 lg:grid-cols-2 gap-5`): `HealthSummaryCard` + `DrugInteractionCard`.
3. **Tools section**: `SectionHeader` + grid of all six `AiToolCard`s.
4. **Safety notice**: `AiSafetyNotice`.

### 3.1 Command bar (`AiCommandBar`)
- White rounded bar embedded in hero: sparkles icon prefix, single input, "Ask AI" submit button, `⌘K`/`Ctrl+K` hint.
- Submit: `router.push('/patient/ai/chat?prompt=' + encodeURIComponent(trimmed))`; empty → `/patient/ai/chat`.
- Global `⌘K`/`Ctrl+K` listener focuses the input (prevent default browser search).
- Quick prompts (chips under bar, honest labels):
  - "Summarize my record" → runs hub summary inline
  - "Explain my lab results" → `/patient/ai/lab-explain?prompt=…` (now consumed, see §5)
  - "Check my medications" → prefills + runs drug check inline, scrolls to card
  - "Prepare for my visit" → `/patient/ai/chat?prompt=…`
- Accessible form semantics; `aria-label` on input.

### 3.2 Trust strip
Four chips with lucide icons; **truthful claims only**: "EMR grounded", "Pharmacopeia checked", "Private by design", "Human review". Remove the unverifiable "Clinical v2.4" model-version badge.

### 3.3 `HealthSummaryCard`
- Uses `Card accent="brand"` + `CardHeader`-style header (icon tile `bg-brand-soft text-brand`, title, "EMR" pill).
- States:
  - idle: dashed `EmptyState`-style prompt with "Generate summary" CTA.
  - loading: 3–4 `Skeleton` lines (`aria-busy`, button disabled + spinner).
  - success: `patientSummary` paragraph; chip groups for `diagnoses` (brand) and `risks`/history (amber); copy button with 2s check feedback; `aria-live="polite"`.
  - error: inline rose alert with retry.
- Uses `useGenerateSummary()` (§6). "Regenerate" label on success.

### 3.4 `DrugInteractionCard`
- Uses `Card accent="amber"`; active meds from `useMedications()` as chips; "Check all" action; manual comma-separated input (`<label>` bound).
- Result mapping (unchanged semantics): severity `severe|high|major` → rose, `moderate|medium` → amber, else sky; each item shows medicine chips, severity pill, note, guidance; scroll area `max-h-60`.
- Empty result → emerald "No adverse interactions detected" panel.
- Error / no-meds states handled inline; `aria-live="polite"`.
- Uses `useCheckDrugInteractions()` (§6).

### 3.5 Tools grid — all six
`AiToolCard` for: Care Chat (`/patient/ai/chat`, sky, Bot), Lab Interpreter (`/patient/ai/lab-explain`, indigo/blue, FlaskConical), Document OCR (`/patient/ai/ocr`, emerald, ScanLine), Health Trends (`/patient/ai/lab-trend`, amber, TrendingUp), Clinical Note (`/patient/ai/clinical-note`, violet, FileText), Vaccination Card (`/patient/ai/vaccination-card`, teal, Syringe). Fixes the orphaned clinical-note + vaccination-card.
Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`. Card: icon tile, title, description, "Open →" affordance, hover lift + border-brand.

### 3.6 `AiSafetyNotice`
Calm strip: "AI helps you understand your health information and prepare for consultations. It does not replace emergency care or your physician's clinical judgment." ShieldCheck icon, `bg-surface-2`, no alarm styling.

## 4. Chat `/patient/ai/chat` — "Full-bleed studio" (approved layout A)

File: `src/app/patient/(app)/ai/chat/page.tsx`. Keep behavior: `useSearchParams` prompt consumption, `POST /ai/chat` (`{message, model, useEhr, patientId?, sessionId?}`), local `sessionId`, non-streaming.

Visual/UX:
- Slim branded header inside the full-bleed area: assistant avatar, "Care Chat", context line ("Grounded in your EMR"), existing model selector + EHR toggle restyled with tokens/`Pill`.
- Empty state: greeting + 4 grounded suggestion cards (not pills), e.g. "Explain my latest lab result", "What should I ask my doctor?", "Review my medications", "Summarize my recent visits".
- User bubble: brand blue, `rounded-2xl` with one tight corner.
- Assistant message: avatar + `bg-surface-2` card, markdown rendering (existing `FormattedMessage`), source chips when available, hover/focus actions: copy, read aloud, thumbs, regenerate (keep existing behavior).
- Composer: sticky bottom bar, autosizing textarea, brand send button; Enter sends, Shift+Enter newline; disclaimer microcopy under composer.
- States: 3-dot thinking indicator with `aria-live`, error banner with retry, scroll-to-bottom affordance.
- All spacing/colors from tokens; no ChatGPT-style slate chrome.

## 5. Sibling pages — one system

Shared, reusable components live in **`src/patient/components/ai/`** (patient namespace, not `portal/components/ai`):
- `AiToolHero.tsx` — compact oceanic hero using `.dashboard-hero`: badge, `h1`, description, optional action slot, back link. One source of truth for the gradient (removes duplicated inline gradient strings).
- `AiToolCard.tsx` — tile as §3.5.
- `AiCommandBar.tsx` — as §3.1.
- `HealthSummaryCard.tsx`, `DrugInteractionCard.tsx` — as §3.3/§3.4, hub-only but isolated for tests.
- `AiSafetyNotice.tsx` — as §3.6.
- `AiEmptyDropzone.tsx` — accessible upload zone: drag + click + keyboard (Enter/Space), `role="button"`, focus ring, drag-over state, file-type hints, disabled/busy states. Used by ocr + vaccination-card.

Per page:
- **lab-explain**: consume `?prompt=` (currently ignored) to prefill/auto-run the explanation; `QueryBoundary` around `GET /medical-records/me?type=lab&limit=20`; records picker as `patient-card` list with `Skeleton` loading; result card uses `Card` + copy + "Discuss in chat". Keep `POST /ai/explain/lab-report {reportId}`.
- **lab-trend**: `AiToolHero`; search input + category chips restyled with tokens (drop inline hex overrides); `Skeleton` while `GET /ai/lab-trend/{patientId}` loads; graceful sample fallback retained; result card aligned.
- **ocr**: `AiToolHero` + `AiEmptyDropzone`; remove dead `bg-surface-1` class; stepper states (choose → uploading → result → save); `POST /files/presign` → `PUT` → `POST /ai/ocr/prescription`; invalidate `patientKeys.medicines()`; push `/patient/medications/new?med[...]` (unchanged).
- **clinical-note**: `AiToolHero`; textarea card; result 2-col with key-term pills + SOAP rows in `rounded-inner bg-surface-2`; `POST /ai/clinical-note-summary` (unchanged).
- **vaccination-card**: `AiToolHero` + `AiEmptyDropzone`; result list; emerald save CTA; `POST /ai/ocr/vaccination-card` + `POST /vaccinations` per dose (unchanged); keep demo fallback.

Topbar: update `PAGE_TITLES` entry for `/patient/ai` subtitle from "Ask with context" to "Grounded in your record" (`src/patient/components/shell/Topbar.tsx`).

## 6. Data & state

New file **`src/patient/hooks/ai.ts`**, added to the `hooks/index.ts` barrel (the barrel is the portal's internal API and is mocked wholesale in page tests, so the new exports are `useGenerateSummary` and `useCheckDrugInteractions`):
- `useGenerateSummary()` — `useMutation`, `POST /ai/summary` with `{patientId}`; normalizes string | structured `StructuredSummary` (same tolerant parsing as today, extracted from the page); typed result.
- `useCheckDrugInteractions()` — `useMutation`, `POST /ai/drug-interaction` with `{medicines: string[]}`; normalizes array | JSON-string | `{result, interactions}` shapes into `DrugInteractionItem[]` (parsing logic lifted from the page).
- Types `StructuredSummary`, `DrugInteractionItem` move here from the page.
- No PHI in error logs; errors map to friendly messages, raw details only for non-PHI transport failures.

Reuse `usePatientProfile` (patientId) and `useMedications` (active med names) unchanged.

## 7. Accessibility & states

- Heading hierarchy: one `h1` per page (hero), `h2` for sections.
- All async results in `aria-live="polite"` regions; pending buttons `disabled` + spinner + `aria-busy`.
- Form controls have visible/bound `<label>`s; icon-only buttons have `aria-label`; decorative icons `aria-hidden`.
- Touch targets ≥ 40px; focus-visible ring already global (brand outline).
- Reduced motion respected (global `prefers-reduced-motion` rule already kills animations).
- Error states always offer a retry action; empty states always explain the next step.

## 8. Testing & Verification

New colocated tests (Vitest + RTL + user-event, mock `@/patient/hooks` or wrap a fresh `QueryClientProvider` per existing patterns):
- `src/app/patient/(app)/ai/page.test.tsx` — hub renders; summary success + error; drug check severity mapping + clear state; quick prompts route correctly; clinical-note + vaccination-card links present.
- `src/patient/components/ai/HealthSummaryCard.test.tsx`, `DrugInteractionCard.test.tsx`, `AiCommandBar.test.tsx`, `AiToolCard.test.tsx`.
- `src/app/patient/(app)/ai/chat/page.test.tsx` — renders, typed message calls `api`, prompt from `?prompt=` prefills.
- Keep `parity.test.ts` green (no file moves/renames).

Commands:
- `bun run --filter @healthcare/marketing test`
- `bun run --filter @healthcare/marketing lint`
- `bunx tsc --noEmit` in `apps/marketing` (no typecheck script exists)

Manual QA: `bun run --filter @healthcare/marketing dev`; visually verify `/patient/ai` family **and** dashboard/trends/records/medications pages after the `@theme` change to confirm improvement, not regression.

## 9. Non-goals

- No backend/API route changes, no streaming, no chat persistence, no "recent conversations".
- No i18n extraction, no dark mode.
- No design-system rewrite beyond the `@theme` registration; no restructure of `src/patient` folders.

## 10. Risks

- **`@theme` portal-wide visual shift**: previously-dead utilities activate everywhere. Mitigated by identical names/values and a manual QA pass; raw-class visuals unchanged.
- **Working tree already has uncommitted AI changes**: implement on top of the current working tree; do not revert or commit unrelated files.
- **The 921-line hub** must shrink, not grow: extraction into `components/ai/*` is the mechanism; keep each new file single-purpose.
- **Next.js 16 specifics** (client components, `useSearchParams` suspense rules): read bundled docs before coding.
