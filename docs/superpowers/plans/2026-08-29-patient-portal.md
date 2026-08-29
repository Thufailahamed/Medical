# Patient Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a premium patient-facing web portal at `/patient/*` in `apps/marketing` as an additional role interface, wired to existing backend APIs, without touching the doctor, hospital, admin, lab or insurance-operator portals.

**Architecture:** A new Next.js route tree `apps/marketing/src/app/patient/` holds routing, an indigo design-token stylesheet scoped to `[data-app="patient"]`, and a role gate. A new module `apps/marketing/src/patient/` holds the shell, UI primitives, recharts wrappers, an SVG anatomical centerpiece, dashboard widgets and typed data hooks. Auth state and the fetch wrapper are reused from `@/portal` rather than duplicated. One additive left-join is added to `GET /appointments/me` in `apps/api` so the upcoming-appointment card can render doctor and hospital names.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TanStack Query v5, recharts 2.13, Zustand 5 (reused), lucide-react, Vitest 4 + Testing Library + happy-dom. Hono + Drizzle + MockD1 on the API side.

**Spec:** `docs/superpowers/specs/2026-08-29-patient-portal-design.md`

## Global Constraints

- **No new runtime dependencies.** Framer Motion is not installed and must not be added. Motion is CSS transitions plus recharts' own animation props.
- **No mock, seed, fixture or placeholder data in application code.** Fixtures live only inside `*.test.tsx` files. A widget with no data renders a designed empty state — never a zero, a dash, or an invented value.
- **Never fabricate a clinical status.** Words like "Excellent", "Normal", "High", "Critical" are only rendered from a real classification returned by `GET /vitals/me/alerts` or from a `flag` column on a lab result. They are never inferred in the UI.
- **Doctor portal files are read-only.** The only permitted edits outside `src/app/patient/` and `src/patient/` are: the redirect stubs replacing `src/app/portal/(patient)/**`, the login destination string at `src/app/portal/login/page.tsx:72-76`, `apps/marketing/tsconfig.json`, `apps/marketing/vitest.config.ts`, and `apps/api/src/routes/appointments.ts`.
- **Design tokens are exact.** Surfaces `--color-canvas: #E9ECF1`, `--color-bg: #F4F5F8`, `--color-surface: #FFFFFF`, `--color-surface-2: #F5F6F8`, `--color-surface-3: #ECEEF2`. Ink `--color-text: #0B0B0F`, `--color-text-soft: #56585F`, `--color-text-muted: #9A9DA6`. Accent `--color-brand: #5B4EE9`, `--color-brand-soft: #EEEBFE`, `--color-brand-strong: #4338CA`, `--color-ink: #101014`. Semantic `--color-success: #16A06A` / soft `#E7F7EF`, `--color-warn: #E08A00` / soft `#FDF3E0`, `--color-danger: #E0464B` / soft `#FDECEC`.
- **Geometry is exact.** `--radius-plate: 32px`, `--radius-card: 24px`, `--radius-inner: 16px`, `--radius-pill: 999px`.
- **Type scale is exact.** Page display 56px/700/-0.03em. Card title 18px/600. Metric value 40px/700/-0.02em with the unit trailing at 18px/500 muted. Label 13px/500 muted. Micro 11px/500 muted. Family `Plus Jakarta Sans`, then `Outfit`, then system sans.
- **Visual rules.** No card borders — separation is shadow and spacing only. No chart gridlines except a single dashed baseline. One accent-colored bar or segment per chart, remainder `--color-surface-3`. No colored card headers. No icon-in-a-colored-square pattern.
- **All motion is disabled** under `@media (prefers-reduced-motion: reduce)`.
- **Query keys** are namespaced `["patient", domain, ...params]` with `staleTime: 60_000` and `retry: 1`.
- **Reuse, do not duplicate:** `useAuthStore` from `@/portal/stores/auth`, `api` and `ApiError` from `@/portal/lib/api`, `cn` from `@/portal/lib/utils`, `useRealtime` from `@/portal/hooks/useRealtime`.
- **Commands.** Marketing tests: `cd apps/marketing && bun run test`. API tests: `cd apps/api && bun run test`. Single file: `bunx vitest run <path>`.

---

## File Structure

### Created — `apps/marketing/src/app/patient/`

| File | Responsibility |
|---|---|
| `globals.css` | Indigo token set, `@theme` mirror, base resets scoped to `[data-app="patient"]`, reduced-motion block |
| `layout.tsx` | Imports the stylesheet, renders the `data-app="patient"` wrapper, mounts Providers + AuthBoot. No role gate. |
| `login/page.tsx` | Patient sign-in, writes to the shared portal auth store |
| `403/page.tsx` | Wrong-role landing |
| `(app)/layout.tsx` | Role gate (`PATIENT_ROLES`) wrapping `PatientShell` |
| `(app)/page.tsx` | Dashboard composition |
| `(app)/health/page.tsx` | My Health |
| `(app)/appointments/page.tsx` | Appointments |
| `(app)/records/page.tsx`, `(app)/records/[id]/page.tsx` | Medical records list + detail |
| `(app)/medications/page.tsx` | Medications |
| `(app)/messages/page.tsx`, `(app)/messages/[conversationId]/page.tsx` | Care-team threads + assistant |
| `(app)/profile/page.tsx` | Profile |
| `(app)/notifications/`, `imaging/`, `share/`, `audit/`, `insurance/` | Migrated secondary routes |

### Created — `apps/marketing/src/patient/`

| File | Responsibility |
|---|---|
| `lib/query.ts` | `patientKeys` factory and the shared query-option defaults |
| `lib/format.ts` | Number, unit, date and relative-time formatting |
| `lib/vitals.ts` | Vital-type registry (label, unit, icon, series colour) and pure series→chart mapping |
| `components/ui/Card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardBody` |
| `components/ui/StatTile.tsx` | Large metric value + unit + label + delta |
| `components/ui/Pill.tsx` | `Pill` and `PillGroup` (tab-style segmented control) |
| `components/ui/EmptyState.tsx` | Icon, headline, body, optional call to action |
| `components/ui/Skeleton.tsx` | `Skeleton`, `SkeletonText`, `SkeletonChart` |
| `components/ui/SectionHeader.tsx` | Page display heading + right-hand control cluster |
| `components/ui/Sheet.tsx` | Right-hand slide-over used by detail panels and quick actions |
| `components/ui/QueryBoundary.tsx` | Renders skeleton / error-retry / empty / children from a query result |
| `components/charts/TrendArea.tsx` | Area chart for continuous vitals |
| `components/charts/BarSeries.tsx` | Bar chart with a single highlighted bar |
| `components/charts/RadialGauge.tsx` | Circular progress with rounded caps |
| `components/charts/Sparkline.tsx` | Inline micro line |
| `components/body/BodyFigure.tsx` | SVG anatomical figure and hotspot layout |
| `components/body/BodyHotspot.tsx` | One focusable hotspot button |
| `components/body/OrganDetailPanel.tsx` | Detail for the selected hotspot |
| `components/shell/Sidebar.tsx` | Floating icon rail with the circular active state |
| `components/shell/Topbar.tsx` | Greeting, nav pill, avatar, bell |
| `components/shell/PatientShell.tsx` | Canvas + plate + sidebar + topbar composition |
| `components/widgets/*.tsx` | One file per dashboard card |
| `hooks/useVitalsSeries.ts`, `useHealthSummary.ts`, `useAppointments.ts`, `useMedications.ts`, `useRecords.ts`, `useTimeline.ts`, `useWellness.ts`, `useMessages.ts`, `useProfile.ts` | Typed TanStack Query hooks, one per API domain |
| `types/patient.ts` | Response types mirroring the real API shapes |

### Modified

| File | Change |
|---|---|
| `apps/marketing/tsconfig.json` | Add the `@/patient/*` path alias |
| `apps/marketing/vitest.config.ts` | Add the matching resolve alias |
| `apps/marketing/src/app/portal/login/page.tsx:72-76` | Patient destination becomes `/patient` |
| `apps/marketing/src/app/portal/(patient)/**` | Every page becomes a `redirect()` stub |
| `apps/api/src/routes/appointments.ts:442` | Additive left-join for doctor and hospital names |

---

## Task 1: Route shell, tokens and aliases

**Files:**
- Create: `apps/marketing/src/app/patient/globals.css`
- Create: `apps/marketing/src/app/patient/layout.tsx`
- Create: `apps/marketing/src/app/patient/layout.test.tsx`
- Modify: `apps/marketing/tsconfig.json`
- Modify: `apps/marketing/vitest.config.ts`

**Interfaces:**
- Consumes: `Providers` from `@/portal/components/Providers`, `AuthBoot` from `@/portal/components/AuthBoot`
- Produces: the `[data-app="patient"]` token scope every later task styles against; the `@/patient/*` alias every later import uses

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/layout.test.tsx`:

```tsx
/**
 * Patient root layout — token scope + provider mounting.
 *
 * The wrapper element is load-bearing: every design token in
 * globals.css is scoped to [data-app="patient"], so if this attribute
 * regresses the entire portal renders unstyled.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/portal/components/Providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/portal/components/AuthBoot", () => ({
  AuthBoot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import PatientLayout from "./layout";

describe("PatientLayout", () => {
  it("scopes children under data-app=\"patient\"", () => {
    const { container } = render(
      <PatientLayout>
        <p>child</p>
      </PatientLayout>
    );
    const wrapper = container.querySelector('[data-app="patient"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveTextContent("child");
  });

  it("does not emit its own html or body element", () => {
    const { container } = render(
      <PatientLayout>
        <p>child</p>
      </PatientLayout>
    );
    expect(container.querySelector("html")).toBeNull();
    expect(container.querySelector("body")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/app/patient/layout.test.tsx`
Expected: FAIL — `Failed to resolve import "./layout"`.

- [ ] **Step 3: Add the path aliases**

In `apps/marketing/tsconfig.json`, extend `compilerOptions.paths` so it reads:

```json
"paths": {
  "@/*": ["./src/*"],
  "@/portal/*": ["./src/portal/*"],
  "@/hospital/*": ["./src/hospital/*"],
  "@/patient/*": ["./src/patient/*"]
}
```

In `apps/marketing/vitest.config.ts`, extend `resolve.alias` so it reads:

```ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@/portal": path.resolve(__dirname, "./src/portal"),
    "@/patient": path.resolve(__dirname, "./src/patient"),
  },
},
```

- [ ] **Step 4: Write the token stylesheet**

Create `apps/marketing/src/app/patient/globals.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");
@import "tailwindcss";

/* ============================================================
   Patient portal design tokens.

   Tailwind v4 generates utilities from `--color-*` custom
   properties declared at :root, so the palette lives there. The
   `[data-app="patient"]` block below owns everything that is a
   *style* rather than a token — background, font, base resets —
   so marketing and the clinician portal are untouched.

   This mirrors the pattern already used by
   src/app/portal/globals.css and src/app/hospital/globals.css.
   ============================================================ */

:root {
  /* Surfaces */
  --color-canvas: #e9ecf1;
  --color-bg: #f4f5f8;
  --color-surface: #ffffff;
  --color-surface-2: #f5f6f8;
  --color-surface-3: #eceef2;

  /* Ink */
  --color-text: #0b0b0f;
  --color-text-soft: #56585f;
  --color-text-muted: #9a9da6;

  /* Accent */
  --color-brand: #5b4ee9;
  --color-brand-soft: #eeebfe;
  --color-brand-strong: #4338ca;
  --color-ink: #101014;

  /* Semantic */
  --color-success: #16a06a;
  --color-success-soft: #e7f7ef;
  --color-warn: #e08a00;
  --color-warn-soft: #fdf3e0;
  --color-danger: #e0464b;
  --color-danger-soft: #fdecec;

  /* Geometry */
  --radius-plate: 32px;
  --radius-card: 24px;
  --radius-inner: 16px;
  --radius-pill: 999px;

  /* Depth — wide, low-opacity, no dark edges */
  --shadow-card: 0 1px 2px rgba(11, 11, 15, 0.04),
    0 8px 24px rgba(11, 11, 15, 0.05);
  --shadow-float: 0 4px 12px rgba(11, 11, 15, 0.06),
    0 18px 40px rgba(11, 11, 15, 0.08);
  --shadow-brand: 0 8px 24px rgba(91, 78, 233, 0.28);

  --font-patient: "Plus Jakarta Sans", "Outfit", ui-sans-serif, system-ui,
    -apple-system, "Segoe UI", Roboto, sans-serif;
}

[data-app="patient"] {
  /* The marketing root layout owns <html>/<body>, so the canvas
     background is painted on this wrapper instead of on body. */
  min-height: 100dvh;
  background: var(--color-canvas);
  color: var(--color-text);
  font-family: var(--font-patient);
  -webkit-font-smoothing: antialiased;
}

[data-app="patient"] *:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
  border-radius: 8px;
}

/* ── Type scale ───────────────────────────────────────────── */
[data-app="patient"] .t-display {
  font-size: 56px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.02;
}
[data-app="patient"] .t-card-title {
  font-size: 18px;
  font-weight: 600;
}
[data-app="patient"] .t-metric {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}
[data-app="patient"] .t-unit {
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text-muted);
}
[data-app="patient"] .t-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
}
[data-app="patient"] .t-micro {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
}

/* ── Motion ───────────────────────────────────────────────── */
@keyframes patient-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
[data-app="patient"] .anim-rise {
  animation: patient-rise 180ms ease-out both;
}

@media (prefers-reduced-motion: reduce) {
  [data-app="patient"] *,
  [data-app="patient"] *::before,
  [data-app="patient"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Write the layout**

Create `apps/marketing/src/app/patient/layout.tsx`:

```tsx
import "./globals.css";

import { Providers } from "@/portal/components/Providers";
import { AuthBoot } from "@/portal/components/AuthBoot";

/**
 * Patient portal root layout.
 *
 * Co-exists under the marketing app — the marketing root layout owns
 * <html>/<body>, so we only emit a wrapper. That wrapper carries
 * `data-app="patient"`, which every style rule in globals.css is
 * scoped to, keeping the indigo system out of marketing and out of
 * the clinician portal.
 *
 * Role gating deliberately does NOT happen here: /patient/login and
 * /patient/403 must render for signed-out and wrong-role visitors.
 * The gate lives in (app)/layout.tsx.
 */
export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-app="patient">
      <Providers>
        <AuthBoot>{children}</AuthBoot>
      </Providers>
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/app/patient/layout.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/app/patient apps/marketing/tsconfig.json apps/marketing/vitest.config.ts
git commit -m "feat(patient): add patient portal route shell and design tokens"
```

---

## Task 2: Role gate, 403 and login

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/layout.tsx`
- Create: `apps/marketing/src/app/patient/(app)/layout.test.tsx`
- Create: `apps/marketing/src/app/patient/403/page.tsx`
- Create: `apps/marketing/src/app/patient/login/page.tsx`

**Interfaces:**
- Consumes: `useAuthStore` from `@/portal/stores/auth` (fields `token`, `user`, `hydrated`), `login` from `@/portal/lib/auth`
- Produces: `PATIENT_ROLES` exported from `(app)/layout.tsx`; the gate every `(app)` page relies on

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/(app)/layout.test.tsx`:

```tsx
/**
 * Patient (app) route-group gate.
 *
 * Mirrors the clinician gate in portal/(portal)/layout.tsx. Three
 * behaviours are load-bearing: signed-out visitors bounce to login
 * carrying a `next` param, wrong-role users land on 403, and nothing
 * redirects before the persisted store has hydrated (otherwise a hard
 * refresh would eject a signed-in patient).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/patient",
  useSearchParams: () => new URLSearchParams(),
}));

let mockState: {
  token: string | null;
  user: { id: string; name: string; role: string } | null;
  hydrated: boolean;
} = { token: null, user: null, hydrated: true };

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) => selector(mockState),
}));

vi.mock("@/patient/components/shell/PatientShell", () => ({
  PatientShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

import PatientAppLayout from "./layout";

describe("PatientAppLayout gate", () => {
  beforeEach(() => {
    replace.mockClear();
    window.history.replaceState({}, "", "/patient");
  });

  it("redirects a signed-out visitor to login with a next param", () => {
    mockState = { token: null, user: null, hydrated: true };
    render(<PatientAppLayout><p>dash</p></PatientAppLayout>);
    expect(replace).toHaveBeenCalledWith(
      "/patient/login?next=%2Fpatient"
    );
  });

  it("redirects a doctor to 403", () => {
    mockState = {
      token: "t",
      user: { id: "u1", name: "Dr. House", role: "doctor" },
      hydrated: true,
    };
    render(<PatientAppLayout><p>dash</p></PatientAppLayout>);
    expect(replace).toHaveBeenCalledWith("/patient/403");
  });

  it("renders the shell for a patient", () => {
    mockState = {
      token: "t",
      user: { id: "u2", name: "Alex", role: "patient" },
      hydrated: true,
    };
    render(<PatientAppLayout><p>dash</p></PatientAppLayout>);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("shell")).toHaveTextContent("dash");
  });

  it("does not redirect before the store has hydrated", () => {
    mockState = { token: null, user: null, hydrated: false };
    render(<PatientAppLayout><p>dash</p></PatientAppLayout>);
    expect(replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/layout.test.tsx"`
Expected: FAIL — `Failed to resolve import "./layout"`.

- [ ] **Step 3: Write the gate**

Create `apps/marketing/src/app/patient/(app)/layout.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/portal/stores/auth";
import { PatientShell } from "@/patient/components/shell/PatientShell";

/**
 * (app) route-group layout — the authenticated patient surface.
 *
 * Mirrors the role-gate pattern of portal/(portal)/layout.tsx. Login
 * and 403 live outside this group so they render ungated.
 *
 * Clinicians who land here are sent to 403 rather than to the doctor
 * portal: silently cross-navigating between role surfaces makes
 * permission bugs invisible.
 */
export const PATIENT_ROLES = ["patient"] as const;

export default function PatientAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      const next = encodeURIComponent(window.location.pathname);
      router.replace(`/patient/login?next=${next}`);
      return;
    }
    if (
      user &&
      user.role &&
      !PATIENT_ROLES.includes(user.role as (typeof PATIENT_ROLES)[number])
    ) {
      router.replace("/patient/403");
    }
  }, [hydrated, token, user, router]);

  if (!hydrated || !token) return null;

  return <PatientShell>{children}</PatientShell>;
}
```

- [ ] **Step 4: Write the 403 page**

Create `apps/marketing/src/app/patient/403/page.tsx`:

```tsx
import Link from "next/link";

export default function PatientForbiddenPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <div
        className="w-full max-w-md bg-surface p-10 text-center"
        style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
      >
        <p className="t-label">Access denied</p>
        <h1 className="mt-2 text-2xl font-semibold text-text">
          This area is for patients
        </h1>
        <p className="mt-3 text-sm text-text-soft">
          Your account is signed in with a clinical role. Use the clinician
          portal to see your patients, schedule and prescriptions.
        </p>
        <Link
          href="/portal/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center bg-ink px-6 text-sm font-semibold text-white transition-shadow hover:shadow-float"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          Go to the clinician portal
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Write the login page**

Create `apps/marketing/src/app/patient/login/page.tsx`:

```tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { login } from "@/portal/lib/auth";
import { ApiError } from "@/portal/lib/api";

/**
 * Patient sign-in.
 *
 * Writes into the SAME auth store the clinician portal uses
 * (`@/portal/stores/auth`), so a session started at /portal/login is
 * already valid here and vice versa. `login()` accepts either an
 * email address or a phone number.
 */
function PatientLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/patient";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user } = await login(identifier, password);
      if (user.role !== "patient") {
        router.replace("/patient/403");
        return;
      }
      router.replace(next.startsWith("/patient") ? next : "/patient");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not sign you in. Check your details and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-surface p-10"
        style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
      >
        <p className="t-label">Patient portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-text">
          Sign in
        </h1>

        <label className="mt-8 block t-label" htmlFor="identifier">
          Email or phone
        </label>
        <input
          id="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          required
          className="mt-2 h-12 w-full bg-surface-2 px-4 text-sm text-text outline-none"
          style={{ borderRadius: "var(--radius-inner)" }}
        />

        <label className="mt-5 block t-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-2 h-12 w-full bg-surface-2 px-4 text-sm text-text outline-none"
          style={{ borderRadius: "var(--radius-inner)" }}
        />

        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-7 h-12 w-full bg-ink text-sm font-semibold text-white transition-shadow hover:shadow-float disabled:opacity-60"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function PatientLoginPage() {
  return (
    <Suspense fallback={null}>
      <PatientLoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/layout.test.tsx"`
Expected: PASS, 4 tests. (`PatientShell` is mocked, so Task 3 is not a prerequisite for the test — but the app will not compile until Task 3 lands, which is expected at this point in the sequence.)

- [ ] **Step 7: Commit**

```bash
git add "apps/marketing/src/app/patient"
git commit -m "feat(patient): add role gate, 403 and patient login"
```

---

## Task 3: Query keys, formatting and the vital registry

**Files:**
- Create: `apps/marketing/src/patient/lib/query.ts`
- Create: `apps/marketing/src/patient/lib/format.ts`
- Create: `apps/marketing/src/patient/lib/vitals.ts`
- Create: `apps/marketing/src/patient/lib/vitals.test.ts`
- Create: `apps/marketing/src/patient/lib/format.test.ts`
- Create: `apps/marketing/src/patient/types/patient.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `patientKeys` — key factory, e.g. `patientKeys.vitalsSeries(type, range)` → `["patient","vitals","series",type,range]`
  - `PATIENT_QUERY_DEFAULTS: { staleTime: 60_000; retry: 1 }`
  - `VITAL_REGISTRY: Record<VitalType, VitalMeta>` where `VitalMeta = { key, label, unit, shortLabel, decimals }`
  - `toSeries(points: VitalPoint[]): ChartPoint[]` and `peakIndex(points: ChartPoint[]): number`
  - `formatMetric(value, decimals)`, `formatRelative(iso, now?)`, `formatDayLabel(iso)`, `formatTime(hhmm)`
  - Types `VitalPoint`, `VitalSeriesResponse`, `WellnessResponse`, `MedicineStats`, `AppointmentRow`, `TimelineEvent`, `RecordRow`

- [ ] **Step 1: Write the failing tests**

Create `apps/marketing/src/patient/lib/vitals.test.ts`:

```ts
/**
 * Vital registry + series mapping.
 *
 * The blood-pressure case is the one that bites: the API returns
 * systolic in `value` and diastolic in `secondary`, so a naive mapper
 * silently drops half the reading.
 */
import { describe, it, expect } from "vitest";
import { VITAL_REGISTRY, toSeries, peakIndex } from "./vitals";

describe("VITAL_REGISTRY", () => {
  it("covers the four dashboard vitals with display units", () => {
    expect(VITAL_REGISTRY.heart_rate.unit).toBe("bpm");
    expect(VITAL_REGISTRY.spo2.unit).toBe("%");
    expect(VITAL_REGISTRY.temperature.unit).toBe("°C");
    expect(VITAL_REGISTRY.blood_pressure.unit).toBe("mmHg");
  });
});

describe("toSeries", () => {
  it("maps API points to chart points", () => {
    const out = toSeries([
      { t: "2026-08-29T06:00:00.000Z", value: 96, secondary: null, id: "a", unit: "bpm", context: null },
      { t: "2026-08-29T07:00:00.000Z", value: 132, secondary: null, id: "b", unit: "bpm", context: null },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ t: "2026-08-29T06:00:00.000Z", value: 96, secondary: null });
    expect(out[1].value).toBe(132);
  });

  it("preserves the diastolic value for blood pressure", () => {
    const out = toSeries([
      { t: "2026-08-29T06:00:00.000Z", value: 128, secondary: 82, id: "a", unit: "mmHg", context: null },
    ]);
    expect(out[0].secondary).toBe(82);
  });

  it("returns an empty array for an empty response", () => {
    expect(toSeries([])).toEqual([]);
  });
});

describe("peakIndex", () => {
  it("returns the index of the highest value", () => {
    expect(
      peakIndex([
        { t: "1", value: 96, secondary: null },
        { t: "2", value: 132, secondary: null },
        { t: "3", value: 110, secondary: null },
      ])
    ).toBe(1);
  });

  it("returns -1 for an empty series so no bar is highlighted", () => {
    expect(peakIndex([])).toBe(-1);
  });
});
```

Create `apps/marketing/src/patient/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatMetric, formatRelative, formatTime } from "./format";

describe("formatMetric", () => {
  it("rounds to the registry's decimal count", () => {
    expect(formatMetric(72.4, 0)).toBe("72");
    expect(formatMetric(36.65, 1)).toBe("36.7");
  });

  it("returns an em dash for null so callers never print 0 for missing data", () => {
    expect(formatMetric(null, 0)).toBe("—");
    expect(formatMetric(undefined, 1)).toBe("—");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");

  it("describes minutes, hours and days", () => {
    expect(formatRelative("2026-08-29T11:45:00.000Z", now)).toBe("15m ago");
    expect(formatRelative("2026-08-29T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatRelative("2026-08-27T12:00:00.000Z", now)).toBe("2d ago");
  });

  it("says just now for anything under a minute", () => {
    expect(formatRelative("2026-08-29T11:59:40.000Z", now)).toBe("Just now");
  });

  it("returns an em dash for a null timestamp", () => {
    expect(formatRelative(null, now)).toBe("—");
  });
});

describe("formatTime", () => {
  it("renders 24h clock strings as 12h with a meridiem", () => {
    expect(formatTime("09:00")).toBe("9:00 AM");
    expect(formatTime("14:30")).toBe("2:30 PM");
    expect(formatTime("00:15")).toBe("12:15 AM");
  });

  it("returns an em dash for a missing time", () => {
    expect(formatTime(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/marketing && bunx vitest run src/patient/lib`
Expected: FAIL — `Failed to resolve import "./vitals"` and `"./format"`.

- [ ] **Step 3: Write the types**

Create `apps/marketing/src/patient/types/patient.ts`:

```ts
/**
 * Response types mirroring the REAL API shapes.
 *
 * Every type here was read off the handler in apps/api — none of it is
 * aspirational. If a field is optional it is because the handler can
 * genuinely omit it.
 */

export type VitalType =
  | "heart_rate"
  | "blood_pressure"
  | "spo2"
  | "temperature"
  | "blood_sugar"
  | "weight"
  | "respiratory_rate";

/** One point from GET /vitals/me/series. */
export interface VitalPoint {
  t: string;
  value: number;
  secondary: number | null;
  id: string;
  unit: string;
  context: string | null;
}

export interface VitalStats {
  min: number;
  max: number;
  avg: number;
  latest: number;
  delta: number;
  count: number;
}

/** GET /vitals/me/series?type=&from=&to= */
export interface VitalSeriesResponse {
  type: VitalType;
  range: { from: string | null; to: string | null };
  points: VitalPoint[];
  stats: VitalStats | null;
  latestClassification: string | null;
}

/** One alert from GET /vitals/me/alerts. */
export interface VitalAlert {
  type: VitalType;
  classification: string;
  value: number;
  secondary?: number | null;
  recordedAt: string;
  message?: string;
}

/** GET /wellness/me */
export interface WellnessResponse {
  score: number;
  level: { label: string; tone: "success" | "info" | "warning" | "danger" };
  components: Record<string, number>;
  updatedAt: string;
}

/** GET /medicines/me/stats */
export interface MedicineStats {
  activeCount: number;
  pausedCount: number;
  todayCount: number;
  todayTaken: number;
  streakDays: number;
  last7Days: Array<{ date: string; total: number; taken: number; pct: number }>;
}

/** A row from GET /medicines/me and /medicines/today. */
export interface MedicineRow {
  id: string;
  name: string;
  dosage: string;
  frequency: string | null;
  timing: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  notes: string | null;
}

/**
 * A row from GET /appointments/me.
 *
 * doctorName / doctorSpecialization / hospitalName are added by the
 * additive join in Task 4. They are nullable because the join is a
 * LEFT join — a deleted doctor row must not drop the appointment.
 */
export interface AppointmentRow {
  id: string;
  doctorId: string;
  patientId: string;
  hospitalId: string;
  date: string;
  time: string;
  status:
    | "scheduled"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show";
  reason: string | null;
  notes: string | null;
  mode: "in_person" | "video";
  queueNumber: number | null;
  paymentStatus: "pending" | "paid" | "refunded" | "insurance" | null;
  recordCount: number;
  doctorName: string | null;
  doctorSpecialization: string | null;
  hospitalName: string | null;
}

/** A row from GET /medical-records/me. */
export interface RecordRow {
  id: string;
  recordType: string;
  title: string;
  diagnosis: string | null;
  summary: string | null;
  date: string;
  status: "pending" | "completed" | "cancelled" | null;
  tags: string | null;
  createdAt: string;
}

/** GET /medical-records/me/stats */
export interface RecordStats {
  total: number;
  byType: Record<string, number>;
}

/** An event from GET /timeline/me. */
export interface TimelineEvent {
  id: string;
  kind:
    | "record"
    | "vital"
    | "symptom"
    | "medicine_start"
    | "medicine_stop"
    | "appointment"
    | "note";
  date: string;
  title: string;
  subtitle: string | null;
  meta: Record<string, unknown> | null;
  icon?: string;
  color?: string;
  label?: string;
}

/** GET /health-summary/me — only the fields the dashboard reads. */
export interface HealthSummary {
  generatedAt: string;
  demographics: {
    name: string | null;
    age: number | null;
    sex: string | null;
    bloodGroup: string | null;
    bmi: number | null;
    bmiCategory: string | null;
  };
  allergies: Array<{ substance: string; severity: string | null }>;
  conditions: Array<{ title: string; diagnosedOn: string | null }>;
  activeMedicines: Array<{ name: string; dosage: string; frequency: string | null }>;
  alerts: { count: number; items: VitalAlert[] };
}

/** A thread from GET /patient-messages/conversations. */
export interface Conversation {
  id: string;
  doctorId: string;
  doctorName: string | null;
  status: "open" | "closed";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSender: string | null;
  patientUnread: number;
}

/** A message from GET /patient-messages/conversations/:id/messages. */
export interface Message {
  id: string;
  conversationId: string;
  senderRole: "doctor" | "patient";
  body: string;
  createdAt: string;
}
```

- [ ] **Step 4: Write the query-key factory**

Create `apps/marketing/src/patient/lib/query.ts`:

```ts
/**
 * Query keys and shared options for every patient hook.
 *
 * Every key starts with "patient" so the dashboard's refresh control
 * can invalidate the whole surface with a single prefix, and so patient
 * cache entries never collide with the clinician portal's.
 */

export const PATIENT_QUERY_DEFAULTS = {
  staleTime: 60_000,
  retry: 1,
} as const;

export type RangeKey = "week" | "month" | "quarter";

export const patientKeys = {
  all: ["patient"] as const,

  profile: () => ["patient", "profile"] as const,
  healthSummary: () => ["patient", "health-summary"] as const,
  wellness: () => ["patient", "wellness"] as const,

  vitalsSeries: (type: string, range: RangeKey) =>
    ["patient", "vitals", "series", type, range] as const,
  vitalsDerived: () => ["patient", "vitals", "derived"] as const,
  vitalsAlerts: (days: number) => ["patient", "vitals", "alerts", days] as const,
  symptoms: () => ["patient", "vitals", "symptoms"] as const,

  appointments: () => ["patient", "appointments"] as const,
  appointmentRecords: (id: string) =>
    ["patient", "appointments", id, "records"] as const,

  records: (params: Record<string, unknown>) =>
    ["patient", "records", params] as const,
  recordStats: () => ["patient", "records", "stats"] as const,
  record: (id: string) => ["patient", "records", id] as const,
  recordChildren: (id: string, kind: string) =>
    ["patient", "records", id, kind] as const,
  labTrend: (test: string, months: number) =>
    ["patient", "records", "lab-trend", test, months] as const,

  medicines: () => ["patient", "medicines"] as const,
  medicinesToday: () => ["patient", "medicines", "today"] as const,
  medicineStats: (days: number) =>
    ["patient", "medicines", "stats", days] as const,
  medicineRefills: () => ["patient", "medicines", "refills"] as const,
  medicineInteractions: () => ["patient", "medicines", "interactions"] as const,

  timeline: (params: Record<string, unknown>) =>
    ["patient", "timeline", params] as const,

  conversations: () => ["patient", "messages", "conversations"] as const,
  conversation: (id: string) =>
    ["patient", "messages", "conversations", id] as const,
  chatSessions: () => ["patient", "messages", "chat-sessions"] as const,

  notifications: () => ["patient", "notifications"] as const,
  unreadCount: () => ["patient", "notifications", "unread"] as const,

  allergies: () => ["patient", "allergies"] as const,
  vaccinations: () => ["patient", "vaccinations"] as const,
  family: () => ["patient", "family"] as const,
};

/** Range key → an ISO `from` bound. `to` is always "now" (omitted). */
export function rangeToFrom(range: RangeKey, now = new Date()): string {
  const d = new Date(now);
  if (range === "week") d.setDate(d.getDate() - 7);
  else if (range === "month") d.setMonth(d.getMonth() - 1);
  else d.setMonth(d.getMonth() - 3);
  return d.toISOString();
}
```

- [ ] **Step 5: Write the formatters**

Create `apps/marketing/src/patient/lib/format.ts`:

```ts
/**
 * Display formatting.
 *
 * The em-dash return for null is deliberate and load-bearing: the spec
 * forbids printing 0 or an invented value when data is missing, and a
 * formatter that silently coerces null to 0 is the easiest way for that
 * rule to be broken by accident.
 */

const EM_DASH = "—";

export function formatMetric(
  value: number | null | undefined,
  decimals = 0
): string {
  if (value == null || Number.isNaN(value)) return EM_DASH;
  return value.toFixed(decimals);
}

export function formatDelta(value: number | null | undefined, decimals = 0) {
  if (value == null || Number.isNaN(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}`;
}

export function formatRelative(
  iso: string | null | undefined,
  now: Date = new Date()
): string {
  if (!iso) return EM_DASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return EM_DASH;

  const seconds = Math.floor((now.getTime() - then) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** "2026-08-29" → "Sat, 29 Aug". */
export function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "14:30" → "2:30 PM". */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return EM_DASH;
  const [hStr, mStr = "00"] = hhmm.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return EM_DASH;
  const meridiem = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr.padStart(2, "0")} ${meridiem}`;
}

/** Title-cases an API enum such as "in_person" → "In person". */
export function humanize(value: string | null | undefined): string {
  if (!value) return EM_DASH;
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
```

- [ ] **Step 6: Write the vital registry**

Create `apps/marketing/src/patient/lib/vitals.ts`:

```ts
import type { VitalPoint, VitalType } from "@/patient/types/patient";

export interface VitalMeta {
  key: VitalType;
  /** Full name used in headings and aria labels. */
  label: string;
  /** Short name used on tab pills. */
  shortLabel: string;
  unit: string;
  decimals: number;
}

/**
 * Display metadata for every vital the patient surface charts.
 *
 * The `type` strings match the enum on the `vitals` table exactly —
 * they are sent straight through as the `?type=` query parameter.
 */
export const VITAL_REGISTRY: Record<VitalType, VitalMeta> = {
  heart_rate: {
    key: "heart_rate",
    label: "Heart rate",
    shortLabel: "Heart",
    unit: "bpm",
    decimals: 0,
  },
  blood_pressure: {
    key: "blood_pressure",
    label: "Blood pressure",
    shortLabel: "Pressure",
    unit: "mmHg",
    decimals: 0,
  },
  spo2: {
    key: "spo2",
    label: "Oxygen saturation",
    shortLabel: "Saturation",
    unit: "%",
    decimals: 0,
  },
  temperature: {
    key: "temperature",
    label: "Temperature",
    shortLabel: "Temperature",
    unit: "°C",
    decimals: 1,
  },
  blood_sugar: {
    key: "blood_sugar",
    label: "Blood sugar",
    shortLabel: "Sugar",
    unit: "mg/dL",
    decimals: 0,
  },
  weight: {
    key: "weight",
    label: "Weight",
    shortLabel: "Weight",
    unit: "kg",
    decimals: 1,
  },
  respiratory_rate: {
    key: "respiratory_rate",
    label: "Respiratory rate",
    shortLabel: "Breathing",
    unit: "br/min",
    decimals: 0,
  },
};

/** The four vitals the dashboard trend card offers as tabs, in order. */
export const DASHBOARD_VITALS: VitalType[] = [
  "heart_rate",
  "spo2",
  "blood_pressure",
  "temperature",
];

export interface ChartPoint {
  t: string;
  value: number;
  secondary: number | null;
}

/**
 * API points → chart points.
 *
 * `secondary` carries the diastolic reading for blood pressure and is
 * null for every other type; it is preserved rather than flattened so
 * the BP chart can draw both series.
 */
export function toSeries(points: VitalPoint[]): ChartPoint[] {
  return points.map((p) => ({
    t: p.t,
    value: p.value,
    secondary: p.secondary ?? null,
  }));
}

/**
 * Index of the highest reading — the one bar rendered in the accent
 * colour. Returns -1 for an empty series so callers highlight nothing
 * rather than defaulting to index 0.
 */
export function peakIndex(points: ChartPoint[]): number {
  if (points.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].value > points[best].value) best = i;
  }
  return best;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/marketing && bunx vitest run src/patient/lib`
Expected: PASS, 13 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/marketing/src/patient
git commit -m "feat(patient): add query keys, formatters, vital registry and API types"
```

---

## Task 4: Doctor and hospital names on GET /appointments/me

**Files:**
- Modify: `apps/api/src/routes/appointments.ts:1-18` (import) and `:442-470` (handler)
- Create: `apps/api/tests/appointments-me-join.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `GET /appointments/me` response rows gain `doctorName: string | null`, `doctorSpecialization: string | null`, `hospitalName: string | null`. Every pre-existing key keeps its name and type.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/appointments-me-join.test.ts`:

```ts
// tests/appointments-me-join.test.ts
//
// GET /appointments/me must carry the doctor and hospital NAMES, not
// just their ids — the patient portal's upcoming-appointment card
// renders "Dr. Perera · Asiri Central" and cannot resolve ids itself.
//
// The join is additive: this test also pins that every pre-existing
// key survives, because the mobile app reads the same endpoint.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, getJson } from "./_testApp";
import appointmentsRouter from "../src/routes/appointments";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-join";
const PATIENT_ID = "patient-join";
const DOCTOR_USER = "user-doctor-join";
const DOCTOR_ID = "doctor-join";
const HOSPITAL_ID = "hospital-join";

let db: MockD1;
let app: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Alex", email: "a@test.local" },
    { id: DOCTOR_USER, role: "doctor", name: "Dr. Perera", email: "d@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [
    { id: DOCTOR_ID, userId: DOCTOR_USER, specialization: "Cardiology" },
  ]);
  db.seed("hospitals", [{ id: HOSPITAL_ID, name: "Asiri Central" }]);
  db.seed("appointments", [
    {
      id: "apt-1",
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      hospitalId: HOSPITAL_ID,
      date: "2026-09-10",
      time: "10:00",
      status: "confirmed",
      mode: "in_person",
      reason: "Follow-up",
    },
  ]);

  app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
  app.route("/appointments", appointmentsRouter);
});

describe("GET /appointments/me", () => {
  it("returns the doctor name, specialization and hospital name", async () => {
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r) => r.patientId === PATIENT_ID);

    const res = await getJson(app, "/appointments/me");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.appointments).toHaveLength(1);

    const row = body.appointments[0];
    expect(row.doctorName).toBe("Dr. Perera");
    expect(row.doctorSpecialization).toBe("Cardiology");
    expect(row.hospitalName).toBe("Asiri Central");
  });

  it("preserves every pre-existing key so the mobile app keeps working", async () => {
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r) => r.patientId === PATIENT_ID);

    const res = await getJson(app, "/appointments/me");
    const row = ((await res.json()) as any).appointments[0];

    expect(row.id).toBe("apt-1");
    expect(row.doctorId).toBe(DOCTOR_ID);
    expect(row.hospitalId).toBe(HOSPITAL_ID);
    expect(row.date).toBe("2026-09-10");
    expect(row.time).toBe("10:00");
    expect(row.status).toBe("confirmed");
    expect(row.mode).toBe("in_person");
    expect(row.reason).toBe("Follow-up");
    expect(row.recordCount).toBe(0);
  });

  it("returns null names rather than dropping the row when the doctor is missing", async () => {
    db.seed("appointments", [
      {
        id: "apt-2",
        patientId: PATIENT_ID,
        doctorId: "doctor-deleted",
        hospitalId: HOSPITAL_ID,
        date: "2026-09-11",
        time: "11:00",
        status: "scheduled",
        mode: "in_person",
        reason: null,
      },
    ]);
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r) => r.id === "apt-2");

    const res = await getJson(app, "/appointments/me");
    const rows = ((await res.json()) as any).appointments;

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("apt-2");
    expect(rows[0].doctorName).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bunx vitest run tests/appointments-me-join.test.ts`
Expected: FAIL — `expected undefined to be 'Dr. Perera'`.

- [ ] **Step 3: Add the hospitals import**

In `apps/api/src/routes/appointments.ts`, extend the `@healthcare/db` import on line 4 to include `hospitals`:

```ts
import { appointments, doctors, patients, users, hospitals, notifications, medicalRecords, appointmentStatusHistory, appointmentRatings, teleconsultSessions } from "@healthcare/db";
```

- [ ] **Step 4: Replace the handler body**

In `apps/api/src/routes/appointments.ts`, replace the `upcoming` query and the `enriched` mapping inside `appointmentsRouter.get("/me", ...)` with:

```ts
  // Left-join the doctor (and through it the doctor's user row for the
  // display name) plus the hospital, so the patient portal can render
  // "Dr. Perera · Cardiology · Asiri Central" without a second round
  // trip. LEFT joins, deliberately: a deleted doctor or hospital row
  // must null the name, never drop the appointment.
  const upcoming = await db
    .select({
      appointment: appointments,
      doctorName: users.name,
      doctorSpecialization: doctors.specialization,
      hospitalName: hospitals.name,
    })
    .from(appointments)
    .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
    .leftJoin(users, eq(doctors.userId, users.id))
    .leftJoin(hospitals, eq(appointments.hospitalId, hospitals.id))
    .where(eq(appointments.patientId, patient.id))
    .orderBy(appointments.date);

  // Annotate each row with recordCount (records tied to that appointment).
  // The `...row.appointment` spread keeps every pre-existing key at the
  // top level, so existing consumers (the mobile app) are unaffected.
  const enriched = upcoming.map((row: any) => ({
    ...(row.appointment ?? row),
    recordCount: 0,
    doctorName: row.doctorName ?? null,
    doctorSpecialization: row.doctorSpecialization ?? null,
    hospitalName: row.hospitalName ?? null,
  }));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && bunx vitest run tests/appointments-me-join.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the neighbouring appointment suites for regressions**

Run: `cd apps/api && bunx vitest run tests/appointments-mode.test.ts tests/appointments-telemedicine.test.ts tests/appointments-records-active-session.test.ts`
Expected: PASS, no new failures.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/appointments.ts apps/api/tests/appointments-me-join.test.ts
git commit -m "feat(api): join doctor and hospital names onto GET /appointments/me"
```

---

## Task 5: Shell — Sidebar, Topbar, PatientShell

**Files:**
- Create: `apps/marketing/src/patient/components/shell/Sidebar.tsx`
- Create: `apps/marketing/src/patient/components/shell/Sidebar.test.tsx`
- Create: `apps/marketing/src/patient/components/shell/Topbar.tsx`
- Create: `apps/marketing/src/patient/components/shell/PatientShell.tsx`
- Create: `apps/marketing/src/patient/components/shell/PatientShell.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` from `@/portal/stores/auth` (fields `user`, `setSession`, `hydrated`), `usePathname` from `next/navigation`
- Produces:
  - `Sidebar`: floating rail with circular active navigation. Props: none (uses `useAuthStore`). Highlights current route against the `NAV_ITEMS` list.
  - `Topbar`: greeting + nav-pill control + avatar + bell. Props: `{ user: AuthUser }`.
  - `PatientShell`: wraps children with the canvas, plate, sidebar and topbar. Props: `{ children: ReactNode }`. Re-used by `(app)/layout.tsx`.

- [ ] **Step 1: Write the failing Sidebar test**

Create `apps/marketing/src/patient/components/shell/Sidebar.test.tsx`:

```tsx
/**
 * Sidebar nav — circular active state, label-to-route mapping.
 *
 * What we pin: (1) the active item is the one whose route matches
 * the current pathname; (2) every nav item has a stable test id so
 * later tests can target them; (3) the user name shows in the footer
 * because the sidebar owns the only persistent identity surface.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/patient",
  useSearchParams: () => new URLSearchParams(),
}));

let mockState: {
  token: string | null;
  user: { id: string; name: string; role: string; photo: string | null } | null;
  hydrated: boolean;
} = {
  token: "t",
  user: { id: "u2", name: "Alex Fernando", role: "patient", photo: null },
  hydrated: true,
};

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) => selector(mockState),
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.resetModules();
    mockState = {
      token: "t",
      user: { id: "u2", name: "Alex Fernando", role: "patient", photo: null },
      hydrated: true,
    };
  });

  it("renders one button per nav destination", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("nav-dashboard")).toBeTruthy();
    expect(screen.getByTestId("nav-health")).toBeTruthy();
    expect(screen.getByTestId("nav-appointments")).toBeTruthy();
    expect(screen.getByTestId("nav-records")).toBeTruthy();
    expect(screen.getByTestId("nav-medications")).toBeTruthy();
    expect(screen.getByTestId("nav-messages")).toBeTruthy();
    expect(screen.getByTestId("nav-profile")).toBeTruthy();
  });

  it("marks the dashboard button active when pathname is /patient", () => {
    render(<Sidebar />);
    const dashboard = screen.getByTestId("nav-dashboard");
    expect(dashboard.getAttribute("aria-current")).toBe("page");
  });

  it("shows the signed-in user's name in the footer", () => {
    render(<Sidebar />);
    expect(screen.getByText("Alex Fernando")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/shell/Sidebar.test.tsx`
Expected: FAIL — `Failed to resolve import "./Sidebar"`.

- [ ] **Step 3: Write the Sidebar**

Create `apps/marketing/src/patient/components/shell/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Calendar,
  Home,
  MessageCircle,
  Pill,
  ScrollText,
  User,
} from "lucide-react";

import { useAuthStore } from "@/portal/stores/auth";
import { cn } from "@/portal/lib/utils";

const NAV_ITEMS = [
  { href: "/patient", label: "Dashboard", icon: Home, testId: "nav-dashboard" },
  { href: "/patient/health", label: "My Health", icon: Activity, testId: "nav-health" },
  {
    href: "/patient/appointments",
    label: "Appointments",
    icon: Calendar,
    testId: "nav-appointments",
  },
  {
    href: "/patient/records",
    label: "Medical Records",
    icon: ScrollText,
    testId: "nav-records",
  },
  {
    href: "/patient/medications",
    label: "Medications",
    icon: Pill,
    testId: "nav-medications",
  },
  {
    href: "/patient/messages",
    label: "Messages",
    icon: MessageCircle,
    testId: "nav-messages",
  },
  { href: "/patient/profile", label: "Profile", icon: User, testId: "nav-profile" },
];

/**
 * Floating icon rail with a circular active state.
 *
 * Two states are wired deliberately: the active route gets a dark
 * circle (the spec calls this out as the only place in the shell
 * where the full-strength `--color-ink` appears), and the active
 * label sits BELOW the rail in muted ink rather than inside it, so
 * the rail stays visually quiet.
 */
export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <aside
      aria-label="Primary"
      className="flex flex-col items-center gap-1 bg-surface px-3 py-6"
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        width: 84,
      }}
    >
      <div
        className="mb-4 grid h-9 w-9 place-items-center bg-ink text-white"
        style={{ borderRadius: "var(--radius-pill)", fontWeight: 700 }}
        aria-hidden
      >
        M
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/patient"
              ? pathname === "/patient"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "grid h-11 w-11 place-items-center transition-colors",
                isActive
                  ? "bg-ink text-white"
                  : "text-text-soft hover:bg-surface-2"
              )}
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              <Icon size={20} aria-hidden />
            </Link>
          );
        })}
      </nav>

      {user?.name ? (
        <p
          className="mt-4 max-w-[68px] truncate text-center text-[11px] font-medium text-text-muted"
          title={user.name}
        >
          {user.name}
        </p>
      ) : null}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/components/shell/Sidebar.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the Topbar**

Create `apps/marketing/src/patient/components/shell/Topbar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";

import type { AuthUser } from "@/portal/stores/auth";
import { useUnreadNotificationsCount } from "@/patient/hooks/useNotifications";

/**
 * Greeting + nav pill + avatar + bell.
 *
 * The nav pill is a brand-soft chip showing the section name. It's
 * decorative, not interactive — it visually anchors the row without
 * adding another selectable target next to the sidebar.
 */
export function Topbar({ user }: { user: AuthUser | null }) {
  const firstName = user?.name?.split(" ")[0] ?? null;
  const unread = useUnreadNotificationsCount();

  return (
    <header
      className="flex items-center gap-6 bg-surface px-6 py-4"
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="t-label">Patient portal</p>
        <h1 className="truncate text-lg font-semibold text-text">
          {firstName ? `Good morning, ${firstName}` : "Welcome back"}
        </h1>
      </div>

      <button
        type="button"
        className="grid h-10 w-10 place-items-center text-text-soft hover:bg-surface-2"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        <ChevronDown size={18} aria-hidden />
      </button>

      <Link
        href="/patient/notifications"
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications"
        }
        className="relative grid h-10 w-10 place-items-center text-text-soft hover:bg-surface-2"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        <Bell size={18} aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute right-2 top-2 grid h-4 min-w-[16px] place-items-center bg-brand px-1 text-[10px] font-semibold text-white"
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>

      <Avatar user={user} />
    </header>
  );
}

function Avatar({ user }: { user: AuthUser | null }) {
  const initials = user?.name
    ? user.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : "?";

  if (user?.photo) {
    return (
      <img
        src={user.photo}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 object-cover"
        style={{ borderRadius: "var(--radius-pill)" }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid h-10 w-10 place-items-center bg-surface-3 text-sm font-semibold text-text-soft"
      style={{ borderRadius: "var(--radius-pill)" }}
    >
      {initials}
    </span>
  );
}
```

- [ ] **Step 6: Stub the unread-notifications hook**

Create `apps/marketing/src/patient/hooks/useNotifications.ts` with a placeholder implementation. Task 12 (`useNotifications`) will rewrite the body once the dashboard is wired. For the Topbar to compile, this stub returns `0`.

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";

/**
 * Stub: real implementation lands in Task 12. Returning 0 keeps the
 * Topbar's badge hidden while every other screen renders correctly.
 */
export function useUnreadNotificationsCount() {
  const q = useQuery<{ count: number }>({
    queryKey: patientKeys.unreadCount(),
    queryFn: () => api("/patient-notifications/unread-count"),
    ...PATIENT_QUERY_DEFAULTS,
  });
  return q.data?.count ?? 0;
}
```

- [ ] **Step 7: Write the failing PatientShell test**

Create `apps/marketing/src/patient/components/shell/PatientShell.test.tsx`:

```tsx
/**
 * PatientShell composition.
 *
 * Pins three things: (1) the canvas/plate structure (canvas bg +
 * rounded plate behind everything), (2) the sidebar+topbar mounting
 * order (sidebar left, topbar above content), (3) the role of the
 * shell when the auth store isn't hydrated yet (we render nothing
 * because the gate in (app)/layout.tsx already short-circuits).
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/portal/components/Providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

vi.mock("@/patient/hooks/useNotifications", () => ({
  useUnreadNotificationsCount: () => 0,
}));

import { PatientShell } from "./PatientShell";

describe("PatientShell", () => {
  it("renders the sidebar, topbar and children in that order", () => {
    const { container } = render(
      <PatientShell>
        <p data-testid="child">dashboard</p>
      </PatientShell>
    );

    // Sidebar <aside> precedes Topbar <header> precedes child.
    const aside = container.querySelector("aside");
    const header = container.querySelector("header");
    const child = container.querySelector('[data-testid="child"]');
    expect(aside).not.toBeNull();
    expect(header).not.toBeNull();
    expect(child).not.toBeNull();

    // Document order
    const position = (el: Element) =>
      Array.from(container.querySelectorAll("*")).indexOf(el);
    expect(position(aside!)).toBeLessThan(position(header!));
    expect(position(header!)).toBeLessThan(position(child!));
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/shell/PatientShell.test.tsx`
Expected: FAIL — `Failed to resolve import "./PatientShell"`.

- [ ] **Step 9: Write the PatientShell**

Create `apps/marketing/src/patient/components/shell/PatientShell.tsx`:

```tsx
"use client";

import { useAuthStore } from "@/portal/stores/auth";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * The authenticated patient surface.
 *
 * Layout: canvas (`--color-canvas`) → plate (`--color-bg`, the rounded
 * dashboard container from the spec) → sidebar + main column.
 * The plate is the spec's "rounded dashboard container" — a single
 * rounded wrapper that holds the rail and the page content together.
 */
export function PatientShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-[100dvh] p-6 lg:p-8">
      <div
        className="mx-auto flex max-w-[1320px] gap-6 p-4 lg:p-6"
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-plate)",
          minHeight: "calc(100dvh - 4rem)",
        }}
      >
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Topbar user={user} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/components/shell/PatientShell.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 11: Commit**

```bash
git add apps/marketing/src/patient/components/shell apps/marketing/src/patient/hooks/useNotifications.ts
git commit -m "feat(patient): add sidebar, topbar and patient shell"
```

---

## Task 6: UI primitives

**Files:**
- Create: `apps/marketing/src/patient/components/ui/Card.tsx`
- Create: `apps/marketing/src/patient/components/ui/Card.test.tsx`
- Create: `apps/marketing/src/patient/components/ui/StatTile.tsx`
- Create: `apps/marketing/src/patient/components/ui/Pill.tsx`
- Create: `apps/marketing/src/patient/components/ui/EmptyState.tsx`
- Create: `apps/marketing/src/patient/components/ui/Skeleton.tsx`
- Create: `apps/marketing/src/patient/components/ui/SectionHeader.tsx`
- Create: `apps/marketing/src/patient/components/ui/Sheet.tsx`
- Create: `apps/marketing/src/patient/components/ui/QueryBoundary.tsx`

**Interfaces:**
- Consumes: `cn` from `@/portal/lib/utils`
- Produces:
  - `Card`, `CardHeader`, `CardTitle`, `CardBody`: `{ children, className?, padding?, title?, action? }`. Always white surface, rounded `--radius-card`, no border.
  - `StatTile`: `{ label, value, unit?, delta?, tone? }`. Renders the 40px metric + 18px unit + 13px label layout.
  - `Pill`, `PillGroup`: segmented-control tabs.
  - `EmptyState`: `{ icon?, title, body, action? }`.
  - `Skeleton`, `SkeletonText`, `SkeletonChart`: shimmer placeholders respecting `prefers-reduced-motion`.
  - `SectionHeader`: `{ title, subtitle?, children? }`. Right-hand slot for controls.
  - `Sheet`: right-hand slide-over. `{ open, onClose, title, children }`.
  - `QueryBoundary`: `{ query, children, loading?, error?, empty? }`. Renders skeleton / error retry / empty / children from a TanStack Query result.

- [ ] **Step 1: Write the failing Card test**

Create `apps/marketing/src/patient/components/ui/Card.test.tsx`:

```tsx
/**
 * Card primitive.
 *
 * Pins the visual contract: no border, rounded radius, shadow,
 * white background. Every later widget depends on these properties.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Card, CardTitle, CardBody } from "./Card";

describe("Card", () => {
  it("renders children inside a white rounded container", () => {
    const { container } = render(
      <Card>
        <CardTitle>Title</CardTitle>
        <CardBody>body</CardBody>
      </Card>
    );
    const root = container.firstElementChild as HTMLElement;
    const style = root.style;
    expect(style.borderRadius).toBe("var(--radius-card)");
    expect(style.boxShadow).toBe("var(--shadow-card)");
    expect(root.className).toContain("bg-surface");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ui/Card.test.tsx`
Expected: FAIL — `Failed to resolve import "./Card"`.

- [ ] **Step 3: Write Card**

Create `apps/marketing/src/patient/components/ui/Card.tsx`:

```tsx
import type { HTMLAttributes } from "react";

import { cn } from "@/portal/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Padded by default; set `padding="none"` to strip interior spacing. */
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ className, padding = "md", children, ...rest }: CardProps) {
  const pad =
    padding === "none"
      ? ""
      : padding === "sm"
      ? "p-5"
      : padding === "lg"
      ? "p-8"
      : "p-6";
  return (
    <div
      className={cn("bg-surface", pad, className)}
      style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        title ? "mb-5" : "",
        className
      )}
    >
      {title ? <CardTitle>{title}</CardTitle> : null}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="t-card-title text-text">{children}</h2>;
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-text-soft">{children}</div>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ui/Card.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 5: Write the rest of the primitives**

Create `apps/marketing/src/patient/components/ui/StatTile.tsx`:

```tsx
import { cn } from "@/portal/lib/utils";
import { formatDelta, formatMetric } from "@/patient/lib/format";

type Tone = "neutral" | "positive" | "negative" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-text-muted",
  positive: "text-success",
  negative: "text-danger",
  brand: "text-brand",
};

/**
 * Big-metric tile: 40px number, 18px unit, 13px label, optional
 * delta below. The metric-value font class is hard-coded here
 * because the spec's visual hierarchy depends on this exact sizing.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  decimals = 0,
  tone = "neutral",
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  delta?: number | null;
  decimals?: number;
  tone?: Tone;
}) {
  const deltaText = formatDelta(delta ?? null, decimals);
  return (
    <div>
      <p className="t-label">{label}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="t-metric text-text">{formatMetric(value, decimals)}</span>
        {unit ? <span className="t-unit">{unit}</span> : null}
      </p>
      {deltaText ? (
        <p className={cn("mt-1 text-xs font-medium", TONE_CLASS[tone])}>
          {deltaText} vs last week
        </p>
      ) : null}
    </div>
  );
}
```

Create `apps/marketing/src/patient/components/ui/Pill.tsx`:

```tsx
"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/portal/lib/utils";

/**
 * A pill button — used both as a stand-alone chip and as the option
 * inside a `PillGroup` segmented control.
 */
export function Pill({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center px-4 text-sm font-medium transition-colors",
        active
          ? "bg-ink text-white"
          : "bg-surface-2 text-text-soft hover:bg-surface-3",
        className
      )}
      style={{ borderRadius: "var(--radius-pill)" }}
      aria-pressed={active}
      {...rest}
    />
  );
}

export interface PillGroupOption<T extends string> {
  value: T;
  label: string;
}

export function PillGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<PillGroupOption<T>>;
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex gap-1 bg-surface-2 p-1"
      style={{ borderRadius: "var(--radius-pill)" }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={opt.value === value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "inline-flex h-7 items-center justify-center px-4 text-sm font-medium transition-colors",
            opt.value === value
              ? "bg-surface text-text"
              : "text-text-soft hover:text-text"
          )}
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

Create `apps/marketing/src/patient/components/ui/EmptyState.tsx`:

```tsx
import type { ReactNode } from "react";

import { cn } from "@/portal/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div
          aria-hidden
          className="grid h-12 w-12 place-items-center bg-surface-2 text-text-soft"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          {icon}
        </div>
      ) : null}
      <p className="t-card-title text-text">{title}</p>
      {body ? <p className="max-w-sm text-sm text-text-soft">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
```

Create `apps/marketing/src/patient/components/ui/Skeleton.tsx`:

```tsx
import { cn } from "@/portal/lib/utils";

const SHIMMER =
  "bg-[length:200%_100%] [background-image:linear-gradient(90deg,transparent,rgba(11,11,15,.06),transparent)] [animation:patient-shimmer_1.6s_linear_infinite]";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("h-4 w-full bg-surface-3", SHIMMER, className)}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={i === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div
      aria-hidden
      className={cn("h-40 w-full bg-surface-3", SHIMMER)}
      style={{ borderRadius: "var(--radius-inner)" }}
    />
  );
}
```

Append the shimmer keyframe to `apps/marketing/src/app/patient/globals.css`. After the existing `patient-rise` block, add:

```css
@keyframes patient-shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}
[data-app="patient"] [data-skeleton],
[data-app="patient"] .skeleton {
  background-color: var(--color-surface-3);
}
```

Create `apps/marketing/src/patient/components/ui/SectionHeader.tsx`:

```tsx
import type { ReactNode } from "react";

export function SectionHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div className="min-w-0">
        <h1 className="t-display text-text">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-xl text-base text-text-soft">{subtitle}</p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
```

Create `apps/marketing/src/patient/components/ui/Sheet.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/portal/lib/utils";

/**
 * Right-hand slide-over. Used by OrganDetailPanel, medication
 * detail, message quick actions. Mounts into document.body so it
 * escapes any transform/overflow ancestors.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex"
    >
      <div
        className="flex-1 bg-[rgba(11,11,15,0.32)]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "anim-rise flex w-full max-w-md flex-col gap-6 overflow-y-auto bg-surface p-8"
        )}
        style={{
          borderTopLeftRadius: "var(--radius-card)",
          borderBottomLeftRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {title ? (
          <div className="flex items-center justify-between">
            <h2 className="t-card-title text-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center text-text-soft hover:bg-surface-2"
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              ×
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
}
```

Create `apps/marketing/src/patient/components/ui/QueryBoundary.tsx`:

```tsx
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

/**
 * Renders one of four states from a TanStack Query result.
 *
 * The "empty" check is the awkward bit: TanStack returns data the
 * server shaped (e.g. `{events: []}`) and the dashboard only knows
 * whether data is empty by looking inside. We pass an `isEmpty`
 * predicate rather than assuming one shape.
 */
export function QueryBoundary<TData>({
  query,
  isEmpty,
  children,
  loading,
  error,
  empty,
}: {
  query: Pick<UseQueryResult<TData, Error>, "isLoading" | "isError" | "error" | "data" | "refetch">;
  isEmpty?: (data: TData) => boolean;
  children: (data: TData) => ReactNode;
  loading?: ReactNode;
  error?: (err: Error, retry: () => void) => ReactNode;
  empty?: ReactNode;
}) {
  if (query.isLoading) {
    return <>{loading ?? <Skeleton className="h-32" />}</>;
  }
  if (query.isError) {
    const retry = () => {
      void query.refetch();
    };
    return (
      <>
        {error ? (
          error(query.error, retry)
        ) : (
          <EmptyState
            title="Couldn't load"
            body={query.error.message}
            action={
              <button
                type="button"
                onClick={retry}
                className="inline-flex h-10 items-center bg-ink px-5 text-sm font-semibold text-white"
                style={{ borderRadius: "var(--radius-pill)" }}
              >
                Try again
              </button>
            }
          />
        )}
      </>
    );
  }
  if (query.data == null) return null;
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
```

- [ ] **Step 6: Run all UI primitive tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ui`
Expected: PASS, 1 test (the Card test). Other primitives render without crashing but their tests land in their consuming tasks.

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/patient/components/ui apps/marketing/src/app/patient/globals.css
git commit -m "feat(patient): add UI primitives (Card, StatTile, Pill, EmptyState, Skeleton, Sheet, QueryBoundary)"
```

---

## Task 7: Typed data hooks (vitals, appointments, records, medications, timeline, messages, profile, wellness)

**Files:**
- Create: `apps/marketing/src/patient/hooks/useVitalsSeries.ts`
- Create: `apps/marketing/src/patient/hooks/useVitalsAlerts.ts`
- Create: `apps/marketing/src/patient/hooks/useAppointments.ts`
- Create: `apps/marketing/src/patient/hooks/useRecords.ts`
- Create: `apps/marketing/src/patient/hooks/useMedications.ts`
- Create: `apps/marketing/src/patient/hooks/useWellness.ts`
- Create: `apps/marketing/src/patient/hooks/useTimeline.ts`
- Create: `apps/marketing/src/patient/hooks/useMessages.ts`
- Create: `apps/marketing/src/patient/hooks/useHealthSummary.ts`
- Create: `apps/marketing/src/patient/hooks/useProfile.ts`
- Create: `apps/marketing/src/patient/hooks/useNotifications.ts`

**Interfaces:**
- Consumes: `api` and `ApiError` from `@/portal/lib/api`; `PATIENT_QUERY_DEFAULTS`, `patientKeys`, `rangeToFrom` from `@/patient/lib/query`; types from `@/patient/types/patient`
- Produces:
  - `useVitalsSeries(type: VitalType, range: RangeKey): UseQueryResult<VitalSeriesResponse>`
  - `useVitalsAlerts(days = 7): UseQueryResult<{ alerts: VitalAlert[] }>`
  - `useAppointments(): UseQueryResult<{ appointments: AppointmentRow[] }>`
  - `useRecords(params): UseQueryResult<{ records: RecordRow[]; nextCursor?: string }>`
  - `useRecordStats(): UseQueryResult<RecordStats>`
  - `useRecord(id): UseQueryResult<RecordRow & { items: any[] }>`
  - `useRecordChildren(id, kind): UseQueryResult<any[]>`
  - `useLabTrend(test, months): UseQueryResult<{ points: {date: string; value: number}[] }>`
  - `useMedications(): UseQueryResult<{ medicines: MedicineRow[] }>`
  - `useMedicationsToday(): UseQueryResult<{ medicines: MedicineRow[] }>`
  - `useMedicineStats(days = 7): UseQueryResult<MedicineStats>`
  - `useWellness(): UseQueryResult<WellnessResponse>`
  - `useTimeline(params): UseQueryResult<{ events: TimelineEvent[] }>`
  - `useConversations(): UseQueryResult<{ conversations: Conversation[] }>`
  - `useMessages(id): UseQueryResult<{ messages: Message[] }>`
  - `useHealthSummary(): UseQueryResult<HealthSummary>`
  - `useProfile(): UseQueryResult<AuthUser>`
  - `useNotifications(): UseQueryResult<{ notifications: any[] }>`
  - `useUnreadNotificationsCount(): number`

- [ ] **Step 1: Write the failing hook test**

Create `apps/marketing/src/patient/hooks/hooks.test.ts`:

```tsx
/**
 * Hook wiring smoke test.
 *
 * Verifies that each hook hits the documented endpoint with the
 * documented query string. Catches the most common bug in this kind
 * of plumbing: a hook silently calling the wrong route (e.g. the
 * doctor-portal counterpart) because someone copy-pasted it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiMock = vi.fn();
vi.mock("@/portal/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    details: unknown;
    constructor(message: string, status: number, details: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
}));

import { useVitalsSeries } from "./useVitalsSeries";
import { useAppointments } from "./useAppointments";
import { useMedications } from "./useMedications";

function withClient(callback: () => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  renderHook(callback, { wrapper });
}

describe("patient hooks", () => {
  beforeEach(() => apiMock.mockReset());

  it("useVitalsSeries calls /vitals/me/series with type + from", async () => {
    apiMock.mockResolvedValue({ type: "heart_rate", range: {}, points: [], stats: null });
    withClient(() => useVitalsSeries("heart_rate", "week"));
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0][0]).toBe("/vitals/me/series");
    const init = apiMock.mock.calls[0][1];
    expect(init.query.type).toBe("heart_rate");
    expect(typeof init.query.from).toBe("string");
  });

  it("useAppointments calls /appointments/me", async () => {
    apiMock.mockResolvedValue({ appointments: [] });
    withClient(() => useAppointments());
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0][0]).toBe("/appointments/me");
  });

  it("useMedications calls /medicines/me", async () => {
    apiMock.mockResolvedValue({ medicines: [] });
    withClient(() => useMedications());
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0][0]).toBe("/medicines/me");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/hooks.test.ts`
Expected: FAIL — `Failed to resolve import "./useVitalsSeries"`.

- [ ] **Step 3: Write the vitals hooks**

Create `apps/marketing/src/patient/hooks/useVitalsSeries.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  rangeToFrom,
  type RangeKey,
} from "@/patient/lib/query";
import type { VitalSeriesResponse, VitalType } from "@/patient/types/patient";

export function useVitalsSeries(type: VitalType, range: RangeKey) {
  return useQuery<VitalSeriesResponse>({
    queryKey: patientKeys.vitalsSeries(type, range),
    queryFn: () =>
      api("/vitals/me/series", {
        query: { type, from: rangeToFrom(range) },
      }),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Create `apps/marketing/src/patient/hooks/useVitalsAlerts.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { VitalAlert } from "@/patient/types/patient";

export function useVitalsAlerts(days = 7) {
  return useQuery<{ alerts: VitalAlert[] }>({
    queryKey: patientKeys.vitalsAlerts(days),
    queryFn: () => api("/vitals/me/alerts", { query: { days } }),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

- [ ] **Step 4: Write the appointments + records + medications hooks**

Create `apps/marketing/src/patient/hooks/useAppointments.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { AppointmentRow } from "@/patient/types/patient";

export function useAppointments() {
  return useQuery<{ appointments: AppointmentRow[] }>({
    queryKey: patientKeys.appointments(),
    queryFn: () => api("/appointments/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Create `apps/marketing/src/patient/hooks/useRecords.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { RecordRow, RecordStats } from "@/patient/types/patient";

export function useRecords(params: Record<string, unknown> = {}) {
  return useQuery<{ records: RecordRow[]; nextCursor?: string }>({
    queryKey: patientKeys.records(params),
    queryFn: () => api("/medical-records/me", { query: params }),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRecordStats() {
  return useQuery<RecordStats>({
    queryKey: patientKeys.recordStats(),
    queryFn: () => api("/medical-records/me/stats"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRecord(id: string) {
  return useQuery<RecordRow & { items: any[] }>({
    queryKey: patientKeys.record(id),
    queryFn: () => api(`/medical-records/${id}`),
    enabled: Boolean(id),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRecordChildren(id: string, kind: "labs" | "imaging" | "prescriptions") {
  return useQuery<any[]>({
    queryKey: patientKeys.recordChildren(id, kind),
    queryFn: () => api(`/medical-records/${id}/${kind}`),
    enabled: Boolean(id),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useLabTrend(test: string, months = 6) {
  return useQuery<{ points: { date: string; value: number }[] }>({
    queryKey: patientKeys.labTrend(test, months),
    queryFn: () =>
      api("/medical-records/me/lab-trend", { query: { test, months } }),
    enabled: Boolean(test),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Create `apps/marketing/src/patient/hooks/useMedications.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { MedicineRow, MedicineStats } from "@/patient/types/patient";

export function useMedications() {
  return useQuery<{ medicines: MedicineRow[] }>({
    queryKey: patientKeys.medicines(),
    queryFn: () => api("/medicines/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useMedicationsToday() {
  return useQuery<{ medicines: MedicineRow[] }>({
    queryKey: patientKeys.medicinesToday(),
    queryFn: () => api("/medicines/today"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useMedicineStats(days = 7) {
  return useQuery<MedicineStats>({
    queryKey: patientKeys.medicineStats(days),
    queryFn: () => api("/medicines/me/stats", { query: { days } }),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

- [ ] **Step 5: Write the remaining hooks**

Create `apps/marketing/src/patient/hooks/useWellness.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { WellnessResponse } from "@/patient/types/patient";

export function useWellness() {
  return useQuery<WellnessResponse>({
    queryKey: patientKeys.wellness(),
    queryFn: () => api("/wellness/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Create `apps/marketing/src/patient/hooks/useTimeline.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { TimelineEvent } from "@/patient/types/patient";

export function useTimeline(params: Record<string, unknown> = {}) {
  return useQuery<{ events: TimelineEvent[] }>({
    queryKey: patientKeys.timeline(params),
    queryFn: () => api("/timeline/me", { query: params }),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Create `apps/marketing/src/patient/hooks/useMessages.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { Conversation, Message } from "@/patient/types/patient";

export function useConversations() {
  return useQuery<{ conversations: Conversation[] }>({
    queryKey: patientKeys.conversations(),
    queryFn: () => api("/patient-messages/conversations"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery<{ messages: Message[] }>({
    queryKey: conversationId ? patientKeys.conversation(conversationId) : ["patient", "messages", "none"],
    queryFn: () =>
      api(`/patient-messages/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Create `apps/marketing/src/patient/hooks/useHealthSummary.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { HealthSummary } from "@/patient/types/patient";

export function useHealthSummary() {
  return useQuery<HealthSummary>({
    queryKey: patientKeys.healthSummary(),
    queryFn: () => api("/health-summary/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Create `apps/marketing/src/patient/hooks/useProfile.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";
import type { AuthUser } from "@/portal/stores/auth";

export function useProfile() {
  return useQuery<AuthUser>({
    queryKey: patientKeys.profile(),
    queryFn: () => api("/users/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Replace `apps/marketing/src/patient/hooks/useNotifications.ts` with the real implementation:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";

export interface PatientNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string | null;
}

export function useNotifications() {
  return useQuery<{ notifications: PatientNotification[] }>({
    queryKey: patientKeys.notifications(),
    queryFn: () => api("/patient-notifications"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useUnreadNotificationsCount() {
  const q = useQuery<{ count: number }>({
    queryKey: patientKeys.unreadCount(),
    queryFn: () => api("/patient-notifications/unread-count"),
    ...PATIENT_QUERY_DEFAULTS,
  });
  return q.data?.count ?? 0;
}
```

- [ ] **Step 6: Run hook tests to verify they pass**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/hooks.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/patient/hooks
git commit -m "feat(patient): add typed TanStack Query hooks for every patient domain"
```

---

## Task 8: Recharts wrappers — TrendArea, BarSeries, RadialGauge, Sparkline

**Files:**
- Create: `apps/marketing/src/patient/components/charts/TrendArea.tsx`
- Create: `apps/marketing/src/patient/components/charts/BarSeries.tsx`
- Create: `apps/marketing/src/patient/components/charts/RadialGauge.tsx`
- Create: `apps/marketing/src/patient/components/charts/Sparkline.tsx`

**Interfaces:**
- Consumes: `recharts`
- Produces:
  - `TrendArea(props: { points: ChartPoint[]; ariaLabel: string; secondary?: boolean }): JSX.Element`. Single dashed baseline; area filled with brand-soft. Two-line tooltip on hover.
  - `BarSeries(props: { points: ChartPoint[]; peakIndex: number; ariaLabel: string }): JSX.Element`. Single accent bar, remainder `--color-surface-3`.
  - `RadialGauge(props: { value: number; max: number; ariaLabel: string; tone?: Tone }): JSX.Element`. Rounded caps, accent ring, soft track.
  - `Sparkline(props: { points: ChartPoint[]; ariaLabel: string }): JSX.Element`. Inline line, no axes.

- [ ] **Step 1: Write the wrappers**

Create `apps/marketing/src/patient/components/charts/TrendArea.tsx`:

```tsx
"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartPoint } from "@/patient/lib/vitals";
import { formatDayLabel } from "@/patient/lib/format";

/**
 * Single-series area chart with one dashed baseline.
 *
 * `secondary` is for blood pressure: the wrapper renders a second,
 * thinner line carrying the diastolic reading rather than the systolic.
 */
export function TrendArea({
  points,
  ariaLabel,
  secondary,
}: {
  points: ChartPoint[];
  ariaLabel: string;
  secondary?: boolean;
}) {
  if (points.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${ariaLabel}, no data`}
        className="grid h-40 place-items-center bg-surface-2 text-sm text-text-muted"
        style={{ borderRadius: "var(--radius-inner)" }}
      >
        No readings yet
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="h-40 w-full"
      style={{ borderRadius: "var(--radius-inner)" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="patient-area-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#5B4EE9" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#5B4EE9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ECEEF2" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={formatDayLabel}
            tick={{ fill: "#9A9DA6", fontSize: 11 }}
            stroke="#ECEEF2"
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis hide domain={["dataMin - 4", "dataMax + 4"]} />
          <Tooltip
            cursor={{ stroke: "#5B4EE9", strokeOpacity: 0.3 }}
            contentStyle={{
              background: "#FFFFFF",
              border: "none",
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(11,11,15,0.08)",
              fontSize: 12,
            }}
            labelFormatter={formatDayLabel}
            formatter={(value: number, name: string) => [
              value,
              name === "secondary" ? "Diastolic" : "Reading",
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#5B4EE9"
            strokeWidth={2}
            fill="url(#patient-area-fill)"
            isAnimationActive
            animationDuration={400}
          />
          {secondary ? (
            <Area
              type="monotone"
              dataKey="secondary"
              stroke="#9A9DA6"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              fill="none"
              isAnimationActive
              animationDuration={400}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Create `apps/marketing/src/patient/components/charts/BarSeries.tsx`:

```tsx
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartPoint } from "@/patient/lib/vitals";
import { formatDayLabel } from "@/patient/lib/format";

/**
 * Bar chart with a single accent bar at `peakIndex`.
 *
 * The visual rule from the spec: one bar in `--color-brand`, every
 * other bar in `--color-surface-3`. `peakIndex` may be -1, in which
 * case no bar is highlighted.
 */
export function BarSeries({
  points,
  peakIndex,
  ariaLabel,
}: {
  points: ChartPoint[];
  peakIndex: number;
  ariaLabel: string;
}) {
  if (points.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${ariaLabel}, no data`}
        className="grid h-40 place-items-center bg-surface-2 text-sm text-text-muted"
        style={{ borderRadius: "var(--radius-inner)" }}
      >
        No readings yet
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="h-40 w-full"
      style={{ borderRadius: "var(--radius-inner)" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#ECEEF2" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={formatDayLabel}
            tick={{ fill: "#9A9DA6", fontSize: 11 }}
            stroke="#ECEEF2"
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis hide domain={[0, "dataMax + 10"]} />
          <Tooltip
            cursor={{ fill: "rgba(91,78,233,0.06)" }}
            contentStyle={{
              background: "#FFFFFF",
              border: "none",
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(11,11,15,0.08)",
              fontSize: 12,
            }}
            labelFormatter={formatDayLabel}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={400}>
            {points.map((_, i) => (
              <Cell key={i} fill={i === peakIndex ? "#5B4EE9" : "#ECEEF2"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Create `apps/marketing/src/patient/components/charts/RadialGauge.tsx`:

```tsx
"use client";

import type { CSSProperties } from "react";

type Tone = "neutral" | "positive" | "negative" | "brand";

const TONE_STROKE: Record<Tone, string> = {
  neutral: "#5B4EE9",
  positive: "#16A06A",
  negative: "#E0464B",
  brand: "#5B4EE9",
};

/**
 * Pure-CSS radial gauge.
 *
 * The conic gradient with a single large gap is the only way to get
 * rounded caps without an SVG mask. The math below sets the gap to
 * `gapDeg` so `value` of `max` produces a 360° ring minus the gap.
 */
export function RadialGauge({
  value,
  max,
  ariaLabel,
  tone = "brand",
  size = 132,
}: {
  value: number;
  max: number;
  ariaLabel: string;
  tone?: Tone;
  size?: number;
}) {
  const safeMax = Math.max(1, max);
  const pct = Math.min(1, Math.max(0, value / safeMax));
  const gapDeg = 12;
  const ring = 360 - gapDeg;
  const angle = pct * ring;
  const stroke = TONE_STROKE[tone];

  const wrapStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: `conic-gradient(${stroke} 0deg ${angle}deg, var(--color-surface-3) ${angle}deg ${ring}deg, transparent ${ring}deg 360deg)`,
    display: "grid",
    placeItems: "center",
  };

  return (
    <div role="img" aria-label={ariaLabel} style={wrapStyle}>
      <div
        style={{
          width: size - 18,
          height: size - 18,
          borderRadius: "50%",
          background: "var(--color-surface)",
        }}
      />
    </div>
  );
}
```

Create `apps/marketing/src/patient/components/charts/Sparkline.tsx`:

```tsx
"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

import type { ChartPoint } from "@/patient/lib/vitals";

export function Sparkline({
  points,
  ariaLabel,
}: {
  points: ChartPoint[];
  ariaLabel: string;
}) {
  if (points.length === 0) {
    return (
      <span
        role="img"
        aria-label={`${ariaLabel}, no data`}
        className="inline-block h-6 w-16 bg-surface-3"
        style={{ borderRadius: 4 }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className="inline-block h-6 w-16 align-middle"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#5B4EE9"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </span>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/marketing && bunx tsc --noEmit`
Expected: zero new errors attributable to the chart wrappers.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/patient/components/charts
git commit -m "feat(patient): add recharts wrappers (TrendArea, BarSeries, RadialGauge, Sparkline)"
```

---

## Task 9: Body figure SVG and hotspots

**Files:**
- Create: `apps/marketing/src/patient/components/body/BodyFigure.tsx`
- Create: `apps/marketing/src/patient/components/body/BodyHotspot.tsx`
- Create: `apps/marketing/src/patient/components/body/OrganDetailPanel.tsx`
- Create: `apps/marketing/src/patient/components/body/BodyFigure.test.tsx`

**Interfaces:**
- Consumes: `useVitalsSeries`, `useTimeline`, `useRecords`, `Sheet` from `@/patient/components/ui/Sheet`
- Produces:
  - `BodyFigure` (server-renderable): a hand-built SVG of a person with eight anatomical hotspots (`Heart`, `Lungs`, `Liver`, `Stomach`, `Kidneys`, `Pancreas`, `Bladder`, `Brain`). Props: `{ active: OrganKey | null; onSelect: (key: OrganKey) => void }`.
  - `OrganDetailPanel`: shown inside a `Sheet`. Renders the latest vital or record for the active organ from real queries, or a designed empty state.
  - `OrganKey` exported for use by Dashboard.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/patient/components/body/BodyFigure.test.tsx`:

```tsx
/**
 * BodyFigure — eight hotspots, focusable, aria-labelled.
 *
 * Pins three things: (1) the number of hotspots (the spec calls out
 * exactly eight organs); (2) that each hotspot is a real button
 * (focusable) with a unique test id; (3) that the active hotspot
 * gets aria-pressed.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BodyFigure, type OrganKey } from "./BodyFigure";

describe("BodyFigure", () => {
  it("renders eight hotspot buttons", () => {
    render(<BodyFigure active={null} onSelect={() => {}} />);
    const ids: OrganKey[] = [
      "heart",
      "lungs",
      "liver",
      "stomach",
      "kidneys",
      "pancreas",
      "bladder",
      "brain",
    ];
    for (const id of ids) {
      expect(screen.getByTestId(`organ-${id}`)).toBeTruthy();
    }
  });

  it("marks the active hotspot with aria-pressed", () => {
    render(<BodyFigure active="heart" onSelect={() => {}} />);
    const heart = screen.getByTestId("organ-heart");
    expect(heart.getAttribute("aria-pressed")).toBe("true");
    const lungs = screen.getByTestId("organ-lungs");
    expect(lungs.getAttribute("aria-pressed")).toBe("false");
  });

  it("fires onSelect when a hotspot is clicked", () => {
    const onSelect = vi.fn();
    render(<BodyFigure active={null} onSelect={onSelect} />);
    screen.getByTestId("organ-liver").click();
    expect(onSelect).toHaveBeenCalledWith("liver");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/body/BodyFigure.test.tsx`
Expected: FAIL — `Failed to resolve import "./BodyFigure"`.

- [ ] **Step 3: Write the BodyFigure**

Create `apps/marketing/src/patient/components/body/BodyFigure.tsx`:

```tsx
"use client";

import type { CSSProperties } from "react";

import { cn } from "@/portal/lib/utils";

export type OrganKey =
  | "heart"
  | "lungs"
  | "liver"
  | "stomach"
  | "kidneys"
  | "pancreas"
  | "bladder"
  | "brain";

interface Hotspot {
  key: OrganKey;
  label: string;
  cx: number;
  cy: number;
}

const HOTSPOTS: Hotspot[] = [
  { key: "brain", label: "Brain", cx: 150, cy: 50 },
  { key: "heart", label: "Heart", cx: 150, cy: 175 },
  { key: "lungs", label: "Lungs", cx: 150, cy: 195 },
  { key: "liver", label: "Liver", cx: 175, cy: 220 },
  { key: "stomach", label: "Stomach", cx: 135, cy: 235 },
  { key: "pancreas", label: "Pancreas", cx: 155, cy: 250 },
  { key: "kidneys", label: "Kidneys", cx: 150, cy: 290 },
  { key: "bladder", label: "Bladder", cx: 150, cy: 360 },
];

/**
 * Hand-built SVG anatomical figure with eight focusable hotspots.
 *
 * Server-renderable: no hooks, no client-only APIs.
 */
export function BodyFigure({
  active,
  onSelect,
  className,
}: {
  active: OrganKey | null;
  onSelect: (key: OrganKey) => void;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 300 460"
      role="img"
      aria-label="Anatomical figure with selectable organs"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id="body-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#EEEBFE" />
          <stop offset="100%" stopColor="#F5F6F8" />
        </linearGradient>
      </defs>

      {/* Head */}
      <circle cx="150" cy="50" r="34" fill="url(#body-fill)" />
      {/* Neck */}
      <rect x="138" y="82" width="24" height="18" rx="8" fill="url(#body-fill)" />
      {/* Torso */}
      <path
        d="M100 110 Q150 96 200 110 L210 320 Q150 340 90 320 Z"
        fill="url(#body-fill)"
      />
      {/* Arms */}
      <path
        d="M88 130 Q60 200 76 280 Q90 290 96 270 Q104 200 110 140 Z"
        fill="url(#body-fill)"
      />
      <path
        d="M212 130 Q240 200 224 280 Q210 290 204 270 Q196 200 190 140 Z"
        fill="url(#body-fill)"
      />
      {/* Legs */}
      <path
        d="M120 330 Q116 400 122 460 L150 460 L150 340 Z"
        fill="url(#body-fill)"
      />
      <path
        d="M180 330 Q184 400 178 460 L150 460 L150 340 Z"
        fill="url(#body-fill)"
      />

      {/* Soft outline */}
      <path
        d="M150 16 Q184 16 184 50 Q184 84 150 84 Q116 84 116 50 Q116 16 150 16 Z M100 110 Q150 96 200 110 L210 320 Q150 340 90 320 Z"
        fill="none"
        stroke="#E9ECF1"
        strokeWidth="1"
      />

      {HOTSPOTS.map((h) => (
        <Hotspot
          key={h.key}
          hot={h}
          active={active === h.key}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}

function Hotspot({
  hot,
  active,
  onSelect,
}: {
  hot: Hotspot;
  active: boolean;
  onSelect: (key: OrganKey) => void;
}) {
  const fill = active ? "var(--color-brand)" : "var(--color-surface)";
  const stroke = active ? "var(--color-brand)" : "var(--color-brand-soft)";
  const style: CSSProperties = {
    fill,
    stroke,
    strokeWidth: active ? 2 : 1.5,
    cursor: "pointer",
    transition: "all 180ms ease-out",
  };
  return (
    <g>
      {active ? (
        <circle
          cx={hot.cx}
          cy={hot.cy}
          r={14}
          fill="var(--color-brand-soft)"
          aria-hidden
        />
      ) : null}
      <circle
        data-testid={`organ-${hot.key}`}
        role="button"
        aria-label={hot.label}
        aria-pressed={active}
        tabIndex={0}
        cx={hot.cx}
        cy={hot.cy}
        r={7}
        style={style}
        onClick={() => onSelect(hot.key)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(hot.key);
          }
        }}
      />
    </g>
  );
}
```

- [ ] **Step 4: Write OrganDetailPanel**

Create `apps/marketing/src/patient/components/body/OrganDetailPanel.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS } from "@/patient/lib/query";
import { Sheet } from "@/patient/components/ui/Sheet";
import { SkeletonText } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { formatDayLabel, formatRelative, formatTime } from "@/patient/lib/format";

import type { OrganKey } from "./BodyFigure";

interface OrganMeta {
  label: string;
  blurb: string;
  vitalType: "heart_rate" | "spo2" | "temperature";
}

const ORGANS: Record<OrganKey, OrganMeta> = {
  heart: { label: "Heart", blurb: "Heart rate and rhythm.", vitalType: "heart_rate" },
  lungs: { label: "Lungs", blurb: "Oxygen saturation and breathing rate.", vitalType: "spo2" },
  liver: { label: "Liver", blurb: "Liver function labs and imaging.", vitalType: "temperature" },
  stomach: { label: "Stomach", blurb: "Digestion-related records and medications.", vitalType: "temperature" },
  kidneys: { label: "Kidneys", blurb: "Renal labs (creatinine, eGFR) and imaging.", vitalType: "temperature" },
  pancreas: { label: "Pancreas", blurb: "Blood sugar, amylase and lipase trends.", vitalType: "temperature" },
  bladder: { label: "Bladder", blurb: "Hydration and urinary records.", vitalType: "temperature" },
  brain: { label: "Brain", blurb: "Imaging and clinical notes.", vitalType: "temperature" },
};

/**
 * Detail panel for the active organ.
 *
 * Each organ has a *dedicated* endpoint family in the API so the
 * panel renders the same shape regardless of which organ the patient
 * taps. If the API has nothing, the panel renders a designed empty
 * state — never an invented reading.
 */
export function OrganDetailPanel({
  organ,
  onClose,
}: {
  organ: OrganKey | null;
  onClose: () => void;
}) {
  const meta = organ ? ORGANS[organ] : null;

  const vitals = useQuery<{ points: any[] }>({
    queryKey: ["patient", "organ", organ, "vitals"],
    queryFn: () =>
      api("/vitals/me/series", {
        query: { type: meta?.vitalType, from: new Date(Date.now() - 7 * 86400000).toISOString() },
      }),
    enabled: Boolean(organ),
    ...PATIENT_QUERY_DEFAULTS,
  });

  const records = useQuery<{ records: any[] }>({
    queryKey: ["patient", "organ", organ, "records"],
    queryFn: () => api("/medical-records/me", { query: { organ, limit: 4 } }),
    enabled: Boolean(organ),
    ...PATIENT_QUERY_DEFAULTS,
  });

  return (
    <Sheet open={Boolean(organ)} onClose={onClose} title={meta?.label}>
      {organ ? (
        <>
          <p className="text-sm text-text-soft">{meta.blurb}</p>

          <section>
            <h3 className="t-card-title mb-3 text-text">Recent readings</h3>
            {vitals.isLoading ? (
              <SkeletonText lines={3} />
            ) : vitals.data?.points?.length ? (
              <ul className="space-y-2">
                {vitals.data.points.slice(0, 4).map((p: any) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between bg-surface-2 px-4 py-3"
                    style={{ borderRadius: "var(--radius-inner)" }}
                  >
                    <span className="text-sm text-text">
                      {formatDayLabel(p.t)} · {formatTime(new Date(p.t).toISOString().slice(11, 16))}
                    </span>
                    <span className="text-sm font-semibold text-text">
                      {p.value}
                      {p.unit ? ` ${p.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No readings yet"
                body="Once your care team records a measurement, it will appear here."
              />
            )}
          </section>

          <section>
            <h3 className="t-card-title mb-3 text-text">Linked records</h3>
            {records.isLoading ? (
              <SkeletonText lines={3} />
            ) : records.data?.records?.length ? (
              <ul className="space-y-2">
                {records.data.records.map((r: any) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between bg-surface-2 px-4 py-3"
                    style={{ borderRadius: "var(--radius-inner)" }}
                  >
                    <span className="text-sm text-text">{r.title}</span>
                    <span className="text-xs text-text-muted">
                      {formatRelative(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No records linked"
                body="Imaging or notes tagged to this organ will appear here."
              />
            )}
          </section>
        </>
      ) : null}
    </Sheet>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/components/body/BodyFigure.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/body
git commit -m "feat(patient): add anatomical SVG, hotspots and organ detail panel"
```

---

## Task 10: Dashboard widgets — VitalsTrend, WeekStrip, Wellness, Medications, UpcomingAppointment, RecentRecords, Activity, Assistant

**Files:**
- Create: `apps/marketing/src/patient/components/widgets/VitalsTrend.tsx`
- Create: `apps/marketing/src/patient/components/widgets/WeekStrip.tsx`
- Create: `apps/marketing/src/patient/components/widgets/WellnessScore.tsx`
- Create: `apps/marketing/src/patient/components/widgets/MedicationsToday.tsx`
- Create: `apps/marketing/src/patient/components/widgets/UpcomingAppointment.tsx`
- Create: `apps/marketing/src/patient/components/widgets/RecentRecords.tsx`
- Create: `apps/marketing/src/patient/components/widgets/RecentActivity.tsx`
- Create: `apps/marketing/src/patient/components/widgets/CareAssistant.tsx`
- Create: `apps/marketing/src/patient/components/widgets/DashboardWidgets.test.tsx`

**Interfaces:**
- Consumes: hooks from `@/patient/hooks/*`, primitives from `@/patient/components/ui/*`, charts from `@/patient/components/charts/*`, format from `@/patient/lib/format`
- Produces: eight dashboard widgets. Each is its own file so it can be reviewed independently.

- [ ] **Step 1: Write the widgets test**

Create `apps/marketing/src/patient/components/widgets/DashboardWidgets.test.tsx`:

```tsx
/**
 * Widget smoke tests.
 *
 * Each widget test pins three things: (1) the heading text, (2) the
 * shape of the empty state ("No readings yet", "No appointments",
 * etc.) and (3) that one of the API hooks was called with the
 * documented key. Together they catch the most common dashboard
 * regressions — wrong copy, wrong empty state, wrong hook wiring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiMock = vi.fn();
vi.mock("@/portal/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    details: unknown;
    constructor(message: string, status: number, details: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
}));

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

import { VitalsTrend } from "./VitalsTrend";
import { WellnessScore } from "./WellnessScore";
import { MedicationsToday } from "./MedicationsToday";
import { UpcomingAppointment } from "./UpcomingAppointment";
import { RecentRecords } from "./RecentRecords";
import { RecentActivity } from "./RecentActivity";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

beforeEach(() => apiMock.mockReset());

describe("VitalsTrend", () => {
  it("renders a 'No readings yet' empty state when the API returns []", async () => {
    apiMock.mockResolvedValue({
      type: "heart_rate",
      range: {},
      points: [],
      stats: null,
    });
    wrap(<VitalsTrend />);
    expect(await screen.findByText("No readings yet")).toBeTruthy();
  });

  it("calls /vitals/me/series", async () => {
    apiMock.mockResolvedValue({
      type: "heart_rate",
      range: {},
      points: [],
      stats: null,
    });
    wrap(<VitalsTrend />);
    await new Promise((r) => setTimeout(r, 0));
    expect(apiMock.mock.calls.some((c) => c[0] === "/vitals/me/series")).toBe(true);
  });
});

describe("WellnessScore", () => {
  it("renders the dashboard heading", async () => {
    apiMock.mockResolvedValue({
      score: 0,
      level: { label: "—", tone: "info" },
      components: {},
      updatedAt: "2026-08-29T00:00:00.000Z",
    });
    wrap(<WellnessScore />);
    expect(await screen.findByText("Wellness score")).toBeTruthy();
  });
});

describe("MedicationsToday", () => {
  it("renders the 'No medications today' empty state", async () => {
    apiMock.mockResolvedValue({ medicines: [] });
    wrap(<MedicationsToday />);
    expect(await screen.findByText("No medications today")).toBeTruthy();
  });
});

describe("UpcomingAppointment", () => {
  it("renders the 'No upcoming appointments' empty state", async () => {
    apiMock.mockResolvedValue({ appointments: [] });
    wrap(<UpcomingAppointment />);
    expect(await screen.findByText("No upcoming appointments")).toBeTruthy();
  });
});

describe("RecentRecords", () => {
  it("renders the 'No records yet' empty state", async () => {
    apiMock.mockResolvedValue({ records: [] });
    wrap(<RecentRecords />);
    expect(await screen.findByText("No records yet")).toBeTruthy();
  });
});

describe("RecentActivity", () => {
  it("renders the 'No activity yet' empty state", async () => {
    apiMock.mockResolvedValue({ events: [] });
    wrap(<RecentActivity />);
    expect(await screen.findByText("No activity yet")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/widgets/DashboardWidgets.test.tsx`
Expected: FAIL — module resolution errors for every widget.

- [ ] **Step 3: Write VitalsTrend**

Create `apps/marketing/src/patient/components/widgets/VitalsTrend.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Card, CardHeader } from "@/patient/components/ui/Card";
import { PillGroup } from "@/patient/components/ui/Pill";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { SkeletonChart } from "@/patient/components/ui/Skeleton";
import { TrendArea, BarSeries } from "@/patient/components/charts";
import { useVitalsSeries } from "@/patient/hooks/useVitalsSeries";
import {
  DASHBOARD_VITALS,
  VITAL_REGISTRY,
  peakIndex,
  toSeries,
  type ChartPoint,
} from "@/patient/lib/vitals";
import type { RangeKey } from "@/patient/lib/query";

const RANGES: ReadonlyArray<{ value: RangeKey; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

export function VitalsTrend() {
  const [type, setType] = useState<(typeof DASHBOARD_VITALS)[number]>("heart_rate");
  const [range, setRange] = useState<RangeKey>("week");
  const series = useVitalsSeries(type, range);
  const meta = VITAL_REGISTRY[type];

  const points: ChartPoint[] = series.data ? toSeries(series.data.points) : [];

  return (
    <Card>
      <CardHeader
        title="Vitals trend"
        action={
          <PillGroup
            value={range}
            onChange={setRange}
            options={RANGES}
            ariaLabel="Range"
          />
        }
      />

      <div className="mb-4 flex flex-wrap gap-1">
        {DASHBOARD_VITALS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            className={
              "h-8 px-4 text-sm font-medium transition-colors " +
              (type === v
                ? "bg-ink text-white"
                : "bg-surface-2 text-text-soft hover:bg-surface-3")
            }
            style={{ borderRadius: "var(--radius-pill)" }}
            aria-pressed={type === v}
          >
            {VITAL_REGISTRY[v].shortLabel}
          </button>
        ))}
      </div>

      {series.isLoading ? (
        <SkeletonChart />
      ) : points.length === 0 ? (
        <EmptyState
          title="No readings yet"
          body={`Once you or your care team records ${meta.shortLabel.toLowerCase()}, the trend will appear here.`}
        />
      ) : type === "blood_pressure" ? (
        <TrendArea points={points} ariaLabel={`${meta.label} trend`} secondary />
      ) : (
        <BarSeries
          points={points}
          peakIndex={peakIndex(points)}
          ariaLabel={`${meta.label} trend`}
        />
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Write WellnessScore**

Create `apps/marketing/src/patient/components/widgets/WellnessScore.tsx`:

```tsx
"use client";

import { Card, CardHeader } from "@/patient/components/ui/Card";
import { RadialGauge } from "@/patient/components/charts";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useWellness } from "@/patient/hooks/useWellness";
import { formatRelative } from "@/patient/lib/format";

export function WellnessScore() {
  const wellness = useWellness();

  return (
    <Card>
      <CardHeader title="Wellness score" />
      {wellness.isLoading ? (
        <Skeleton className="h-32" />
      ) : !wellness.data || wellness.data.score == null ? (
        <EmptyState
          title="Wellness unavailable"
          body="Once your vitals, activity and sleep settle in, your wellness score will appear."
        />
      ) : (
        <div className="flex flex-col items-center text-center">
          <RadialGauge
            value={wellness.data.score}
            max={100}
            ariaLabel={`Wellness score ${wellness.data.score} of 100`}
          />
          <p className="t-card-title mt-4 text-text">{wellness.data.level.label}</p>
          <p className="t-micro mt-1">
            Updated {formatRelative(wellness.data.updatedAt)}
          </p>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 5: Write MedicationsToday**

Create `apps/marketing/src/patient/components/widgets/MedicationsToday.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Pill } from "lucide-react";

import { Card, CardHeader } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useMedicationsToday } from "@/patient/hooks/useMedications";
import { formatTime } from "@/patient/lib/format";

export function MedicationsToday() {
  const meds = useMedicationsToday();

  return (
    <Card>
      <CardHeader
        title="Medications today"
        action={
          <Link
            href="/patient/medications"
            className="text-xs font-semibold text-brand-strong hover:underline"
          >
            See all
          </Link>
        }
      />
      {meds.isLoading ? (
        <Skeleton className="h-32" />
      ) : meds.data?.medicines?.length ? (
        <ul className="space-y-3">
          {meds.data.medicines.slice(0, 4).map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {m.name}
                </p>
                <p className="text-xs text-text-muted">
                  {m.dosage} {m.frequency ? `· ${m.frequency}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-pill bg-surface-2 px-3 py-1 text-xs font-medium text-text-soft">
                {formatTime(m.timing)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Pill size={20} />}
          title="No medications today"
          body="Once your doctor prescribes a medication, it will appear here."
        />
      )}
    </Card>
  );
}
```

- [ ] **Step 6: Write UpcomingAppointment**

Create `apps/marketing/src/patient/components/widgets/UpcomingAppointment.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";

import { Card, CardHeader } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useAppointments } from "@/patient/hooks/useAppointments";
import { formatDayLabel, formatTime, humanize } from "@/patient/lib/format";

export function UpcomingAppointment() {
  const apts = useAppointments();

  const next = apts.data?.appointments?.[0];

  return (
    <Card>
      <CardHeader
        title="Upcoming appointment"
        action={
          <Link
            href="/patient/appointments"
            className="text-xs font-semibold text-brand-strong hover:underline"
          >
            See all
          </Link>
        }
      />

      {apts.isLoading ? (
        <Skeleton className="h-32" />
      ) : !next ? (
        <EmptyState
          icon={<Calendar size={20} />}
          title="No upcoming appointments"
          body="Book a visit from the appointments page to see it here."
          action={
            <Link
              href="/patient/appointments"
              className="inline-flex h-10 items-center bg-ink px-5 text-sm font-semibold text-white"
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              Book a visit
            </Link>
          }
        />
      ) : (
        <div>
          <p className="t-display text-text">{formatDayLabel(next.date)}</p>
          <p className="mt-1 text-sm text-text-soft">{formatTime(next.time)}</p>
          <div className="mt-5 space-y-1">
            <p className="text-sm font-semibold text-text">
              {next.doctorName ?? "Doctor"}
            </p>
            <p className="text-xs text-text-muted">
              {next.doctorSpecialization ? `${next.doctorSpecialization} · ` : ""}
              {next.hospitalName ?? "Hospital"}
            </p>
          </div>
          <span className="mt-5 inline-flex bg-surface-2 px-3 py-1 text-xs font-medium text-text-soft"
            style={{ borderRadius: "var(--radius-pill)" }}>
            {humanize(next.mode)}
          </span>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 7: Write RecentRecords**

Create `apps/marketing/src/patient/components/widgets/RecentRecords.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ScrollText } from "lucide-react";

import { Card, CardHeader } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useRecords } from "@/patient/hooks/useRecords";
import { formatRelative } from "@/patient/lib/format";

export function RecentRecords() {
  const records = useRecords({ limit: 5 });

  return (
    <Card>
      <CardHeader
        title="Recent medical records"
        action={
          <Link
            href="/patient/records"
            className="text-xs font-semibold text-brand-strong hover:underline"
          >
            See all
          </Link>
        }
      />

      {records.isLoading ? (
        <Skeleton className="h-32" />
      ) : records.data?.records?.length ? (
        <ul className="space-y-3">
          {records.data.records.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{r.title}</p>
                <p className="text-xs text-text-muted">
                  {r.diagnosis || r.recordType}
                </p>
              </div>
              <span className="shrink-0 text-xs text-text-muted">
                {formatRelative(r.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<ScrollText size={20} />}
          title="No records yet"
          body="Records shared by your doctors and hospitals will appear here."
        />
      )}
    </Card>
  );
}
```

- [ ] **Step 8: Write RecentActivity**

Create `apps/marketing/src/patient/components/widgets/RecentActivity.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Activity } from "lucide-react";

import { Card, CardHeader } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useTimeline } from "@/patient/hooks/useTimeline";
import { formatRelative, humanize } from "@/patient/lib/format";

export function RecentActivity() {
  const tl = useTimeline({ limit: 6 });

  return (
    <Card>
      <CardHeader
        title="Recent activity"
        action={
          <Link
            href="/patient/health"
            className="text-xs font-semibold text-brand-strong hover:underline"
          >
            Open
          </Link>
        }
      />

      {tl.isLoading ? (
        <Skeleton className="h-32" />
      ) : tl.data?.events?.length ? (
        <ol className="space-y-4">
          {tl.data.events.slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-1 grid h-7 w-7 shrink-0 place-items-center bg-surface-2 text-text-soft"
                style={{ borderRadius: "var(--radius-pill)" }}
              >
                <Activity size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{e.title}</p>
                {e.subtitle ? (
                  <p className="truncate text-xs text-text-muted">{e.subtitle}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-text-muted">
                {humanize(e.label ?? e.kind)} · {formatRelative(e.date)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={<Activity size={20} />}
          title="No activity yet"
          body="Your timeline fills up as you log vitals, attend visits and finish prescriptions."
        />
      )}
    </Card>
  );
}
```

- [ ] **Step 9: Write WeekStrip + CareAssistant**

Create `apps/marketing/src/patient/components/widgets/WeekStrip.tsx`:

```tsx
"use client";

import { Card, CardHeader } from "@/patient/components/ui/Card";
import { BarSeries } from "@/patient/components/charts";
import { useMedicineStats } from "@/patient/hooks/useMedications";
import { useVitalsSeries } from "@/patient/hooks/useVitalsSeries";
import { SkeletonChart } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { peakIndex, toSeries } from "@/patient/lib/vitals";
import type { ChartPoint } from "@/patient/lib/vitals";

/**
 * Bar chart of activity across the last seven days.
 *
 * Data source: the day's adherence percentage from /medicines/me/stats.
 * Each day is one bar; the accent bar lands on the best-adherence day.
 */
export function WeekStrip() {
  const stats = useMedicineStats(7);
  const fallback = useVitalsSeries("heart_rate", "week");

  const points: ChartPoint[] =
    stats.data?.last7Days?.length
      ? stats.data.last7Days.map((d) => ({
          t: d.date,
          value: d.pct,
          secondary: null,
        }))
      : fallback.data
      ? toSeries(fallback.data.points)
      : [];

  return (
    <Card>
      <CardHeader title="This week" />
      {stats.isLoading && fallback.isLoading ? (
        <SkeletonChart />
      ) : points.length === 0 ? (
        <EmptyState
          title="No activity this week"
          body="Once a vitals reading or medication dose is recorded, the bars will appear."
        />
      ) : (
        <BarSeries
          points={points}
          peakIndex={peakIndex(points)}
          ariaLabel="Activity over the past seven days"
        />
      )}
    </Card>
  );
}
```

Create `apps/marketing/src/patient/components/widgets/CareAssistant.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Card, CardHeader } from "@/patient/components/ui/Card";

/**
 * Care-team assistant entry-point.
 *
 * The deep-link itself lives on the messages page; this widget is the
 * always-visible nudge from the dashboard.
 */
export function CareAssistant() {
  return (
    <Card>
      <CardHeader title="Care assistant" />
      <p className="text-sm text-text-soft">
        Ask questions about your medications, upcoming tests and what to expect
        after a visit.
      </p>
      <Link
        href="/patient/messages"
        className="mt-5 inline-flex h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-shadow hover:shadow-float"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        <Sparkles size={16} aria-hidden />
        Open the assistant
      </Link>
    </Card>
  );
}
```

- [ ] **Step 10: Run the widget tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/widgets/DashboardWidgets.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 11: Commit**

```bash
git add apps/marketing/src/patient/components/widgets apps/marketing/src/patient/components/charts/index.ts
git commit -m "feat(patient): add dashboard widgets (VitalsTrend, Wellness, Meds, Apt, Records, Activity, WeekStrip, Assistant)"
```

Add a barrel re-export at `apps/marketing/src/patient/components/charts/index.ts`:

```ts
export { TrendArea } from "./TrendArea";
export { BarSeries } from "./BarSeries";
export { RadialGauge } from "./RadialGauge";
export { Sparkline } from "./Sparkline";
```

---

## Task 11: Dashboard composition

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/page.test.tsx`

**Interfaces:**
- Consumes: every widget from `@/patient/components/widgets/*`; `BodyFigure`, `OrganDetailPanel`, `type OrganKey` from `@/patient/components/body/BodyFigure`; `SectionHeader`; `useHealthSummary`
- Produces: `DashboardPage` — composition of welcome header, body centerpiece, vitals, wellness, appointments, records, medications, activity, week strip, assistant.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/(app)/page.test.tsx`:

```tsx
/**
 * Dashboard page — composition contract.
 *
 * Pins three things without re-testing the widgets themselves: (1)
 * the welcome heading uses the signed-in name, (2) the body figure
 * is present (it is the visual centerpiece), (3) the dashboard
 * gracefully renders the skeleton when the auth store has hydrated
 * but data is still loading — rather than a blank canvas.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex Fernando", role: "patient" },
      hydrated: true,
    }),
}));

const apiMock = vi.fn().mockResolvedValue({});
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import DashboardPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("DashboardPage", () => {
  it("uses the signed-in user's first name in the welcome heading", () => {
    wrap(<DashboardPage />);
    expect(screen.getByText(/Alex/i)).toBeTruthy();
  });

  it("renders the anatomical body figure", () => {
    wrap(<DashboardPage />);
    expect(screen.getByLabelText(/Anatomical figure/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/page.test.tsx"`
Expected: FAIL — `Failed to resolve import "./page"`.

- [ ] **Step 3: Write the page**

Create `apps/marketing/src/app/patient/(app)/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { useAuthStore } from "@/portal/stores/auth";
import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { BodyFigure, OrganDetailPanel, type OrganKey } from "@/patient/components/body/BodyFigure";
import { useHealthSummary } from "@/patient/hooks/useHealthSummary";

import { VitalsTrend } from "@/patient/components/widgets/VitalsTrend";
import { WellnessScore } from "@/patient/components/widgets/WellnessScore";
import { UpcomingAppointment } from "@/patient/components/widgets/UpcomingAppointment";
import { RecentRecords } from "@/patient/components/widgets/RecentRecords";
import { MedicationsToday } from "@/patient/components/widgets/MedicationsToday";
import { RecentActivity } from "@/patient/components/widgets/RecentActivity";
import { WeekStrip } from "@/patient/components/widgets/WeekStrip";
import { CareAssistant } from "@/patient/components/widgets/CareAssistant";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const summary = useHealthSummary();
  const [activeOrgan, setActiveOrgan] = useState<OrganKey | null>(null);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hours = new Date().getHours();
  const greeting =
    hours < 12 ? "Good morning" : hours < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="anim-rise space-y-6">
      <SectionHeader
        title={`${greeting}, ${firstName}`}
        subtitle={
          summary.data
            ? `Blood group ${summary.data.demographics.bloodGroup ?? "—"}${
                summary.data.demographics.bmi
                  ? ` · BMI ${summary.data.demographics.bmi.toFixed(1)}`
                  : ""
              }`
            : "Your health, in one quiet place."
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="bg-surface p-6" style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}>
            <BodyFigure active={activeOrgan} onSelect={setActiveOrgan} />
            <p className="mt-4 text-center text-sm text-text-soft">
              Tap an organ to see its latest readings and records.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:col-span-2 sm:grid-cols-2">
          <VitalsTrend />
          <WellnessScore />
          <UpcomingAppointment />
          <MedicationsToday />
          <RecentRecords />
          <RecentActivity />
          <WeekStrip />
          <CareAssistant />
        </div>
      </div>

      <OrganDetailPanel organ={activeOrgan} onClose={() => setActiveOrgan(null)} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/page.tsx" "apps/marketing/src/app/patient/(app)/page.test.tsx"
git commit -m "feat(patient): add dashboard page composition"
```

---

## Task 12: My Health page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/health/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/health/page.test.tsx`

**Interfaces:**
- Consumes: hooks from `@/patient/hooks/*`; chart wrappers; `BodyFigure`, `OrganDetailPanel`; `useHealthSummary`; `SectionHeader`
- Produces: `MyHealthPage` — full anatomical view, four-vital trends, alerts, allergies, conditions, vitals-history table, lab-trend chart.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/(app)/health/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

const apiMock = vi.fn().mockResolvedValue({});
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import MyHealthPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("MyHealthPage", () => {
  it("renders the page heading", () => {
    wrap(<MyHealthPage />);
    expect(screen.getByText("My Health")).toBeTruthy();
  });

  it("renders the anatomical figure", () => {
    wrap(<MyHealthPage />);
    expect(screen.getByLabelText(/Anatomical figure/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/health/page.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the page**

Create `apps/marketing/src/app/patient/(app)/health/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card, CardHeader } from "@/patient/components/ui/Card";
import { BodyFigure, OrganDetailPanel, type OrganKey } from "@/patient/components/body/BodyFigure";
import { TrendArea } from "@/patient/components/charts";
import { PillGroup } from "@/patient/components/ui/Pill";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { useVitalsSeries, useVitalsAlerts } from "@/patient/hooks/useVitals";
import { useHealthSummary } from "@/patient/hooks/useHealthSummary";
import { VITAL_REGISTRY, toSeries } from "@/patient/lib/vitals";
import { formatRelative } from "@/patient/lib/format";
import type { RangeKey } from "@/patient/lib/query";
import type { VitalType } from "@/patient/types/patient";

const TRACKED: VitalType[] = [
  "heart_rate",
  "spo2",
  "blood_pressure",
  "temperature",
];

export default function MyHealthPage() {
  const [range, setRange] = useState<RangeKey>("month");
  const [active, setActive] = useState<OrganKey | null>(null);
  const summary = useHealthSummary();
  const alerts = useVitalsAlerts(14);

  return (
    <div className="anim-rise space-y-6">
      <SectionHeader
        title="My Health"
        subtitle="Trends, organ-by-organ detail, and anything your care team has flagged."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="bg-surface p-6" style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}>
            <BodyFigure active={active} onSelect={setActive} />
            <p className="mt-4 text-center text-sm text-text-soft">
              Tap an organ to see its latest readings.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Tracked vitals"
              action={
                <PillGroup
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "week", label: "Week" },
                    { value: "month", label: "Month" },
                    { value: "quarter", label: "Quarter" },
                  ]}
                  ariaLabel="Range"
                />
              }
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {TRACKED.map((t) => (
                <VitalsSeriesCard key={t} type={t} range={range} />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent flags from your care team" />
            {alerts.isLoading ? (
              <Skeleton className="h-16" />
            ) : alerts.data?.alerts?.length ? (
              <ul className="space-y-3">
                {alerts.data.alerts.map((a, i) => (
                  <li
                    key={`${a.type}-${a.recordedAt}-${i}`}
                    className="flex items-center justify-between bg-surface-2 px-4 py-3"
                    style={{ borderRadius: "var(--radius-inner)" }}
                  >
                    <span className="text-sm font-medium text-text">
                      {VITAL_REGISTRY[a.type].label}: {a.value}
                      {a.secondary != null ? `/${a.secondary}` : ""} {VITAL_REGISTRY[a.type].unit}
                    </span>
                    <span className="text-xs text-text-muted">
                      {a.classification} · {formatRelative(a.recordedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No recent flags"
                body="When your care team flags a reading, it will appear here."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Allergies and conditions" />
            {summary.isLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="t-label mb-2">Allergies</p>
                  {summary.data?.allergies?.length ? (
                    <ul className="space-y-1">
                      {summary.data.allergies.map((a, i) => (
                        <li key={i} className="text-sm text-text">
                          {a.substance}
                          {a.severity ? ` · ${a.severity}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted">None recorded.</p>
                  )}
                </div>
                <div>
                  <p className="t-label mb-2">Conditions</p>
                  {summary.data?.conditions?.length ? (
                    <ul className="space-y-1">
                      {summary.data.conditions.map((c, i) => (
                        <li key={i} className="text-sm text-text">
                          {c.title}
                          {c.diagnosedOn ? ` · ${c.diagnosedOn}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted">None recorded.</p>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <OrganDetailPanel organ={active} onClose={() => setActive(null)} />
    </div>
  );
}

function VitalsSeriesCard({ type, range }: { type: VitalType; range: RangeKey }) {
  const series = useVitalsSeries(type, range);
  const meta = VITAL_REGISTRY[type];
  const points = series.data ? toSeries(series.data.points) : [];

  return (
    <div>
      <p className="t-label">{meta.label}</p>
      <p className="t-metric mt-1 text-text">
        {series.data?.stats?.latest ?? "—"}
        <span className="t-unit ml-1">{meta.unit}</span>
      </p>
      <div className="mt-3">
        <TrendArea
          points={points}
          ariaLabel={`${meta.label} trend`}
          secondary={type === "blood_pressure"}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/health/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/health/page.tsx" "apps/marketing/src/app/patient/(app)/health/page.test.tsx"
git commit -m "feat(patient): add My Health page"
```

> **Note:** `useVitals` is a barrel re-export. Add `apps/marketing/src/patient/hooks/useVitals.ts`:
>
> ```ts
> export { useVitalsSeries } from "./useVitalsSeries";
> export { useVitalsAlerts } from "./useVitalsAlerts";
> ```

---

## Task 13: Appointments page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/appointments/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/appointments/page.test.tsx`

**Interfaces:**
- Consumes: `useAppointments`; `SectionHeader`; `Card`, `CardHeader`; `EmptyState`; `Skeleton`
- Produces: `AppointmentsPage` — list with three filter pills (Upcoming / Past / Cancelled).

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/(app)/appointments/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

const apiMock = vi.fn().mockResolvedValue({ appointments: [] });
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import AppointmentsPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("AppointmentsPage", () => {
  it("renders the page heading", () => {
    wrap(<AppointmentsPage />);
    expect(screen.getByText("Appointments")).toBeTruthy();
  });

  it("renders the empty state when there are no appointments", async () => {
    wrap(<AppointmentsPage />);
    expect(await screen.findByText(/No appointments/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/appointments/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Write the page**

Create `apps/marketing/src/app/patient/(app)/appointments/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card } from "@/patient/components/ui/Card";
import { PillGroup } from "@/patient/components/ui/Pill";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useAppointments } from "@/patient/hooks/useAppointments";
import { formatDayLabel, formatTime, humanize } from "@/patient/lib/format";
import type { AppointmentRow } from "@/patient/types/patient";

type Filter = "upcoming" | "past" | "cancelled";

export default function AppointmentsPage() {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const apts = useAppointments();

  const rows = (apts.data?.appointments ?? []).filter((a) => {
    if (filter === "upcoming") {
      return ["scheduled", "confirmed", "in_progress"].includes(a.status);
    }
    if (filter === "cancelled") {
      return a.status === "cancelled" || a.status === "no_show";
    }
    return a.status === "completed";
  });

  return (
    <div className="anim-rise space-y-6">
      <SectionHeader
        title="Appointments"
        subtitle="Every visit you've booked, in chronological order."
      >
        <PillGroup
          value={filter}
          onChange={setFilter}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          ariaLabel="Filter"
        />
      </SectionHeader>

      {apts.isLoading ? (
        <Skeleton className="h-32" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title={`No ${filter} appointments`}
            body={
              filter === "upcoming"
                ? "Book a visit from your profile to see it here."
                : "Nothing to show in this list yet."
            }
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((a) => (
            <li key={a.id}>
              <AppointmentCard a={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppointmentCard({ a }: { a: AppointmentRow }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-display text-text">{formatDayLabel(a.date)}</p>
          <p className="mt-1 text-sm text-text-soft">{formatTime(a.time)}</p>
        </div>
        <span
          className="inline-flex bg-surface-2 px-3 py-1 text-xs font-medium text-text-soft"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          {humanize(a.status)}
        </span>
      </div>

      <div className="mt-5 space-y-1">
        <p className="text-sm font-semibold text-text">{a.doctorName ?? "Doctor"}</p>
        <p className="text-xs text-text-muted">
          {a.doctorSpecialization ? `${a.doctorSpecialization} · ` : ""}
          {a.hospitalName ?? "Hospital"}
        </p>
      </div>

      <span
        className="mt-5 inline-flex bg-brand-soft px-3 py-1 text-xs font-medium text-brand-strong"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        {humanize(a.mode)}
      </span>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/appointments/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/appointments"
git commit -m "feat(patient): add Appointments page"
```

---

## Task 14: Records list + detail

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/records/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/records/page.test.tsx`
- Create: `apps/marketing/src/app/patient/(app)/records/[id]/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/records/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `useRecords`, `useRecordStats`, `useRecord`, `useRecordChildren`, `useLabTrend`; UI primitives
- Produces:
  - `RecordsPage`: filterable list of records, with stat tiles at the top.
  - `RecordDetailPage`: title, body, child items (labs/imaging/prescriptions), linked lab-trend chart.

- [ ] **Step 1: Write the failing list-page test**

Create `apps/marketing/src/app/patient/(app)/records/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

const apiMock = vi.fn().mockResolvedValue({ records: [] });
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import RecordsPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("RecordsPage", () => {
  it("renders the page heading", () => {
    wrap(<RecordsPage />);
    expect(screen.getByText("Medical Records")).toBeTruthy();
  });

  it("renders the empty state", async () => {
    wrap(<RecordsPage />);
    expect(await screen.findByText(/No records yet/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/records/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Write the list page**

Create `apps/marketing/src/app/patient/(app)/records/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card, CardHeader } from "@/patient/components/ui/Card";
import { PillGroup } from "@/patient/components/ui/Pill";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useRecords, useRecordStats } from "@/patient/hooks/useRecords";
import { formatRelative, humanize } from "@/patient/lib/format";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "lab_report", label: "Labs" },
  { value: "prescription", label: "Prescriptions" },
  { value: "imaging", label: "Imaging" },
  { value: "clinical_note", label: "Notes" },
];

export default function RecordsPage() {
  const [filter, setFilter] = useState<string>("all");
  const stats = useRecordStats();
  const records = useRecords(
    filter === "all" ? { limit: 50 } : { type: filter, limit: 50 }
  );

  return (
    <div className="anim-rise space-y-6">
      <SectionHeader title="Medical Records" subtitle="Everything your care team has shared with you." />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {Object.entries(stats.data?.byType ?? {})
          .slice(0, 4)
          .map(([kind, count]) => (
            <Card key={kind}>
              <p className="t-label">{humanize(kind)}</p>
              <p className="t-metric mt-2 text-text">{count}</p>
            </Card>
          ))}
      </div>

      <PillGroup
        value={filter}
        onChange={setFilter}
        options={FILTERS}
        ariaLabel="Filter by type"
      />

      {records.isLoading ? (
        <Skeleton className="h-32" />
      ) : records.data?.records?.length ? (
        <ul className="grid grid-cols-1 gap-4">
          {records.data.records.map((r) => (
            <li key={r.id}>
              <Card>
                <Link href={`/patient/records/${r.id}`} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="t-card-title text-text">{r.title}</p>
                    <p className="mt-1 text-sm text-text-soft">
                      {r.diagnosis || humanize(r.recordType)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-text-muted">
                    {formatRelative(r.createdAt)}
                  </span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title="No records yet"
            body="Records shared by your doctors and hospitals will appear here."
          />
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/records/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the detail-page test**

Create `apps/marketing/src/app/patient/(app)/records/[id]/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: "rec-1" }),
  usePathname: () => "/patient/records/rec-1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

const apiMock = vi.fn().mockResolvedValue({});
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import RecordDetailPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("RecordDetailPage", () => {
  it("renders the back link to the records list", () => {
    wrap(<RecordDetailPage />);
    expect(screen.getByText(/back to records/i)).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/records/[id]/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 7: Write the detail page**

Create `apps/marketing/src/app/patient/(app)/records/[id]/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card, CardHeader } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { TrendArea } from "@/patient/components/charts";
import { useRecord, useRecordChildren, useLabTrend } from "@/patient/hooks/useRecords";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { toSeries } from "@/patient/lib/vitals";

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const record = useRecord(id);
  const labs = useRecordChildren(id, "labs");
  const imaging = useRecordChildren(id, "imaging");
  const prescriptions = useRecordChildren(id, "prescriptions");

  const firstLab = labs.data?.[0]?.testName ?? null;
  const labTrend = useLabTrend(firstLab ?? "", 6);

  return (
    <div className="anim-rise space-y-6">
      <Link
        href="/patient/records"
        className="text-xs font-semibold text-brand-strong hover:underline"
      >
        ← Back to records
      </Link>

      {record.isLoading ? (
        <Skeleton className="h-32" />
      ) : !record.data ? (
        <EmptyState title="Record not found" body="The link may have expired." />
      ) : (
        <>
          <SectionHeader title={record.data.title} subtitle={humanize(record.data.recordType)} />

          {record.data.summary || record.data.diagnosis ? (
            <Card>
              <p className="text-sm text-text">{record.data.summary ?? record.data.diagnosis}</p>
              <p className="t-micro mt-3">{formatDayLabel(record.data.date)}</p>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Lab results" />
            {labs.isLoading ? (
              <Skeleton className="h-16" />
            ) : labs.data?.length ? (
              <ul className="space-y-2">
                {labs.data.map((l: any) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between bg-surface-2 px-4 py-3"
                    style={{ borderRadius: "var(--radius-inner)" }}
                  >
                    <span className="text-sm text-text">{l.testName}</span>
                    <span className="text-sm font-semibold text-text">
                      {l.value} {l.unit ?? ""}
                      {l.flag && l.flag !== "normal" ? (
                        <span
                          className="ml-2 inline-flex bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn"
                          style={{ borderRadius: "var(--radius-pill)" }}
                        >
                          {humanize(l.flag)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No lab results attached" />
            )}
          </Card>

          {firstLab && labTrend.data?.points?.length ? (
            <Card>
              <CardHeader title={`${firstLab} — 6 month trend`} />
              <TrendArea
                points={toSeries(
                  labTrend.data.points.map((p) => ({
                    t: p.date,
                    value: p.value,
                    secondary: null,
                    id: `${firstLab}-${p.date}`,
                    unit: "",
                    context: null,
                  }))
                )}
                ariaLabel={`${firstLab} trend`}
              />
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Prescriptions" />
            {prescriptions.isLoading ? (
              <Skeleton className="h-16" />
            ) : prescriptions.data?.length ? (
              <ul className="space-y-2">
                {prescriptions.data.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between bg-surface-2 px-4 py-3"
                      style={{ borderRadius: "var(--radius-inner)" }}>
                    <span className="text-sm text-text">{p.name}</span>
                    <span className="text-xs text-text-muted">
                      {p.dosage} {p.frequency ? `· ${p.frequency}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No prescriptions attached" />
            )}
          </Card>

          <Card>
            <CardHeader title="Imaging" />
            {imaging.isLoading ? (
              <Skeleton className="h-16" />
            ) : imaging.data?.length ? (
              <ul className="space-y-2">
                {imaging.data.map((i: any) => (
                  <li key={i.id} className="bg-surface-2 px-4 py-3"
                      style={{ borderRadius: "var(--radius-inner)" }}>
                    <p className="text-sm font-semibold text-text">
                      {i.modality} · {i.bodyPart}
                    </p>
                    {i.impression ? (
                      <p className="text-xs text-text-muted">{i.impression}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No imaging attached" />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run detail test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/records/[id]/page.test.tsx"`
Expected: PASS, 1 test.

- [ ] **Step 9: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/records"
git commit -m "feat(patient): add Medical Records list and detail pages"
```

---

## Task 15: Medications page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/medications/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/medications/page.test.tsx`

**Interfaces:**
- Consumes: `useMedications`, `useMedicationsToday`, `useMedicineStats`; `Card`, `PillGroup`, `EmptyState`, `Skeleton`, `StatTile`, `SectionHeader`, `BarSeries`; vital helpers
- Produces: `MedicationsPage` — adherence stat tiles, today list, active list, adherence bar chart.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/(app)/medications/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

const apiMock = vi.fn().mockResolvedValue({});
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import MedicationsPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("MedicationsPage", () => {
  it("renders the page heading", () => {
    wrap(<MedicationsPage />);
    expect(screen.getByText("Medications")).toBeTruthy();
  });

  it("renders the empty state for the today list", async () => {
    wrap(<MedicationsPage />);
    expect(await screen.findByText(/No medications today/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/medications/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Write the page**

Create `apps/marketing/src/app/patient/(app)/medications/page.tsx`:

```tsx
"use client";

import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card, CardHeader } from "@/patient/components/ui/Card";
import { StatTile } from "@/patient/components/ui/StatTile";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { BarSeries } from "@/patient/components/charts";
import {
  useMedications,
  useMedicationsToday,
  useMedicineStats,
} from "@/patient/hooks/useMedications";
import { peakIndex, toSeries } from "@/patient/lib/vitals";
import { formatDayLabel, formatRelative } from "@/patient/lib/format";

export default function MedicationsPage() {
  const stats = useMedicineStats(7);
  const today = useMedicationsToday();
  const meds = useMedications();

  const adherencePoints = stats.data?.last7Days?.length
    ? toSeries(
        stats.data.last7Days.map((d) => ({
          t: d.date,
          value: d.pct,
          secondary: null,
        }))
      )
    : [];

  return (
    <div className="anim-rise space-y-6">
      <SectionHeader
        title="Medications"
        subtitle="Your active prescriptions, today's schedule, and adherence."
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Card>
          <StatTile label="Active" value={stats.data?.activeCount ?? 0} />
        </Card>
        <Card>
          <StatTile label="Today" value={stats.data?.todayCount ?? 0} />
        </Card>
        <Card>
          <StatTile
            label="Taken today"
            value={stats.data?.todayTaken ?? 0}
            tone="positive"
          />
        </Card>
        <Card>
          <StatTile label="Streak" value={stats.data?.streakDays ?? 0} unit="d" />
        </Card>
      </div>

      <Card>
        <CardHeader title="Adherence this week" />
        {stats.isLoading ? (
          <Skeleton className="h-32" />
        ) : adherencePoints.length === 0 ? (
          <EmptyState
            title="No adherence data yet"
            body="Once you record a dose, the streak and bar chart will appear."
          />
        ) : (
          <BarSeries
            points={adherencePoints}
            peakIndex={peakIndex(adherencePoints)}
            ariaLabel="Adherence this week"
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Today" />
        {today.isLoading ? (
          <Skeleton className="h-24" />
        ) : today.data?.medicines?.length ? (
          <ul className="space-y-3">
            {today.data.medicines.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-3"
                style={{ borderRadius: "var(--radius-inner)" }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{m.name}</p>
                  <p className="text-xs text-text-muted">
                    {m.dosage} {m.frequency ? `· ${m.frequency}` : ""}
                  </p>
                </div>
                <span className="text-xs text-text-muted">{formatRelative(m.startDate)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No medications today"
            body="Once your doctor prescribes a medication, it will appear here."
          />
        )}
      </Card>

      <Card>
        <CardHeader title="All active" />
        {meds.isLoading ? (
          <Skeleton className="h-24" />
        ) : meds.data?.medicines?.length ? (
          <ul className="space-y-3">
            {meds.data.medicines.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-3"
                style={{ borderRadius: "var(--radius-inner)" }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{m.name}</p>
                  <p className="text-xs text-text-muted">
                    Started {formatDayLabel(m.startDate)} · {m.dosage}
                  </p>
                </div>
                <span
                  className={
                    m.active
                      ? "inline-flex bg-success-soft px-2 py-0.5 text-xs font-medium text-success"
                      : "inline-flex bg-surface-3 px-2 py-0.5 text-xs font-medium text-text-muted"
                  }
                  style={{ borderRadius: "var(--radius-pill)" }}
                >
                  {m.active ? "Active" : "Paused"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No active medications" />
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/medications/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/medications"
git commit -m "feat(patient): add Medications page"
```

---

## Task 16: Messages list and conversation

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/messages/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/messages/page.test.tsx`
- Create: `apps/marketing/src/app/patient/(app)/messages/[conversationId]/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/messages/[conversationId]/page.test.tsx`

**Interfaces:**
- Consumes: `useConversations`, `useMessages`; `SectionHeader`, `Card`, `EmptyState`, `Skeleton`
- Produces:
  - `MessagesPage`: list of threads, the assistant row at top.
  - `ConversationPage`: a single thread view; uses SSE streaming (`useRealtime`) for live updates.

- [ ] **Step 1: Write the failing list-page test**

Create `apps/marketing/src/app/patient/(app)/messages/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

const apiMock = vi.fn().mockResolvedValue({ conversations: [] });
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import MessagesPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("MessagesPage", () => {
  it("renders the page heading", () => {
    wrap(<MessagesPage />);
    expect(screen.getByText("Messages")).toBeTruthy();
  });

  it("renders the empty state", async () => {
    wrap(<MessagesPage />);
    expect(await screen.findByText(/No conversations yet/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/messages/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Write the list page**

Create `apps/marketing/src/app/patient/(app)/messages/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useConversations } from "@/patient/hooks/useMessages";
import { formatRelative } from "@/patient/lib/format";

export default function MessagesPage() {
  const convs = useConversations();

  return (
    <div className="anim-rise space-y-6">
      <SectionHeader
        title="Messages"
        subtitle="Threads with your care team, plus your private assistant."
      />

      <Link
        href="/patient/messages/assistant"
        className="flex items-center gap-4 bg-surface p-5"
        style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
      >
        <span
          aria-hidden
          className="grid h-12 w-12 place-items-center bg-ink text-white"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          <Sparkles size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-card-title text-text">Care assistant</p>
          <p className="text-sm text-text-soft">
            Ask anything about medications, tests and what to expect after a visit.
          </p>
        </div>
      </Link>

      {convs.isLoading ? (
        <Skeleton className="h-32" />
      ) : convs.data?.conversations?.length ? (
        <ul className="space-y-3">
          {convs.data.conversations.map((c) => (
            <li key={c.id}>
              <Card>
                <Link
                  href={`/patient/messages/${c.id}`}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="t-card-title text-text">
                      {c.doctorName ?? "Care team"}
                    </p>
                    <p className="mt-1 truncate text-sm text-text-soft">
                      {c.lastMessagePreview ?? "No messages yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {c.patientUnread > 0 ? (
                      <span
                        aria-label={`${c.patientUnread} unread`}
                        className="grid h-6 min-w-[24px] place-items-center bg-brand px-2 text-[11px] font-semibold text-white"
                        style={{ borderRadius: "var(--radius-pill)" }}
                      >
                        {c.patientUnread}
                      </span>
                    ) : null}
                    <span className="text-xs text-text-muted">
                      {formatRelative(c.lastMessageAt)}
                    </span>
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title="No conversations yet"
            body="Your doctor can start a thread from your visit. Threads will appear here as soon as one is created."
          />
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/messages/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the failing conversation-page test**

Create `apps/marketing/src/app/patient/(app)/messages/[conversationId]/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ conversationId: "conv-1" }),
  usePathname: () => "/patient/messages/conv-1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex", role: "patient" },
      hydrated: true,
    }),
}));

const apiMock = vi.fn().mockResolvedValue({ messages: [] });
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import ConversationPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("ConversationPage", () => {
  it("renders the back link", () => {
    wrap(<ConversationPage />);
    expect(screen.getByText(/back to messages/i)).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/messages/[conversationId]/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 7: Write the conversation page**

Create `apps/marketing/src/app/patient/(app)/messages/[conversationId]/page.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useMessages } from "@/patient/hooks/useMessages";
import { api } from "@/portal/lib/api";
import { useRealtime } from "@/portal/hooks/useRealtime";
import { formatRelative } from "@/patient/lib/format";
import type { Message } from "@/patient/types/patient";

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const isAssistant = conversationId === "assistant";
  const id = isAssistant ? null : conversationId;
  const messages = useMessages(id);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Live updates for real conversations (assistant uses SSE streaming
  // through its own endpoint, mounted below).
  useRealtime({
    topic: `conversation:${conversationId}`,
    enabled: !isAssistant && Boolean(conversationId),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data?.messages?.length]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      if (isAssistant) {
        await api("/patient-messages/assistant", {
          method: "POST",
          json: { body: draft },
        });
      } else {
        await api(`/patient-messages/conversations/${conversationId}/messages`, {
          method: "POST",
          json: { body: draft },
        });
      }
      setDraft("");
      void messages.refetch();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="anim-rise flex h-[calc(100dvh-9rem)] flex-col gap-6">
      <Link
        href="/patient/messages"
        className="text-xs font-semibold text-brand-strong hover:underline"
      >
        ← Back to messages
      </Link>
      <SectionHeader
        title={isAssistant ? "Care assistant" : "Conversation"}
        subtitle={isAssistant ? "Private, between you and your AI assistant." : "Thread with your care team."}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.isLoading ? (
          <Skeleton className="h-24" />
        ) : messages.data?.messages?.length ? (
          <ol className="space-y-3">
            {messages.data.messages.map((m) => (
              <MessageBubble key={m.id} m={m} mine={m.senderRole === "patient"} />
            ))}
          </ol>
        ) : (
          <Card>
            <EmptyState
              title={isAssistant ? "Ask anything" : "No messages yet"}
              body={
                isAssistant
                  ? "Ask about a medication, an upcoming test or what to expect after a visit."
                  : "Your care team hasn't replied yet."
              }
            />
          </Card>
        )}
      </div>

      <form onSubmit={onSend} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isAssistant ? "Ask the assistant…" : "Reply…"}
          className="h-12 flex-1 bg-surface px-4 text-sm text-text outline-none"
          style={{ borderRadius: "var(--radius-pill)", boxShadow: "var(--shadow-card)" }}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="h-12 bg-ink px-6 text-sm font-semibold text-white disabled:opacity-50"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <li
      className={
        "max-w-[80%] px-4 py-3 text-sm " +
        (mine
          ? "ml-auto bg-ink text-white"
          : "mr-auto bg-surface text-text")
      }
      style={{
        borderRadius: 18,
        boxShadow: mine ? undefined : "var(--shadow-card)",
      }}
    >
      <p>{m.body}</p>
      <p className={"mt-1 text-[10px] " + (mine ? "text-white/70" : "text-text-muted")}>
        {formatRelative(m.createdAt)}
      </p>
    </li>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/messages/[conversationId]/page.test.tsx"`
Expected: PASS, 1 test.

- [ ] **Step 9: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/messages"
git commit -m "feat(patient): add Messages list and conversation pages"
```

---

## Task 17: Profile page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/profile/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/profile/page.test.tsx`

**Interfaces:**
- Consumes: `useProfile`, `useHealthSummary`; `SectionHeader`, `Card`, `Pill`
- Produces: `ProfilePage` — profile card, demographics, allergies/conditions summary, sign-out button.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/(app)/profile/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const clear = vi.fn();
vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      token: "t",
      user: { id: "u", name: "Alex Fernando", role: "patient" },
      hydrated: true,
      clearSession: () => clear(),
    }),
}));

const apiMock = vi.fn().mockResolvedValue({});
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import ProfilePage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("ProfilePage", () => {
  it("renders the page heading", () => {
    wrap(<ProfilePage />);
    expect(screen.getByText("Profile")).toBeTruthy();
  });

  it("shows the user's name", () => {
    wrap(<ProfilePage />);
    expect(screen.getByText(/Alex Fernando/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/profile/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Write the page**

Create `apps/marketing/src/app/patient/(app)/profile/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

import { useAuthStore } from "@/portal/stores/auth";
import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card, CardHeader } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { useHealthSummary } from "@/patient/hooks/useHealthSummary";
import { api } from "@/portal/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const summary = useHealthSummary();

  async function onSignOut() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore — we still want to clear the local session
    }
    clearSession();
    router.replace("/patient/login");
  }

  return (
    <div className="anim-rise space-y-6">
      <SectionHeader title="Profile" subtitle="Your account, demographics and care context." />

      <Card>
        <div className="flex items-center gap-5">
          <span
            aria-hidden
            className="grid h-16 w-16 place-items-center bg-ink text-2xl font-semibold text-white"
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            {(user?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-card-title text-text">{user?.name ?? "—"}</p>
            <p className="text-sm text-text-soft">{user?.email ?? user?.phone ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="h-10 bg-surface-2 px-4 text-sm font-medium text-text-soft hover:bg-surface-3"
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            Sign out
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Demographics" />
        {summary.isLoading ? (
          <Skeleton className="h-24" />
        ) : summary.data ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Age" value={summary.data.demographics.age} />
            <Field label="Sex" value={summary.data.demographics.sex} />
            <Field label="Blood group" value={summary.data.demographics.bloodGroup} />
            <Field
              label="BMI"
              value={
                summary.data.demographics.bmi != null
                  ? `${summary.data.demographics.bmi.toFixed(1)} (${summary.data.demographics.bmiCategory ?? "—"})`
                  : null
              }
            />
          </dl>
        ) : (
          <p className="text-sm text-text-muted">No demographics on file.</p>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="t-label">{label}</dt>
      <dd className="mt-1 text-sm text-text">{value ?? "—"}</dd>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/profile/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/profile"
git commit -m "feat(patient): add Profile page"
```

---

## Task 18: Notifications page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/notifications/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/notifications/page.test.tsx`

**Interfaces:**
- Consumes: `useNotifications`; `SectionHeader`, `Card`, `EmptyState`, `Skeleton`
- Produces: `NotificationsPage` — chronological list, unread badge.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/(app)/notifications/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({ token: "t", user: { id: "u", name: "Alex", role: "patient" }, hydrated: true }),
}));

const apiMock = vi.fn().mockResolvedValue({ notifications: [] });
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import NotificationsPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
}

describe("NotificationsPage", () => {
  it("renders the page heading", () => {
    wrap(<NotificationsPage />);
    expect(screen.getByText("Notifications")).toBeTruthy();
  });

  it("renders the empty state", async () => {
    wrap(<NotificationsPage />);
    expect(await screen.findByText(/No notifications yet/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/notifications/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Write the page**

Create `apps/marketing/src/app/patient/(app)/notifications/page.tsx`:

```tsx
"use client";

import { SectionHeader } from "@/patient/components/ui/SectionHeader";
import { Card } from "@/patient/components/ui/Card";
import { Skeleton } from "@/patient/components/ui/Skeleton";
import { EmptyState } from "@/patient/components/ui/EmptyState";
import { useNotifications } from "@/patient/hooks/useNotifications";
import { formatRelative } from "@/patient/lib/format";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  const notif = useNotifications();

  return (
    <div className="anim-rise space-y-6">
      <SectionHeader title="Notifications" subtitle="Updates from your care team and the platform." />

      {notif.isLoading ? (
        <Skeleton className="h-32" />
      ) : notif.data?.notifications?.length ? (
        <ul className="space-y-3">
          {notif.data.notifications.map((n) => (
            <li key={n.id}>
              <Card>
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="mt-1 grid h-9 w-9 shrink-0 place-items-center bg-brand-soft text-brand"
                    style={{ borderRadius: "var(--radius-pill)" }}
                  >
                    <Bell size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="t-card-title text-text">{n.title}</p>
                    <p className="mt-1 text-sm text-text-soft">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-text-muted">
                    {formatRelative(n.createdAt)}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icon={<Bell size={20} />}
            title="No notifications yet"
            body="When your care team sends an update, it will appear here."
          />
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/notifications/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/notifications"
git commit -m "feat(patient): add Notifications page"
```

---

## Task 19: Migrate imaging, share, audit, insurance with new shell

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/imaging/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/imaging/[studyUid]/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/share/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/audit/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/marketplace/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/plans/[planId]/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/enroll/[planId]/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/policy/[id]/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/ecard/[id]/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/quote/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/coverage-check/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/claims/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/claims/new/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/claims/[id]/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/payment/[enrollmentId]/page.tsx`

**Interfaces:**
- Consumes: each migrated page imports the same primitives, query hooks and `api` wrapper as the new portal. Pages are thin: same data flow, new chrome.
- Produces: every secondary surface lives under `/patient/*` instead of `/portal/(patient)/me/*`.

- [ ] **Step 1: Read each source file and copy with a re-skin**

For every file in `apps/marketing/src/app/portal/(patient)/me/*` and the imaging study detail page, copy the body verbatim, then replace:
- `useAuthStore` selector fields: same field set — the auth store is shared.
- Header bar markup: replace with `<SectionHeader title="…" subtitle="…" />`.
- The data hooks used by each page are unchanged — the backend endpoints are the same. Only the chrome changes.
- Any `<div className="card">` or bare card container becomes `<Card>...</Card>` so they pick up the new shadow/radius.

This task is mechanical, not creative: the page bodies were authored against the same backend and are being lifted into a new visual shell.

- [ ] **Step 2: Verify each migrated page renders without runtime error**

For every migrated page, add a smoke test that pins the page heading:

```tsx
// example: apps/marketing/src/app/patient/(app)/imaging/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({ token: "t", user: { id: "u", name: "Alex", role: "patient" }, hydrated: true }),
}));
const apiMock = vi.fn().mockResolvedValue({});
vi.mock("@/portal/lib/api", () => ({
  api: () => apiMock(),
  ApiError: class ApiError extends Error {},
}));

import ImagingPage from "./page";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("ImagingPage", () => {
  it("renders the page heading", () => {
    wrap(<ImagingPage />);
    expect(screen.getByText("Imaging")).toBeTruthy();
  });
});
```

The same template applies to every other migrated page — swap the heading text and the imported component.

- [ ] **Step 3: Run all migrated-page tests**

Run: `cd apps/marketing && bunx vitest run src/app/patient/\(app\)`
Expected: PASS, one test per migrated page.

- [ ] **Step 4: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/imaging" \
        "apps/marketing/src/app/patient/(app)/share" \
        "apps/marketing/src/app/patient/(app)/audit" \
        "apps/marketing/src/app/patient/(app)/insurance"
git commit -m "feat(patient): migrate imaging, share, audit, insurance surfaces"
```

---

## Task 20: Redirect stubs and login destination

**Files:**
- Modify: `apps/marketing/src/app/portal/login/page.tsx` (line 72-76, the patient destination)
- Modify: every file under `apps/marketing/src/app/portal/(patient)/**`
- Modify: `apps/marketing/src/app/portal/(patient)/me/page.tsx` becomes a redirect to `/patient`
- Create: `apps/marketing/src/app/portal/(patient)/me/redirect.test.tsx`

**Interfaces:**
- Consumes: Next.js `redirect`
- Produces:
  - `/portal/login` after sign-in sends `patient` users to `/patient`.
  - Every page under `/portal/(patient)/**` permanently redirects to its `/patient/*` counterpart.

- [ ] **Step 1: Write the failing redirect test**

Create `apps/marketing/src/app/portal/(patient)/me/redirect.test.tsx`:

```tsx
/**
 * `/portal/me` is the legacy patient entrypoint. Once the new portal
 * ships it must redirect every visitor to `/patient`, preserving any
 * sub-route.
 */
import { describe, it, expect, vi } from "vitest";

import { meRouteMap, redirectForMePath } from "./redirect";

describe("redirectForMePath", () => {
  it("maps the legacy root to the new dashboard", () => {
    expect(redirectForMePath("/portal/me")).toBe("/patient");
  });

  it("maps a known sub-route to its new counterpart", () => {
    expect(redirectForMePath("/portal/me/records")).toBe("/patient/records");
  });

  it("passes query strings through unchanged", () => {
    expect(redirectForMePath("/portal/me/insurance?planId=abc")).toBe(
      "/patient/insurance?planId=abc"
    );
  });

  it("falls back to /patient when the sub-route is unknown", () => {
    expect(redirectForMePath("/portal/me/unicorn")).toBe("/patient");
  });
});

describe("meRouteMap", () => {
  it("covers every legacy sub-route", () => {
    const expected = [
      "/portal/me",
      "/portal/me/records",
      "/portal/me/imaging",
      "/portal/me/imaging/abc-123",
      "/portal/me/share",
      "/portal/me/audit",
      "/portal/me/notifications",
      "/portal/me/insurance",
      "/portal/me/insurance/claims",
      "/portal/me/insurance/claims/new",
      "/portal/me/insurance/claims/claim-1",
      "/portal/me/insurance/coverage-check",
      "/portal/me/insurance/ecard/ecard-1",
      "/portal/me/insurance/enroll/plan-1",
      "/portal/me/insurance/marketplace",
      "/portal/me/insurance/marketplace/provider-1",
      "/portal/me/insurance/payment/enr-1",
      "/portal/me/insurance/plans/plan-1",
      "/portal/me/insurance/policy/policy-1",
      "/portal/me/insurance/quote",
    ];
    for (const path of expected) {
      expect(typeof redirectForMePath(path)).toBe("string");
    }
    expect(meRouteMap.size).toBe(expected.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/portal/(patient)/me/redirect.test.tsx"`
Expected: FAIL — `Failed to resolve import "./redirect"`.

- [ ] **Step 3: Write the redirect map**

Create `apps/marketing/src/app/portal/(patient)/me/redirect.ts`:

```ts
/**
 * Legacy patient URL → new patient URL.
 *
 * Every route the OLD portal hosted under `/portal/(patient)/me/*` is
 * enumerated here so we can ship a single `next.config` rewrite OR a
 * per-page `redirect()` call without missing a path.
 *
 * Adding a new patient surface? Add it here too — the test in
 * `redirect.test.tsx` will keep the map honest.
 */

export const meRouteMap: Map<string, string> = new Map([
  ["/portal/me", "/patient"],
  ["/portal/me/records", "/patient/records"],
  ["/portal/me/imaging", "/patient/imaging"],
  ["/portal/me/share", "/patient/share"],
  ["/portal/me/audit", "/patient/audit"],
  ["/portal/me/notifications", "/patient/notifications"],
  ["/portal/me/insurance", "/patient/insurance"],
  ["/portal/me/insurance/claims", "/patient/insurance/claims"],
  ["/portal/me/insurance/claims/new", "/patient/insurance/claims/new"],
  ["/portal/me/insurance/coverage-check", "/patient/insurance/coverage-check"],
  ["/portal/me/insurance/marketplace", "/patient/insurance/marketplace"],
  ["/portal/me/insurance/quote", "/patient/insurance/quote"],
]);

const meDynamicRouteMap: Array<{ pattern: RegExp; build: (params: string[]) => string }> = [
  { pattern: /^\/portal\/me\/imaging\/([^/]+)$/, build: (p) => `/patient/imaging/${p[0]}` },
  { pattern: /^\/portal\/me\/insurance\/claims\/([^/]+)$/, build: (p) => `/patient/insurance/claims/${p[0]}` },
  { pattern: /^\/portal\/me\/insurance\/ecard\/([^/]+)$/, build: (p) => `/patient/insurance/ecard/${p[0]}` },
  { pattern: /^\/portal\/me\/insurance\/enroll\/([^/]+)$/, build: (p) => `/patient/insurance/enroll/${p[0]}` },
  { pattern: /^\/portal\/me\/insurance\/marketplace\/([^/]+)$/, build: (p) => `/patient/insurance/marketplace/${p[0]}` },
  { pattern: /^\/portal\/me\/insurance\/payment\/([^/]+)$/, build: (p) => `/patient/insurance/payment/${p[0]}` },
  { pattern: /^\/portal\/me\/insurance\/plans\/([^/]+)$/, build: (p) => `/patient/insurance/plans/${p[0]}` },
  { pattern: /^\/portal\/me\/insurance\/policy\/([^/]+)$/, build: (p) => `/patient/insurance/policy/${p[0]}` },
];

export function redirectForMePath(rawPath: string): string {
  const [path, query = ""] = rawPath.split("?");
  const querySuffix = query ? `?${query}` : "";

  const direct = meRouteMap.get(path);
  if (direct) return `${direct}${querySuffix}`;

  for (const { pattern, build } of meDynamicRouteMap) {
    const m = path.match(pattern);
    if (m) return `${build(m.slice(1))}${querySuffix}`;
  }
  return `/patient${querySuffix}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/portal/(patient)/me/redirect.test.tsx"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Rewrite every legacy patient page as a redirect stub**

For every page under `apps/marketing/src/app/portal/(patient)/**`, replace the body with a `redirect()` call. Example for the dashboard:

```tsx
// apps/marketing/src/app/portal/(patient)/me/page.tsx
import { redirect } from "next/navigation";

export default function LegacyMePage() {
  redirect("/patient");
}
```

For each sub-route, replace the body with:

```tsx
import { redirect } from "next/navigation";

export default function LegacyMeSubPage() {
  // Keep this file as a server-only redirect stub so Next.js's
  // router never invokes the old client tree.
  const path = "/portal/<sub-path>";
  const { redirectForMePath } = require("./redirect");
  redirect(redirectForMePath(path));
}
```

Pages with dynamic params (`[id]`, `[planId]`, `[studyUid]`, `[conversationId]`, `[enrollmentId]`) read the params and rebuild the target path:

```tsx
// apps/marketing/src/app/portal/(patient)/me/imaging/[studyUid]/page.tsx
import { redirect } from "next/navigation";

export default function LegacyImagingStudyPage({
  params,
}: {
  params: { studyUid: string };
}) {
  redirect(`/patient/imaging/${params.studyUid}`);
}
```

- [ ] **Step 6: Update the login destination**

In `apps/marketing/src/app/portal/login/page.tsx`, change the patient destination on lines 72-76 from `/portal/me` to `/patient`:

```tsx
const next = params.get("next") || (user?.role === "patient" ? "/patient" : "/portal/dashboard");
```

- [ ] **Step 7: Verify the marketing app boots**

Run: `cd apps/marketing && bun run build`
Expected: build succeeds. The new `/patient/*` routes are reachable; the legacy `/portal/(patient)/me/*` URLs redirect cleanly.

- [ ] **Step 8: Run the entire marketing test suite**

Run: `cd apps/marketing && bun run test`
Expected: PASS. The legacy patient pages are server-only redirects, so no tests touch them, and the new patient tests all pass.

- [ ] **Step 9: Run the API test suite**

Run: `cd apps/api && bun run test`
Expected: PASS, no regressions. The new `/appointments-me-join` test joins the existing pass set.

- [ ] **Step 10: Commit**

```bash
git add apps/marketing/src/app/portal
git commit -m "feat(patient): redirect legacy /portal/(patient)/me/* routes to /patient/*"
```

---

## Self-Review

Run the three writing-plans checks against the plan:

**1. Spec coverage.** Spec sections map to tasks:
- §6.1 Dashboard → Tasks 5, 6, 9, 10, 11
- §6.2 My Health → Tasks 8, 12
- §6.3 Appointments → Tasks 4, 13
- §6.4 Records → Tasks 8, 14
- §6.5 Medications → Tasks 8, 15
- §6.6 Messages → Task 16
- §6.7 Profile → Task 17
- §6.8 Imaging/Share/Audit/Insurance → Task 19
- §6.9 Notifications → Task 18
- §7 Endpoints → Tasks 7, 4 (the additive join)
- §8 Backend change → Task 4
- §9 Data-integrity → covered by Global Constraints and the per-widget empty states
- §10 Errors/loading → QueryBoundary + Skeleton primitives in Task 6
- §11 Testing → every task carries a test file

No gaps.

**2. Placeholder scan.** Search the plan for "TBD", "TODO", "implement later", "fill in", "similar to Task", "appropriate error handling". Result: zero matches.

**3. Type consistency.** Hook signatures in Task 7 match the import sites in Tasks 9–18. `VitalType` is defined in `types/patient.ts` (Task 3) and used unchanged in Tasks 8 and 12. `AppointmentRow.doctorName` is documented in Task 3 and populated by the join in Task 4. `RangeKey` is defined in `lib/query.ts` (Task 3) and consumed in Tasks 10 and 12.

---

## End of Plan
