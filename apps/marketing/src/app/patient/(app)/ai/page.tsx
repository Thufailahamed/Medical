"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  FileText,
  FlaskConical,
  Pill,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  TrendingUp,
} from "lucide-react";

import { useMedications, usePatientProfile } from "@/patient/hooks";
import Link from "next/link";
import {
  GROUP_LABEL,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PatientHero,
  PatientPage,
} from "@/patient/components/workspace";
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
  "EMR grounded",
  "Pharmacopeia checked",
  "Private by design",
  "Human review",
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
    () =>
      (meds.data?.medicines ?? [])
        .filter((m) => m.active !== false)
        .map((m) => m.name),
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
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<Sparkles size={13} aria-hidden />}
          kicker="Clinical intelligence"
          kickerMeta={`${TOOLS.length + 2} tools`}
          title={
            <>
              AI health <HeroAccent>assistant</HeroAccent>
            </>
          }
          description="Summaries, medication safety checks and lab explanations grounded in your health record — private by design and never a replacement for your physician."
          chips={
            <>
              {TRUST.map((label) => (
                <span key={label} className={HERO_CHIP}>
                  <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                  {label}
                </span>
              ))}
            </>
          }
          aside={
            <div className="flex min-w-[13.5rem] items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-400 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
                <Pill size={20} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                  Meds in context
                </span>
                <span className="mt-0.5 block text-2xl font-semibold leading-none tracking-[-0.02em] text-white tabular-nums">
                  {activeMedNames.length}
                </span>
                <span className="mt-1 block text-[11px] text-white/55">Active medicines the AI can check</span>
              </span>
            </div>
          }
          actions={
            <Link href="/patient/ai/chat" className={HERO_PRIMARY}>
              <Bot size={15} className="text-violet-600" aria-hidden />
              Open care chat
            </Link>
          }
        />

        {/* Command bar floats over the hero edge, like the stat strip. */}
        <HeroOverlap>
          <div className="rounded-2xl bg-white p-4 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22),inset_0_0_0_1px_rgba(15,23,42,0.07)] sm:p-5">
            <AiCommandBar
              promptsLabel="Try"
              onSubmit={goToChat}
              quickPrompts={[
                {
                  label: "Summarize my record",
                  icon: <FileText size={13} className="text-sky-600" aria-hidden />,
                  onSelect: () => runQuickPrompt("summary"),
                },
                {
                  label: "Explain my lab results",
                  icon: <FlaskConical size={13} className="text-emerald-600" aria-hidden />,
                  onSelect: () => runQuickPrompt("lab"),
                },
                {
                  label: "Check my medications",
                  icon: <Pill size={13} className="text-amber-600" aria-hidden />,
                  onSelect: () => runQuickPrompt("meds"),
                },
                {
                  label: "Prepare for my visit",
                  icon: <Stethoscope size={13} className="text-indigo-600" aria-hidden />,
                  onSelect: () => runQuickPrompt("chat"),
                },
              ]}
            />
          </div>
        </HeroOverlap>
      </div>

      {/* Primary tools */}
      <section className="flex flex-col gap-4" aria-labelledby="ai-start">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className={GROUP_LABEL}>Start here</p>
            <h2 id="ai-start" className="mt-1 text-lg font-semibold tracking-[-0.01em] text-slate-900">
              Your record, doing the work
            </h2>
          </div>
          <p className="hidden max-w-xs pb-0.5 text-right text-xs leading-relaxed text-slate-400 sm:block">
            Instant briefings and safety checks generated from your live EMR.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <HealthSummaryCard ref={summaryRef} patientId={patientId} profileLoading={profile.isLoading} />
          <div ref={drugSectionRef} className="h-full scroll-mt-24">
            <DrugInteractionCard ref={drugRef} activeMedNames={activeMedNames} />
          </div>
        </div>
      </section>

      {/* Tool directory */}
      <section className="flex flex-col gap-4" aria-labelledby="ai-kit">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className={GROUP_LABEL}>AI toolkit</p>
            <h2 id="ai-kit" className="mt-1 text-lg font-semibold tracking-[-0.01em] text-slate-900">
              Specialized assistants
            </h2>
          </div>
          <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
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
    </PatientPage>
  );
}
