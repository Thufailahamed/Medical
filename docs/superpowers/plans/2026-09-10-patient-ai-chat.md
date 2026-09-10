# Patient AI Redesign — Plan B: Chat Studio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/patient/ai/chat` as a premium full-bleed studio by extracting four focused components (`ChatShellHeader`, `ChatEmptyState`, `ChatMessageRow`, `ChatComposer`) and rewiring the page onto them — behavior unchanged.

**Architecture:** The 921-line page keeps its state/effects/API logic but delegates all rendering to components under `src/patient/components/ai/`. All visuals move to portal tokens (header, bubbles, actions, composer). The route stays full-bleed (`PatientShell` already special-cases `/patient/ai/chat`).

**Tech Stack:** Next.js 16.2.10 (modified — read `apps/marketing/node_modules/next/dist/docs/` before writing code), React 19.2.4, TanStack Query 5, Tailwind v4 `@theme` tokens (Plan A), lucide-react, Vitest 4 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-10-patient-ai-redesign-design.md` §4
**Depends on:** Plan A committed (`AiCommandBar`, tokens, hooks).

## Global Constraints

- Behavior frozen: `POST /ai/chat` with `{ message, model, useEhr, patientId?, sessionId? }`, response `{ reply?, message?.body, sessionId? }`; local `sessionId`; `?prompt=` auto-send once; non-streaming. No new endpoints, no persistence, no i18n.
- Full-bleed must remain: do not edit `PatientShell.tsx`'s `fullBleed` logic.
- Remove non-functional affordances (attach, mic) from the composer; keep the functional EHR toggle.
- Tokens/utilities: use `bg-brand`, `text-text`, `text-text-soft`, `text-text-muted`, `border-border`, `bg-surface-2`, `rounded-pill`, `shadow-[var(--shadow-*)].` No slate/sky hardcoding except the brand-gradient avatar (`#0284c7 → #38bdf8`), which matches the sidebar.
- Tests: Vitest colocated; mock `@/portal/lib/api` and `@/patient/hooks`; no snapshots.
- Repo has unrelated uncommitted changes. Commit steps `git add` only the files listed — never `git add -A`.
- Run `bunx tsc --noEmit` from `apps/marketing` after each task; pre-existing errors outside `src/patient/components/ai`, `src/app/patient/(app)/ai` are not blockers.

---

### Task 1: `ChatShellHeader`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/ChatShellHeader.tsx`
- Create: `apps/marketing/src/patient/components/ai/ChatShellHeader.test.tsx`

**Interfaces:**
- Produces:
  - `const CHAT_MODELS: readonly { id: "wellness-72" | "wellness-pro" | "wellness-fast"; name: string; blurb: string; icon: LucideIcon }[]`
  - `type ChatModelId = (typeof CHAT_MODELS)[number]["id"]`
  - `ChatShellHeader({ modelId, onModelChange, onNewChat, hasMessages }: { modelId: ChatModelId; onModelChange: (id: ChatModelId) => void; onNewChat: () => void; hasMessages: boolean })`
- Owns the model dropdown (open state + outside-click close), migrated from the page.

- [ ] **Step 1: Write the failing tests**

Create `apps/marketing/src/patient/components/ai/ChatShellHeader.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatShellHeader } from "./ChatShellHeader";

describe("ChatShellHeader", () => {
  it("changes the model through the dropdown", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    render(
      <ChatShellHeader
        modelId="wellness-72"
        onModelChange={onModelChange}
        onNewChat={vi.fn()}
        hasMessages={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Wellness 72/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /Wellness Pro/i }));
    expect(onModelChange).toHaveBeenCalledWith("wellness-pro");
  });

  it("shows New chat only when a conversation exists", async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();
    const { rerender } = render(
      <ChatShellHeader
        modelId="wellness-72"
        onModelChange={vi.fn()}
        onNewChat={onNewChat}
        hasMessages={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /New chat/i })).toBeNull();
    rerender(
      <ChatShellHeader
        modelId="wellness-72"
        onModelChange={vi.fn()}
        onNewChat={onNewChat}
        hasMessages
      />,
    );
    await user.click(screen.getByRole("button", { name: /New chat/i }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("links back to the workspace and to the lab explainer", () => {
    render(
      <ChatShellHeader
        modelId="wellness-72"
        onModelChange={vi.fn()}
        onNewChat={vi.fn()}
        hasMessages={false}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Back to AI workspace/i }),
    ).toHaveAttribute("href", "/patient/ai");
    expect(screen.getByRole("link", { name: /Lab explainer/i })).toHaveAttribute(
      "href",
      "/patient/ai/lab-explain",
    );
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/ChatShellHeader.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  FlaskConical,
  Globe,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { cn } from "@/portal/lib/utils";

export const CHAT_MODELS = [
  {
    id: "wellness-72",
    name: "Wellness 72",
    blurb: "Best for everyday clinical questions",
    icon: Sparkles,
  },
  {
    id: "wellness-pro",
    name: "Wellness Pro",
    blurb: "Deeper reasoning, lab interpretation",
    icon: FlaskConical,
  },
  {
    id: "wellness-fast",
    name: "Wellness Fast",
    blurb: "Quick, concise answers",
    icon: Globe,
  },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];

export function ChatShellHeader({
  modelId,
  onModelChange,
  onNewChat,
  hasMessages,
}: {
  modelId: ChatModelId;
  onModelChange: (id: ChatModelId) => void;
  onNewChat: () => void;
  hasMessages: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const modelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (modelBtnRef.current?.contains(target)) return;
      if (document.getElementById("model-menu")?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const activeModel =
    CHAT_MODELS.find((m) => m.id === modelId) ?? CHAT_MODELS[0];
  const ActiveIcon = activeModel.icon;

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-white/95 px-3 backdrop-blur-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/patient/ai"
          aria-label="Back to AI workspace"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-text-soft transition-colors hover:bg-surface-2 hover:text-text"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>

        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #0284c7, #38bdf8)" }}
        >
          <Sparkles size={14} />
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className="truncate text-[13px] font-bold text-text">Care Chat</p>
          <p className="truncate text-[10.5px] text-text-muted">
            Grounded in your EMR
          </p>
        </div>

        <button
          ref={modelBtnRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={cn(
            "ml-1 inline-flex h-8 items-center gap-1.5 rounded-pill border px-2.5 text-[12px] font-semibold transition-colors",
            menuOpen
              ? "border-brand/40 bg-brand-soft text-brand"
              : "border-border text-text-soft hover:bg-surface-2",
          )}
        >
          <ActiveIcon size={13} aria-hidden />
          <span className="hidden sm:inline">{activeModel.name}</span>
          <ChevronDown
            size={12}
            aria-hidden
            className={cn("transition-transform", menuOpen && "rotate-180")}
          />
        </button>

        {menuOpen ? (
          <div
            id="model-menu"
            role="menu"
            className="absolute left-12 top-[52px] z-30 w-72 rounded-2xl border border-border bg-white p-1.5 shadow-[var(--shadow-float)]"
          >
            {CHAT_MODELS.map((m) => {
              const Icon = m.icon;
              const isActive = m.id === modelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onModelChange(m.id);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                    isActive ? "bg-brand-soft" : "hover:bg-surface-2",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                      isActive
                        ? "border-brand/30 bg-white text-brand"
                        : "border-border bg-surface-2 text-text-soft",
                    )}
                  >
                    <Icon size={14} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-text">
                        {m.name}
                      </span>
                      {isActive ? (
                        <Check
                          size={14}
                          aria-hidden
                          className="shrink-0 text-brand"
                        />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">
                      {m.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {hasMessages ? (
          <button
            type="button"
            onClick={onNewChat}
            title="Start a new conversation"
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-medium text-text-soft transition-colors hover:bg-surface-2 hover:text-text"
          >
            <RotateCcw size={13} aria-hidden />
            <span className="hidden sm:inline">New chat</span>
          </button>
        ) : null}
        <Link
          href="/patient/ai/lab-explain"
          className="hidden h-8 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-medium text-text-soft transition-colors hover:bg-surface-2 hover:text-text sm:inline-flex"
        >
          <FlaskConical size={13} aria-hidden />
          <span>Lab explainer</span>
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/ChatShellHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/ChatShellHeader.tsx apps/marketing/src/patient/components/ai/ChatShellHeader.test.tsx
git commit -m "feat(patient-ai): add ChatShellHeader"
```

---

### Task 2: `ChatEmptyState`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/ChatEmptyState.tsx`
- Create: `apps/marketing/src/patient/components/ai/ChatEmptyState.test.tsx`

**Interfaces:**
- Produces: `ChatEmptyState({ firstName, disabled, onPrompt }: { firstName: string; disabled?: boolean; onPrompt: (query: string) => void })`
- Owns the four starter prompts (moved verbatim from the page).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatEmptyState } from "./ChatEmptyState";

describe("ChatEmptyState", () => {
  it("greets the patient and sends a starter prompt", async () => {
    const user = userEvent.setup();
    const onPrompt = vi.fn();
    render(<ChatEmptyState firstName="Anya" onPrompt={onPrompt} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Anya");
    await user.click(screen.getByRole("button", { name: /Medication safety/i }));
    expect(onPrompt).toHaveBeenCalledTimes(1);
    expect(onPrompt.mock.calls[0][0]).toMatch(/active medications/i);
  });

  it("disables starter prompts while busy", () => {
    render(<ChatEmptyState firstName="Anya" onPrompt={vi.fn()} disabled />);
    for (const name of [/Medication safety/i, /Explain my labs/i, /Prepare for my visit/i, /Vitals & trends/i]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/ChatEmptyState.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { FlaskConical, HeartPulse, Pill, Sparkles, Stethoscope } from "lucide-react";

const STARTER_PROMPTS = [
  {
    title: "Medication safety",
    icon: Pill,
    query:
      "Are my current active medications safe to take together? Are there any food or timing interactions I should avoid?",
  },
  {
    title: "Explain my labs",
    icon: FlaskConical,
    query:
      "Explain my recent lab test results in simple, plain English without confusing medical jargon.",
  },
  {
    title: "Prepare for my visit",
    icon: Stethoscope,
    query:
      "What are the most important clinical questions I should ask my doctor at my upcoming consultation?",
  },
  {
    title: "Vitals & trends",
    icon: HeartPulse,
    query:
      "How do my recorded heart rate and blood pressure trends compare to healthy clinical target reference ranges?",
  },
] as const;

export function ChatEmptyState({
  firstName,
  disabled = false,
  onPrompt,
}: {
  firstName: string;
  disabled?: boolean;
  onPrompt: (query: string) => void;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl text-center">
        <span
          aria-hidden
          className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl text-white shadow-[var(--shadow-brand)]"
          style={{ background: "linear-gradient(135deg, #0284c7, #38bdf8)" }}
        >
          <Sparkles size={22} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          How can I help with your health today,{" "}
          <span className="text-brand">{firstName}</span>?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-soft">
          Ask about prescriptions, lab results, or what to bring up at your next
          visit. Answers are grounded in your records when EHR sync is on.
        </p>

        <div className="mt-7 grid w-full grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
          {STARTER_PROMPTS.map((prompt) => {
            const Icon = prompt.icon;
            return (
              <button
                key={prompt.title}
                type="button"
                disabled={disabled}
                onClick={() => onPrompt(prompt.query)}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-white px-3.5 py-3 text-left transition-all hover:border-brand/40 hover:bg-brand-soft/30 hover:shadow-[var(--shadow-card)] disabled:opacity-60"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <Icon size={15} aria-hidden />
                </span>
                <span className="text-[13px] font-semibold text-text">
                  {prompt.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/ChatEmptyState.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/ChatEmptyState.tsx apps/marketing/src/patient/components/ai/ChatEmptyState.test.tsx
git commit -m "feat(patient-ai): add ChatEmptyState"
```

---

### Task 3: `ChatMessageRow`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/ChatMessageRow.tsx`
- Create: `apps/marketing/src/patient/components/ai/ChatMessageRow.test.tsx`

**Interfaces:**
- Produces:
  - `interface ChatMessage { id: string; role: "user" | "assistant"; body: string; createdAt: string }`
  - `ChatMessageRow({ message, isLastAssistant, busy, copied, editing, rating, onCopy, onEdit, onSaveEdit, onCancelEdit, onReadAloud, onRate, onRegenerate })`
- Internal (not exported): `EditUserBubble`, `FormattedMessage`, `InlineFormat` — moved verbatim from the page, restyled to tokens.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatMessageRow, type ChatMessage } from "./ChatMessageRow";

const userMessage: ChatMessage = {
  id: "u1",
  role: "user",
  body: "Why is my blood pressure high?",
  createdAt: "2026-09-10T10:00:00.000Z",
};

const assistantMessage: ChatMessage = {
  id: "a1",
  role: "assistant",
  body: "Morning pressure **rises naturally** at waking.",
  createdAt: "2026-09-10T10:00:05.000Z",
};

function rowProps(message: ChatMessage) {
  return {
    message,
    isLastAssistant: message.role === "assistant",
    busy: false,
    copied: false,
    editing: false,
    onCopy: vi.fn(),
    onEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onReadAloud: vi.fn(),
    onRate: vi.fn(),
    onRegenerate: vi.fn(),
  };
}

describe("ChatMessageRow", () => {
  it("renders a user bubble with copy and edit actions", async () => {
    const user = userEvent.setup();
    const props = rowProps(userMessage);
    render(<ChatMessageRow {...props} />);
    expect(screen.getByText("Why is my blood pressure high?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await user.click(screen.getByRole("button", { name: "Edit and resubmit" }));
    expect(props.onCopy).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders assistant markdown and action buttons", async () => {
    const user = userEvent.setup();
    const props = rowProps(assistantMessage);
    render(<ChatMessageRow {...props} />);
    expect(screen.getByText("rises naturally")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Helpful" }));
    await user.click(screen.getByRole("button", { name: "Regenerate response" }));
    expect(props.onRate).toHaveBeenCalledWith(1);
    expect(props.onRegenerate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/ChatMessageRow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Edit3,
  RefreshCw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react";

import { cn } from "@/portal/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
}

function actionClass(active?: boolean, activeClass?: string) {
  return cn(
    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text",
    active && activeClass,
  );
}

export function ChatMessageRow({
  message,
  isLastAssistant,
  busy,
  copied,
  editing,
  rating,
  onCopy,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onReadAloud,
  onRate,
  onRegenerate,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  busy: boolean;
  copied: boolean;
  editing: boolean;
  rating?: 1 | -1;
  onCopy: () => void;
  onEdit: () => void;
  onSaveEdit: (text: string) => void;
  onCancelEdit: () => void;
  onReadAloud: () => void;
  onRate: (value: 1 | -1) => void;
  onRegenerate: () => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="group/row flex w-full justify-end">
        <div className="flex max-w-[88%] flex-col items-end sm:max-w-[80%]">
          <div className="rounded-2xl rounded-tr-md bg-brand px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-[var(--shadow-brand)]">
            {editing ? (
              <EditUserBubble
                value={message.body}
                onCancel={onCancelEdit}
                onSave={onSaveEdit}
              />
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
            )}
          </div>
          {!editing ? (
            <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
              <button
                type="button"
                onClick={onCopy}
                title="Copy"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text"
              >
                {copied ? (
                  <>
                    <Check size={12} aria-hidden className="text-success" />
                    <span className="text-success">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} aria-hidden />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onEdit}
                title="Edit and resubmit"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <Edit3 size={12} aria-hidden />
                <span>Edit</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group/row flex w-full items-start gap-3">
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-brand)]"
        style={{ background: "linear-gradient(135deg, #0284c7, #38bdf8)" }}
      >
        <Sparkles size={13} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-border bg-white p-3.5 text-[14px] leading-relaxed text-text shadow-[var(--shadow-card)]">
          <FormattedMessage content={message.body} />
        </div>

        <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
          <button
            type="button"
            onClick={onCopy}
            title="Copy"
            aria-label="Copy message"
            className={actionClass(copied, "text-success")}
          >
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={onReadAloud}
            title="Read aloud"
            aria-label="Read aloud"
            className={actionClass()}
          >
            <Volume2 size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onRate(1)}
            title="Helpful"
            aria-label="Helpful"
            aria-pressed={rating === 1}
            className={actionClass(rating === 1, "text-success")}
          >
            <ThumbsUp
              size={13}
              aria-hidden
              className={cn(rating === 1 && "fill-success")}
            />
          </button>
          <button
            type="button"
            onClick={() => onRate(-1)}
            title="Not helpful"
            aria-label="Not helpful"
            aria-pressed={rating === -1}
            className={actionClass(rating === -1, "text-danger")}
          >
            <ThumbsDown
              size={13}
              aria-hidden
              className={cn(rating === -1 && "fill-danger")}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                void navigator.clipboard.writeText(window.location.href);
              }
            }}
            title="Share"
            aria-label="Share conversation"
            className={actionClass()}
          >
            <Share2 size={13} aria-hidden />
          </button>
          {isLastAssistant && !busy ? (
            <button
              type="button"
              onClick={onRegenerate}
              title="Regenerate response"
              aria-label="Regenerate response"
              className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold text-brand hover:bg-brand-soft"
            >
              <RefreshCw size={12} aria-hidden />
              <span>Regenerate</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EditUserBubble({
  value,
  onCancel,
  onSave,
}: {
  value: string;
  onCancel: () => void;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="flex min-w-[220px] flex-col gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={Math.min(6, Math.max(2, draft.split("\n").length))}
        className="w-full resize-none rounded-xl border border-white/40 bg-white px-3 py-2 text-[14px] text-text focus:outline-none"
        autoFocus
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 rounded-lg px-3 text-[12px] font-medium text-white/90 hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft.trim())}
          disabled={!draft.trim()}
          className="h-7 rounded-lg bg-white px-3 text-[12px] font-bold text-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save &amp; submit
        </button>
      </div>
    </div>
  );
}

function FormattedMessage({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/);
  return (
    <div className="space-y-3">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n");
        const isList = lines.every((line) => {
          const t = line.trim();
          return (
            t === "" ||
            t.startsWith("- ") ||
            t.startsWith("* ") ||
            /^\d+\.\s/.test(t)
          );
        });

        if (isList && lines.some((l) => l.trim() !== "")) {
          const nonEmpty = lines.filter((l) => l.trim() !== "");
          return (
            <ul key={pIdx} className="list-disc space-y-1 pl-5 text-text">
              {nonEmpty.map((line, lIdx) => {
                const text = line.replace(/^\s*[-*]\s+|\s*\d+\.\s+/, "");
                return (
                  <li key={lIdx} className="leading-relaxed">
                    <InlineFormat text={text} />
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={pIdx} className="whitespace-pre-wrap break-words leading-relaxed">
            <InlineFormat text={para} />
          </p>
        );
      })}
    </div>
  );
}

function InlineFormat({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-semibold text-text">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return (
            <em key={idx} className="italic text-text-soft">
              {part.slice(1, -1)}
            </em>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={idx}
              className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-text"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/ChatMessageRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/ChatMessageRow.tsx apps/marketing/src/patient/components/ai/ChatMessageRow.test.tsx
git commit -m "feat(patient-ai): add ChatMessageRow"
```

---

### Task 4: `ChatComposer`

**Files:**
- Create: `apps/marketing/src/patient/components/ai/ChatComposer.tsx`
- Create: `apps/marketing/src/patient/components/ai/ChatComposer.test.tsx`

**Interfaces:**
- Produces: `ChatComposer({ value, onChange, onSend, onStop, busy, useEhr, onToggleEhr, focusToken })`
- Behavior: autosizing textarea; Enter sends, Shift+Enter newlines; send disabled when empty; Stop replaces Send while busy; EHR toggle is the only toolbar control (attach/mic removed). `focusToken` increments to re-focus the textarea (the composer owns its ref — ESLint `react-hooks/immutability` forbids mutating a ref passed as a prop).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ChatComposer } from "./ChatComposer";

function Harness({ onSend }: { onSend: () => void }) {
  const [value, setValue] = useState("");
  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSend={onSend}
      onStop={vi.fn()}
      busy={false}
      useEhr
      onToggleEhr={vi.fn()}
    />
  );
}

describe("ChatComposer", () => {
  it("sends with Enter but not Shift+Enter", () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    const textarea = screen.getByLabelText("Message HealthHub");

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("keeps send disabled until text is present", async () => {
    const user = userEvent.setup();
    render(<Harness onSend={vi.fn()} />);
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Message HealthHub"), "Hi");
    expect(send).not.toBeDisabled();
  });

  it("toggles EHR sync", async () => {
    const user = userEvent.setup();
    const onToggleEhr = vi.fn();
    render(
      <ChatComposer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        busy={false}
        useEhr
        onToggleEhr={onToggleEhr}
      />,
    );
    await user.click(screen.getByRole("button", { name: /EHR/i }));
    expect(onToggleEhr).toHaveBeenCalledWith(false);
  });

  it("shows Stop while busy", () => {
    render(
      <ChatComposer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        busy
        useEhr
        onToggleEhr={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Stop/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/ChatComposer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, ShieldCheck, Square } from "lucide-react";

import { cn } from "@/portal/lib/utils";

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  useEhr,
  onToggleEhr,
  focusToken = 0,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  useEhr: boolean;
  onToggleEhr: (value: boolean) => void;
  focusToken?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => {
    if (focusToken > 0) textareaRef.current?.focus();
  }, [focusToken]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <footer className="shrink-0 px-3 pb-4 pt-2 sm:px-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col rounded-3xl border border-border bg-white shadow-[var(--shadow-card)] transition-all focus-within:border-brand/40 focus-within:shadow-[var(--shadow-md)]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message HealthHub…"
            rows={1}
            aria-label="Message HealthHub"
            className="w-full resize-none border-0 bg-transparent px-4 pb-1.5 pt-3 text-[14.5px] leading-relaxed text-text placeholder:text-text-muted focus:outline-none"
            style={{ maxHeight: 220 }}
          />

          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <button
              type="button"
              onClick={() => onToggleEhr(!useEhr)}
              title={
                useEhr
                  ? "EHR sync on — your records will be used to ground the answer"
                  : "EHR sync off — generic answer"
              }
              aria-label="Toggle EHR sync"
              aria-pressed={useEhr}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-pill border px-2.5 text-[12px] font-semibold transition-colors",
                useEhr
                  ? "border-success/30 bg-success-soft text-success"
                  : "border-border bg-white text-text-soft hover:bg-surface-2",
              )}
            >
              <ShieldCheck size={13} aria-hidden />
              <span className="hidden sm:inline">EHR</span>
            </button>

            {busy ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generating"
                className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-ink px-3 text-[12px] font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                <Square size={11} aria-hidden className="fill-white" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!value.trim()}
                onClick={onSend}
                aria-label="Send message"
                title="Send (Enter)"
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full transition-all",
                  value.trim()
                    ? "bg-brand text-white shadow-[var(--shadow-brand)] hover:bg-brand-strong"
                    : "cursor-not-allowed bg-surface-3 text-text-muted",
                )}
              >
                <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-text-muted">
          HealthHub AI can make mistakes. Verify clinical decisions with your
          physician.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai/ChatComposer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/ai/ChatComposer.tsx apps/marketing/src/patient/components/ai/ChatComposer.test.tsx
git commit -m "feat(patient-ai): add ChatComposer"
```

---

### Task 5: Rewire `chat/page.tsx` + page test

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/ai/chat/page.tsx` (full rewrite, ~250 lines)
- Test: `apps/marketing/src/app/patient/(app)/ai/chat/page.test.tsx` (new)

**Interfaces:**
- Consumes: `ChatShellHeader`/`CHAT_MODELS`/`ChatModelId` (Task 1), `ChatEmptyState` (Task 2), `ChatMessageRow`/`ChatMessage` (Task 3), `ChatComposer` (Task 4), `usePatientProfile`.
- Produces: same behavior as before — `POST /ai/chat`, `?prompt=` auto-send, session id, regenerate, ratings, copy, read-aloud, reset.

- [ ] **Step 1: Write the failing page test**

Create `apps/marketing/src/app/patient/(app)/ai/chat/page.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { apiMock, searchParamsMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  searchParamsMock: { current: new URLSearchParams() },
}));

vi.mock("@/portal/lib/api", () => ({
  api: apiMock,
  ApiError: class ApiError extends Error {},
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock.current,
}));

vi.mock("@/patient/hooks", () => ({
  usePatientProfile: () => ({
    data: { patient: { patients: { id: "p1" }, users: { name: "Anya Perera" } } },
    isLoading: false,
  }),
}));

import AiChatPage from "./page";

describe("AiChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsMock.current = new URLSearchParams();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows the greeting empty state", () => {
    render(<AiChatPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Anya/ }),
    ).toBeTruthy();
    expect(screen.getByText(/Care Chat/i)).toBeTruthy();
  });

  it("sends a typed message and renders the reply", async () => {
    apiMock.mockResolvedValue({ reply: "Take your medication with food." });
    const user = userEvent.setup();
    render(<AiChatPage />);

    await user.type(
      screen.getByLabelText("Message HealthHub"),
      "How do I take my meds?",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "/ai/chat",
        expect.objectContaining({
          method: "POST",
          json: expect.objectContaining({ message: "How do I take my meds?" }),
        }),
      ),
    );
    expect(
      await screen.findByText("Take your medication with food."),
    ).toBeTruthy();
  });

  it("auto-sends the ?prompt= from the hub", async () => {
    apiMock.mockResolvedValue({ reply: "Here is your answer." });
    searchParamsMock.current = new URLSearchParams({ prompt: "Hello from hub" });
    render(<AiChatPage />);

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "/ai/chat",
        expect.objectContaining({
          json: expect.objectContaining({ message: "Hello from hub" }),
        }),
      ),
    );
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/ai/chat/page.test.tsx"`
Expected: FAIL — the current page does not render the `Care Chat` header or accept these selectors (and would call the real `api` wrapper).

- [ ] **Step 3: Rewrite the page**

Replace the entire contents of `apps/marketing/src/app/patient/(app)/ai/chat/page.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowDown, Sparkles, X } from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { ChatComposer } from "@/patient/components/ai/ChatComposer";
import { ChatEmptyState } from "@/patient/components/ai/ChatEmptyState";
import {
  ChatMessageRow,
  type ChatMessage,
} from "@/patient/components/ai/ChatMessageRow";
import {
  ChatShellHeader,
  type ChatModelId,
} from "@/patient/components/ai/ChatShellHeader";

export default function AiChatPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const patientName = profile.data?.patient.users.name ?? "Patient";
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rating, setRating] = useState<Record<string, 1 | -1 | undefined>>({});
  const [modelId, setModelId] = useState<ChatModelId>("wellness-72");
  const [useEhr, setUseEhr] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const [focusToken, setFocusToken] = useState(0);
  const initialPromptSent = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
  }

  function scrollToBottom() {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  async function sendMessage(text: string) {
    if (!text.trim() || busy) return;
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      body: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        message: userMsg.body,
        model: modelId,
        useEhr,
      };
      if (patientId) payload.patientId = patientId;
      if (sessionId) payload.sessionId = sessionId;

      const res = await api<{
        reply?: string;
        message?: { body: string };
        sessionId?: string;
      }>("/ai/chat", { method: "POST", json: payload });

      if (res.sessionId) setSessionId(res.sessionId);
      const replyText =
        res.reply ??
        res.message?.body ??
        "I have reviewed your clinical records and synthesized an assessment for you.";

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          body: replyText,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "The AI assistant is taking longer than usual. Please try again.",
      );
    } finally {
      setBusy(false);
      requestAnimationFrame(() => setFocusToken((t) => t + 1));
    }
  }

  function stopGeneration() {
    setBusy(false);
  }

  function regenerate() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === "user");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.slice(0, realIdx);
    });
    void sendMessage(lastUser.body);
  }

  useEffect(() => {
    const prompt = searchParams.get("prompt")?.trim();
    if (!prompt || initialPromptSent.current) return;
    initialPromptSent.current = true;
    void sendMessage(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function resetChat() {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setInput("");
    setRating({});
    initialPromptSent.current = true;
    setFocusToken((t) => t + 1);
  }

  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  function readAloud(text: string) {
    if (typeof window === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(
      text.replace(/[*#_`>]/g, "").slice(0, 2000),
    );
    window.speechSynthesis?.speak(utterance);
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-text">
      <ChatShellHeader
        modelId={modelId}
        onModelChange={setModelId}
        onNewChat={resetChat}
        hasMessages={hasMessages}
      />

      <div ref={listRef} onScroll={handleScroll} className="relative min-h-0 flex-1 overflow-y-auto">
        {!hasMessages ? (
          <ChatEmptyState
            firstName={patientName.split(" ")[0]}
            disabled={busy}
            onPrompt={(query) => void sendMessage(query)}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
            {messages.map((m, idx) => (
              <ChatMessageRow
                key={m.id}
                message={m}
                isLastAssistant={
                  m.role === "assistant" && idx === messages.length - 1
                }
                busy={busy}
                copied={copiedId === m.id}
                editing={editingId === m.id}
                rating={rating[m.id]}
                onCopy={() => void copyMessage(m.id, m.body)}
                onEdit={() => setEditingId(m.id)}
                onSaveEdit={(text) => {
                  setEditingId(null);
                  setMessages((prev) => prev.slice(0, idx));
                  void sendMessage(text);
                }}
                onCancelEdit={() => setEditingId(null)}
                onReadAloud={() => readAloud(m.body)}
                onRate={(value) =>
                  setRating((prev) => {
                    const next = { ...prev };
                    if (next[m.id] === value) delete next[m.id];
                    else next[m.id] = value;
                    return next;
                  })
                }
                onRegenerate={regenerate}
              />
            ))}

            {busy ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3"
              >
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-brand)]"
                  style={{
                    background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                  }}
                >
                  <Sparkles size={13} className="animate-spin" />
                </span>
                <div className="flex items-center gap-1.5 pt-2">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      aria-hidden
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {showScrollDown ? (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-border bg-white text-text-soft shadow-[var(--shadow-md)] transition-colors hover:text-brand"
          >
            <ArrowDown size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs font-medium text-danger"
          >
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircle size={14} aria-hidden className="shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const last = [...messages]
                    .reverse()
                    .find((m) => m.role === "user");
                  setError(null);
                  if (last) {
                    setInput(last.body);
                    setFocusToken((t) => t + 1);
                  }
                }}
                className="text-[11px] font-bold text-danger underline underline-offset-2 hover:opacity-80"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="text-danger hover:opacity-70"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={() => void sendMessage(input)}
        onStop={stopGeneration}
        busy={busy}
        useEhr={useEhr}
        onToggleEhr={setUseEhr}
        focusToken={focusToken}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the page test and chat-related suites**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/ai/chat/page.test.tsx" src/patient/components/ai`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/ai/chat/page.tsx" "apps/marketing/src/app/patient/(app)/ai/chat/page.test.tsx"
git commit -m "feat(patient-ai): rebuild chat as full-bleed studio"
```

---

### Task 6: Verification sweep for Plan B

- [ ] **Step 1: Suites for touched areas**

Run: `cd apps/marketing && bunx vitest run src/patient/components/ai src/patient/hooks src/patient/parity.test.ts`
Expected: PASS.

- [ ] **Step 2: Lint + types on touched files**

Run: `cd apps/marketing && bunx eslint src/patient/components/ai "src/app/patient/(app)/ai/chat"`
Run: `cd apps/marketing && bunx tsc --noEmit 2>&1 | grep -E "patient/components/ai|patient/\(app\)/ai" || echo "no new type errors"`
Expected: no lint output; no matching type errors.

- [ ] **Step 3: Dev smoke (reuse the running dev server if present)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/patient/ai/chat`
Expected: `200`. Open `/patient/ai/chat` in the browser: empty greeting, starter cards run, composer sends, model menu switches, New chat resets, EHR toggle works, full-bleed (no page padding).

## Plan B Done Criteria

- `chat/page.tsx` ≤ ~260 lines and renders via the four extracted components.
- All behavior preserved: `?prompt=` auto-send, session id, regenerate, ratings, copy, read-aloud, reset.
- Component tests + page test pass; lint/type clean in touched paths; route serves 200 full-bleed.
