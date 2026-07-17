"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  Calculator,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Input, Field } from "@/portal/components/ui/Form";
import { formatLkr } from "@/portal/lib/format";

const PRE_EXISTING = [
  { value: "diabetes", label: "Diabetes" },
  { value: "hypertension", label: "Hypertension" },
  { value: "asthma", label: "Asthma" },
  { value: "heart_disease", label: "Heart disease" },
  { value: "cancer_history", label: "Cancer history" },
  { value: "kidney_disease", label: "Kidney disease" },
];

interface QuoteResult {
  monthlyPremiumLkr: number;
  annualPremiumLkr: number;
  basePremiumLkr: number;
  adjustmentsLkr: number;
  billingCycle: string;
}

export default function QuotePage() {
  return (
    <Suspense fallback={<Card className="h-64 animate-pulse" />}>
      <QuotePageInner />
    </Suspense>
  );
}

function QuotePageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const planId = search.get("planId");
  const cycle = (search.get("cycle") as "monthly" | "annual") ?? "annual";

  const [step, setStep] = useState(1);
  const [age, setAge] = useState(30);
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [members, setMembers] = useState<
    Array<{ name: string; age: number; relation: string }>
  >([]);
  const [preExisting, setPreExisting] = useState<string[]>([]);

  const [memberName, setMemberName] = useState("");
  const [memberAge, setMemberAge] = useState("");

  const planQ = useQuery({
    queryKey: ["insurance", "plan", planId],
    queryFn: () =>
      api<{ plan: { id: string; name: string; monthlyPremiumLkr: number; annualPremiumLkr: number; providerName: string } }>(
        `/insurance-marketplace/plans/${planId}`,
      ),
    enabled: !!planId,
  });

  const quoteMut = useMutation({
    mutationFn: () =>
      api<{ quote: QuoteResult }>("/insurance-marketplace/quote", {
        method: "POST",
        json: {
          planId,
          billingCycle: cycle,
          memberAge: age,
          memberGender: gender,
          members: members.length ? members : undefined,
          preExisting: preExisting.length ? preExisting : undefined,
        },
      }),
  });

  if (!planId) {
    return (
      <Card className="text-center py-12">
        <Calculator size={28} className="mx-auto text-text-muted" />
        <p className="text-sm text-text-soft mt-2">
          No plan selected. Pick a plan first.
        </p>
        <button
          onClick={() => router.push("/portal/me/insurance/marketplace")}
          className="text-xs text-brand hover:text-brand-strong font-semibold mt-3 inline-block"
        >
          Browse marketplace
        </button>
      </Card>
    );
  }

  const plan = planQ.data?.plan;
  const quote = quoteMut.data?.quote;

  return (
    <div className="space-y-5 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold text-text">Personalised quote</h1>
        {plan ? (
          <p className="text-sm text-text-soft mt-0.5">
            {plan.name} · {plan.providerName}
          </p>
        ) : null}
      </header>

      <Stepper step={step} steps={["About you", "Members", "Pre-existing", "Quote"]} />

      {step === 1 ? (
        <Card className="space-y-4">
          <h2 className="font-bold text-text">About you</h2>
          <Field label="Age">
            <Input
              type="number"
              value={age}
              onChange={(e) => setAge(Number(e.target.value) || 30)}
            />
          </Field>
          <Field label="Gender">
            <div className="flex flex-wrap gap-2">
              {(["male", "female", "other"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`text-sm px-3 py-1.5 rounded-md border ${
                    gender === g
                      ? "bg-brand-soft border-brand text-brand-strong font-semibold"
                      : "border-border text-text-soft"
                  }`}
                >
                  {g[0].toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)}>
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-4">
          <h2 className="font-bold text-text">Family members</h2>
          <p className="text-xs text-text-soft">
            Add any family members to be covered. Skip if individual.
          </p>
          {members.length > 0 ? (
            <ul className="space-y-1.5">
              {members.map((m, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-md text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium text-text">{m.name}</div>
                    <div className="text-[11px] text-text-muted">
                      {m.relation}, age {m.age}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setMembers(members.filter((_, j) => j !== i))
                    }
                    className="text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Name"
            />
            <Input
              value={memberAge}
              onChange={(e) => setMemberAge(e.target.value)}
              placeholder="Age"
              type="number"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!memberName || !memberAge) return;
              setMembers([
                ...members,
                {
                  name: memberName,
                  age: Number(memberAge) || 30,
                  relation: "spouse",
                },
              ]);
              setMemberName("");
              setMemberAge("");
            }}
          >
            <Plus size={14} />
            Add member
          </Button>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ChevronLeft size={14} />
              Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="space-y-4">
          <h2 className="font-bold text-text">Pre-existing conditions</h2>
          <p className="text-xs text-text-soft">
            Disclosure affects premium and waiting periods. Skip if none.
          </p>
          <div className="flex flex-wrap gap-2">
            {PRE_EXISTING.map((p) => {
              const on = preExisting.includes(p.value);
              return (
                <button
                  key={p.value}
                  onClick={() =>
                    setPreExisting(
                      on
                        ? preExisting.filter((v) => v !== p.value)
                        : [...preExisting, p.value],
                    )
                  }
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    on
                      ? "bg-brand text-white border-brand font-semibold"
                      : "bg-surface-1 text-text-soft border-border/60"
                  }`}
                >
                  {on ? <Check size={10} className="inline mr-1" /> : null}
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ChevronLeft size={14} />
              Back
            </Button>
            <Button
              onClick={() => {
                setStep(4);
                quoteMut.mutate();
              }}
              loading={quoteMut.isPending}
            >
              See premium
              <ChevronRight size={14} />
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="space-y-4">
          <h2 className="font-bold text-text">Your premium</h2>
          {quoteMut.isPending ? (
            <p className="text-sm text-text-soft">Calculating…</p>
          ) : quoteMut.isError ? (
            <div className="text-sm text-red-600">
              Could not calculate. Please retry.
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => quoteMut.mutate()}
              >
                Retry
              </Button>
            </div>
          ) : quote ? (
            <>
              <div className="text-center py-4">
                <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold">
                  {cycle === "annual" ? "Annual" : "Monthly"} premium
                </div>
                <div className="text-5xl font-bold text-brand-strong mt-2">
                  {formatLkr(
                    cycle === "annual"
                      ? quote.annualPremiumLkr
                      : quote.monthlyPremiumLkr,
                  )}
                </div>
                <div className="text-sm text-text-soft mt-1">
                  {cycle === "annual"
                    ? `${formatLkr(quote.monthlyPremiumLkr)} / month equivalent`
                    : `${formatLkr(quote.annualPremiumLkr)} / year equivalent`}
                </div>
              </div>
              <div className="space-y-1.5 pt-4 border-t border-border/60">
                <div className="flex justify-between text-sm">
                  <span className="text-text-soft">Base premium</span>
                  <span className="text-text font-medium">
                    {formatLkr(quote.basePremiumLkr)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-soft">Adjustments</span>
                  <span
                    className={`font-medium ${
                      quote.adjustmentsLkr > 0 ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {quote.adjustmentsLkr > 0 ? "+" : ""}
                    {formatLkr(quote.adjustmentsLkr)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between pt-4 border-t border-border/60">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  <ChevronLeft size={14} />
                  Back
                </Button>
                <Button
                  onClick={() =>
                    router.push(
                      `/portal/me/insurance/enroll/${planId}?cycle=${cycle}`,
                    )
                  }
                >
                  <Wallet size={14} />
                  Enrol with this quote
                </Button>
              </div>
            </>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Stepper({
  step,
  steps,
}: {
  step: number;
  steps: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < step;
        const active = idx === step;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-brand text-white"
                    : "bg-surface-2 text-text-muted"
              }`}
            >
              {done ? <Check size={12} /> : idx}
            </div>
            <div
              className={`text-xs font-medium truncate ${
                active
                  ? "text-text"
                  : done
                    ? "text-text-soft"
                    : "text-text-muted"
              }`}
            >
              {label}
            </div>
            {i < steps.length - 1 ? (
              <div
                className={`flex-1 h-px ${done ? "bg-emerald-500" : "bg-border"}`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}