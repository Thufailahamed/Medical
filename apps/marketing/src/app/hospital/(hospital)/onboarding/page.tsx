"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";

const STORAGE_KEY = "healthcare-hospital-onboarded";

export default function OnboardingPage() {
  const t = useT();
  const router = useRouter();
  const locale = useAuthStore((s) => s.locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t("onboarding.step1Title"), body: t("onboarding.step1Body") },
    { title: t("onboarding.step2Title"), body: t("onboarding.step2Body") },
    { title: t("onboarding.step3Title"), body: t("onboarding.step3Body") },
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
        <Pill tone="success">{t("onboarding.welcome")}</Pill>
        <h2 className="mt-4 text-2xl font-semibold">{steps[step].title}</h2>
        <p className="mt-2 text-sm text-text-muted">{steps[step].body}</p>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-8 rounded-full ${
                  i === step ? "bg-brand" : "bg-surface-2"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={skip}>
              {t("onboarding.skip")}
            </Button>
            <Button onClick={next}>
              {step === steps.length - 1
                ? t("onboarding.finish")
                : t("common.next")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}