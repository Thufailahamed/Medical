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
    hint: "Interactions & timing",
    tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
    icon: Pill,
    query:
      "Are my current active medications safe to take together? Are there any food or timing interactions I should avoid?",
  },
  {
    title: "Explain my labs",
    hint: "Plain-English results",
    tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
    icon: FlaskConical,
    query:
      "Explain my recent lab test results in simple, plain English without confusing medical jargon.",
  },
  {
    title: "Prepare for my visit",
    hint: "Questions to ask",
    tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
    icon: Stethoscope,
    query:
      "What are the most important clinical questions I should ask my doctor at my upcoming consultation?",
  },
  {
    title: "Vitals & trends",
    hint: "Compare to targets",
    tone: "from-rose-500 to-pink-600 shadow-rose-500/30",
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
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_12px_32px_-8px_rgba(99,102,241,0.6)] ring-1 ring-inset ring-white/25"
        >
          <Sparkles size={22} />
        </span>
        <h1 className="text-[clamp(24px,3vw,32px)] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-900">
          How can I help with your health today,{" "}
          <span className="bg-gradient-to-r from-sky-600 to-teal-500 bg-clip-text text-transparent">{firstName}</span>?
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
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
                className="group flex items-center gap-3.5 rounded-2xl bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22),inset_0_0_0_1px_rgba(2,132,199,0.25)] disabled:opacity-60"
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105 ${prompt.tone}`}>
                  <Icon size={17} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-900 group-hover:text-sky-700">
                    {prompt.title}
                  </span>
                  <span className="block text-[11px] text-slate-400">{prompt.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
