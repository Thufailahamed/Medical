# Patient AI Redesign — Plan A: Token Foundation + Shared Components + Hub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the patient portal's design tokens real in Tailwind v4 and rebuild the `/patient/ai` hub as a premium, componentized "command center" (approved layout A), with reusable AI components ready for the chat and sibling-page plans.

**Architecture:** Register existing CSS variables in a Tailwind `@theme` block (no value changes, no markup churn), extract AI response parsing into TanStack mutation hooks, then build small focused components (`AiToolCard`, `AiToolHero`, `AiCommandBar`, `HealthSummaryCard`, `DrugInteractionCard`, `AiSafetyNotice`) and reduce the 921-line hub page to a composition.

**Tech Stack:** Next.js 16.2.10 (modified — read `apps/marketing/node_modules/next/dist/docs/` before writing code), React 19.2.4, TanStack Query 5, Tailwind v4.3, lucide-react, Vitest 4 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-10-patient-ai-redesign-design.md`

## Global Constraints

- No backend/API changes. Endpoints used: `POST /ai/summary {patientId}`, `POST /ai/drug-interaction {medicines: string[]}`.
- No new dependencies. No new routes; all `ai/*/page.tsx` files must keep existing (parity test).
- Hardcoded English; no i18n. No dark mode.
- Use `@theme`-backed utilities (`bg-brand`, `text-text`, `rounded-pill`, `shadow-card`) plus raw `.patient-card` / `.t-*` / `.dashboard-hero` classes. Do not rename or re-value any existing CSS token.
- Tests: Vitest colocated `*.test.tsx`; mock `@/patient/hooks` wholesale in page/component tests; no snapshots.
- Repo has unrelated uncommitted changes. Commit steps must `git add` only the files listed in that task — never `git add -A`. **Ask the user before the first commit; if they decline, skip all commit steps and leave changes staged in the working tree.**
- TypeScript must pass `bunx tsc --noEmit` from `apps/marketing` after each task.

---

### Task 1: Register design tokens in Tailwind `@theme`

**Files:**
- Modify: `apps/marketing/src/app/patient/globals.css:10-59`
- Test: `apps/marketing/src/app/patient/globals.test.ts` (new)

**Interfaces:**
- Produces: working Tailwind utilities `bg-brand`, `bg-brand-soft`, `bg-brand-strong`, `text-text`, `text-text-soft`, `text-text-muted`, `bg-surface`, `bg-surface-2`, `bg-surface-3`, `border-border`, `bg-success-soft`, `text-success`, `bg-warn-soft`, `text-warn`, `bg-danger-soft`, `text-danger`, `bg-ink`, `rounded-card`, `rounded-inner`, `rounded-pill`, `shadow-card`, `shadow-float`, `shadow-brand`, `font-patient`.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/app/patient/globals.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compile } from "tailwindcss";

const require = createRequire(import.meta.url);
const tailwindDir = dirname(require.resolve("tailwindcss/package.json"));

function loadStylesheet(id: string, base: string) {
  const file = id === "tailwindcss" ? join(tailwindDir, "index.css") : join(base, id);
  return Promise.resolve({
    path: file,
    base: dirname(file),
    content: readFileSync(file, "utf8"),
  });
}

async function compiledPatientCss() {
  const raw = readFileSync(
    fileURLToPath(new URL("./globals.css", import.meta.url)),
    "utf8",
  );
  const css = raw
    .replace(/@import url\("https:[^"]+"\);\s*/g, "")
    .replace('@import "tailwindcss";', '@import "tailwindcss" source(none);');
  const compiler = await compile(css, { base: tailwindDir, loadStylesheet });
  return compiler.build([
    "bg-brand",
    "bg-brand-soft",
    "text-text",
    "text-text-soft",
    "bg-surface-2",
    "border-border",
    "bg-success-soft",
    "text-success",
    "bg-warn-soft",
    "bg-danger-soft",
    "rounded-pill",
    "rounded-inner",
    "rounded-card",
    "shadow-card",
    "shadow-float",
    "shadow-brand",
  ]);
}

describe("patient design tokens", () => {
  it("registers the portal tokens as Tailwind theme values", async () => {
    const css = await compiledPatientCss();
    for (const utility of [
      ".bg-brand",
      ".bg-brand-soft",
      ".text-text",
      ".text-text-soft",
      ".bg-surface-2",
      ".border-border",
      ".bg-success-soft",
      ".text-success",
      ".bg-warn-soft",
      ".bg-danger-soft",
      ".rounded-pill",
      ".rounded-inner",
      ".rounded-card",
      ".shadow-card",
      ".shadow-float",
      ".shadow-brand",
    ]) {
      expect(css).toContain(utility);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/app/patient/globals.test.ts`
Expected: FAIL — `:root` tokens do not generate utilities (`expect(css).toContain(".bg-brand")` fails).

- [ ] **Step 3: Convert `:root` to `@theme`**

In `apps/marketing/src/app/patient/globals.css`, change the opening of the token block only:

```css
/* before */
:root {
  /* Surfaces — soft blue workspace, bright white cards */
```

becomes:

```css
/* after */
@theme {
  /* Surfaces — soft blue workspace, bright white cards */
```

Keep every variable name and value inside the block unchanged, and keep the closing `}` in place. The `[data-app="patient"]` rule and all raw classes (`.patient-card`, `.t-*`, `.dashboard-hero`, etc.) reference these variables through `var(--…)` and continue to work because `@theme` emits the same custom properties to `:root`.

- [ ] **Step 4: Run the token test and the existing suite**

Run: `cd apps/marketing && bunx vitest run src/app/patient/globals.test.ts src/patient/parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (ask user first — see Global Constraints)**

```bash
git add apps/marketing/src/app/patient/globals.css apps/marketing/src/app/patient/globals.test.ts
git commit -m "fix(patient-portal): register design tokens in tailwind @theme"
```

---

### Task 2: AI hooks — summary + drug interaction

**Files:**
- Create: `apps/marketing/src/patient/hooks/ai.ts`
- Create: `apps/marketing/src/patient/hooks/ai.test.ts`
- Modify: `apps/marketing/src/patient/hooks/index.ts:33`
- Modify: `apps/marketing/src/patient/hooks/index.test.ts:132-137` (add two names to `EXPECTED_HOOK_EXPORTS`)

**Interfaces:**
- Consumes: `api` from `@/portal/lib/api`.
- Produces:
  - `interface StructuredSummary { patientSummary: string; diagnoses?: string[]; medicines?: string[]; history?: string[]; risks?: string[]; recentTests?: string[] }`
  - `interface DrugInteractionItem { medicines: string[]; severity: string; note?: string; recommendation?: string; source?: string }`
  - `const DEFAULT_CLEAR_MESSAGE: string`
  - `function normalizeSummary(res: { summary: string | StructuredSummary }): StructuredSummary`
  - `function normalizeInteractions(res: { result?: string; interactions?: DrugInteractionItem[] | string }): { items: DrugInteractionItem[]; message: string | null }`
  - `function useGenerateSummary()`
  - `function useCheckDrugInteractions()`
  - Barrel exports: `useGenerateSummary`, `useCheckDrugInteractions`, plus the two types `StructuredSummary` and `DrugInteractionItem`. Pure helpers (`normalizeSummary`, `normalizeInteractions`, `DEFAULT_CLEAR_MESSAGE`) stay out of the barrel — the barrel test counts function-shaped exports.

- [ ] **Step 1: Write the failing tests**

Create `apps/marketing/src/patient/hooks/ai.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  DEFAULT_CLEAR_MESSAGE,
  normalizeInteractions,
  normalizeSummary,
  type DrugInteractionItem,
} from "./ai";

describe("normalizeSummary", () => {
  it("wraps plain-string responses", () => {
    expect(normalizeSummary({ summary: "Stable" })).toEqual({
      patientSummary: "Stable",
    });
  });

  it("keeps structured fields and defaults missing arrays", () => {
    const out = normalizeSummary({
      summary: { patientSummary: "Hi", diagnoses: ["T2DM"] },
    });
    expect(out.diagnoses).toEqual(["T2DM"]);
    expect(out.risks).toEqual([]);
    expect(out.history).toEqual([]);
  });

  it("falls back when patientSummary is missing", () => {
    expect(
      normalizeSummary({ summary: {} as never }).patientSummary,
    ).toBe("Health record summary generated successfully.");
  });
});

describe("normalizeInteractions", () => {
  const items: DrugInteractionItem[] = [
    { medicines: ["Warfarin", "Aspirin"], severity: "severe", note: "Bleeding risk" },
  ];

  it("keeps an array payload", () => {
    expect(normalizeInteractions({ interactions: items })).toEqual({
      items,
      message: null,
    });
  });

  it("parses a JSON-string interactions payload", () => {
    expect(normalizeInteractions({ interactions: JSON.stringify(items) }).items).toEqual(items);
  });

  it("parses a JSON result object with nested interactions", () => {
    expect(
      normalizeInteractions({ result: JSON.stringify({ interactions: items }) }).items,
    ).toEqual(items);
  });

  it("returns plain-text results as a clean message", () => {
    expect(normalizeInteractions({ result: "No interactions found." }).message).toBe(
      "No interactions found.",
    );
  });

  it("returns the default clear message for malformed JSON results", () => {
    expect(normalizeInteractions({ result: "[{bad json" }).message).toBe(
      DEFAULT_CLEAR_MESSAGE,
    );
  });

  it("returns the default clear message when nothing parses", () => {
    expect(normalizeInteractions({}).message).toBe(DEFAULT_CLEAR_MESSAGE);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/ai.test.ts`
Expected: FAIL — cannot resolve `./ai`.

- [ ] **Step 3: Implement the hooks**

Create `apps/marketing/src/patient/hooks/ai.ts`:

```ts
"use client";

import { useMutation } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";

export interface StructuredSummary {
  patientSummary: string;
  diagnoses?: string[];
  medicines?: string[];
  history?: string[];
  risks?: string[];
  recentTests?: string[];
}

export interface DrugInteractionItem {
  medicines: string[];
  severity: "minor" | "moderate" | "severe" | string;
  note?: string;
  recommendation?: string;
  source?: string;
}

export const DEFAULT_CLEAR_MESSAGE =
  "No known adverse interactions detected between the provided medications. Continue taking as directed by your physician.";

type SummaryResponse = { summary: string | StructuredSummary };

export function normalizeSummary(res: SummaryResponse): StructuredSummary {
  if (typeof res.summary === "string") {
    return { patientSummary: res.summary };
  }
  const s = (res.summary ?? {}) as Partial<StructuredSummary>;
  return {
    patientSummary:
      s.patientSummary || "Health record summary generated successfully.",
    diagnoses: Array.isArray(s.diagnoses) ? s.diagnoses : [],
    medicines: Array.isArray(s.medicines) ? s.medicines : [],
    history: Array.isArray(s.history) ? s.history : [],
    risks: Array.isArray(s.risks) ? s.risks : [],
    recentTests: Array.isArray(s.recentTests) ? s.recentTests : [],
  };
}

type InteractionResponse = {
  result?: string;
  interactions?: DrugInteractionItem[] | string;
};

export function normalizeInteractions(res: InteractionResponse): {
  items: DrugInteractionItem[];
  message: string | null;
} {
  let items: DrugInteractionItem[] = [];

  if (Array.isArray(res.interactions)) {
    items = res.interactions as DrugInteractionItem[];
  } else if (typeof res.interactions === "string") {
    try {
      const parsed = JSON.parse(res.interactions);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      /* malformed JSON — fall through */
    }
  }

  if (!items.length && typeof res.result === "string") {
    try {
      const parsed = JSON.parse(res.result);
      if (Array.isArray(parsed)) items = parsed;
      else if (parsed && Array.isArray(parsed.interactions)) {
        items = parsed.interactions;
      }
    } catch {
      /* plain text or malformed — fall through */
    }
  }

  if (items.length) return { items, message: null };

  const trimmed = typeof res.result === "string" ? res.result.trim() : "";
  const clean =
    trimmed && !trimmed.startsWith("[") && !trimmed.startsWith("{")
      ? res.result!
      : DEFAULT_CLEAR_MESSAGE;
  return { items: [], message: clean };
}

export function useGenerateSummary() {
  return useMutation({
    mutationFn: async (patientId: string) =>
      normalizeSummary(
        await api<SummaryResponse>("/ai/summary", {
          method: "POST",
          json: { patientId },
        }),
      ),
  });
}

export function useCheckDrugInteractions() {
  return useMutation({
    mutationFn: async (medicines: string[]) =>
      normalizeInteractions(
        await api<InteractionResponse>("/ai/drug-interaction", {
          method: "POST",
          json: { medicines },
        }),
      ),
  });
}
```

- [ ] **Step 4: Wire the barrel and its export test**

In `apps/marketing/src/patient/hooks/index.ts`, append after the last export line:

```ts
export {
  useGenerateSummary,
  useCheckDrugInteractions,
  type StructuredSummary,
  type DrugInteractionItem,
} from "./ai";
```

In `apps/marketing/src/patient/hooks/index.test.ts`, add to the `EXPECTED_HOOK_EXPORTS` array (after `"useBulkMoveRecords",`):

```ts
  // Patient AI (web)
  "useGenerateSummary",
  "useCheckDrugInteractions",
```

- [ ] **Step 5: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/ai.test.ts src/patient/hooks/index.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/hooks/ai.ts apps/marketing/src/patient/hooks/ai.test.ts apps/marketing/src/patient/hooks/index.ts apps/marketing/src/patient/hooks/index.test.ts
git commit -m "feat(patient-ai): add summary and drug-interaction hooks"
```

---

### Task 3: `AiToolCard` + `AiSafetyNotice`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/AiToolCard.tsx`
- Create: `apps/marketing/src/patient/components/ai/AiToolCard.test.tsx`
- Create: `apps/marketing/src/patient/components/ai/AiSafetyNotice.tsx`
- Create: `apps/marketing/src/patient/components/ai/AiSafetyNotice.test.tsx`

**Interfaces:**
- Consumes: `Card` from `@/patient/components/primitives/Card`.
- Produces:
  - `type AiToolAccent = "sky" | "brand" | "emerald" | "amber" | "violet" | "teal"`
  - `AiToolCard({ href, title, description, cta, icon, accent }: { href: string; title: string; description: string; cta: string; icon: React.ReactNode; accent: AiToolAccent })`
  - `AiSafetyNotice({ className }: { className?: string })`

- [ ] **Step 1: Write the failing tests**

`AiToolCard.test.tsx`:

`next/link` is mocked globally in `vitest.setup.ts` (renders an `<a href>`), so use that mock.

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bot } from "lucide-react";

import { AiToolCard } from "./AiToolCard";

describe("AiToolCard", () => {
  it("renders title, description, cta and link target", () => {
    render(
      <AiToolCard
        href="/patient/ai/chat"
        title="Care Chat"
        description="Multi-turn conversation."
        cta="Open chat"
        icon={<Bot size={16} />}
        accent="sky"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/patient/ai/chat",
    );
    expect(screen.getByText("Care Chat")).toBeTruthy();
    expect(screen.getByText("Multi-turn conversation.")).toBeTruthy();
    expect(screen.getByText("Open chat")).toBeTruthy();
  });
});
```

`AiSafetyNotice.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AiSafetyNotice } from "./AiSafetyNotice";

describe("AiSafetyNotice", () => {
  it("states the clinical safety boundary", () => {
    render(<AiSafetyNotice />);
    expect(screen.getByText(/Clinical safety notice/i)).toBeTruthy();
    expect(screen.getByText(/does not replace emergency care/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`AiToolCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { cn } from "@/portal/lib/utils";

export type AiToolAccent =
  | "sky"
  | "brand"
  | "emerald"
  | "amber"
  | "violet"
  | "teal";

const ACCENT: Record<AiToolAccent, string> = {
  sky: "bg-sky-50 text-sky-700",
  brand: "bg-brand-soft text-brand",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
  teal: "bg-teal-50 text-teal-700",
};

export function AiToolCard({
  href,
  title,
  description,
  cta,
  icon,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
  accent: AiToolAccent;
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="flex h-full flex-col transition-transform duration-200 group-hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              ACCENT[accent],
            )}
            aria-hidden
          >
            {icon}
          </span>
          <ArrowRight
            size={14}
            aria-hidden
            className="mt-1 text-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-brand"
          />
        </div>
        <h3 className="mt-3 text-sm font-bold text-text">{title}</h3>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-text-soft">
          {description}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-brand">
          {cta}
        </span>
      </Card>
    </Link>
  );
}
```

`AiSafetyNotice.tsx`:

```tsx
"use client";

import { ShieldCheck } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export function AiSafetyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-border bg-surface-2 p-4",
        className,
      )}
    >
      <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-brand" />
      <p className="text-xs leading-relaxed text-text-soft">
        <strong className="font-bold text-text">Clinical safety notice.</strong>{" "}
        HealthHub AI helps you understand your health information and prepare for
        consultations. It does not replace emergency care or your physician&apos;s
        clinical judgment.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/AiToolCard.tsx apps/marketing/src/patient/components/ai/AiToolCard.test.tsx apps/marketing/src/patient/components/ai/AiSafetyNotice.tsx apps/marketing/src/patient/components/ai/AiSafetyNotice.test.tsx
git commit -m "feat(patient-ai): add AiToolCard and AiSafetyNotice"
```

---

### Task 4: `AiToolHero`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/AiToolHero.tsx`
- Create: `apps/marketing/src/patient/components/ai/AiToolHero.test.tsx`

**Interfaces:**
- Produces: `AiToolHero({ badge, title, description, icon, actions, trust, backHref, backLabel, className }: { badge: string; title: string; description: string; icon?: React.ReactNode; actions?: React.ReactNode; trust?: string[]; backHref?: string; backLabel?: string; className?: string })`
- Reuses the `.dashboard-hero` raw class — it is the single source of the oceanic gradient; **never** add an inline gradient in this component.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlaskConical } from "lucide-react";

import { AiToolHero } from "./AiToolHero";

describe("AiToolHero", () => {
  it("renders badge, title, description, trust items and back link", () => {
    render(
      <AiToolHero
        badge="Pathology"
        title="Explain a lab report"
        description="Plain-language explanations."
        icon={<FlaskConical size={12} />}
        trust={["Plain English", "Non-diagnostic"]}
        actions={<button type="button">Upload</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Explain a lab report",
    );
    expect(screen.getByText("Pathology")).toBeTruthy();
    expect(screen.getByText("Plain English")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to AI tools/i })).toHaveAttribute(
      "href",
      "/patient/ai",
    );
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/AiToolHero.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export function AiToolHero({
  badge,
  title,
  description,
  icon,
  actions,
  trust = [],
  backHref = "/patient/ai",
  backLabel = "Back to AI tools",
  className,
}: {
  badge: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  trust?: string[];
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "dashboard-hero relative overflow-hidden rounded-2xl p-6 text-white shadow-xl md:p-7",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 flex flex-col gap-4">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 text-[11.5px] font-semibold text-sky-100/90 transition-colors hover:text-white"
        >
          <ArrowLeft size={12} aria-hidden />
          {backLabel}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-200 backdrop-blur-md">
              {icon}
              {badge}
            </span>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white md:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {description}
            </p>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              {actions}
            </div>
          ) : null}
        </div>

        {trust.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-3.5">
            {trust.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/90"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/AiToolHero.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/AiToolHero.tsx apps/marketing/src/patient/components/ai/AiToolHero.test.tsx
git commit -m "feat(patient-ai): add AiToolHero"
```

---

### Task 5: `AiCommandBar`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/AiCommandBar.tsx`
- Create: `apps/marketing/src/patient/components/ai/AiCommandBar.test.tsx`

**Interfaces:**
- Produces:
  - `interface AiQuickPrompt { label: string; icon?: React.ReactNode; onSelect: () => void }`
  - `AiCommandBar({ onSubmit, quickPrompts, placeholder, className }: { onSubmit: (prompt: string) => void; quickPrompts: AiQuickPrompt[]; placeholder?: string; className?: string })`
- Behavior: Enter submits; empty submit calls `onSubmit("")`; `⌘K`/`Ctrl+K` focuses the input; quick-prompt chips call `onSelect`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AiCommandBar } from "./AiCommandBar";

describe("AiCommandBar", () => {
  it("submits trimmed text and clears the input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AiCommandBar onSubmit={onSubmit} quickPrompts={[]} />);

    const input = screen.getByLabelText("Ask the AI assistant");
    await user.type(input, "  Explain my labs  ");
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("Explain my labs");
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("submits an empty prompt when the field is blank", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AiCommandBar onSubmit={onSubmit} quickPrompts={[]} />);
    await user.click(screen.getByRole("button", { name: /Ask AI/i }));
    expect(onSubmit).toHaveBeenCalledWith("");
  });

  it("runs quick prompts", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AiCommandBar
        onSubmit={vi.fn()}
        quickPrompts={[{ label: "Summarize my record", onSelect }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Summarize my record" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("focuses the input on Ctrl+K", async () => {
    const user = userEvent.setup();
    render(<AiCommandBar onSubmit={vi.fn()} quickPrompts={[]} />);
    const input = screen.getByLabelText("Ask the AI assistant");
    input.blur();
    await user.keyboard("{Control>}k{/Control}");
    expect(document.activeElement).toBe(input);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/AiCommandBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export interface AiQuickPrompt {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

export function AiCommandBar({
  onSubmit,
  quickPrompts,
  placeholder = "Ask about records, labs, symptoms or prescriptions…",
  className,
}: {
  onSubmit: (prompt: string) => void;
  quickPrompts: AiQuickPrompt[];
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(value.trim());
    setValue("");
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <form
        onSubmit={handleSubmit}
        className="flex items-stretch gap-2 rounded-2xl bg-white p-1.5 shadow-[0_14px_40px_rgba(6,16,28,0.28)]"
      >
        <span
          aria-hidden
          className="grid w-9 shrink-0 place-items-center text-brand"
        >
          <Sparkles size={15} />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask the AI assistant"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-text placeholder:text-text-muted focus:outline-none"
        />
        <span
          aria-hidden
          className="hidden items-center rounded-lg border border-border bg-surface-2 px-1.5 text-[10px] font-bold text-text-muted sm:inline-flex"
        >
          ⌘K
        </span>
        <button
          type="submit"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-bold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-strong"
        >
          Ask AI
          <SendHorizontal size={12} aria-hidden />
        </button>
      </form>

      {quickPrompts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={prompt.onSelect}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {prompt.icon}
              {prompt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/AiCommandBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/AiCommandBar.tsx apps/marketing/src/patient/components/ai/AiCommandBar.test.tsx
git commit -m "feat(patient-ai): add AiCommandBar"
```

---

### Task 6: `HealthSummaryCard`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/HealthSummaryCard.tsx`
- Create: `apps/marketing/src/patient/components/ai/HealthSummaryCard.test.tsx`

**Interfaces:**
- Consumes: `useGenerateSummary` (Task 2), `Card`, `Pill`, `Skeleton`.
- Produces:
  - `interface HealthSummaryHandle { generate: () => void }`
  - `HealthSummaryCard` — a `forwardRef` component with props `{ patientId: string; profileLoading?: boolean }`.
- States: idle (dashed prompt), pending (skeletons), success (summary + chip groups + copy), error (rose alert + retry). Results wrapped in `aria-live="polite"`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mutateAsyncMock } = vi.hoisted(() => ({ mutateAsyncMock: vi.fn() }));

vi.mock("@/patient/hooks", () => ({
  useGenerateSummary: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

import { HealthSummaryCard } from "./HealthSummaryCard";

describe("HealthSummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("starts with the empty prompt", () => {
    render(<HealthSummaryCard patientId="p1" />);
    expect(screen.getByText(/Generate your briefing/i)).toBeTruthy();
  });

  it("renders the structured summary after generating", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValue({
      patientSummary: "Diabetes is stable.",
      diagnoses: ["Type 2 diabetes"],
      risks: ["Family history"],
    });
    render(<HealthSummaryCard patientId="p1" />);
    await user.click(screen.getByRole("button", { name: /Generate summary/i }));
    expect(await screen.findByText("Diabetes is stable.")).toBeTruthy();
    expect(screen.getByText("Type 2 diabetes")).toBeTruthy();
    expect(screen.getByText("Family history")).toBeTruthy();
    expect(mutateAsyncMock).toHaveBeenCalledWith("p1");
  });

  it("shows an inline error with retry", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValue(new Error("Service unavailable"));
    render(<HealthSummaryCard patientId="p1" />);
    await user.click(screen.getByRole("button", { name: /Generate summary/i }));
    expect(await screen.findByText("Service unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();
  });

  it("blocks generation without a patient id", async () => {
    const user = userEvent.setup();
    render(<HealthSummaryCard patientId="" />);
    await user.click(screen.getByRole("button", { name: /Generate summary/i }));
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByText(/profile is still loading/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/HealthSummaryCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { useGenerateSummary, type StructuredSummary } from "@/patient/hooks";

export interface HealthSummaryHandle {
  generate: () => void;
}

function summaryToText(summary: StructuredSummary) {
  return [
    summary.patientSummary,
    summary.diagnoses?.length ? `Diagnoses: ${summary.diagnoses.join(", ")}` : "",
    summary.medicines?.length ? `Medications: ${summary.medicines.join(", ")}` : "",
    summary.risks?.length ? `Risks: ${summary.risks.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const HealthSummaryCard = forwardRef<
  HealthSummaryHandle,
  { patientId: string; profileLoading?: boolean }
>(function HealthSummaryCard({ patientId, profileLoading = false }, ref) {
  const generateSummary = useGenerateSummary();
  const [summary, setSummary] = useState<StructuredSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (profileLoading) return;
    if (!patientId) {
      setError("Your health profile is still loading or unavailable. Refresh and try again.");
      return;
    }
    setError(null);
    try {
      setSummary(await generateSummary.mutateAsync(patientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate health summary.");
    }
  }

  useImperativeHandle(ref, () => ({ generate: () => void run() }));

  async function copySummary() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summaryToText(summary));
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card accent="brand" className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"
        >
          <FileText size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="t-card-title text-text">Health record summary</h2>
            <Pill tone="brand">EMR</Pill>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-text-soft">
            AI synthesizes visits, conditions and trends into plain language you
            can read in 30 seconds.
          </p>
        </div>
      </div>

      <div
        className="mt-4 flex-1"
        aria-live="polite"
        aria-busy={generateSummary.isPending}
      >
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs font-medium text-danger"
          >
            <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void run()}
                className="mt-2 rounded-pill border border-danger/30 bg-white px-2.5 py-1 text-[11px] font-bold text-danger hover:bg-danger-soft"
              >
                Retry
              </button>
            </div>
          </div>
        ) : generateSummary.isPending ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-9/12" />
            <Skeleton className="h-4 w-7/12" />
          </div>
        ) : summary ? (
          <div className="relative rounded-xl border border-border bg-surface-2 p-3.5">
            <button
              type="button"
              onClick={() => void copySummary()}
              aria-label="Copy summary"
              className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border bg-white text-text-muted transition-colors hover:text-text"
            >
              {copied ? (
                <Check size={12} aria-hidden className="text-success" />
              ) : (
                <Copy size={12} aria-hidden />
              )}
            </button>
            <p className="pr-7 text-xs leading-relaxed text-text">
              {summary.patientSummary}
            </p>
            {summary.diagnoses?.length ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="t-label">Diagnoses</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.diagnoses.map((d) => (
                    <Pill key={d} tone="brand">
                      {d}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}
            {summary.risks?.length ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="t-label">Risk factors</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.risks.map((r) => (
                    <Pill key={r} tone="warn">
                      {r}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/60 p-6 text-center">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white text-brand">
              <Sparkles size={16} aria-hidden />
            </span>
            <p className="mt-2.5 text-xs font-bold text-text">
              Generate your briefing
            </p>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-text-soft">
              A comprehensive briefing from your electronic health record, in
              seconds.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
          <ShieldCheck size={12} aria-hidden className="text-success" />
          Grounded in your EMR
        </span>
        <button
          type="button"
          onClick={() => void run()}
          disabled={generateSummary.isPending || profileLoading}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand px-3.5 text-xs font-bold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-muted disabled:shadow-none"
        >
          {generateSummary.isPending ? (
            <>
              <Loader2 size={13} aria-hidden className="animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles size={13} aria-hidden />
              {summary ? "Regenerate" : "Generate summary"}
            </>
          )}
        </button>
      </div>
    </Card>
  );
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/HealthSummaryCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/HealthSummaryCard.tsx apps/marketing/src/patient/components/ai/HealthSummaryCard.test.tsx
git commit -m "feat(patient-ai): add HealthSummaryCard"
```

---

### Task 7: `DrugInteractionCard`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/DrugInteractionCard.tsx`
- Create: `apps/marketing/src/patient/components/ai/DrugInteractionCard.test.tsx`

**Interfaces:**
- Consumes: `useCheckDrugInteractions`, `Card`, `Pill`.
- Produces:
  - `interface DrugInteractionHandle { checkAll: () => void }`
  - `DrugInteractionCard` — `forwardRef` with props `{ activeMedNames: string[] }`.
- Severity mapping: `severe|high|major` → danger (rose), `moderate|medium` → warn (amber), anything else → brand (blue).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";

const { mutateAsyncMock } = vi.hoisted(() => ({ mutateAsyncMock: vi.fn() }));

vi.mock("@/patient/hooks", () => ({
  useCheckDrugInteractions: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

import {
  DrugInteractionCard,
  type DrugInteractionHandle,
} from "./DrugInteractionCard";

describe("DrugInteractionCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists active medications and checks all of them via the ref handle", async () => {
    mutateAsyncMock.mockResolvedValue({ items: [], message: null });
    const ref = createRef<DrugInteractionHandle>();
    render(<DrugInteractionCard ref={ref} activeMedNames={["Metformin", "Atorvastatin"]} />);

    expect(screen.getByText("Metformin")).toBeTruthy();
    ref.current?.checkAll();
    expect(mutateAsyncMock).toHaveBeenCalledWith(["Metformin", "Atorvastatin"]);
  });

  it("maps severity to the right accessible result", async () => {
    mutateAsyncMock.mockResolvedValue({
      items: [
        {
          medicines: ["Warfarin", "Aspirin"],
          severity: "severe",
          note: "Increased bleeding risk",
          recommendation: "Contact your doctor before combining.",
        },
      ],
      message: null,
    });
    const user = userEvent.setup();
    render(<DrugInteractionCard activeMedNames={[]} />);
    await user.type(screen.getByLabelText("Medications"), "Warfarin, Aspirin");
    await user.click(screen.getByRole("button", { name: /Check interactions/i }));

    expect(await screen.findByText("Increased bleeding risk")).toBeTruthy();
    expect(screen.getByText("severe")).toBeTruthy();
    expect(screen.getByText("Contact your doctor before combining.")).toBeTruthy();
  });

  it("shows the clear state when no interactions are found", async () => {
    mutateAsyncMock.mockResolvedValue({
      items: [],
      message: "No interactions found.",
    });
    const user = userEvent.setup();
    render(<DrugInteractionCard activeMedNames={[]} />);
    await user.type(screen.getByLabelText("Medications"), "Paracetamol");
    await user.click(screen.getByRole("button", { name: /Check interactions/i }));
    expect(await screen.findByText(/No adverse interactions detected/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/DrugInteractionCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { AlertCircle, Loader2, Pill as PillIcon, ShieldCheck, Zap } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { useCheckDrugInteractions, type DrugInteractionItem } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

export interface DrugInteractionHandle {
  checkAll: () => void;
}

type Tone = "danger" | "warn" | "brand";

function severityTone(severity: string): Tone {
  const s = (severity || "moderate").toLowerCase();
  if (s === "severe" || s === "high" || s === "major") return "danger";
  if (s === "moderate" || s === "medium") return "warn";
  return "brand";
}

const TONE_STYLES: Record<
  Tone,
  { card: string; pill: string; dot: string; label: string }
> = {
  danger: {
    card: "border-danger/30 bg-danger-soft/60",
    pill: "bg-danger-soft text-danger",
    dot: "bg-danger",
    label: "text-danger",
  },
  warn: {
    card: "border-warn/30 bg-warn-soft/60",
    pill: "bg-warn-soft text-warn",
    dot: "bg-warn",
    label: "text-warn",
  },
  brand: {
    card: "border-brand/30 bg-brand-soft/60",
    pill: "bg-brand-soft text-brand",
    dot: "bg-brand",
    label: "text-brand",
  },
};

export const DrugInteractionCard = forwardRef<
  DrugInteractionHandle,
  { activeMedNames: string[] }
>(function DrugInteractionCard({ activeMedNames }, ref) {
  const check = useCheckDrugInteractions();
  const [medicines, setMedicines] = useState("");
  const [result, setResult] = useState<{
    items: DrugInteractionItem[];
    message: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(names?: string) {
    const raw = names ?? medicines;
    const list = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!list.length) {
      setError("Enter at least one medication name to check.");
      return;
    }
    setError(null);
    setResult(null);
    try {
      setResult(await check.mutateAsync(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Interaction check failed.");
    }
  }

  function checkAll() {
    if (!activeMedNames.length) {
      setError("No active medications on file. Add meds or type names manually.");
      return;
    }
    const joined = activeMedNames.join(", ");
    setMedicines(joined);
    void run(joined);
  }

  useImperativeHandle(ref, () => ({ checkAll }));

  return (
    <Card accent="amber" className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn"
        >
          <PillIcon size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="t-card-title text-text">Medication safety</h2>
            <Pill tone="warn">Rx</Pill>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-text-soft">
            Cross-check drug interactions and contraindications against a
            verified pharmacopeia.
          </p>
        </div>
      </div>

      {activeMedNames.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-border bg-surface-2/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="t-label">
              Active Rx ({activeMedNames.length})
            </span>
            <button
              type="button"
              onClick={checkAll}
              className="inline-flex items-center gap-1 rounded-pill border border-brand/30 bg-brand-soft px-2 py-1 text-[11px] font-bold text-brand transition-colors hover:bg-brand/15"
            >
              <Zap size={11} aria-hidden />
              Check all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeMedNames.map((name) => (
              <Pill key={name} tone="neutral" className="normal-case">
                {name}
              </Pill>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs text-text-soft">
          No active medications on file — type names below to check.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="drug-check-input" className="t-label">
          Medications
        </label>
        <input
          id="drug-check-input"
          type="text"
          value={medicines}
          onChange={(e) => setMedicines(e.target.value)}
          placeholder="Paracetamol, Metformin, Atorvastatin…"
          className="h-10 w-full rounded-xl border border-border bg-white px-3 text-[13px] font-medium text-text placeholder:text-text-muted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>

      <div className="mt-4 flex-1" aria-live="polite" aria-busy={check.isPending}>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs font-medium text-danger"
          >
            <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : check.isPending ? (
          <div className="flex flex-col gap-2">
            <div className="patient-shimmer h-16 rounded-xl" aria-hidden />
            <div className="patient-shimmer h-16 rounded-xl" aria-hidden />
          </div>
        ) : result?.items.length ? (
          <div className="flex flex-col gap-2">
            <span className="t-label">
              {result.items.length}{" "}
              {result.items.length === 1
                ? "interaction detected"
                : "interactions detected"}
            </span>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {result.items.map((item, idx) => {
                const tone = severityTone(item.severity);
                const styles = TONE_STYLES[tone];
                return (
                  <div
                    key={idx}
                    className={cn("flex flex-col gap-2 rounded-xl border p-3", styles.card)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {item.medicines?.map((med, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-text">
                              {med}
                            </span>
                            {i < item.medicines.length - 1 ? (
                              <span aria-hidden className="text-[11px] font-bold text-text-muted">
                                +
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider",
                          styles.pill,
                        )}
                      >
                        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
                        {item.severity}
                      </span>
                    </div>
                    {item.note ? (
                      <p className="text-xs leading-relaxed text-text">{item.note}</p>
                    ) : null}
                    {item.recommendation ? (
                      <div className="border-t border-border/60 pt-1.5 text-[11.5px] text-text-soft">
                        <span className="font-bold text-text">Guidance · </span>
                        {item.recommendation}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : result ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft/70 p-3.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
              <ShieldCheck size={14} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-text">
                No adverse interactions detected
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-text-soft">
                {result.message}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[11.5px] text-text-muted">
            Results appear here after a check. This is decision support, not a
            prescription.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
          <ShieldCheck size={12} aria-hidden className="text-success" />
          Pharmacopeia verified
        </span>
        <button
          type="button"
          onClick={() => void run()}
          disabled={!medicines.trim() || check.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-warn px-3.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(224,138,0,0.28)] transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-muted disabled:shadow-none"
        >
          {check.isPending ? (
            <>
              <Loader2 size={13} aria-hidden className="animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <ShieldCheck size={13} aria-hidden />
              Check interactions
            </>
          )}
        </button>
      </div>
    </Card>
  );
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/DrugInteractionCard.test.tsx`
Expected: PASS. (The clear-state test asserts `/No adverse interactions detected/i`, which matches the fixed heading — the server message renders below it.)

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/DrugInteractionCard.tsx apps/marketing/src/patient/components/ai/DrugInteractionCard.test.tsx
git commit -m "feat(patient-ai): add DrugInteractionCard"
```

---

### Task 8: Rebuild the hub page + Topbar subtitle

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/ai/page.tsx` (full rewrite, ~170 lines)
- Modify: `apps/marketing/src/patient/components/shell/Topbar.tsx:37`
- Test: `apps/marketing/src/app/patient/(app)/ai/page.test.tsx` (new)
- Delete after rewrite: none (helpers moved to Task 2 hooks)

**Interfaces:**
- Consumes: `usePatientProfile`, `useMedications` (existing), `AiCommandBar` (Task 5), `HealthSummaryCard` + `HealthSummaryHandle` (Task 6), `DrugInteractionCard` + `DrugInteractionHandle` (Task 7), `AiToolCard` (Task 3), `AiSafetyNotice` (Task 3).
- Produces: `/patient/ai` renders hero + command bar + both cards + all six tool links + safety notice.

- [ ] **Step 1: Write the failing page test**

Create `apps/marketing/src/app/patient/(app)/ai/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock, generateMock, checkMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  generateMock: vi.fn(),
  checkMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/patient/hooks", () => ({
  usePatientProfile: () => ({
    data: { patient: { patients: { id: "p1" }, users: { name: "Anya Perera" } } },
    isLoading: false,
  }),
  useMedications: () => ({
    data: { medicines: [{ name: "Metformin" }, { name: "Atorvastatin" }] },
    isLoading: false,
  }),
  useGenerateSummary: () => ({ mutateAsync: generateMock, isPending: false }),
  useCheckDrugInteractions: () => ({ mutateAsync: checkMock, isPending: false }),
}));

import AiToolsPage from "./page";

describe("AiToolsPage", () => {
  it("renders the hero, both primary cards and all six tools", () => {
    render(<AiToolsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /AI health assistant/i }),
    ).toBeTruthy();
    expect(screen.getByText("Health record summary")).toBeTruthy();
    expect(screen.getByText("Medication safety")).toBeTruthy();
    for (const name of [
      "Care Chat",
      "Lab Interpreter",
      "Document OCR",
      "Health Trends",
      "Clinical Note",
      "Vaccination Card",
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByText(/Clinical safety notice/i)).toBeTruthy();
  });

  it("routes command bar submissions to chat with the prompt", async () => {
    const user = userEvent.setup();
    render(<AiToolsPage />);
    await user.type(screen.getByLabelText("Ask the AI assistant"), "Why am I tired?");
    await user.click(screen.getByRole("button", { name: /Ask AI/i }));
    expect(pushMock).toHaveBeenCalledWith(
      "/patient/ai/chat?prompt=" + encodeURIComponent("Why am I tired?"),
    );
  });

  it("links every tool to its route", () => {
    render(<AiToolsPage />);
    for (const href of [
      "/patient/ai/chat",
      "/patient/ai/lab-explain",
      "/patient/ai/ocr",
      "/patient/ai/lab-trend",
      "/patient/ai/clinical-note",
      "/patient/ai/vaccination-card",
    ]) {
      expect(
        screen.getAllByRole("link").some((a) => a.getAttribute("href") === href),
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/ai/page.test.tsx"`
Expected: FAIL — current page does not render six tool links (only four) and heading copy differs.

- [ ] **Step 3: Rewrite the page**

Replace the entire contents of `apps/marketing/src/app/patient/(app)/ai/page.tsx` with:

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  FileText,
  FlaskConical,
  Lock,
  Pill,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  TrendingUp,
  UserCheck,
} from "lucide-react";

import { useMedications, usePatientProfile } from "@/patient/hooks";
import { AiCommandBar } from "@/patient/components/ai/AiCommandBar";
import { AiSafetyNotice } from "@/patient/components/ai/AiSafetyNotice";
import {
  AiToolCard,
  type AiToolAccent,
} from "@/patient/components/ai/AiToolCard";
import {
  DrugInteractionCard,
  type DrugInteractionHandle,
} from "@/patient/components/ai/DrugInteractionCard";
import {
  HealthSummaryCard,
  type HealthSummaryHandle,
} from "@/patient/components/ai/HealthSummaryCard";

const TOOLS: {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
  accent: AiToolAccent;
}[] = [
  {
    href: "/patient/ai/chat",
    title: "Care Chat",
    description: "Multi-turn conversation about symptoms, meds and care plans.",
    cta: "Open chat",
    icon: <Bot size={18} />,
    accent: "sky",
  },
  {
    href: "/patient/ai/lab-explain",
    title: "Lab Interpreter",
    description: "Plain-language explanations for your lab markers and ranges.",
    cta: "Explain labs",
    icon: <FlaskConical size={18} />,
    accent: "brand",
  },
  {
    href: "/patient/ai/ocr",
    title: "Document OCR",
    description: "Scan prescriptions and discharge notes into your record.",
    cta: "Scan paper",
    icon: <ScanLine size={18} />,
    accent: "emerald",
  },
  {
    href: "/patient/ai/lab-trend",
    title: "Health Trends",
    description: "Track HbA1c, blood pressure and vitals over time.",
    cta: "View trends",
    icon: <TrendingUp size={18} />,
    accent: "amber",
  },
  {
    href: "/patient/ai/clinical-note",
    title: "Clinical Note",
    description: "Turn a long visit note into a structured SOAP summary.",
    cta: "Summarize note",
    icon: <FileText size={18} />,
    accent: "violet",
  },
  {
    href: "/patient/ai/vaccination-card",
    title: "Vaccination Card",
    description: "Scan a paper vaccination card into your immunization record.",
    cta: "Scan card",
    icon: <Syringe size={18} />,
    accent: "teal",
  },
];

const TRUST = [
  { icon: Activity, label: "EMR grounded" },
  { icon: ShieldCheck, label: "Pharmacopeia checked" },
  { icon: Lock, label: "Private by design" },
  { icon: UserCheck, label: "Human review" },
];

export default function AiToolsPage() {
  const router = useRouter();
  const profile = usePatientProfile();
  const meds = useMedications();
  const patientId = profile.data?.patient.patients.id ?? "";

  const summaryRef = useRef<HealthSummaryHandle>(null);
  const drugRef = useRef<DrugInteractionHandle>(null);
  const drugSectionRef = useRef<HTMLDivElement>(null);

  const activeMedNames = useMemo(
    () => (meds.data?.medicines ?? []).map((m) => m.name),
    [meds.data?.medicines],
  );

  function goToChat(prompt: string) {
    if (!prompt) {
      router.push("/patient/ai/chat");
      return;
    }
    router.push(`/patient/ai/chat?prompt=${encodeURIComponent(prompt)}`);
  }

  function runQuickPrompt(action: "summary" | "lab" | "meds" | "chat") {
    switch (action) {
      case "summary":
        summaryRef.current?.generate();
        break;
      case "lab":
        router.push(
          `/patient/ai/lab-explain?prompt=${encodeURIComponent(
            "Explain my most recent lab report in plain English.",
          )}`,
        );
        break;
      case "meds":
        drugSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        drugRef.current?.checkAll();
        break;
      case "chat":
        router.push(
          `/patient/ai/chat?prompt=${encodeURIComponent(
            "What are the most important questions I should ask my doctor at my next visit?",
          )}`,
        );
        break;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-1 pb-6 pt-1 sm:gap-6 sm:px-2">
      {/* Hero + command center */}
      <section className="dashboard-hero relative overflow-hidden rounded-2xl p-6 text-white shadow-xl md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-200 backdrop-blur-md">
            <Sparkles size={11} aria-hidden />
            Clinical intelligence
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              AI health assistant
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
              Summaries, medication safety checks and lab explanations grounded
              in your health record — private by design and never a replacement
              for your physician.
            </p>
          </div>

          <AiCommandBar
            className="max-w-3xl"
            onSubmit={goToChat}
            quickPrompts={[
              {
                label: "Summarize my record",
                icon: <FileText size={12} aria-hidden />,
                onSelect: () => runQuickPrompt("summary"),
              },
              {
                label: "Explain my lab results",
                icon: <FlaskConical size={12} aria-hidden />,
                onSelect: () => runQuickPrompt("lab"),
              },
              {
                label: "Check my medications",
                icon: <Pill size={12} aria-hidden />,
                onSelect: () => runQuickPrompt("meds"),
              },
              {
                label: "Prepare for my visit",
                icon: <Stethoscope size={12} aria-hidden />,
                onSelect: () => runQuickPrompt("chat"),
              },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-3.5">
            {TRUST.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/90"
              >
                <Icon size={12} aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Primary tools */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <HealthSummaryCard
          ref={summaryRef}
          patientId={patientId}
          profileLoading={profile.isLoading}
        />
        <div ref={drugSectionRef} className="h-full scroll-mt-24">
          <DrugInteractionCard ref={drugRef} activeMedNames={activeMedNames} />
        </div>
      </div>

      {/* Tool directory */}
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <h2 className="t-card-title text-text">Specialized AI tools</h2>
            <p className="mt-0.5 text-xs text-text-soft">
              Six dedicated assistants for labs, documents and trends
            </p>
          </div>
          <span className="text-[11px] font-bold text-text-muted">
            {TOOLS.length} tools
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <AiToolCard key={tool.href} {...tool} />
          ))}
        </div>
      </section>

      <AiSafetyNotice />
    </div>
  );
}
```

- [ ] **Step 4: Update the Topbar subtitle**

In `apps/marketing/src/patient/components/shell/Topbar.tsx:37`, change:

```tsx
  { match: "/patient/ai", title: "AI Assistant", subtitle: "Ask with context" },
```

to:

```tsx
  { match: "/patient/ai", title: "AI Assistant", subtitle: "Grounded in your record" },
```

- [ ] **Step 5: Run the page test + surrounding suites**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/ai/page.test.tsx" src/patient/components/shell/Sidebar.test.tsx src/patient/parity.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/ai/page.tsx" "apps/marketing/src/app/patient/(app)/ai/page.test.tsx" apps/marketing/src/patient/components/shell/Topbar.tsx
git commit -m "feat(patient-ai): rebuild hub as portal-native command center"
```

---

### Task 9: Verification sweep for Plan A

**Files:**
- No source changes expected.

- [ ] **Step 1: Full marketing test suite**

Run: `bun run --filter @healthcare/marketing test`
Expected: all suites pass, including `src/patient/parity.test.ts`.

- [ ] **Step 2: Lint + types**

Run: `bun run --filter @healthcare/marketing lint`
Run: `cd apps/marketing && bunx tsc --noEmit`
Expected: no errors. If `tsc` reports pre-existing errors in files untouched by this plan, record them and confirm the same errors exist on `git stash` of Plan A changes before treating them as blockers.

- [ ] **Step 3: Visual QA with the dev server**

Run: `bun run --filter @healthcare/marketing dev`, then check:
- `/patient/ai`: hero + command bar; ⌘K focuses the ask bar; all four quick prompts behave (summary generates, lab routes, meds scrolls+checks, visit routes to chat); all six tools link; summary/drug cards show idle/loading/success/error states.
- `/patient` (dashboard), `/patient/trends`, `/patient/records`, `/patient/medications`: confirm the `@theme` change improved (not broke) previously-dead utilities — brand buttons/icons should now be colored, cards unchanged in shape. Report regressions before finishing.

- [ ] **Step 4: Final commit (if any QA fixes were needed)**

Stage only the files you actually changed for QA fixes, for example:

```bash
git add apps/marketing/src/patient/components/ai/<changed-file>.tsx
git commit -m "fix(patient-ai): hub QA polish"
```

---

## Plan A Done Criteria

- `globals.test.ts` proves token utilities compile; portal-wide QA shows no regressions.
- `/patient/ai` is a ~170-line composition over `src/patient/components/ai/*`; all six tools are reachable; summary and drug-check flows work end-to-end with proper loading/error/empty states.
- `hooks/ai.ts` owns response parsing; `hooks/index.test.ts` still passes.
- Full vitest suite, lint, and tsc pass.

## Follow-up Plans (not covered here)

- **Plan B — Chat studio:** extract `ChatShellHeader`, `ChatEmptyState`, `ChatMessageRow`, `ChatComposer`; rewire `chat/page.tsx`; restyle to tokens; tests.
- **Plan C — Siblings + closeout:** `AiEmptyDropzone`; rework `lab-explain` (consume `?prompt=`), `lab-trend`, `ocr`, `clinical-note`, `vaccination-card` onto `AiToolHero` + primitives; final full-family QA.
