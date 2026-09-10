"use client";

import {
  FlaskConical,
  HeartPulse,
  Pill,
  Sparkles,
  Stethoscope,
} from "lucide-react";

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
