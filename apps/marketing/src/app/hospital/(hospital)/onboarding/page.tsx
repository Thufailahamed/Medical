"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";

const STORAGE_KEY = "healthcare-hospital-onboarded";

export default function OnboardingPage() {
  const router = useRouter();
  const locale = useAuthStore((s) => s.locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: tr(locale, "onboarding.step1Title"), body: tr(locale, "onboarding.step1Body") },
    { title: tr(locale, "onboarding.step2Title"), body: tr(locale, "onboarding.step2Body") },
    { title: tr(locale, "onboarding.step3Title"), body: tr(locale, "onboarding.step3Body") },
  ];

  function next() {
    if (step < steps.length - 1) setStep(step + 1);
    else finish();
  }

  function skip() {
    finish();
  }

  function finish() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    router.push("/hospital/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <Pill tone="success">{tr(locale, "onboarding.welcome")}</Pill>
        <h2 className="mt-4 text-2xl font-semibold">{steps[step].title}</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{steps[step].body}</p>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-8 rounded-full ${
                  i === step ? "bg-[var(--accent-600)]" : "bg-[var(--border)]"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={skip}>
              {tr(locale, "onboarding.skip")}
            </Button>
            <Button onClick={next}>
              {step === steps.length - 1
                ? tr(locale, "onboarding.finish")
                : tr(locale, "common.next")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}