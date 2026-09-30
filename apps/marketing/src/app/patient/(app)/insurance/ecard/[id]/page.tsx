"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Copy,
  CreditCard,
  Hospital,
  Phone,
  Share2,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDate, formatLkr } from "@/portal/lib/format";
import {
  EmptyBlock,
  HERO_CHIP,
  HERO_DANGER_CHIP,
  HERO_GHOST,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";

interface EcardResponse {
  ecard: {
    id: string;
    cardNumber: string;
    qrToken: string;
    issuedAt: string;
    validUntil: string;
    holderName: string | null;
    providerName: string | null;
    planName: string | null;
    policyNumber: string | null;
    coverageAmountLkr: number | null;
  };
  policyNumber: string | null;
  providerName: string | null;
  holderName: string | null;
}

export default function EcardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ["insurance", "ecard", id],
    queryFn: () =>
      api<EcardResponse>(`/insurance-marketplace/enrollments/${id}/ecard`),
  });

  const card = q.data?.ecard;
  const valid = card
    ? new Date(card.validUntil).getTime() > Date.now()
    : false;

  // Generate a data-URL QR client-side so we never depend on a third party.
  useEffect(() => {
    if (!card?.qrToken) {
      setQrUrl("");
      return;
    }
    const payload = JSON.stringify({
      t: card.qrToken,
      p: card.policyNumber,
      c: card.cardNumber,
    });
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#0B1F3A", light: "#FFFFFF" },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }, [card?.qrToken, card?.policyNumber, card?.cardNumber]);

  const copyNumber = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && card) {
      navigator.clipboard.writeText(card.cardNumber).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    }
  };

  const shareCard = () => {
    if (typeof navigator !== "undefined" && "share" in navigator && card) {
      void (navigator as Navigator & { share: (d: { title: string; text: string }) => Promise<void> }).share({
        title: "Insurance E-card",
        text: `${card.providerName ?? "Insurer"} · ${card.policyNumber ?? card.id} · ${card.cardNumber}`,
      });
    }
  };

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href={`/patient/insurance/policy/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Back to policy
        </Link>
      </div>

      {q.isLoading ? (
        <section className={PANEL}>
          <PanelSkeleton rows={4} />
        </section>
      ) : !card ? (
        <section className={PANEL}>
          <EmptyBlock
            icon={<CreditCard size={19} />}
            title="E-card unavailable"
            body="Your digital insurance card could not be loaded. Try again shortly."
          />
        </section>
      ) : (
        <>
          <PatientHero
            kickerIcon={<CreditCard size={13} aria-hidden />}
            kicker="Insurance"
            kickerMeta="Cashless e-card"
            title={
              <>
                {card.providerName ?? "Insurer"}{" "}
                <HeroAccent>{card.planName ? `· ${card.planName}` : ""}</HeroAccent>
              </>
            }
            description={`Present this card at any network hospital for instant cashless admission — the insurer settles directly with the facility.`}
            chips={
              <>
                <span className={valid ? HERO_CHIP : HERO_DANGER_CHIP}>
                  <ShieldCheck size={12} className={valid ? "text-emerald-300" : ""} />
                  {valid ? "Valid & active" : "Inactive"}
                </span>
                <span className={HERO_CHIP}>
                  <Wallet size={12} className="text-sky-300" />
                  {formatLkr(card.coverageAmountLkr ?? 0)} cover
                </span>
                <span className={HERO_CHIP}>Valid till {formatDate(card.validUntil)}</span>
              </>
            }
            actions={
              <>
                <button type="button" onClick={copyNumber} className={HERO_GHOST}>
                  <Copy size={13} /> {copied ? "Copied" : "Copy number"}
                </button>
                <button type="button" onClick={shareCard} className={HERO_GHOST}>
                  <Share2 size={13} /> Share
                </button>
              </>
            }
          />

          <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              icon={<ShieldCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              label="Status"
              value={valid ? "Active" : "Inactive"}
              sub={valid ? "Accepted at network" : "Policy not active"}
              pulse={!valid}
            />
            <StatTile
              icon={<Wallet size={16} />}
              tone="bg-sky-50 text-sky-600"
              label="Coverage"
              value={formatLkr(card.coverageAmountLkr ?? 0)}
              sub="Sum insured"
            />
            <StatTile
              icon={<Building2 size={16} />}
              tone="bg-violet-50 text-violet-600"
              label="Policy"
              value={card.policyNumber ?? card.id.slice(0, 8).toUpperCase()}
              sub={card.providerName ?? "Insurer"}
            />
            <StatTile
              icon={<Hospital size={16} />}
              tone="bg-amber-50 text-amber-600"
              label="Cashless"
              value="Network"
              sub={`Issued ${formatDate(card.issuedAt)}`}
            />
          </HeroOverlap>

          <div className="grid gap-5 xl:grid-cols-12">
            <div className="flex flex-col gap-5 xl:col-span-8">
              {!valid ? (
                <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-amber-900">E-card inactive</div>
                    <div className="mt-0.5 text-sm text-amber-800">
                      E-card is only available when your policy is active. Renew or pay the
                      outstanding premium to re-enable cashless admission.
                    </div>
                  </div>
                </section>
              ) : null}

              <section className={PANEL}>
                <PanelHeader
                  icon={<CreditCard size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="Digital e-card"
                  caption="Scan at network hospitals for cashless admission."
                />
                <div className="mt-5">
                  <div className="relative overflow-hidden rounded-2xl bg-[#0B1F3A] p-6 text-white">
                    <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10" />
                    <div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-white/5" />
                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                            Digital E-Card
                          </div>
                          <div className="mt-1 text-lg font-bold">
                            {card.providerName ?? "Insurer"}
                          </div>
                          <div className="text-xs text-white/80">{card.planName}</div>
                        </div>
                        <ShieldCheck size={28} className="text-white/80" />
                      </div>

                      <div className="mt-8">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                          Policy number
                        </div>
                        <div className="mt-1 font-mono text-2xl font-bold tracking-wider">
                          {card.policyNumber ?? card.id.slice(0, 12).toUpperCase()}
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                            Coverage
                          </div>
                          <div className="text-lg font-bold">
                            {formatLkr(card.coverageAmountLkr ?? 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                            Valid until
                          </div>
                          <div className="text-lg font-bold">{formatDate(card.validUntil)}</div>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col items-center rounded-2xl bg-white p-4">
                        {qrUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrUrl}
                            alt="E-card QR"
                            width={220}
                            height={220}
                            className="rounded-lg"
                          />
                        ) : (
                          <div className="h-[220px] w-[220px] animate-pulse rounded-lg bg-slate-100" />
                        )}
                        <div className="mt-3 font-mono text-lg font-bold tracking-widest text-slate-900">
                          {card.cardNumber}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Scan at network hospitals
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                            Holder
                          </div>
                          <div className="text-sm font-bold">{card.holderName ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                            Issued
                          </div>
                          <div className="text-sm font-bold">{formatDate(card.issuedAt)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside className="flex flex-col gap-5 xl:col-span-4">
              <section className={PANEL}>
                <PanelHeader
                  icon={<Hospital size={16} />}
                  tone="bg-emerald-50 text-emerald-600"
                  title="Cashless admission"
                  caption="How to use this card."
                />
                <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-500">
                  <li className="flex items-start gap-2">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                    Show the QR or policy number at the hospital front desk.
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                    The facility verifies cover directly with your insurer.
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                    No upfront payment — insurer settles the approved amount.
                  </li>
                </ul>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={shareCard}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-500"
                  >
                    <Share2 size={13} /> Share
                  </button>
                  <button
                    type="button"
                    onClick={copyNumber}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    <Copy size={13} /> {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </section>

              <QuickToolsPanel
                id="ecard-tools"
                title="Insurance"
                tools={[
                  {
                    icon: ShieldCheck,
                    label: "My policy",
                    hint: "Full details",
                    href: `/patient/insurance/policy/${id}`,
                    tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
                  },
                  {
                    icon: Wallet,
                    label: "Claims",
                    hint: "File & track",
                    href: "/patient/insurance/claims",
                    tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
                  },
                  {
                    icon: Phone,
                    label: "Insurance hub",
                    hint: "All cover",
                    href: "/patient/insurance",
                    tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
                  },
                ]}
              />
            </aside>
          </div>
        </>
      )}
    </PatientPage>
  );
}
