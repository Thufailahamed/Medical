"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  Plus,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  PromoCard,
} from "@/patient/components/workspace";

const PRE_EXISTING = [
  { value: "diabetes", label: "Diabetes" },
  { value: "hypertension", label: "Hypertension" },
  { value: "asthma", label: "Asthma" },
  { value: "heart_disease", label: "Heart disease" },
  { value: "cancer_history", label: "Cancer history" },
  { value: "kidney_disease", label: "Kidney disease" },
];

interface QuoteResult {
  planId: string | null;
  planName: string | null;
  billingCycle: string;
  basePremiumLkr: number;
  adjustedPremiumLkr: number;
  notes: string[];
  riders: { id: string; name: string; priceLkr: number }[];
}

const STEP_LABELS = ["About you", "Members", "Pre-existing", "Quote"];

export default function QuotePage() {
  return (
    <Suspense
      fallback={
        <PatientPage>
          <div className="h-44 animate-pulse rounded-[20px] bg-slate-100" />
        </PatientPage>
      }
    >
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
      api<QuoteResult>("/insurance-marketplace/quote", {
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

  const plan = planQ.data?.plan;
  const quote = quoteMut.data;

  return (
    <PatientPage>
      <div className="-mb-1">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <PatientHero
        overlap={false}
        kickerIcon={<Calculator size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Personalised quote"
        title={
          <>
            Your <HeroAccent>premium estimate</HeroAccent>
          </>
        }
        description={
          plan
            ? `${plan.name} · ${plan.providerName} · ${cycle} billing`
            : "Pick a plan on the marketplace to estimate your premium."
        }
        chips={
          <>
            <span className={HERO_CHIP}>
              Step {step} of {STEP_LABELS.length}
            </span>
            <span className={HERO_CHIP}>
              {plan ? `${plan.providerName}` : "No plan selected"}
            </span>
          </>
        }
        actions={
          !planId ? (
            <button
              type="button"
              onClick={() => router.push("/patient/insurance/marketplace")}
              className={HERO_GHOST}
            >
              Browse marketplace
            </button>
          ) : undefined
        }
      />

      {!planId ? (
        <section className={PANEL}>
          <div className="flex flex-col items-center py-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
              <Calculator size={24} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">No plan selected</p>
            <p className="mt-1 text-xs text-slate-500">Pick a plan on the marketplace first.</p>
            <button
              type="button"
              onClick={() => router.push("/patient/insurance/marketplace")}
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
            >
              Browse marketplace
            </button>
          </div>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="flex flex-col gap-5 xl:col-span-8">
            <section className={PANEL}>
              <Stepper step={step} steps={STEP_LABELS} />
            </section>

            {step === 1 ? (
              <section className={PANEL}>
                <PanelHeader
                  icon={<HeartPulse size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="About you"
                  caption="Age and gender affect the base premium."
                />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_LABEL}>Age</label>
                    <input
                      type="number"
                      className={FIELD_INPUT}
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value) || 30)}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Gender</label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(["male", "female", "other"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                            gender === g
                              ? "border-sky-500 bg-sky-50 text-sky-700"
                              : "border-slate-200 text-slate-500 hover:border-slate-300",
                          )}
                        >
                          {g[0].toUpperCase() + g.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className={PANEL}>
                <PanelHeader
                  icon={<Users size={16} />}
                  tone="bg-violet-50 text-violet-600"
                  title="Family members"
                  caption="Add members to cover — skip if this is an individual plan."
                />
                {members.length > 0 ? (
                  <ul className="mt-4 space-y-1.5">
                    {members.map((m, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{m.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {m.relation}, age {m.age}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMembers(members.filter((_, j) => j !== i))}
                          className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <input
                    className={FIELD_INPUT}
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Name"
                  />
                  <input
                    className={FIELD_INPUT}
                    value={memberAge}
                    onChange={(e) => setMemberAge(e.target.value)}
                    placeholder="Age"
                    type="number"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!memberName || !memberAge) return;
                    setMembers([
                      ...members,
                      { name: memberName, age: Number(memberAge) || 30, relation: "spouse" },
                    ]);
                    setMemberName("");
                    setMemberAge("");
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  <Plus size={14} /> Add member
                </button>
                <div className="mt-5 flex justify-between border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className={PANEL}>
                <PanelHeader
                  icon={<HeartPulse size={16} />}
                  tone="bg-amber-50 text-amber-600"
                  title="Pre-existing conditions"
                  caption="Disclosure affects premium and waiting periods — skip if none."
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {PRE_EXISTING.map((p) => {
                    const on = preExisting.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() =>
                          setPreExisting(
                            on ? preExisting.filter((v) => v !== p.value) : [...preExisting, p.value],
                          )
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          on
                            ? "border-sky-600 bg-sky-600 text-white"
                            : "border-slate-200 text-slate-500 hover:border-slate-300",
                        )}
                      >
                        {on ? <Check size={10} /> : null}
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex justify-between border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(4);
                      quoteMut.mutate();
                    }}
                    disabled={quoteMut.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    See premium <ChevronRight size={14} />
                  </button>
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section className={PANEL}>
                <PanelHeader
                  icon={<Wallet size={16} />}
                  tone="bg-emerald-50 text-emerald-600"
                  title="Your premium"
                  caption={plan ? `${plan.name} · ${cycle} billing` : undefined}
                />
                {quoteMut.isPending ? (
                  <p className="mt-5 text-sm text-slate-500">Calculating…</p>
                ) : quoteMut.isError ? (
                  <div className="mt-5 text-sm text-rose-600">
                    Could not calculate.{" "}
                    <button
                      type="button"
                      onClick={() => quoteMut.mutate()}
                      className="font-bold text-sky-700 hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : quote ? (
                  <>
                    <div className="py-5 text-center">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {cycle === "annual" ? "Annual" : "Monthly"} premium
                      </div>
                      <div className="mt-2 text-5xl font-bold tracking-tight text-slate-900">
                        {formatLkr(quote.adjustedPremiumLkr)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {cycle === "annual"
                          ? `${formatLkr(quote.adjustedPremiumLkr / 12)} / month equivalent`
                          : `${formatLkr(quote.adjustedPremiumLkr * 12)} / year equivalent`}
                      </div>
                    </div>
                    <div className="space-y-1.5 border-t border-slate-100 pt-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Base premium</span>
                        <span className="font-medium text-slate-900">{formatLkr(quote.basePremiumLkr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Adjustments</span>
                        <span
                          className={cn(
                            "font-medium",
                            quote.adjustedPremiumLkr - quote.basePremiumLkr > 0
                              ? "text-amber-700"
                              : "text-emerald-700",
                          )}
                        >
                          {quote.adjustedPremiumLkr - quote.basePremiumLkr > 0 ? "+" : ""}
                          {formatLkr(quote.adjustedPremiumLkr - quote.basePremiumLkr)}
                        </span>
                      </div>
                      {quote.notes?.length ? (
                        <ul className="list-inside list-disc pt-1 text-xs text-slate-500">
                          {quote.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      ) : null}
                      {quote.riders?.length ? (
                        <div className="space-y-1 pt-1">
                          {quote.riders.map((r) => (
                            <div key={r.id} className="flex justify-between text-xs">
                              <span className="text-slate-500">{r.name}</span>
                              <span className="font-medium text-slate-900">{formatLkr(r.priceLkr)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-5 flex justify-between border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100"
                      >
                        <ChevronLeft size={14} /> Back
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/patient/insurance/enroll/${planId}?cycle=${cycle}`)
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500"
                      >
                        <Wallet size={14} /> Enrol with this quote
                      </button>
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}
          </div>

          <div className="flex flex-col gap-5 xl:col-span-4">
            {plan ? (
              <section className={PANEL}>
                <PanelHeader
                  icon={<Calculator size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="Plan summary"
                  caption={plan.providerName}
                />
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">{plan.name}</div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      {cycle} premium
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {formatLkr(cycle === "annual" ? plan.annualPremiumLkr : plan.monthlyPremiumLkr)}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <PromoCard
              icon={<Wallet size={21} aria-hidden />}
              kicker="Ready?"
              title="Enrol in minutes"
              body="Coverage activates as soon as your first premium clears — e-card issued instantly."
              href="/patient/insurance/marketplace"
            />
          </div>
        </div>
      )}
    </PatientPage>
  );
}

function Stepper({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < step;
        const active = idx === step;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {done ? <Check size={12} /> : idx}
            </div>
            <div
              className={cn(
                "truncate text-xs font-medium",
                active ? "text-slate-900" : done ? "text-slate-500" : "text-slate-400",
              )}
            >
              {label}
            </div>
            {i < steps.length - 1 ? (
              <div className={cn("h-px flex-1", done ? "bg-emerald-500" : "bg-slate-200")} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
