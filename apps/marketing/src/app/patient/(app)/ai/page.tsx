"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  FileText,
  FlaskConical,
  Pill,
  ScanLine,
  Sparkles,
  Stethoscope,
  Syringe,
  TrendingUp,
} from "lucide-react";

import { useMedications, usePatientProfile } from "@/patient/hooks";
import { PageHero } from "@/patient/components/primitives/PageHero";
import { Card } from "@/patient/components/primitives/Card";
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-1 pb-8 pt-1 sm:gap-7 sm:px-2">
      {/* Hero + command center */}
      <PageHero
        icon={<Sparkles size={13} aria-hidden />}
        kicker="Clinical intelligence"
        title="AI health assistant"
        description="Summaries, medication safety checks and lab explanations grounded in your health record — private by design and never a replacement for your physician."
        footer={
          <>
            {TRUST.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </>
        }
      />

      <Card>
        <AiCommandBar
          promptsLabel="Try"
          onSubmit={goToChat}
          quickPrompts={[
            {
              label: "Summarize my record",
              icon: <FileText size={13} className="text-sky-200" aria-hidden />,
              onSelect: () => runQuickPrompt("summary"),
            },
            {
              label: "Explain my lab results",
              icon: <FlaskConical size={13} className="text-emerald-200" aria-hidden />,
              onSelect: () => runQuickPrompt("lab"),
            },
            {
              label: "Check my medications",
              icon: <Pill size={13} className="text-amber-200" aria-hidden />,
              onSelect: () => runQuickPrompt("meds"),
            },
            {
              label: "Prepare for my visit",
              icon: <Stethoscope size={13} className="text-indigo-200" aria-hidden />,
              onSelect: () => runQuickPrompt("chat"),
            },
          ]}
        />
      </Card>

      {/* Primary tools */}
      <section className="anim-rise anim-rise-delay-1 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className="t-label">Start here</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-text md:text-xl">
              Your record, doing the work
            </h2>
          </div>
          <p className="hidden max-w-xs pb-0.5 text-right text-xs leading-relaxed text-text-muted sm:block">
            Instant briefings and safety checks generated from your live EMR.
          </p>
        </div>
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
      </section>

      {/* Tool directory */}
      <section className="anim-rise anim-rise-delay-2 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className="t-label">AI toolkit</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-text md:text-xl">
              Specialized assistants
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-bold text-text-soft shadow-2xs">
            {TOOLS.length} tools
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <AiToolCard key={tool.href} {...tool} />
          ))}
        </div>
      </section>

      <AiSafetyNotice className="anim-rise anim-rise-delay-3" />
    </div>
  );
}
