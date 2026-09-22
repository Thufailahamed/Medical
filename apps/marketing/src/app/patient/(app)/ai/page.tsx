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
import { cn } from "@/portal/lib/utils";
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
      <section className="dashboard-hero anim-rise relative overflow-hidden rounded-3xl p-6 text-white shadow-xl md:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.28) 0%, transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/3 md:block"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1.4px)",
            backgroundSize: "20px 20px",
            maskImage:
              "linear-gradient(to left, rgba(0,0,0,0.9) 35%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to left, rgba(0,0,0,0.9) 35%, transparent)",
          }}
        />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex max-w-3xl flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-100 backdrop-blur-md shadow-2xs">
              <Sparkles size={12} className="text-sky-300" aria-hidden />
              Clinical intelligence
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
                AI health{" "}
                <span className="bg-gradient-to-r from-sky-200 via-cyan-100 to-emerald-200 bg-clip-text text-transparent">
                  assistant
                </span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-normal leading-relaxed text-white/85 md:text-[15px]">
                Summaries, medication safety checks and lab explanations
                grounded in your health record — private by design and never a
                replacement for your physician.
              </p>
            </div>

            <AiCommandBar
              className="mt-1"
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

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-white/15 pt-4">
              {TRUST.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/85"
                >
                  <span
                    aria-hidden
                    className="grid h-6 w-6 place-items-center rounded-lg border border-white/15 bg-white/10 text-sky-200"
                  >
                    <Icon size={12} />
                  </span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Decorative constellation of the tool icons */}
          <div aria-hidden className="relative hidden lg:block">
            <div
              className="absolute inset-0 -m-10 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(125,211,252,0.18) 0%, transparent 65%)",
              }}
            />
            <div className="relative grid grid-cols-2 gap-4">
              {TOOLS.map((tool, i) => (
                <div key={tool.href} className={cn(i % 2 === 1 && "translate-y-5")}>
                  <div
                    className="anim-pulse-soft grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-sky-100 shadow-lg backdrop-blur-md"
                    style={{ animationDelay: `${i * 0.45}s` }}
                  >
                    {tool.icon}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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
